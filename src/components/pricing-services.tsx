import Link from "next/link";
import { PaymentLinkCards } from "@/components/payment-link-cards";
import { PublicShell } from "@/components/public-shell";

/** Public plans page while subscriptions are not for sale. One-time services use Payment Links. */
export function PricingServices() {
  return (
    <PublicShell title="Plans & Services" lede="Buy a media kit, rate card, contract review, or starter kit. You pay on Stripe.">
      <PaymentLinkCards />
      <p className="note">Plus, Pro, and Business plans are coming soon.</p>
      <p><Link href="/packages">See these on the packages page</Link></p>
    </PublicShell>
  );
}
