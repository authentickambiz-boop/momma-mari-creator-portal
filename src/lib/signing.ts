import { and, asc, eq, gt } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PortalDb } from "@/db";
import {
  contractFiles,
  contractSignatures,
  contracts,
  creatorNotifications,
  creators,
  dealStageEvents,
  deals,
  revisions,
  signatureFiles,
} from "@/db/schema";
import { createApprovalEmail } from "./approvals";
import { firstEmail } from "./creator-interest";
import { setDealStage } from "./deal-stage";
import { assertStaffAccess, assignedManagersByCreator, notifyStaff, staffHistoryRole } from "./managers";
import { driveConfigured, prepareContractsFolder, uploadDriveFile } from "./drive";
import { nowIso } from "./format";
import { isFullLegalName } from "./sign-copy";

type Result<T> = { ok: true } & T | { ok: false; status: number; error: string };

const SIGN_WINDOW = new Set(["approved_by_agency", "awaiting_signature"]);

export type SignatureListRow = {
  id: string;
  dealId: string;
  brand: string;
  creatorId: string;
  creatorName: string;
  manager: { id: string; name: string; email: string } | null;
  contractId: string;
  version: number;
  role: string;
  status: string;
  signerName: string | null;
  signerEmail: string | null;
  signedAt: string | null;
  ip: string | null;
  userAgent: string | null;
  documentSha256: string | null;
  signedSha256: string | null;
  signedFilename: string | null;
  driveFileUrl: string | null;
  guardian: boolean;
  workflowStage: string | null;
  createdAt: string;
};

