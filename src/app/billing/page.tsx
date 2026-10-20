import { manageBillingAction, prepareHostedEmailLinkAction } from "@/app/billing-actions";
import { BillingOffers } from "@/components/billing-offers";
import { PortalFrame } from "@/components/portal-frame";
import { readOwnAccount } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";
import { checkoutStatusNote, oneTimePriceNote, paymentsEnabled, readCreatorBilling } from "@/lib/payments";
import { memberOneTimePercent, oneTimeMemberNote, oneTimeOffers, subscriptionOffers } from "@/lib/payments-config";
import { creatorIsSigned } from "@/lib/signed-creators";
import { stripeLiveEnabled, stripeStatusNote } from "@/lib/stripe-billing";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ stripe?: string; checkout?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const account = await readOwnAccount(portal.db, portal.viewer);
  const billing = account ? await readCreatorBilling(portal.db, account.creatorId) : null;
  const stripeNote = stripeStatusNote(params.stripe);
  const checkoutNote = checkoutStatusNote(params.checkout);
  const stripeOn = stripeLiveEnabled();
  const paymentsOn = paymentsEnabled();
  const plans = subscriptionOffers().map((offer) => ({
    id: offer.id,
    name: offer.name,
    prices: offer.prices.flatMap((price) => price.interval === "month" || price.interval === "year" ? [{ interval: price.interval, label: price.label }] : []),
  }));
  const signed = account ? await creatorIsSigned(portal.db, account.creatorId) : false;
  const memberPercent = signed ? 0 : memberOneTimePercent(billing?.subscriptionPlan, billing?.subscriptionStatus);
  const kits = oneTimeOffers().map((offer) => {
    const price = offer.prices[0];
    const label = price?.label ?? "";
    return {
      id: offer.id,
      name: offer.name,
      priceNote: oneTimePriceNote(label, price?.amountCents ?? 0, memberPercent, signed),
      included: signed,
    };
  });
  return (
    <PortalFrame viewer={portal.viewer} tab="billing" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Billing and usage</h1><p>Your plan only. Checkout stays off until payments are turned on, so nothing is charged from those buttons.</p></div>}>
      {stripeNote ? <p className="note">{stripeNote}</p> : null}
      {checkoutNote ? <p className="note">{checkoutNote}</p> : null}
      {account && billing ? (
        <>
          <div className="card stack">
            <p><b>Plan.</b> {account.plan}</p>
            <p><b>Subscription.</b> {billing.summary ?? "No paid plan yet."}</p>
            {billing.purchases.length ? <p><b>Purchases.</b> {billing.purchases.map((purchase) => purchase.name).join(", ")}</p> : null}
            <p className="note">{stripeOn ? "Stripe is on for this server. A payment link still does not charge anyone until they pay it." : "Stripe is off. Payment links, subscriptions, and invoices are ready and do not run."}</p>
            {portal.viewer.role === "creator" ? (
              <>
                <form action={manageBillingAction}>
                  <button className="btn" type="submit">Manage billing</button>
                </form>
                <p className="note">{paymentsOn ? "Opens your Stripe billing page. If that session cannot start, it opens the billing login link instead." : "Payments are off, so this opens the billing login link and does not call Stripe."}</p>
                <form action={prepareHostedEmailLinkAction}>
                  <button className="btn ghost" type="submit">Prepare hosted email payment link</button>
                </form>
              </>
            ) : null}
            <p><b>Add-ons.</b> {account.addOns.length ? account.addOns.join(", ") : "None yet."}</p>
            <div>
              <div className="sec-title">AI credits · {account.usage.tier}</div>
              <p className="note">{account.usage.used} of {account.usage.cap}</p>
              <div className="progress" aria-label="AI credit usage">
                <span style={{ width: `${account.usage.percent}%` }} />
              </div>
              {account.warning ? <p className="private-note">{account.warning}</p> : null}
            </div>
          </div>
          {portal.viewer.role === "creator" ? <BillingOffers enabled={paymentsOn} plans={plans} kits={kits} memberNote={oneTimeMemberNote()} /> : null}
        </>
      ) : (
        <p className="note">Billing is on each creator&apos;s own sign-in. This page does not list anyone else&apos;s plan or credits.</p>
      )}
    </PortalFrame>
  );
}
