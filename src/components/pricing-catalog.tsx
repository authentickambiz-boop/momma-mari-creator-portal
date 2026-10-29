import Link from "next/link";
import { PlanBuyCards } from "@/components/plan-buy-cards";
import { PublicShell } from "@/components/public-shell";
import { PRICE_NOT_SET, pricingPageModel, type ShownPrice, type ShownService } from "@/lib/pricing-page";
import { publicPlans } from "@/lib/stripe-payment-links";

function PriceLine({ price }: { price: ShownPrice }) {
  if (price.placeholder) {
    return <p className="note" data-price-placeholder="true">{price.text}</p>;
  }
  return <p><b>{price.text}</b></p>;
}

function ServiceCard({ service }: { service: ShownService }) {
  return (
    <article className="card" data-service={service.id}>
      <h2>{service.name}</h2>
      {service.placeholder ? (
        <p className="note" data-price-placeholder="true">{service.price}</p>
      ) : (
        <>
          <p><b>{service.price}</b></p>
          {service.plus ? <p className="note">{service.plus}</p> : null}
          {service.pro ? <p className="note">{service.pro}</p> : null}
          {service.business ? <p className="note">{service.business}</p> : null}
          {service.quoteHref ? <p><a className="btn" href={service.quoteHref}>{service.quoteLabel}</a></p> : null}
        </>
      )}
    </article>
  );
}

export function PricingCatalog({ preview }: { preview: boolean }) {
  const model = pricingPageModel(preview);
  return (
    <PublicShell title="Plans & Services" lede="Plus, Pro, and Business, plus one-time help for media kits, rate cards, contract reviews, and starter kits.">
      {preview ? (
        <p className="note" data-pricing-preview="true">
          Owner preview. Set PRICING_PAGE_ENABLED to true when this page should be public. A missing catalog price says &quot;{PRICE_NOT_SET}&quot;
        </p>
      ) : null}
      <div className="sec-title">Plans</div>
      {preview ? (
        <div className="public-grid">
          {model.plans.map((plan) => (
            <article key={plan.id} className="card" data-plan={plan.id}>
              <h2>{plan.name}</h2>
              {plan.prices.map((price) => <PriceLine key={price.interval} price={price} />)}
            </article>
          ))}
        </div>
      ) : (
        <PlanBuyCards plans={publicPlans()} />
      )}
      <div className="sec-title">Services</div>
      {model.groups.map((group) => (
        <section key={group.id} data-service-group={group.id}>
          <div className="sec-title">{group.title}</div>
          <div className="public-grid">
            {group.services.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
        </section>
      ))}
      <section className="card stack" data-pricing-fees="true">
        <h2>How the fee works</h2>
        <p>{model.fee.selfServe}</p>
        <p>{model.fee.signed}</p>
        <p>{model.fee.members}</p>
        <p className="note">Nothing is charged from this page.</p>
      </section>
      <p><Link className="btn" href="/apply">Apply to join</Link></p>
    </PublicShell>
  );
}