export function encodeBytes(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export function decodeBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function decodeSignaturePng(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  const match = trimmed.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const bytes = decodeBytes(match[1]);
  if (bytes.byteLength < 32 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  return bytes;
}

type Stamp = {
  name: string;
  email: string;
  signedAt: string;
  role: string;
  png: Uint8Array | null;
};

export async function buildSignedPdf(input: { original: Uint8Array; stamps: Stamp[]; documentSha256: string; filename: string; version: number }) {
  const doc = await PDFDocument.load(input.original);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const script = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const pages = doc.getPages();
  const last = pages[pages.length - 1];
  const width = last.getSize().width;
  last.drawRectangle({
    x: 36,
    y: 24,
    width: Math.max(120, width - 72),
    height: 78,
    borderColor: rgb(0.45, 0.32, 0.22),
    borderWidth: 1,
  });
  const first = input.stamps[0];
  const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, "").slice(0, 80) || "Signer";
  last.drawText(`Signed by ${safe(first?.name ?? "the signer")}`, { x: 44, y: 78, size: 12, font: script, color: rgb(0.15, 0.1, 0.08) });
  last.drawText(`${safe(first?.signedAt ?? "")} UTC`, { x: 44, y: 60, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
  if (input.stamps.length > 1) {
    last.drawText(`Countersigned by ${safe(input.stamps[1].name)}`, { x: 44, y: 44, size: 10, font: script, color: rgb(0.15, 0.1, 0.08) });
  }
  const drawn = input.stamps.find((stamp) => stamp.png);
  if (drawn?.png) {
    const image = await doc.embedPng(drawn.png);
    last.drawImage(image, { x: Math.max(48, width - 190), y: 36, width: 140, height: 48 });
  }

  const certificate = doc.addPage();
  const lines = [
    "Signature certificate",
    "",
    `Document: v${input.version} ${input.filename}`,
    `SHA-256 of the document that was signed:`,
    input.documentSha256,
    "",
    "This page was appended when the contract was signed.",
    "The signature above was applied to that exact version.",
    "",
  ];
  for (const stamp of input.stamps) {
    lines.push(`${stamp.role}: ${stamp.name}`);
    lines.push(stamp.email);
    lines.push(`${stamp.signedAt} UTC`);
    lines.push("");
  }
  let y = 740;
  for (const line of lines) {
    const safe = line.replace(/[^\x20-\x7E]/g, "").slice(0, 90);
    if (safe) certificate.drawText(safe, { x: 48, y, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  }
  return new Uint8Array(await doc.save());
}

async function loadOriginal(db: PortalDb, contractId: string) {
  const rows = await db.select().from(contractFiles).where(eq(contractFiles.contractId, contractId));
  if (!rows[0]) return null;
  return decodeBytes(rows[0].bytesBase64);
}

function notReady(stage: string | null) {
  if (stage && ["signed_sent", "waiting_for_product", "product_received", "draft_due", "draft_submitted", "manager_review", "sent_to_brand", "brand_revisions", "brand_approved", "scheduled_posted", "payment_pending", "paid"].includes(stage)) {
    return "This deal is already past signing. Nothing was changed.";
  }
  return "This deal isn't ready to sign. Nothing was changed.";
}

async function queueSignedEmail(
  db: PortalDb,
  input: { deal: typeof deals.$inferSelect; creatorName: string; version: number; filename: string; driveFileUrl: string | null; actorEmail: string },
) {
  const brandEmail = firstEmail(input.deal.contact);
  if (!brandEmail) return { ok: false as const, status: 400, error: "Add the brand email before the signed contract can be queued." };
  const link = input.driveFileUrl
    ? `Drive link: ${input.driveFileUrl}`
    : "The signed PDF is in the Contracts folder for this deal.";
  return createApprovalEmail(
    db,
    {
      dealId: input.deal.id,
      gate: "signed_contract",
      to: brandEmail,
      subject: `${input.creatorName}'s signed contract for ${input.deal.brand}`,
      body: [
        "Hi,",
        "",
        `${input.creatorName}'s signed contract for ${input.deal.brand} is ready (v${input.version}, ${input.filename}).`,
        "",
        link,
        "",
        "Thanks,",
        "Kamron",
        "Momma Mari",
      ].join("\n"),
      attachmentUrl: input.driveFileUrl,
      attachmentNote: `Signed contract v${input.version}`,
    },
    { email: input.actorEmail, role: "bot" },
  );
}

async function saveSignedFile(
  db: PortalDb,
  input: {
    deal: typeof deals.$inferSelect;
    signatureId: string;
    filename: string;
    bytes: Uint8Array;
  },
) {
  let driveFileId: string | null = null;
  let driveFileUrl: string | null = null;
  if (driveConfigured()) {
    const creatorRows = await db.select().from(creators).where(eq(creators.id, input.deal.creatorId));
    const folderId = await prepareContractsFolder(db, {
      id: input.deal.id,
      brand: input.deal.brand,
      driveFolderId: input.deal.driveFolderId,
      creatorFolderId: creatorRows[0]?.driveFolderId ?? null,
    });
    const uploaded = await uploadDriveFile({
      folderId,
      filename: input.filename,
      mimeType: "application/pdf",
      bytes: input.bytes,
    });
    driveFileId = uploaded.fileId;
    driveFileUrl = uploaded.fileUrl;
  }
  await db.insert(signatureFiles).values({ signatureId: input.signatureId, bytesBase64: encodeBytes(input.bytes) });
  return { driveFileId, driveFileUrl, signedSha256: await sha256Hex(input.bytes) };
}

export async function advanceAfterSignature(db: PortalDb, dealId: string) {
  const rows = await db.select().from(deals).where(eq(deals.id, dealId));
  const deal = rows[0];
  if (!deal) return { ok: false as const, status: 404, error: "Deal not found." };
  const next = deal.productRequired ? "waiting_for_product" : "draft_due";
  if (deal.workflowStage === next) return { ok: true as const, workflowStage: next };
  const moved = await setDealStage(db, {
    dealId,
    toStage: next,
    actorEmail: "portal",
    actorRole: "system",
    note: deal.productRequired ? "Product is required before production." : "No product is needed. Straight to production.",
  });
  if (!moved.ok) return moved;
  return { ok: true as const, workflowStage: moved.workflowStage };
}

export async function signContract(
  db: PortalDb,
  input: {
    contractId: string;
    actorEmail: string;
    actorRole: string;
    creatorId: string | null;
    legalName: string;
    signatureKind: string;
    signaturePng?: string | null;
    consentEsign: boolean;
    consentRead: boolean;
    guardianConfirm: boolean;
    ip: string;
    userAgent: string;
  },
): Promise<Result<{ signatureId: string; status: string; workflowStage: string | null; pendingCountersign: boolean }>> {
  if (input.actorRole !== "creator" || !input.creatorId) {
    return { ok: false, status: 403, error: "You can only sign your own contract." };
  }
  const contractRows = await db.select().from(contracts).where(eq(contracts.id, input.contractId));
  const contract = contractRows[0];
  if (!contract) return { ok: false, status: 404, error: "Contract not found." };
  const dealRows = await db.select().from(deals).where(eq(deals.id, contract.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (deal.creatorId !== input.creatorId) return { ok: false, status: 403, error: "You can only sign your own contract." };
  const requests = await db.select().from(contractSignatures).where(eq(contractSignatures.contractId, contract.id));
  if (requests.some((row) => row.status === "final" || row.status === "pending_countersign")) {
    return { ok: false, status: 409, error: "This version is already signed." };
  }
  const request = requests.find((row) => row.status === "requested");
  if (!request && requests.some((row) => row.status === "void")) {
    return { ok: false, status: 409, error: "This version was replaced. Sign the newest contract." };
  }
  if (!deal.workflowStage || !SIGN_WINDOW.has(deal.workflowStage)) {
    return { ok: false, status: 409, error: notReady(deal.workflowStage) };
  }
  if (contract.status !== "approved" || (contract.signingFormat !== "pdf" && contract.signingFormat !== "docusign")) {
    return { ok: false, status: 400, error: "This file needs review before signing. Upload a PDF or mark it as DocuSign." };
  }
  if (!request) return { ok: false, status: 409, error: "This version isn't waiting for a signature." };
  if (!input.consentEsign || !input.consentRead) {
    return { ok: false, status: 400, error: "Check both boxes: agree to sign electronically, and confirm you have read and agree." };
  }
  const legalName = clean(input.legalName);
  if (!legalName || !isFullLegalName(legalName)) {
    return { ok: false, status: 400, error: "Enter your full legal name." };
  }
  const creatorRows = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
  const creator = creatorRows[0];
  const minor = Boolean(creator?.signerIsMinor);
  if (minor && !input.guardianConfirm) {
    return { ok: false, status: 400, error: "A parent or guardian has to sign this contract." };
  }
  if (!minor && creator?.kidsAges && !input.guardianConfirm) {
    return { ok: false, status: 400, error: "Confirm you are the parent or guardian for any minor in this content." };
  }
  const png = input.signatureKind === "drawn" ? decodeSignaturePng(input.signaturePng) : null;
  if (input.signatureKind === "drawn" && !png) return { ok: false, status: 400, error: "Draw your signature, or switch to a typed signature." };
  if (input.signatureKind !== "drawn" && input.signatureKind !== "typed") {
    return { ok: false, status: 400, error: "Draw your signature, or type it." };
  }
  const original = await loadOriginal(db, contract.id);
  if (!original || !original.slice(0, 5).every((byte, index) => byte === "%PDF-".charCodeAt(index))) {
    return { ok: false, status: 400, error: "This file isn't a PDF we can sign. Upload a PDF, or upload the completed DocuSign copy." };
  }
  const documentSha256 = await sha256Hex(original);
  if (contract.sha256 && contract.sha256 !== documentSha256) {
    return { ok: false, status: 409, error: "This file doesn't match the approved version. Nothing was signed." };
  }
  if (contract.countersign && !firstEmail(deal.contact)) {
    return { ok: false, status: 400, error: "Add the brand email before the signed contract can be queued." };
  }
  if (!contract.countersign && !firstEmail(deal.contact)) {
    return { ok: false, status: 400, error: "Add the brand email before the signed contract can be queued." };
  }

  const signedAt = nowIso();
  const role = minor ? "guardian" : "creator";
  let signedPdf: Uint8Array;
  try {
    signedPdf = await buildSignedPdf({
      original,
      documentSha256,
      filename: contract.filename,
      version: contract.version,
      stamps: [{ name: legalName, email: input.actorEmail, signedAt, role, png }],
    });
  } catch {
    return { ok: false, status: 400, error: "This file isn't a PDF we can sign. Upload a PDF, or upload the completed DocuSign copy." };
  }
  const signedFilename = `v${contract.version} ${contract.filename.replace(/\.pdf$/i, "")} SIGNED.pdf`;
  const stored = await saveSignedFile(db, { deal, signatureId: request.id, filename: signedFilename, bytes: signedPdf });
  const pendingCountersign = Boolean(contract.countersign);
  await db.update(contractSignatures).set({
    role,
    status: pendingCountersign ? "pending_countersign" : "final",
    signerName: legalName,
    signerEmail: input.actorEmail,
    signedAt,
    ip: input.ip,
    userAgent: input.userAgent,
    documentSha256,
    signatureKind: input.signatureKind,
    consentEsign: true,
    consentRead: true,
    guardian: minor,
    signedSha256: stored.signedSha256,
    signedFilename,
    driveFileId: stored.driveFileId,
    driveFileUrl: stored.driveFileUrl,
  }).where(eq(contractSignatures.id, request.id));

  if (minor) {
    await notifyStaff(db, {
      kind: "minor_signature",
      creatorId: deal.creatorId,
      message: `A parent or guardian signed the ${deal.brand} contract for ${creator?.name ?? "a creator"}. Please review.`,
    });
  }

  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage: "signed_by_creator",
    actorEmail: input.actorEmail,
    actorRole: "creator",
    creatorId: input.creatorId,
    note: minor ? `Parent or guardian signed contract v${contract.version}.` : `Creator signed contract v${contract.version}.`,
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  let workflowStage = moved.workflowStage;
  if (!pendingCountersign) {
    const advanced = await advanceAfterSignature(db, deal.id);
    if (!advanced.ok) return advanced;
    workflowStage = advanced.workflowStage;
  }

  if (!pendingCountersign) {
    const drafted = await queueSignedEmail(db, {
      deal,
      creatorName: creator?.name ?? legalName,
      version: contract.version,
      filename: signedFilename,
      driveFileUrl: stored.driveFileUrl,
      actorEmail: input.actorEmail,
    });
    if (!drafted.ok) return drafted;
    await db.update(contractSignatures).set({ approvalId: drafted.id }).where(eq(contractSignatures.id, request.id));
  }

  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: pendingCountersign ? "contract_signed_waiting" : "contract_signed",
    message: pendingCountersign
      ? `You signed the contract for ${deal.brand}. Momma Mari still needs to countersign.`
      : `Your signed contract for ${deal.brand} is saved.`,
    createdAt: signedAt,
    readAt: null,
  });
  return { ok: true, signatureId: request.id, status: pendingCountersign ? "pending_countersign" : "final", workflowStage, pendingCountersign };
}

export async function countersignContract(
  db: PortalDb,
  input: {
    contractId: string;
    actorEmail: string;
    actorRole: string;
    legalName: string;
    signatureKind: string;
    signaturePng?: string | null;
    consentEsign: boolean;
    consentRead: boolean;
    ip: string;
    userAgent: string;
  },
): Promise<Result<{ signatureId: string; workflowStage: string | null }>> {
  if (input.actorRole !== "admin" && input.actorRole !== "manager") return { ok: false, status: 403, error: "Only an admin can countersign." };
  const contractRows = await db.select().from(contracts).where(eq(contracts.id, input.contractId));
  const contract = contractRows[0];
  if (!contract) return { ok: false, status: 404, error: "Contract not found." };
  const dealRows = await db.select().from(deals).where(eq(deals.id, contract.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (input.actorRole === "manager") {
    const allowed = await assertStaffAccess(db, {
      actorEmail: input.actorEmail,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: "countersign",
    });
    if (!allowed.ok) return allowed;
  }
  if (!contract.countersign) return { ok: false, status: 400, error: "This contract is not marked for a Momma Mari countersignature." };
  if (deal.workflowStage !== "signed_by_creator") {
    return { ok: false, status: 409, error: notReady(deal.workflowStage) };
  }
  const rows = await db.select().from(contractSignatures).where(eq(contractSignatures.contractId, contract.id));
  const creatorSign = rows.find((row) => row.status === "pending_countersign");
  if (!creatorSign) return { ok: false, status: 409, error: "The creator has not signed this version yet." };
  if (!firstEmail(deal.contact)) return { ok: false, status: 400, error: "Add the brand email before the signed contract can be queued." };
  if (!input.consentEsign || !input.consentRead) {
    return { ok: false, status: 400, error: "Check both boxes before countersigning." };
  }
  const legalName = clean(input.legalName);
  if (!legalName || !isFullLegalName(legalName)) return { ok: false, status: 400, error: "Enter your full legal name." };
  const png = input.signatureKind === "drawn" ? decodeSignaturePng(input.signaturePng) : null;
  if (input.signatureKind === "drawn" && !png) return { ok: false, status: 400, error: "Draw your signature, or switch to a typed signature." };
  const original = await loadOriginal(db, contract.id);
  if (!original) return { ok: false, status: 400, error: "This file isn't a PDF we can sign. Upload a PDF, or upload the completed DocuSign copy." };
  const creatorPng = null;
  const signedAt = nowIso();
  const signedPdf = await buildSignedPdf({
    original,
    documentSha256: creatorSign.documentSha256 ?? contract.sha256 ?? "",
    filename: contract.filename,
    version: contract.version,
    stamps: [
      {
        name: creatorSign.signerName ?? "Creator",
        email: creatorSign.signerEmail ?? "",
        signedAt: creatorSign.signedAt ?? signedAt,
        role: creatorSign.role,
        png: creatorPng,
      },
      { name: legalName, email: input.actorEmail, signedAt, role: "countersign", png },
    ],
  });
  const id = crypto.randomUUID();
  const signedFilename = `v${contract.version} ${contract.filename.replace(/\.pdf$/i, "")} SIGNED countersigned.pdf`;
  const stored = await saveSignedFile(db, { deal, signatureId: id, filename: signedFilename, bytes: signedPdf });
  const creatorRows = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
  const drafted = await queueSignedEmail(db, {
    deal,
    creatorName: creatorRows[0]?.name ?? creatorSign.signerName ?? "Creator",
    version: contract.version,
    filename: signedFilename,
    driveFileUrl: stored.driveFileUrl,
    actorEmail: input.actorEmail,
  });
  if (!drafted.ok) return drafted;
  await db.insert(contractSignatures).values({
    id,
    contractId: contract.id,
    dealId: deal.id,
    version: contract.version,
    role: "countersign",
    status: "final",
    signerName: legalName,
    signerEmail: input.actorEmail,
    signedAt,
    ip: input.ip,
    userAgent: input.userAgent,
    documentSha256: creatorSign.documentSha256,
    signatureKind: input.signatureKind === "drawn" ? "drawn" : "typed",
    consentEsign: true,
    consentRead: true,
    guardian: false,
    signedSha256: stored.signedSha256,
    signedFilename,
    driveFileId: stored.driveFileId,
    driveFileUrl: stored.driveFileUrl,
    approvalId: drafted.id,
    createdAt: signedAt,
  });
  await db.update(contractSignatures).set({ status: "final" }).where(eq(contractSignatures.id, creatorSign.id));
  await db.insert(dealStageEvents).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    fromStage: deal.workflowStage,
    toStage: deal.workflowStage,
    actorEmail: input.actorEmail,
    actorRole: staffHistoryRole(input.actorRole),
    note: `Momma Mari countersigned contract v${contract.version}.`,
    createdAt: signedAt,
  });
  const prior = await db.select().from(revisions).where(eq(revisions.dealId, deal.id));
  const sortOrder = prior.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  await db.insert(revisions).values({
    id: crypto.randomUUID(),
    dealId: deal.id,
    draftId: null,
    occurredLabel: signedAt.slice(0, 16).replace("T", " "),
    occurredAt: signedAt,
    source: "us",
    summary: "Momma Mari countersigned the contract.",
    emailUrl: null,
    sortOrder,
    isSeed: false,
    createdAt: signedAt,
  });
  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: "contract_countersigned",
    message: `Your signed contract for ${deal.brand} is saved.`,
    createdAt: signedAt,
    readAt: null,
  });
  const advanced = await advanceAfterSignature(db, deal.id);
  if (!advanced.ok) return advanced;
  return { ok: true, signatureId: id, workflowStage: advanced.workflowStage };
}

export async function uploadBrandSignedCopy(
  db: PortalDb,
  input: {
    contractId: string;
    actorEmail: string;
    actorRole: string;
    filename: string;
    bytes: Uint8Array;
    ip: string;
    userAgent: string;
  },
): Promise<Result<{ signatureId: string; workflowStage: string | null }>> {
  if (input.actorRole !== "admin" && input.actorRole !== "manager") return { ok: false, status: 403, error: "Only an admin can upload a signed copy." };
  const contractRows = await db.select().from(contracts).where(eq(contracts.id, input.contractId));
  const contract = contractRows[0];
  if (!contract) return { ok: false, status: 404, error: "Contract not found." };
  const dealRows = await db.select().from(deals).where(eq(deals.id, contract.dealId));
  const deal = dealRows[0];
  if (!deal) return { ok: false, status: 404, error: "Deal not found." };
  if (input.actorRole === "manager") {
    const allowed = await assertStaffAccess(db, {
      actorEmail: input.actorEmail,
      actorRole: "manager",
      creatorId: deal.creatorId,
      permission: "contract",
    });
    if (!allowed.ok) return allowed;
  }
  if (!deal.workflowStage || !SIGN_WINDOW.has(deal.workflowStage)) {
    return { ok: false, status: 409, error: notReady(deal.workflowStage) };
  }
  if (contract.status !== "approved") return { ok: false, status: 400, error: "Approve the contract before filing a signed copy." };
  if (!firstEmail(deal.contact)) return { ok: false, status: 400, error: "Add the brand email before the signed contract can be queued." };
  if (!input.bytes.slice(0, 5).every((byte, index) => byte === "%PDF-".charCodeAt(index))) {
    return { ok: false, status: 400, error: "Upload the completed signed PDF." };
  }
  const existing = await db.select().from(contractSignatures).where(eq(contractSignatures.contractId, contract.id));
  if (existing.some((row) => row.status === "final" || row.status === "pending_countersign")) {
    return { ok: false, status: 409, error: "This version is already signed." };
  }
  const creatorRows = await db.select().from(creators).where(eq(creators.id, deal.creatorId));
  const signedAt = nowIso();
  const id = crypto.randomUUID();
  const filename = input.filename.split(/[/\\]/).pop()?.trim().slice(0, 180) || `v${contract.version} signed.pdf`;
  const documentSha256 = await sha256Hex(input.bytes);
  const stored = await saveSignedFile(db, { deal, signatureId: id, filename, bytes: input.bytes });
  const drafted = await queueSignedEmail(db, {
    deal,
    creatorName: creatorRows[0]?.name ?? "Creator",
    version: contract.version,
    filename,
    driveFileUrl: stored.driveFileUrl,
    actorEmail: input.actorEmail,
  });
  if (!drafted.ok) return drafted;
  await db
    .update(contractSignatures)
    .set({ status: "void", voidedAt: signedAt })
    .where(and(eq(contractSignatures.contractId, contract.id), eq(contractSignatures.status, "requested")));
  await db.insert(contractSignatures).values({
    id,
    contractId: contract.id,
    dealId: deal.id,
    version: contract.version,
    role: "brand_docusign",
    status: "final",
    signerName: "Brand DocuSign",
    signerEmail: input.actorEmail,
    signedAt,
    ip: input.ip,
    userAgent: input.userAgent,
    documentSha256,
    signatureKind: "uploaded",
    consentEsign: false,
    consentRead: false,
    guardian: false,
    signedSha256: stored.signedSha256,
    signedFilename: filename,
    driveFileId: stored.driveFileId,
    driveFileUrl: stored.driveFileUrl,
    approvalId: drafted.id,
    createdAt: signedAt,
  });
  const moved = await setDealStage(db, {
    dealId: deal.id,
    toStage: "signed_by_creator",
    actorEmail: input.actorEmail,
    actorRole: staffHistoryRole(input.actorRole),
    note: `Uploaded the brand's completed DocuSign for v${contract.version}. The sign page was skipped.`,
  });
  if (!moved.ok) return { ok: false, status: moved.status, error: moved.error };
  const advanced = await advanceAfterSignature(db, deal.id);
  if (!advanced.ok) return advanced;
  await db.insert(creatorNotifications).values({
    id: crypto.randomUUID(),
    creatorId: deal.creatorId,
    dealId: deal.id,
    kind: "contract_signed",
    message: `Your signed contract for ${deal.brand} is saved.`,
    createdAt: signedAt,
    readAt: null,
  });
  return { ok: true, signatureId: id, workflowStage: advanced.workflowStage };
}

export async function setSignerIsMinor(
  db: PortalDb,
  input: { creatorId: string; minor: boolean; actorRole: string },
): Promise<Result<{ minor: boolean }>> {
  if (input.actorRole !== "admin") return { ok: false, status: 403, error: "Only an admin can mark a signer as a minor." };
  const rows = await db.select().from(creators).where(eq(creators.id, input.creatorId));
  if (!rows[0]) return { ok: false, status: 404, error: "Creator not found." };
  await db.update(creators).set({ signerIsMinor: input.minor }).where(eq(creators.id, input.creatorId));
  return { ok: true, minor: input.minor };
}

export async function listSignatures(db: PortalDb, since: string | null): Promise<SignatureListRow[]> {
  const rows = since
    ? await db.select().from(contractSignatures).where(gt(contractSignatures.createdAt, since)).orderBy(asc(contractSignatures.createdAt))
    : await db.select().from(contractSignatures).orderBy(asc(contractSignatures.createdAt));
  if (rows.length === 0) return [];
  const dealRows = await db.select().from(deals);
  const creatorRows = await db.select({ id: creators.id, name: creators.name }).from(creators);
  const managerByCreator = await assignedManagersByCreator(db);
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
      manager: deal ? managerByCreator.get(deal.creatorId) ?? null : null,
      contractId: row.contractId,
      version: row.version,
      role: row.role,
      status: row.status,
      signerName: row.signerName,
      signerEmail: row.signerEmail,
      signedAt: row.signedAt,
      ip: row.ip,
      userAgent: row.userAgent,
      documentSha256: row.documentSha256,
      signedSha256: row.signedSha256,
      signedFilename: row.signedFilename,
      driveFileUrl: row.driveFileUrl,
      guardian: row.guardian,
      workflowStage: deal?.workflowStage ?? null,
      createdAt: row.createdAt,
    };
  });
}

/** Creator stage moves are normally limited to interest. Signing is the other creator move. */
export function creatorMaySignStage(stage: string | null) {
  return Boolean(stage && SIGN_WINDOW.has(stage));
}
