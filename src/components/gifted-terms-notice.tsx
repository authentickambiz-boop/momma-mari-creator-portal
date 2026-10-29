import { GIFTED_TERMS_TEXT, GIFTED_TERMS_VERSION } from "@/config/gifted-terms";

const REVIEW_LINE = /^These terms are pending legal review\.\n+/;

/** Signed-in gifts keeps the review note. The public bench page does not. */
export function GiftedTermsNotice({ publicPage = false }: { publicPage?: boolean }) {
  const text = publicPage ? GIFTED_TERMS_TEXT.replace(REVIEW_LINE, "") : GIFTED_TERMS_TEXT;
  return (
    <div className="callout">
      {publicPage ? null : <b>These terms are pending legal review.</b>}
      <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
      <p className="note">{publicPage ? "Nothing is charged from this page." : `Version ${GIFTED_TERMS_VERSION}. Nothing is charged from this page.`}</p>
    </div>
  );
}
