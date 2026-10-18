import Link from "next/link";
import { eq } from "drizzle-orm";
import { SignForm } from "@/components/sign-form";
import { PortalFrame } from "@/components/portal-frame";
import { contractFiles } from "@/db/schema";
import { loadPortal } from "@/lib/current-user";
import { findCreatorById, getDealForViewer } from "@/lib/queries";
import { ATTORNEY_NOTE, CONTENT_MINOR_LABEL, GUARDIAN_LABEL } from "@/lib/sign-copy";
import type { ContractView, SignatureView } from "@/lib/types";

const SIGN_ERRORS: Record<string, string> = {
  boxes: "Check both boxes: agree to sign electronically, and confirm you have read and agree.",
  name: "Enter your full legal name.",
  guardian: "A parent or guardian has to sign this contract.",
  content: "Confirm you are the parent or guardian for any minor in this content.",
  draw: "Draw your signature, or switch to a typed signature.",
  pdf: "This file isn't a PDF we can sign. Upload a PDF, or upload the completed DocuSign copy.",
  mismatch: "This file doesn't match the approved version. Nothing was signed.",
  email: "Add the brand email before the signed contract can be queued.",
  signemail: "Add the brand email before the signed contract can be queued.",
  replaced: "This version was replaced. Sign the newest contract.",
  signed: "This version is already signed.",
  past: "This deal is already past signing. Nothing was changed.",
  ready: "This deal isn't ready to sign. Nothing was changed.",
  own: "You can only sign your own contract.",
  review: "This file needs review before signing. Upload a PDF or mark it as DocuSign.",
  "1": "That signature was not saved.",
};

