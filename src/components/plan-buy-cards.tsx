"use client";

import { useState } from "react";
import { BUY_NOW_LABEL, type PublicPlan } from "@/lib/stripe-payment-links";

function PlanBuyCard({ plan }: { plan: PublicPlan }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const price = plan.prices.find((item) => item.interval === interval) ?? plan.prices[0];
  return (
    <article className="card" data-plan={plan.id}>
      <h2>{plan.name}</h2>
      <ul>
        {plan.features.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p><b>{price?.label}</b></p>
      <div className="switcher" role="group" aria-label={`${plan.name} billing period`}>
        <button type="button" className={interval === "month" ? "on" : ""} aria-pressed={interval === "month"} onClick={() => setInterval("month")}>Monthly</button>
        <button type="button" className={interval === "year" ? "on" : ""} aria-pressed={interval === "year"} onClick={() => setInterval("year")}>Yearly</button>
      </div>
      {price ? <p><a className="btn" href={price.href} data-plan-interval={price.interval}>{BUY_NOW_LABEL}</a></p> : null}
    </article>
  );
}

export function PlanBuyCards({ plans }: { plans: PublicPlan[] }) {
  return (
    <div className="public-grid">
      {plans.map((plan) => <PlanBuyCard key={plan.id} plan={plan} />)}
    </div>
  );
}
