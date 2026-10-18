/** Checklist Kamron walks before a creator ever sees the file. Notes stay internal. */
export const CONTRACT_CHECKS = [
  { id: "payment_terms", label: "Payment terms" },
  { id: "usage_rights", label: "Usage rights and duration" },
  { id: "exclusivity", label: "Exclusivity" },
  { id: "deliverables_dates", label: "Deliverables and dates" },
  { id: "revisions", label: "Revisions" },
  { id: "kill_fee", label: "Kill fee" },
  { id: "ftc", label: "FTC disclosure" },
  { id: "minors", label: "Minors and kids' privacy" },
  { id: "morality", label: "Morality clause" },
  { id: "governing_law", label: "Governing law" },
] as const;

export type ContractCheckId = (typeof CONTRACT_CHECKS)[number]["id"];
export type ContractCheckStatus = "ok" | "issue" | "unchecked";
export type SigningFormat = "pdf" | "docusign" | "needs_review";

export const CONTRACTS_FOLDER_NAME = "02 Contracts";
export const MAX_CONTRACT_BYTES = 20 * 1024 * 1024;

export const PAST_CONTRACT_ERROR = "This deal is already past the contract. Nothing was changed.";
export const NEEDS_REVIEW_ERROR = "This file needs review before signing. Upload a PDF or mark it as DocuSign.";
export const APPROVE_FORBIDDEN = "You can't approve this contract.";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const OCTET_MIME = "application/octet-stream";

const OPEN_FOR_CONTRACT = new Set([
  "offer_received",
  "offer_shared",
  "creator_interested",
  "interest_sent",
  "contract_received",
  "contract_review",
  "revisions_requested",
  "revised_contract",
  "approved_by_agency",
]);

const CHECK_IDS = new Set<string>(CONTRACT_CHECKS.map((item) => item.id));

export function contractStageOpen(stage: string | null | undefined) {
  if (!stage) return true;
  return OPEN_FOR_CONTRACT.has(stage);
}

export function isContractCheckId(value: string): value is ContractCheckId {
  return CHECK_IDS.has(value);
}

export function isContractCheckStatus(value: string): value is ContractCheckStatus {
  return value === "ok" || value === "issue" || value === "unchecked";
}

export function isSigningFormat(value: string): value is SigningFormat {
  return value === "pdf" || value === "docusign" || value === "needs_review";
}

export function contractCheckLabel(id: string) {
  return CONTRACT_CHECKS.find((item) => item.id === id)?.label ?? id;
}

export function contractStatusLabel(status: string) {
  if (status === "received") return "Received";
  if (status === "in_review") return "In review";
  if (status === "revisions_requested") return "Changes requested";
  if (status === "approved") return "Approved";
  return status;
}

export function signingFormatLabel(format: string) {
  if (format === "pdf") return "PDF, ready for signing later";
  if (format === "docusign") return "DocuSign, ready for signing later";
  return "needs review before signing";
}

export function acceptedContractFile(filename: string, mimeType: string) {
  const name = filename.trim().toLowerCase();
  const mime = mimeType.trim().toLowerCase();
  if (mime === PDF_MIME || mime === DOCX_MIME) return true;
  if ((mime === "" || mime === OCTET_MIME) && (name.endsWith(".pdf") || name.endsWith(".docx"))) return true;
  return false;
}

/** DocuSign or a PDF can be signed later. Word and anything else is flagged. */
export function signingFormatFor(input: { filename: string; mimeType: string; docusign?: boolean }): SigningFormat {
  if (input.docusign) return "docusign";
  const name = input.filename.trim().toLowerCase();
  const mime = input.mimeType.trim().toLowerCase();
  if (mime === PDF_MIME || name.endsWith(".pdf")) return "pdf";
  return "needs_review";
}
