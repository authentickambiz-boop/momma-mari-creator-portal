import { prepareHostedEmailLinkAction } from "@/app/billing-actions";
import { PortalFrame } from "@/components/portal-frame";
import { readOwnAccount } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";
import { stripeLiveEnabled } from "@/lib/stripe-billing";

const STRIPE_NOTES: Record<string, string> = {
  off: "Stripe is off. Nothing was charged.",
  error: "That payment link was not created. Nothing was charged.",
  ready: "Stripe prepared a payment link. The customer is not charged until they pay it.",
  creator_only: "Payment links are prepared from the creator's own sign-in.",
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const account = await readOwnAccount(portal.db, portal.viewer);
  const stripeNote = params.stripe ? STRIPE_NOTES[params.stripe] : null;
  const stripeOn = stripeLiveEnabled();
  return (
    <PortalFrame viewer={portal.viewer} tab="billing" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Billing and usage</h1><p>Your plan only. Stripe stays off until live keys exist, so nothing is charged.</p></div>}>
      {stripeNote ? <p className="note">{stripeNote}</p> : null}
      {account ? (
        <div className="card stack">
          <p><b>Plan.</b> {account.plan}</p>
          <p className="note">{stripeOn ? "Stripe is on for this server. A payment link still does not charge anyone until they pay it." : "Stripe is off. Payment links, subscriptions, and invoices are ready and do not run."}</p>
          {portal.viewer.role === "creator" ? (
            <form action={prepareHostedEmailLinkAction}>
              <button className="btn ghost" type="submit">Prepare hosted email payment link</button>
            </form>
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
      ) : (
        <p className="note">Billing is on each creator&apos;s own sign-in. This page does not list anyone else&apos;s plan or credits.</p>
      )}
    </PortalFrame>
  );
}
