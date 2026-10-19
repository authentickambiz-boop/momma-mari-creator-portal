import { PortalFrame } from "@/components/portal-frame";
import { readOwnAccount } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";

export default async function BillingPage() {
  const portal = await loadPortal(null);
  const account = await readOwnAccount(portal.db, portal.viewer);
  return (
    <PortalFrame viewer={portal.viewer} tab="billing" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Billing and usage</h1><p>Your plan only. Stripe is not connected yet, so nothing is charged.</p></div>}>
      {account ? (
        <div className="card stack">
          <p><b>Plan.</b> {account.plan}</p>
          <p className="note">Stripe isn&apos;t connected yet. This plan is a placeholder.</p>
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
