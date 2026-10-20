const APPROVAL_ERROR_TEXT = {
  approver: "Only an approver can change an email. Approvers are the admin addresses.",
  intent: "intent must be edit, approve, or reject.",
  missing: "Email not found.",
  deal: "Deal not found.",
  sent: "This email was already sent.",
  waiting: "Only a waiting email can be edited or approved.",
  body: "subject and body are required.",
  list: "That creator isn't on your list.",
  email: "You can't approve brand email.",
} as const;

/** A short code for the approval form. Unknown wording stays the fixed fallback. */
export function approvalErrorCode(error: string) {
  const match = (Object.keys(APPROVAL_ERROR_TEXT) as (keyof typeof APPROVAL_ERROR_TEXT)[])
    .find((code) => APPROVAL_ERROR_TEXT[code] === error);
  return match ?? "1";
}

/** A known approval sentence. Unknown codes and the generic fallback stay null so the page can use its own fixed line. */
export function approvalErrorNote(code: string | undefined) {
  if (!code || code === "1") return null;
  return APPROVAL_ERROR_TEXT[code as keyof typeof APPROVAL_ERROR_TEXT] ?? null;
}
