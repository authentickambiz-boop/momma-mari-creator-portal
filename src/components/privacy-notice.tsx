import Link from "next/link";

export function PrivacyNotice() {
  return (
    <p className="note privacy-notice">
      By submitting you agree to our <Link href="/privacy">Privacy Policy</Link>.
    </p>
  );
}