function isPdf(bytes: Uint8Array | null) {
  if (!bytes || bytes.byteLength < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export default async function SignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creator?: string; contract?: string; signError?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(query.creator ?? null);
  const deal = await getDealForViewer(portal.db, portal.viewer, id);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  const creatorQuery = staff ? `?creator=${portal.viewedId}` : "";
  const error = query.signError ? SIGN_ERRORS[query.signError] ?? SIGN_ERRORS["1"] : null;
  const profile = deal ? await findCreatorById(portal.db, deal.creatorId) : null;

  return (
    <PortalFrame viewer={portal.viewer} tab="deals" creators={portal.creators} viewedId={portal.viewedId} hello={null}>
      {!deal ? (
        <div className="card">
          <h2>That deal isn&apos;t on your list.</h2>
        </div>
      ) : (
        <SignBody
          dealId={deal.id}
          brand={deal.brand}
          creatorId={deal.creatorId}
          workflowStage={deal.workflowStage}
          signerIsMinor={deal.signerIsMinor}
          contracts={deal.contracts}
          signatures={deal.signatures}
          contractQuery={query.contract ?? null}
          creatorQuery={creatorQuery}
          role={portal.viewer.role}
          allowCountersign={portal.viewer.role === "admin" || Boolean(portal.viewer.permissions?.countersign)}
          viewerCreatorId={portal.viewer.creatorId}
          db={portal.db}
          error={error}
          kidsAges={profile?.kidsAges ?? null}
        />
      )}
    </PortalFrame>
  );
}

async function SignBody({
  dealId,
  brand,
  creatorId,
  workflowStage,
  signerIsMinor,
  contracts,
  signatures,
  contractQuery,
  creatorQuery,
  role,
  allowCountersign,
  viewerCreatorId,
  db,
  error,
  kidsAges,
}: {
  dealId: string;
  brand: string;
  creatorId: string;
  workflowStage: string | null;
  signerIsMinor: boolean;
  contracts: ContractView[];
  signatures: SignatureView[];
  contractQuery: string | null;
  creatorQuery: string;
  role: string;
  allowCountersign: boolean;
  viewerCreatorId: string | null;
  db: Awaited<ReturnType<typeof loadPortal>>["db"];
  error: string | null;
  kidsAges: string | null;
}) {
  const requested = signatures.find((row) => row.status === "requested");
  const contract = contracts.find((row) => row.id === contractQuery)
    ?? contracts.find((row) => row.id === requested?.contractId)
    ?? [...contracts].reverse().find((row) => row.status === "approved")
    ?? null;
  const back = `/deals/${dealId}${creatorQuery}`;
  if (!contract) {
    return (
      <div className="card">
        <h1>Sign</h1>
        <p>There isn&apos;t a contract ready to sign on this deal.</p>
        <p><Link href={back}>Back to {brand}</Link></p>
      </div>
    );
  }

  const fileRows = await db.select().from(contractFiles).where(eq(contractFiles.contractId, contract.id));
  const bytes = fileRows[0] ? new Uint8Array(Buffer.from(fileRows[0].bytesBase64, "base64")) : null;
  const pdf = isPdf(bytes);
  const signWindow = workflowStage === "approved_by_agency" || workflowStage === "awaiting_signature";
  const request = signatures.find((row) => row.contractId === contract.id && row.status === "requested");
  const pending = signatures.find((row) => row.contractId === contract.id && row.status === "pending_countersign");
  const signedCopies = signatures.filter((row) => row.contractId === contract.id && row.signedFilename && row.status !== "void" && row.status !== "requested");
  const signable = contract.status === "approved" && (contract.signingFormat === "pdf" || contract.signingFormat === "docusign");
  const canSign = role === "creator" && viewerCreatorId === creatorId && signWindow && signable && Boolean(request) && pdf;
  const canCountersign = allowCountersign && role !== "creator" && Boolean(pending);
  const guardianLabel = signerIsMinor ? GUARDIAN_LABEL : kidsAges ? CONTENT_MINOR_LABEL : null;
  const viewedCreator = creatorQuery.startsWith("?creator=") ? creatorId : "";

  return (
    <div className="card">
      <p><Link href={back}>Back to {brand}</Link></p>
      <h1>Sign {brand}</h1>
      <p>
        v{contract.version} · {contract.filename}
        {contract.countersign ? " · Momma Mari will countersign" : ""}
      </p>
      {signerIsMinor ? <p className="note">A parent or guardian has to sign this contract. Kamron is flagged when they do.</p> : null}
      {pdf ? (
        <iframe className="sign-frame" title={`${brand} contract`} src={`/api/deals/${dealId}/contracts/${contract.id}/file`} />
      ) : (
        <p className="note">This file isn&apos;t a PDF we can show here. Upload a PDF, or upload the completed DocuSign copy.</p>
      )}
      {signedCopies.map((row) => (
        <p key={row.id}>
          <a href={`/api/deals/${dealId}/signatures/${row.id}/file`}>{row.signedFilename}</a>
          {row.status === "pending_countersign" ? " · Waiting for Momma Mari to countersign" : ""}
          {row.signerName ? ` · Signed by ${row.signerName}` : ""}
        </p>
      ))}
      <p className="note">{ATTORNEY_NOTE}</p>
      {canSign ? (
        <SignForm mode="sign" dealId={dealId} contractId={contract.id} creatorId="" guardianLabel={guardianLabel} error={error} />
      ) : null}
      {canCountersign ? (
        <>
          <h2>Momma Mari countersigns</h2>
          <SignForm mode="countersign" dealId={dealId} contractId={contract.id} creatorId={viewedCreator || creatorId} guardianLabel={null} error={canSign ? null : error} />
        </>
      ) : null}
      {!canSign && !canCountersign && signedCopies.length === 0 ? (
        <p className="note">{error ?? (request && !pdf ? "The sign button stays off until the file is a PDF we can stamp." : "This contract isn't waiting for a signature.")}</p>
      ) : null}
      {error && !canSign && !canCountersign && signedCopies.length > 0 ? <p className="note">{error}</p> : null}
    </div>
  );
}
