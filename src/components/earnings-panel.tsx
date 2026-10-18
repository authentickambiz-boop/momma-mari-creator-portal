import { Chips } from "./portal-frame";
import { commissionLabel, creatorPayoutTracker, feeAndPayout, formatMoney, monthName, nextPayoutLabel, paidOutCents, paymentStatusLabel, paymentStatusTone, pipelineHeadline } from "@/lib/format";
import type { CreatorProfile, DealSummary, InboxItem, PaymentView } from "@/lib/types";

export function EarningsPanel({
  creator,
  deals,
  payments,
  inbox,
  audience,
}: {
  creator: CreatorProfile;
  deals: DealSummary[];
  payments: PaymentView[];
  inbox: InboxItem[];
  audience: "owner" | "creator";
}) {
  const visible = deals.filter((deal) => deal.visibleToCreator);
  const headline = pipelineHeadline(visible, monthName(new Date()));
  const paid = paidOutCents(payments);
  const paymentByDeal = new Map(payments.map((payment) => [payment.dealId, payment]));
  const owner = audience === "owner";
  return (
    <>
      <div className="stats">
        {owner ? (
          <div className="card stat">
            <div className="n">{formatMoney(headline.cents)}</div>
            <div className="l">{headline.label}</div>
          </div>
        ) : null}
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
                {owner ? <th>Deal amount</th> : null}
                {owner ? <th>When the brand pays</th> : null}
                {owner ? <th>Landed in Momma Mari account</th> : null}
                {owner ? <th>Creator payout</th> : <th>Your payout</th>}
                {owner ? <th>Commission</th> : <th>Momma Mari fee</th>}
                {owner ? null : <th>Brand paid</th>}
                {owner ? null : <th>Your cut sent</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((deal) => {
                const payment = paymentByDeal.get(deal.id);
                const basis = payment?.landedAmountCents ?? payment?.amountOwedCents ?? null;
                const share = feeAndPayout(basis);
                const tracker = creatorPayoutTracker(payment ?? null);
                const status = payment?.paymentStatus
                  ? <span className={`chip ${paymentStatusTone(payment.paymentStatus)}`}>{paymentStatusLabel(payment.paymentStatus, audience)}</span>
                  : deal.earningsChipText
                    ? <span className={`chip ${deal.earningsChipTone ?? "c-gray"}`}>{deal.earningsChipText}</span>
                    : <Chips chips={deal.chips.slice(0, 1)} />;
                return (
                  <tr key={deal.id}>
                    <td>{deal.brand}</td>
                    {owner ? <td>{payment?.amountLabel ?? deal.amountDisplay}</td> : null}
                    {owner ? <td className={payment?.dueLabel?.startsWith("TBD") ? "tbd" : undefined}>{payment?.dueLabel ?? "TBD"}</td> : null}
                    {owner ? <td>{payment?.landedDate ? `${payment.landedDate}${payment.landedAmountCents != null ? ` · ${formatMoney(payment.landedAmountCents)}` : ""}` : "Not yet"}</td> : null}
                    <td className={share.payoutCents == null ? "tbd" : undefined}>
                      {owner ? (share.payoutCents == null ? "Pending" : formatMoney(share.payoutCents)) : tracker.payoutLabel}
                    </td>
                    <td>{owner ? commissionLabel(basis) : tracker.feeLabel}</td>
                    {owner ? null : <td>{tracker.brandPaidOn ?? "Not yet"}</td>}
                    {owner ? null : <td>{tracker.cutSentOn ?? "Not yet"}</td>}
                    <td>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {owner ? (
          <p className="note">
            Momma Mari&apos;s commission is 20% of the brand amount. Her cut is the rest, so the fee and the payout add up to what the brand paid. Nothing is sent until you mark creator paid.
          </p>
        ) : (
          <p className="note">You see when the brand paid, the 20% Momma Mari fee, and when your cut was sent. Kamron marks each step. Nothing is sent automatically.</p>
        )}
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
