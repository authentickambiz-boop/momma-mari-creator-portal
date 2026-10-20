const CONTRACT_MATCHES = [
  { code: "past", error: "This deal is already past the contract. Nothing was changed." },
  { code: "review", error: "This file needs review before signing. Upload a PDF or mark it as DocuSign." },
  { code: "type", error: "Upload a PDF or DOCX." },
  { code: "type", error: "That file is over 20 MB." },
  { code: "changes", error: "Mark at least one checklist item as an issue, or write the changes to request." },
  { code: "items", error: "Each checklist item is ok, an issue, or not checked." },
  { code: "email", error: "Add the brand email before asking for changes." },
  { code: "signemail", error: "Add the brand email before the signed contract can be queued." },
  { code: "upload", error: "Upload the completed signed PDF." },
  { code: "signed", error: "This version is already signed." },
  { code: "ready", error: "This deal isn't ready to sign. Nothing was changed." },
] as const;

const CONTRACT_NOTES = {
  past: "This deal is already past the contract. Nothing was changed.",
  review: "This file needs review before signing. Upload a PDF or mark it as DocuSign.",
  type: "Upload a PDF or DOCX under 20 MB.",
  changes: "Mark at least one checklist item as an issue, or write the changes to request.",
  items: "Each checklist item is ok, an issue, or not checked.",
  email: "Add the brand email before asking for changes. The email stays in your queue.",
  signemail: "Add the brand email before the signed contract can be queued.",
  upload: "Upload the completed signed PDF.",
  signed: "This version is already signed.",
  ready: "This deal isn't ready to sign. Nothing was changed.",
} as const;

const SIGN_MATCHES = [
  { code: "boxes", error: "Check both boxes: agree to sign electronically, and confirm you have read and agree." },
  { code: "counter", error: "Check both boxes before countersigning." },
  { code: "name", error: "Enter your full legal name." },
  { code: "guardian", error: "A parent or guardian has to sign this contract." },
  { code: "content", error: "Confirm you are the parent or guardian for any minor in this content." },
  { code: "draw", error: "Draw your signature, or switch to a typed signature." },
  { code: "draw", error: "Draw your signature, or type it." },
  { code: "pdf", error: "This file isn't a PDF we can sign. Upload a PDF, or upload the completed DocuSign copy." },
  { code: "mismatch", error: "This file doesn't match the approved version. Nothing was signed." },
  { code: "signemail", error: "Add the brand email before the signed contract can be queued." },
  { code: "replaced", error: "This version was replaced. Sign the newest contract." },
  { code: "signed", error: "This version is already signed." },
  { code: "past", error: "This deal is already past signing. Nothing was changed." },
  { code: "ready", error: "This deal isn't ready to sign. Nothing was changed." },
  { code: "own", error: "You can only sign your own contract." },
  { code: "review", error: "This file needs review before signing. Upload a PDF or mark it as DocuSign." },
  { code: "upload", error: "Upload the completed signed PDF." },
] as const;

function exactCode(rows: readonly { code: string; error: string }[], error: string) {
  return rows.find((row) => row.error === error)?.code ?? "1";
}

/** A short code for a refused contract step. Unknown wording stays the fixed fallback. */
export function contractErrorCode(error: string) {
  return exactCode(CONTRACT_MATCHES, error);
}

/** A known contract sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function contractErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return CONTRACT_NOTES[code as keyof typeof CONTRACT_NOTES] ?? null;
}

/** A short code for a refused signature. Unknown wording stays the fixed fallback. */
export function signErrorCode(error: string) {
  return exactCode(SIGN_MATCHES, error);
}
