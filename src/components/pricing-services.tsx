import Link from "next/link";
import { PaymentLinkCards } from "@/components/payment-link-cards";
import { PlanBuyCards } from "@/components/plan-buy-cards";
import { PublicShell } from "@/components/public-shell";
import { pricingFeeCopy } from "@/lib/pricing-page";
import { publicPlans } from "@/lib/stripe-payment-links";

/** Public plans and one-time services. Both open a Stripe Payment Link. */
export function PricingServices() {
  const fee = pricingFeeCopy();
  return (
    <PublicShell title="Plans & Services" lede="Plus, Pro, and Business, plus one-time help for media kits, rate cards, contract reviews, and starter kits.">
      <div className="sec-title">Plans</div>
      <PlanBuyCards plans={publicPlans()} />
      <div className="sec-title">Services</div>
      <PaymentLinkCards />
      <section className="card stack" data-pricing-fees="true">
        <h2>How the fee works</h2>
        <p>{fee.selfServe}</p>
        <p>{fee.signed}</p>
        <p>{fee.members}</p>
        <p className="note">Nothing is charged until you pay on Stripe.</p>
      </section>
      <p><Link href="/packages">See these on the packages page</Link></p>
    </PublicShell>
  );
}
