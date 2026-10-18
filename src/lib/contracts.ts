import { and, asc, eq, gt } from "drizzle-orm";
import type { PortalDb } from "@/db";
import { contractChecks, contracts, creatorNotifications, creators, deals } from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import {
  APPROVE_FORBIDDEN,
  CONTRACT_CHECKS,
  MAX_CONTRACT_BYTES,
  NEEDS_REVIEW_ERROR,
  PAST_CONTRACT_ERROR,
  acceptedContractFile,
  contractCheckLabel,
  contractStageOpen,
  isContractCheckStatus,
  isSigningFormat,
  signingFormatFor,
  type ContractCheckStatus,
  type SigningFormat,
} from "./contract-shared";
import { firstEmail } from "./creator-interest";
import { setDealStage } from "./deal-stage";
import { driveConfigured, prepareContractsFolder, uploadDriveFile } from "./drive";
import { nowIso } from "./format";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

export type ContractListRow = {
  id: string;
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  version: number;
  filename: string;
  mimeType: string;
  sha256: string | null;
  driveFileId: string | null;
  driveFileUrl: string | null;
  signingFormat: string;
  countersign: boolean;
  status: string;
  uploadedBy: string;
  createdAt: string;
  workflowStage: string | null;
  checklist: Array<{ item: string; status: string; note: string | null }>;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function basename(filename: string) {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  return base.slice(0, 180);
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function loadDeal(db: PortalDb, dealId: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  return rows[0] ?? null;
}

async function loadContract(db: PortalDb, contractId: string) {
  const rows = await db.select().from(contracts).where(eq(contracts.id, contractId));
  return rows[0] ?? null;
}

function blocked(stage: string | null) {
  if (contractStageOpen(stage)) return null;
  return { ok: false as const, status: 409, error: PAST_CONTRACT_ERROR };
}

async function nextVersion(db: PortalDb, dealId: string) {
  const rows = await db.select({ version: contracts.version }).from(contracts).where(eq(contracts.dealId, dealId));
  return rows.reduce((max, row) => Math.max(max, row.version), 0) + 1;
}

export async function saveContract(
  db: PortalDb,
  input: {
    dealId: string;
    filename: string;
    mimeType: string;
    bytes?: Uint8Array | null;
    sha256?: string | null;
    driveFileId?: string | null;
    driveFileUrl?: string | null;
    docusign?: boolean;
    countersign?: boolean;
    actorEmail: string;
    actorRole: string;
  },
): Promise<Result<{ id: string; version: number; signingFormat: SigningFormat; sha256: string | null; workflowStage: string | null }>> {
  if (input.actorRole !== "admin" && input.actorRole !== "bot") {
    return { ok: false, status: 403, error: "You can't upload a contract." };
  }
  const deal = await loadDeal(db, input.dealId);
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const closed = blocked(deal.workflowStage);
  if (closed) return closed;

  const filename = basename(input.filename);
  const mimeType = input.mimeType?.trim() || "application/octet-stream";
  if (!filename || !acceptedContractFile(filename, mimeType)) {
    return { ok: false, status: 400, error: "Upload a PDF or DOCX." };
  }
  const bytes = input.bytes ?? null;
  if (bytes && bytes.byteLength > MAX_CONTRACT_BYTES) {
    return { ok: false, status: 400, error: "That file is over 20 MB." };
  }
  if (input.actorRole !== "bot" && (!bytes || bytes.byteLength === 0)) {
    return { ok: false, status: 400, error: "Upload a PDF or DOCX." };
  }

  const signingFormat = signingFormatFor({ filename, mimeType, docusign: input.docusign });
  const sha256 = bytes && bytes.byteLength > 0 ? await sha256Hex(bytes) : clean(input.sha256);
  const version = await nextVersion(db, deal.id);
  let driveFileId = clean(input.driveFileId);
  let driveFileUrl = clean(input.driveFileUrl);
  let driveFolderId: string | null = null;

  if (!driveFileId && bytes && bytes.byteLength > 0 && driveConfigured()) {
    const creatorRows = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
    const creator = creatorRows[0];
    try {
      driveFolderId = await prepareContractsFolder(db, {
        id: deal.id,
        brand: deal.brand,
        driveFolderId: deal.driveFolderId,
        creatorFolderId: creator?.driveFolderId ?? null,
      });
      const uploaded = await uploadDriveFile({
        folderId: driveFolderId,
        filename: `v${version} ${filename}`,
        mimeType,
        bytes,
      });
      driveFileId = uploaded.fileId;
      driveFileUrl = uploaded.fileUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Drive did not store the contract.";
      return { ok: false, status: 502, error: message };
    }
  }

  const timestamp = nowIso();
  const id = crypto.randomUUID();
  const source = input.actorRole === "bot" ? "bot" : input.docusign ? "docusign" : "upload";
  await db.insert(contracts).values({
    id,
    dealId: deal.id,
    version,
    filename,
    mimeType,
    sizeBytes: bytes ? bytes.byteLength : null,
    sha256,
    driveFileId,
    driveFileUrl,
    driveFolderId,
    source,
    signingFormat,
    countersign: Boolean(input.countersign),
    status: "received",
    uploadedBy: input.actorEmail,
    approvalId: null,
    createdAt: timestamp,
  });
  await db.insert(contractChecks).values(
    CONTRACT_CHECKS.map((item) => ({
      id: crypto.randomUUID(),
      contractId: id,
      item: item.id,
      status: "unchecked",
      note: null,
      createdAt: timestamp,
    })),
  );

  const toStage = version === 1 ? "contract_received" : "revised_contract";
  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage,
    actorEmail: input.actorEmail,
    actorRole: input.actorRole === "bot" ? "bot" : "admin",
    note: `Contract v${version} uploaded.`,
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  return { ok: true, id, version, signingFormat, sha256, workflowStage: moved.workflowStage };
}

export async function saveChecklist(
  db: PortalDb,
  input: {
    contractId: string;
    checks: Array<{ item: string; status: string; note?: string | null }>;
    countersign?: boolean;
    actorEmail: string;
    actorRole: string;
    moveStage?: boolean;
  },
): Promise<Result<{ workflowStage: string | null }>> {
  if (input.actorRole !== "admin") {
    return { ok: false, status: 403, error: "Only an admin can review a contract." };
  }
  const contract = await loadContract(db, input.contractId);
  if (!contract) return { ok: false, status: 404, error: "Contract not found." };
  const deal = await loadDeal(db, contract.dealId);
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const closed = blocked(deal.workflowStage);
  if (closed) return closed;
  for (const check of input.checks) {
    if (!isContractCheckStatus(check.status)) {
      return { ok: false, status: 400, error: "Each checklist item is ok, an issue, or not checked." };
    }
  }

  for (const check of input.checks) {
    const note = clean(check.note);
    await db
      .update(contractChecks)
      .set({ status: check.status, note })
      .where(and(eq(contractChecks.contractId, contract.id), eq(contractChecks.item, check.item)));
  }
  const patch: Partial<typeof contracts.$inferInsert> = {};
  if (typeof input.countersign === "boolean") patch.countersign = input.countersign;
  if (contract.status === "received") patch.status = "in_review";
  if (Object.keys(patch).length > 0) {
    await db.update(contracts).set(patch).where(eq(contracts.id, contract.id));
  }

  const moveStage = input.moveStage !== false;
  if (moveStage && (deal.workflowStage === "contract_received" || deal.workflowStage === "revised_contract")) {
    const moved = await setDealStage(db, {
      dealId: deal.id,
      toStage: "contract_review",
      actorEmail: input.actorEmail,
      actorRole: "admin",
      note: "Checklist updated.",
    });
    if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
    return { ok: true, workflowStage: moved.workflowStage };
  }
  return { ok: true, workflowStage: deal.workflowStage };
}

function revisionBody(input: {
  creatorName: string;
  brand: string;
  issues: Array<{ label: string; note: string | null }>;
  changes: string | null;
}) {
  const lines = input.issues.map((issue) => (issue.note ? `- ${issue.label}: ${issue.note}` : `- ${issue.label}`));
  if (input.changes) lines.push(`- ${input.changes}`);
  return [
    "Hi,",
    "",
    `We reviewed the contract for ${input.creatorName} and ${input.brand}. Please update these points:`,
    "",
    ...lines,
    "",
    "Thanks,",
    "Kamron",
    "Momma Mari",
  ].join("\n");
}

export async function requestContractRevisions(
  db: PortalDb,
  input: {
    contractId: string;
    changes?: string | null;
    brandEmail?: string | null;
    actorEmail: string;
    actorRole: string;
  },
): Promise<Result<{ approvalId: string; workflowStage: string | null }>> {
  if (input.actorRole !== "admin") {
    return { ok: false, status: 403, error: "Only an admin can request contract changes." };
  }
  const contract = await loadContract(db, input.contractId);
  if (!contract) return { ok: false, status: 404, error: "Contract not found." };
  const deal = await loadDeal(db, contract.dealId);
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const closed = blocked(deal.workflowStage);
  if (closed) return closed;

  const saved = await db.select().from(contractChecks).where(eq(contractChecks.contractId, contract.id));
  const issues = saved
    .filter((row) => row.status === "issue")
    .map((row) => ({ label: contractCheckLabel(row.item), note: clean(row.note) }));
  const changes = clean(input.changes);
  if (issues.length === 0 && !changes) {
    return { ok: false, status: 400, error: "Mark at least one checklist item as an issue, or write the changes to request." };
  }
  const brandEmail = firstEmail(input.brandEmail) ?? firstEmail(deal.contact);
  if (!brandEmail) return { ok: false, status: 400, error: "Add the brand email before asking for changes." };

  const creatorRows = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
  const creatorName = creatorRows[0]?.name ?? "the creator";
  const drafted = await createApprovalEmail(
    db,
    {
      dealId: deal.id,
      gate: "revision",
      to: brandEmail,
      subject: `A few changes on the ${deal.brand} contract`,
      body: revisionBody({ creatorName, brand: deal.brand, issues, changes }),
    },
    { email: input.actorEmail, role: "admin" },
  );
  if (!drafted.ok) return { ok: false, status: drafted.status, error: drafted.error };

  await db.update(contracts).set({ status: "revisions_requested", approvalId: drafted.id }).where(eq(contracts.id, contract.id));
  if (!deal.contact) {
    await db.update(deals).set({ contact: brandEmail, updatedAt: nowIso() }).where(eq(deals.id, deal.id));
  }
  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage: "revisions_requested",
    actorEmail: input.actorEmail,
    actorRole: "admin",
    note: "Asked the brand for contract changes.",
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  return { ok: true, approvalId: drafted.id, workflowStage: moved.workflowStage };
}

export async function setSigningFormat(
  db: PortalDb,
  input: { contractId: string; signingFormat: string; actorRole: string },
): Promise<Result<{ signingFormat: SigningFormat }>> {
  if (input.actorRole !== "admin") {
    return { ok: false, status: 403, error: APPROVE_FORBIDDEN };
  }
  if (!isSigningFormat(input.signingFormat)) {
    return { ok: false, status: 400, error: "Signing format must be pdf, docusign, or needs_review." };
  }
  const contract = await loadContract(db, input.contractId);
  if (!contract) return { ok: false, status: 404, error: "Contract not found." };
  const deal = await loadDeal(db, contract.dealId);
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const closed = blocked(deal.workflowStage);
  if (closed) return closed;
  await db.update(contracts).set({ signingFormat: input.signingFormat }).where(eq(contracts.id, contract.id));
  return { ok: true, signingFormat: input.signingFormat };
}

export async function approveContract(
  db: PortalDb,
  input: { contractId: string; actorEmail: string; actorRole: string },
): Promise<Result<{ workflowStage: string | null }>> {
  if (input.actorRole !== "admin") {
    return { ok: false, status: 403, error: APPROVE_FORBIDDEN };
  }
  const contract = await loadContract(db, input.contractId);
  if (!contract) return { ok: false, status: 404, error: "Contract not found." };
  const deal = await loadDeal(db, contract.dealId);
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  const closed = blocked(deal.workflowStage);
  if (closed) return closed;
  if (contract.signingFormat === "needs_review") {
    return { ok: false, status: 400, error: NEEDS_REVIEW_ERROR };
  }
  if (contract.status === "approved") {
    return { ok: false, status: 409, error: "This version is already approved." };
  }

  await db.update(contracts).set({ status: "approved" }).where(eq(contracts.id, contract.id));
  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage: "approved_by_agency",
    actorEmail: input.actorEmail,
    actorRole: "admin",
    note: `Contract v${contract.version} approved.`,
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: "contract_approved",
    message: `Your contract for ${deal.brand} is approved. It's ready for you to sign.`,
    createdAt: nowIso(),
    readAt: null,
  });
  return { ok: true, workflowStage: moved.workflowStage };
}

