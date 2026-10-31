import Link from "next/link";
import { pricingComparison, type ComparisonColumn } from "@/lib/pricing-comparison";

function TierButtons({ columns }: { columns: ComparisonColumn[] }) {
  return (
    <div className="tier-actions">
      {columns.map((column) => (
        <p key={column.id} className={column.highlight ? "tier-action is-highlight" : "tier-action"} data-tier={column.id}>
          <a className="btn" href={column.href} data-tier-button={column.id}>{column.button}</a>
        </p>
      ))}
    </div>
  );
}

export function PricingComparison() {
  const model = pricingComparison();
  return (
    <section className="card stack" data-pricing-comparison="true">
      <h2>Compare Free, Plus, Pro, and Business</h2>
      <p>Pro and Business are highlighted. You can start there instead of stepping through Plus.</p>
      <TierButtons columns={model.columns} />
      <div className="tier-table-wrap">
        <table className="tier-table">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              {model.columns.map((column) => (
                <th key={column.id} scope="col" className={column.featured ? "is-top" : column.highlight ? "is-highlight" : ""} data-tier={column.id}>
                  {column.name}
                  <span>{column.price}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.feature}>
                <th scope="row">{row.feature}</th>
                <td>{row.free}</td>
                <td>{row.plus}</td>
                <td className="is-highlight">{row.pro}</td>
                <td className="is-top">{row.business}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TierButtons columns={model.columns} />
      <p className="note">Plus is <Link href="/pricing">$19/mo</Link>. Pro is $39/mo. Business is $199/mo. One-time services run from $79 to $499. The buttons open the live Stripe checkout links.</p>
    </section>
  );
}
