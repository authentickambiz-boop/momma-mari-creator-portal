import Link from "next/link";
import type { GiftGuideReservationView } from "@/lib/gift-guide";
import { summarizeGiftGuide } from "@/lib/gift-guide";

type Summary = ReturnType<typeof summarizeGiftGuide>;

function videoLabel(count: number) {
  if (count === 1) return "1 video";
  return `${count} videos`;
}

export function GiftGuideReservationsPanel({
  summary,
  reservations,
}: {
  summary: Summary;
  reservations: GiftGuideReservationView[];
}) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Gift guide reservations</div>
      <p className="note">
        Reservations are free. Nothing is charged from this screen. Confirmation drafts wait on <Link href="/approvals">Approvals</Link>.
      </p>
      <p>
        <b>{summary.total}</b> requested.
        {" "}Roundup slots requested: <b>{summary.roundupSlotsRequested}</b>.
        {" "}Each roundup video holds at most {summary.productsPerRoundup} products.
      </p>
      <p className="note">
        Bench slots requested: {summary.benchSlotsRequested} ({videoLabel(summary.benchVideosNeeded)}).
        {" "}Roster slots requested: {summary.rosterSlotsRequested} ({videoLabel(summary.rosterVideosNeeded)}).
        {" "}Web listings and dedicated headliner videos are counted below and do not take a roundup slot.
      </p>
      <table>
        <thead><tr><th>Package</th><th>Requested</th></tr></thead>
        <tbody>
          {summary.byPackage.map((row) => (
            <tr key={row.id}><td>{row.name}</td><td>{row.count}</td></tr>
          ))}
        </tbody>
      </table>
      <table>
        <thead><tr><th>Category</th><th>Requested</th></tr></thead>
        <tbody>
          {summary.byCategory.map((row) => (
            <tr key={row.id}><td>{row.name}</td><td>{row.count}</td></tr>
          ))}
        </tbody>
      </table>
      {reservations.length === 0 ? <p className="note empty">No gift guide reservations yet.</p> : (
        <table>
          <thead>
            <tr><th>Brand</th><th>Product</th><th>Category</th><th>Package</th><th>Status</th></tr>
          </thead>
          <tbody>
            {reservations.map((row) => (
              <tr key={row.id}>
                <td>{row.brandName}<div className="note">{row.contactName} · {row.email}</div></td>
                <td>{row.productName}<div className="note">{row.retailPriceLabel}</div></td>
                <td>{row.categoryLabel}</td>
                <td>{row.packageName}<div className="note">{row.priceLabel}</div></td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
