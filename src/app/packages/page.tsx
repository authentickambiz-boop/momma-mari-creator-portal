import type { Metadata } from "next";
import Link from "next/link";
import { bookPackageAction } from "@/app/package-actions";
import { PaymentLinkCards } from "@/components/payment-link-cards";
import { PrivacyNotice } from "@/components/privacy-notice";
import { PublicShell } from "@/components/public-shell";
import { packageForBudget, packagePublicView, parseBudgetDollars } from "@/lib/brand-packages";
import { packageCheckoutEnabled } from "@/lib/package-checkout-flag";
import { packagePricesApproved } from "@/lib/package-prices-flag";
import { publicPageMeta } from "@/lib/public-meta";
import { BRAND_INQUIRY_HREF } from "@/lib/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const view = packagePublicView(packagePricesApproved());
  return {
    ...publicPageMeta({
      title: "Brand packages · Momma Mari",
      description: view.description,
      path: "/packages",
    }),
    robots: view.robots,
  };
}

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ budget?: string; checkout?: string }> }) {
  const params = await searchParams;
  const view = packagePublicView(packagePricesApproved());
  const parsed = parseBudgetDollars(params.budget ?? "");
  const match = "cents" in parsed && parsed.cents ? packageForBudget(parsed.cents) : null;
  const checkoutOn = packageCheckoutEnabled();
  return (
    <PublicShell title="Brand packages" lede={view.lede}>
      {params.checkout === "off" ? <p className="note">Deposit checkout is off. Nothing was charged.</p> : null}
      {"error" in parsed ? <p className="note">{parsed.error}</p> : null}
      <form className="card stack" method="get">
        <label>
          Your budget in dollars
          <input name="budget" inputMode="decimal" defaultValue={params.budget ?? ""} aria-label="Budget in dollars" />
        </label>
        <button className="btn" type="submit">See the package for this budget</button>
      </form>
      {match ? <p className="note">A budget in this range books {match.name}.</p> : null}
      <div className="sec-title">One-time services</div>
      <p className="note">These open a Stripe payment page. Nothing is charged until you pay there.</p>
      <PaymentLinkCards />
      <div className="public-grid" style={{ marginTop: 16 }}>
        {view.cards.map((item) => (
          <article key={item.id} className="card" data-package={item.id} data-matched={match?.id === item.id ? "true" : "false"}>
            <h2>{item.name}</h2>
            <p>{item.budgetLabel}</p>
            <p>{item.summary}</p>
            {item.priceLabel ? <p><b>{item.priceLabel}</b></p> : null}
            {item.quoteHref ? <p><Link className="btn" href={item.quoteHref}>{item.quoteLabel}</Link></p> : null}
            {item.priceLabel ? (
              <form action={bookPackageAction}>
                <input type="hidden" name="packageId" value={item.id} />
                <button className="btn" type="submit" disabled={!checkoutOn}>Book / pay deposit</button>
              </form>
            ) : null}
            {item.priceLabel && !checkoutOn ? <p className="note">Checkout is off. Nothing is charged.</p> : null}
            {item.priceLabel ? <PrivacyNotice /> : null}
          </article>
        ))}
      </div>
      <p><Link href={BRAND_INQUIRY_HREF}>Need a custom brief?</Link></p>
    </PublicShell>
  );
}
