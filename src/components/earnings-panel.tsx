import { Chips } from "./portal-frame";
import { creatorCutLabel, formatMoney, monthName, nextPayoutLabel, paidOutCents, pipelineHeadline } from "@/lib/format";
import type { CreatorProfile, DealSummary, InboxItem, PaymentView } from "@/lib/types";

export function EarningsPanel({
  creator,
  deals,
  payments,
  inbox,
}: {
  creator: CreatorProfile;
  deals: DealSummary[];
  payments: PaymentView[];
  inbox: InboxItem[];
}) {
  const visible = deals.filter((deal) => deal.visibleToCreator);
  const headline = pipelineHeadline(visible, monthName(new Date()));
  const paid = paidOutCents(payments);
  const paymentByDeal = new Map(payments.map((payment) => [payment.dealId, payment]));
  return (
    <>
      <div className="stats">
        <div className="card stat">
          <div className="n">{formatMoney(headline.cents)}</div>
          <div className="l">{headline.label}</div>
        </div>
        <div className="card stat">
          <div className="n">{creator.monthlyGoalCents != null ? formatMoney(creator.monthlyGoalCents) : "—"}</div>
          <div className="l">Monthly goal</div>
        </div>
        <div className="card stat">
          <div className="n">{formatMoney(paid)}</div>
          <div className="l">
            {paid === 0 ? "Paid out through Momma Mari so far (no deal paid yet)" : "Paid out through Momma Mari"}
          </div>
        </div>
        <div className="card stat">
          <div className="n">{nextPayoutLabel(new Date())}</div>
          <div className="l">Next payout review. Kamron approves payouts every Monday.</div>
        </div>
      </div>
      <div className="card">
        <div className="sec-title">Money by deal</div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Deal amount</th>
                <th>When the brand pays</th>
                <th>Landed in Momma Mari account</th>
                <th>Your cut</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((deal) => {
                const payment = paymentByDeal.get(deal.id);
                const basis = payment?.landedAmountCents ?? payment?.amountOwedCents ?? null;
                return (
                  <tr key={deal.id}>
                    <td>{deal.brand}</td>
                    <td>{payment?.amountLabel ?? deal.amountDisplay}</td>
                    <td className={payment?.dueLabel?.startsWith("TBD") ? "tbd" : undefined}>{payment?.dueLabel ?? "TBD"}</td>
                    <td>{payment?.landedDate ? `${payment.landedDate}${payment.landedAmountCents != null ? ` · ${formatMoney(payment.landedAmountCents)}` : ""}` : "Not yet"}</td>
                    <td className={creator.splitPercent == null ? "tbd" : undefined}>{creatorCutLabel(creator.splitPercent, basis)}</td>
                    <td>{deal.earningsChipText ? <span className={`chip ${deal.earningsChipTone ?? "c-gray"}`}>{deal.earningsChipText}</span> : <Chips chips={deal.chips.slice(0, 1)} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note">
          {creator.splitPercent == null
            ? "The agency/creator split isn't set yet. Your cut says pending contract until Kamron uploads the contract terms. Once the split is set, your cut fills in when each payment lands."
            : `Your split is ${creator.splitPercent}%. The agency keeps ${100 - creator.splitPercent}%. Payouts still wait for Kamron's Monday approval.`}
        </p>
      </div>
      {inbox.length > 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Other money seen in your inbox, Oct 3–17 (not from Momma Mari deals)</div>
          <table>
            <thead><tr><th>Date</th><th>From</th><th>Amount</th></tr></thead>
            <tbody>
              {inbox.map((item) => (
                <tr key={item.id}>
                  <td>{item.occurredOn}</td>
                  <td>{item.source}</td>
                  <td className={item.amountLabel === "TBD" ? "tbd" : undefined}>{item.amountLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Seed data from the mockup. The portal does not read a live inbox, and personal bills are not copied here.</p>
        </div>
      ) : null}
    </>
  );
}
