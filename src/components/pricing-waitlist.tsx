import { joinPricingWaitlistAction } from "@/app/pricing-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PublicShell } from "@/components/public-shell";

export function PricingWaitlist({ notice }: { notice: string | null }) {
  return (
    <PublicShell title="Plans & Services" lede="Coming soon, join waitlist">
      <p>Plus, Pro, and Business are not open yet.</p>
      {notice ? <p className="note" role="status">{notice}</p> : null}
      <form action={joinPricingWaitlistAction} className="card stack">
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" aria-label="Email" />
        </label>
        <PrivacyNotice />
        <button className="btn" type="submit">Join the waitlist</button>
      </form>
    </PublicShell>
  );
}