export async function listContracts(db: PortalDb, since: string | null): Promise<ContractListRow[]> {
  const rows = since
    ? await db.select().from(contracts).where(gt(contracts.createdAt, since)).orderBy(asc(contracts.createdAt))
    : await db.select().from(contracts).orderBy(asc(contracts.createdAt));
  if (rows.length === 0) return [];
  const dealRows = await db.select().from(deals);
  const creatorRows = await db.select({ id: creators.id, name: creators.name }).from(creators);
  const checkRows = await db.select().from(contractChecks).orderBy(asc(contractChecks.createdAt));
  const dealById = new Map(dealRows.map((deal) => [deal.id, deal]));
  const creatorById = new Map(creatorRows.map((creator) => [creator.id, creator.name]));
  return rows.map((row) => {
    const deal = dealById.get(row.dealId);
    return {
      id: row.id,
      dealId: row.dealId,
      brand: deal?.brand ?? "",
      creatorId: deal?.creatorId ?? "",
      creatorName: deal ? creatorById.get(deal.creatorId) ?? "Creator" : "Creator",
      version: row.version,
      filename: row.filename,
      mimeType: row.mimeType,
      sha256: row.sha256,
      driveFileId: row.driveFileId,
      driveFileUrl: row.driveFileUrl,
      signingFormat: row.signingFormat,
      countersign: row.countersign,
      status: row.status,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt,
      workflowStage: deal?.workflowStage ?? null,
      checklist: checkRows
        .filter((check) => check.contractId === row.id)
        .map((check) => ({ item: check.item, status: check.status as ContractCheckStatus, note: check.note })),
    };
  });
}
