import { openBrandReportAction } from "@/app/brand-report-actions";
import { dealReviewLabel } from "@/lib/creator-deal-review";
import type { ExpiryAlert } from "@/lib/usage";

type Review = {
  id: string;
  brand: string;
  creatorName: string;
  decision: string | null;
  counterNote: string | null;
  offerLabel: string;
  contactEmail: string;
};

type ReportLink = { token: string; brand: string; title: string };

type DealChoice = { id: string; brand: string };

export function OwnerSignals({
  alerts,
  reviews,
  reports,
  deals,
}: {
  alerts: ExpiryAlert[];
  reviews: Review[];
  reports: ReportLink[];
  deals: DealChoice[];
}) {
  return (
    <>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Rights expiring</div>
        {alerts.length === 0 ? <p className="note empty">No usage or exclusivity date is inside 14 days.</p> : (
          <ul>
            {alerts.map((alert) => (
              <li key={`${alert.dealId}-${alert.kind}`}>
                {alert.kind === "usage" ? "Usage" : "Exclusivity"} for {alert.brand}
                {alert.category ? ` (${alert.category})` : ""} {alert.status === "expired" ? "ended" : "ends"} {alert.endsOn}.
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Creator decisions</div>
        <p className="note">Accept, counter, and pass are saved here. Nothing is emailed.</p>
        {reviews.length === 0 ? <p className="note empty">No offers are waiting for a creator.</p> : (
          <ul>
            {reviews.map((review) => (
              <li key={review.id}>
                {review.creatorName} · {review.brand} · {review.offerLabel} · {dealReviewLabel(review.decision)}
                {review.counterNote ? ` · ${review.counterNote}` : ""}
                <span className="note"> · {review.contactEmail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Brand reports</div>
        <p className="note">A brand can open the report and rebook from the brief. Payments are off, so this does not show a price or an invoice.</p>
        {deals.length > 0 ? (
          <form action={openBrandReportAction} className="stage-form">
            <label>Deal
              <select name="dealId" defaultValue={deals[0]?.id ?? ""}>
                {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.brand}</option>)}
              </select>
            </label>
            <button className="btn" type="submit">Open brand report</button>
          </form>
        ) : <p className="note empty">No deals yet.</p>}
        {reports.length > 0 ? (
          <ul>
            {reports.map((report) => (
              <li key={report.token}><a href={`/brand-report/${report.token}`}>{report.title}</a></li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}
