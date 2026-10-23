import { markPaymentTimingAction, overrideDepositAction, setDepositStatusAction } from "@/app/deposit-actions";
import { formatMoney } from "@/lib/format";
import type { DealDetail } from "@/lib/types";

export function DealDeposit({
  deal,
  isOwner,
  creatorId,
  notice,
}: {
  deal: DealDetail;
  isOwner: boolean;
  creatorId: string;
  notice: string | null;
}) {
  const deposit = deal.deposit;
  return (
    <div className="box" id="deposit">
      <div className="sec-title">Deposit</div>
      <p data-deposit-status>
        {deposit.statusLabel}
        {isOwner && deposit.amountCents != null ? ` · ${formatMoney(deposit.amountCents)} (50% before filming)` : ""}
      </p>
      {notice ? <p className="note">{notice}</p> : null}
      {isOwner && deposit.status !== "not_required" ? (
        <>
          <p className="note">Manual invoice only. Nothing is sent to Stripe, and nothing is emailed from here.</p>
          <form action={setDepositStatusAction} className="stage-form">
            <input type="hidden" name="dealId" value={deal.id} />
            {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
            <label>
              Status
              <select name="status" defaultValue={deposit.status} aria-label="Deposit status">
                <option value="not_requested">Not requested</option>
                <option value="invoiced">Invoiced</option>
                <option value="received">Received</option>
              </select>
            </label>
            <label>
              Invoiced on
              <input name="invoicedOn" defaultValue={deposit.invoicedOn ?? ""} placeholder="2026-10-21" aria-label="Deposit invoiced on" />
            </label>
            <label>
              Date received
              <input name="receivedOn" defaultValue={deposit.receivedOn ?? ""} placeholder="2026-10-21" aria-label="Deposit received on" />
            </label>
            <button className="btn" type="submit">Save deposit</button>
          </form>
          {deposit.filmingLocked ? (
            <form action={overrideDepositAction} className="stage-form">
              <input type="hidden" name="dealId" value={deal.id} />
              {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
              <label>
                Let filming start before the deposit lands
                <input name="reason" required placeholder="Why this one can start" aria-label="Deposit override reason" />
              </label>
              <button className="btn ghost" type="submit">Override the lock</button>
            </form>
          ) : null}
          {deposit.overrideReason ? <p className="note">Override: {deposit.overrideReason}</p> : null}
          <form action={markPaymentTimingAction} className="stage-form">
            <input type="hidden" name="dealId" value={deal.id} />
            {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
            <p className="note">Mark whether the brand paid this deal on time. One on-time deal lets you move the brand to Net 30. A Net 30 brand that pays more than 10 days late is flagged. Nothing switches on its own.</p>
            <label>
              Due
              <input name="dueOn" placeholder="2026-10-01" aria-label="Brand payment due" />
            </label>
            <label>
              Paid
              <input name="paidOn" placeholder="2026-10-01" aria-label="Brand payment date" />
            </label>
            <button className="btn ghost" type="submit">Save payment timing</button>
          </form>
        </>
      ) : null}
      {isOwner && deposit.status === "not_required" ? <p className="note">Gifted deals and Net 30 brands do not need a deposit before filming.</p> : null}
    </div>
  );
}
