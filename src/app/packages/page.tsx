import Link from "next/link";
import { bookPackageAction } from "@/app/package-actions";
import { PublicShell } from "@/components/public-shell";
import { BRAND_PACKAGES, packageForBudget, parseBudgetDollars } from "@/lib/brand-packages";
import { packageCheckoutEnabled } from "@/lib/package-checkout-flag";
import { BRAND_INQUIRY_HREF, PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  title: "Brand packages · Momma Mari",
  description: "Brand packages booked by budget. Prices are placeholders until the owner approves them.",
  robots: PUBLIC_ROBOTS,
};

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ budget?: string; checkout?: string }> }) {
  const params = await searchParams;
  const parsed = parseBudgetDollars(params.budget ?? "");
  const match = "cents" in parsed && parsed.cents ? packageForBudget(parsed.cents) : null;
  const checkoutOn = packageCheckoutEnabled();
  return (
    <PublicShell title="Brand packages" lede="Pick a package by your budget. Prices below are placeholders and still need the owner's approval.">
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
      <div className="public-grid" style={{ marginTop: 16 }}>
        {BRAND_PACKAGES.map((item) => (
          <article key={item.id} className="card" data-package={item.id} data-matched={match?.id === item.id ? "true" : "false"}>
            <h2>{item.name}</h2>
            <p>{item.budgetLabel}</p>
            <p>{item.summary}</p>
            <p><b>{item.placeholderPriceLabel}</b></p>
            <p className="note">Placeholder price. TODO: owner approval. This is not a creator&apos;s rate.</p>
            <form action={bookPackageAction}>
              <input type="hidden" name="packageId" value={item.id} />
              <button className="btn" type="submit" disabled={!checkoutOn}>Book / pay deposit</button>
            </form>
            {!checkoutOn ? <p className="note">Checkout is off. Nothing is charged.</p> : null}
          </article>
        ))}
      </div>
      <p><Link href={BRAND_INQUIRY_HREF}>Need a custom brief?</Link></p>
    </PublicShell>
  );
}
