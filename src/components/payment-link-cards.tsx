import { publicPaymentLinks } from "@/lib/stripe-payment-links";

export function PaymentLinkCards() {
  return (
    <div className="public-grid">
      {publicPaymentLinks().map((item) => (
        <article key={item.id} className="card" data-payment-link={item.id}>
          <h2>{item.name}</h2>
          <p><b>{item.priceLabel}</b></p>
          <p><a className="btn" href={item.quoteHref}>{item.quoteLabel}</a></p>
        </article>
      ))}
    </div>
  );
}
