import { markBrandPaidAction, markCreatorPaidAction, recordPayoutAction, uploadW9Action } from "@/app/payout-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";
import { form1099Totals, listCreatorW9s, listPayoutLedger, payoutTransfersEnabled } from "@/lib/payout-ledger";

function payoutNote(code: string | undefined, saved: string | undefined) {
  if (saved === "1") return "Saved. Nothing was sent to a bank.";
  if (saved === "brand") return "The brand payment date is saved. The creator is not paid yet.";
  if (saved === "paid") return "The creator payout date is saved. No transfer was sent.";
  if (saved === "w9") return "The W-9 is stored encrypted.";
  if (code === "amount") return "Check the dollar amounts. Fees and expenses come off the gross first. Nothing was saved.";
  if (code === "brand") return "The brand has to pay before the creator is paid. Nothing was changed.";
  if (code === "date") return "Use a YYYY-MM-DD date. Nothing was saved.";
  if (code === "file") return "Upload a PDF or a photo of the W-9. Nothing was saved.";
  if (code === "forbidden") return "That payout stays with the owner or that creator.";
  if (code === "missing") return "That payout line was not found.";
  return null;
}

export default async function PayoutsPage({ searchParams }: { searchParams: Promise<{ creator?: string; error?: string; saved?: string; year?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const note = payoutNote(params.error, params.saved);
  if (portal.viewer.role === "manager") {
    return (
      <PortalFrame viewer={portal.viewer} tab="payouts" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Payout ledger</h1>}>
        <p className="note">Payouts stay on the owner&apos;s sign-in and each creator&apos;s own sign-in.</p>
      </PortalFrame>
    );
  }
  const year = Number(params.year ?? new Date().getFullYear());
  const ledger = await listPayoutLedger(portal.db, portal.viewer);
  const tax = await form1099Totals(portal.db, portal.viewer, Number.isInteger(year) ? year : new Date().getFullYear());
  const w9s = await listCreatorW9s(portal.db, portal.viewer, portal.viewer.role === "creator" ? portal.viewer.creatorId : null);
  const owner = portal.viewer.role === "admin";
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="payouts"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Payout ledger</h1><p>Fees and expenses come off the gross first. The creator keeps 80% of what is left. A creator is paid only after the brand pays. Nothing here sends money.</p></div></div>}
    >
      {note ? <p className="note">{note}</p> : null}
      <p className="note">{payoutTransfersEnabled() ? "Payout transfers are on, but this page still only records a date." : "Payout transfers are off. Marking a line paid only writes the date."}</p>
      {owner ? (
        <form action={recordPayoutAction} className="card stack">
          <div className="sec-title">Add a line</div>
          <label>
            Creator
            <select name="creatorId" required aria-label="Creator">
              {portal.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
            </select>
          </label>
          <label>Brand<input name="brand" required aria-label="Brand" /></label>
          <label>Gross dollars<input name="gross" inputMode="decimal" required aria-label="Gross" /></label>
          <label>Fees<input name="fees" inputMode="decimal" placeholder="0" aria-label="Fees" /></label>
          <label>Expenses<input name="expenses" inputMode="decimal" placeholder="0" aria-label="Expenses" /></label>
          <label>Brand paid on<input name="brandPaidOn" placeholder="2026-10-21" aria-label="Brand paid on" /></label>
          <label>Note<input name="note" aria-label="Note" /></label>
          <button className="btn" type="submit">Save line</button>
        </form>
      ) : null}
      <section className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">1099 total for {Number.isInteger(year) ? year : ""}</div>
        <p className="note">This is the creator share of lines paid in that year. Unpaid lines are left out. It is a total for the CPA, not a filed form.</p>
        {tax.ok && tax.totals.length === 0 ? <p className="note empty">No paid lines in that year.</p> : null}
        {tax.ok ? tax.totals.map((total) => (
          <p key={total.creatorId}><b>{total.creatorName}</b> · {formatMoney(total.creatorCents)}</p>
        )) : null}
        {owner ? <p><a href={`/payouts/export?year=${year}`}>Download the CPA spreadsheet</a></p> : null}
      </section>
      <section className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">W-9</div>
        <p className="note">The file is encrypted before it is stored. The portal does not show the form on this page.</p>
        {w9s.ok && w9s.files.length === 0 ? <p className="note empty">No W-9 yet.</p> : null}
        {w9s.ok ? w9s.files.map((file) => (
          <p key={file.id}><a href={`/payouts/w9/${file.id}`}>{file.filename}</a> · {file.createdAt.slice(0, 10)}</p>
        )) : null}
        <form action={uploadW9Action} className="stack">
          {owner ? (
            <label>
              Creator
              <select name="creatorId" aria-label="W-9 creator">
                {portal.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
              </select>
            </label>
          ) : null}
          <label>File<input name="w9" type="file" accept="application/pdf,image/jpeg,image/png" required aria-label="W-9 file" /></label>
          <button className="btn" type="submit">Upload W-9</button>
        </form>
      </section>
      {ledger.ok ? ledger.weeks.map((week) => (
        <section key={week.weekOf} className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Week of {week.weekOf}</div>
          <p className="note">Creators {formatMoney(week.creatorCents)} · Agency {formatMoney(week.agencyCents)}</p>
          <LedgerTable lines={week.lines} owner={owner} />
        </section>
      )) : null}
      {ledger.ok && ledger.waiting.length > 0 ? (
        <section className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Not paid to the creator yet</div>
          <LedgerTable lines={ledger.waiting} owner={owner} />
        </section>
      ) : null}
    </PortalFrame>
  );
}

function LedgerTable({ lines, owner }: { lines: { id: string; creatorName: string; brand: string; grossCents: number; feeCents: number; expenseCents: number; creatorCents: number; agencyCents: number; brandPaidOn: string | null; payoutOn: string | null }[]; owner: boolean }) {
  return (
    <table>
      <thead>
        <tr><th>Creator</th><th>Brand</th><th>Gross</th><th>Fees</th><th>Expenses</th><th>Creator 80%</th><th>Agency 20%</th><th>Brand paid</th><th>Creator paid</th></tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id}>
            <td>{line.creatorName}</td>
            <td>{line.brand}</td>
            <td>{formatMoney(line.grossCents)}</td>
            <td>{formatMoney(line.feeCents)}</td>
            <td>{formatMoney(line.expenseCents)}</td>
            <td>{formatMoney(line.creatorCents)}</td>
            <td>{formatMoney(line.agencyCents)}</td>
            <td>
              {line.brandPaidOn ?? "Waiting"}
              {owner && !line.brandPaidOn ? (
                <form action={markBrandPaidAction}>
                  <input type="hidden" name="lineId" value={line.id} />
                  <input name="brandPaidOn" required aria-label={`Brand paid date for ${line.brand}`} placeholder="YYYY-MM-DD" />
                  <button className="btn ghost" type="submit">Mark brand paid</button>
                </form>
              ) : null}
            </td>
            <td>
              {line.payoutOn ?? "Not yet"}
              {owner && line.brandPaidOn && !line.payoutOn ? (
                <form action={markCreatorPaidAction}>
                  <input type="hidden" name="lineId" value={line.id} />
                  <input name="payoutOn" required aria-label={`Creator paid date for ${line.brand}`} placeholder="YYYY-MM-DD" />
                  <button className="btn ghost" type="submit">Mark creator paid</button>
                </form>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
