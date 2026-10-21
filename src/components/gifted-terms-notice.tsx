import { GIFTED_TERMS_TEXT, GIFTED_TERMS_VERSION } from "@/config/gifted-terms";

export function GiftedTermsNotice() {
  return (
    <div className="callout">
      <b>These terms are pending legal review.</b>
      <p style={{ whiteSpace: "pre-wrap" }}>{GIFTED_TERMS_TEXT}</p>
      <p className="note">Version {GIFTED_TERMS_VERSION}. Nothing is charged from this page.</p>
    </div>
  );
}
