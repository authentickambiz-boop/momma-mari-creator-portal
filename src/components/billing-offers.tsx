"use client";

import { useState } from "react";
import { startCheckoutAction } from "@/app/billing-actions";

type PlanPrice = { interval: "month" | "year"; label: string };
type PlanOffer = { id: string; name: string; prices: PlanPrice[] };
type KitOffer = { id: string; name: string; label: string };

function ComingSoon() {
  return <button className="btn" type="button" disabled>Coming soon</button>;
}

function PlanCard({ plan, enabled }: { plan: PlanOffer; enabled: boolean }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const price = plan.prices.find((item) => item.interval === interval) ?? plan.prices[0];
  return (
    <article className="card">
      <div className="sec-title">{plan.name}</div>
      <b>{price?.label}</b>
      <div className="switcher" role="group" aria-label={`${plan.name} billing period`}>
        <button type="button" className={interval === "month" ? "on" : ""} aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Monthly</button>
        <button type="button" className={interval === "year" ? "on" : ""} aria-pressed={interval === "year"} onClick={() => setInterval("year")}>Yearly</button>
      </div>
      {enabled && price ? (
        <form action={startCheckoutAction}>
          <input type="hidden" name="offer" value={plan.id} />
          <input type="hidden" name="interval" value={price.interval} />
          <button className="btn" type="submit">Subscribe</button>
        </form>
      ) : (
        <ComingSoon />
      )}
    </article>
  );
}

function KitCard({ kit, enabled }: { kit: KitOffer; enabled: boolean }) {
  return (
    <article className="card">
      <div className="sec-title">One-time</div>
      <b>{kit.name}</b>
      <p className="note">{kit.label}</p>
      {enabled ? (
        <form action={startCheckoutAction}>
          <input type="hidden" name="offer" value={kit.id} />
          <input type="hidden" name="interval" value="one_time" />
          <button className="btn" type="submit">Buy</button>
        </form>
      ) : (
        <ComingSoon />
      )}
    </article>
  );
}

export function BillingOffers({
  enabled,
  plans,
  kits,
}: {
  enabled: boolean;
  plans: PlanOffer[];
  kits: KitOffer[];
}) {
  return (
    <>
      <div className="sec-title">Plans</div>
      <p className="note">{enabled ? "Checkout opens on Stripe. You are not charged until you pay there." : "Payments are off. These buttons stay on Coming soon, and nothing calls Stripe."}</p>
      <div className="offer-grid">
        {plans.map((plan) => <PlanCard key={plan.id} plan={plan} enabled={enabled} />)}
      </div>
      <div className="sec-title">Kits and one-time</div>
      <div className="offer-grid">
        {kits.map((kit) => <KitCard key={kit.id} kit={kit} enabled={enabled} />)}
      </div>
    </>
  );
}
