export const ESIGN_CONSENT_LABEL =
  "I agree to do business electronically and to sign this contract with an electronic signature (ESIGN Act and UETA).";

export const READ_CONSENT_LABEL = "I have read this contract and I agree to it.";

export const GUARDIAN_LABEL = "I am the parent or guardian, and I am signing for this creator.";

export const CONTENT_MINOR_LABEL = "I am the parent or guardian for any minor who appears in this content.";

export const ATTORNEY_NOTE = "Electronic signatures on this page are pending legal review.";

export function isFullLegalName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.every((part) => /[\p{L}]/u.test(part));
}
