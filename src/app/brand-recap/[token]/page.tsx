import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { withBasePath } from "@/lib/format";
import { NOT_REPORTED, publicBrandRecap } from "@/lib/brand-recap";
import { recapMetricCards } from "@/lib/brand-recap-report";

export const metadata = {
  title: "Campaign recap · Momma Mari",
  robots: { index: false, follow: false },
};

export default async function BrandRecapPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await publicBrandRecap(await getDb(), token);
  if (!report) notFound();
  const cards = recapMetricCards(report);
  return (
    <PublicShell title={report.title} lede={`${report.creatorName} for ${report.brand}. Live since ${report.goLiveOn}.`}>
      <article className="card stack recap-sheet">
        {report.goal ? (
          <div className="kpi">
            <div className="sec-title">Target vs. result</div>
            <p>{report.goal.label}</p>
            <p>Target: {report.goal.target}</p>
            {report.goal.resultStatus === "reported" && report.goal.result ? (
              <p>Result: {report.goal.result}{report.goal.resultWindow ? ` · ${report.goal.resultWindow}` : ""}{report.goal.resultSource ? ` · ${report.goal.resultSource}` : ""}</p>
            ) : <p>Result: Pending</p>}
          </div>
        ) : null}
        <div className="sec-title">Deliverables</div>
        {report.deliverableLog.length === 0 ? (
          report.deliverables.length === 0 ? <p>Deliverables: {NOT_REPORTED}</p> : (
            <ul>
              {report.deliverables.map((line) => <li key={line}>{line}</li>)}
            </ul>
          )
        ) : (
          <ul>
            {report.deliverableLog.map((row) => (
              <li key={`${row.label}-${row.url ?? "pending"}`}>
                {row.status === "pending" ? `${row.label} · Pending` : (
                  <>
                    {row.label}
                    {" · "}
                    {row.platformLabel ?? "Post"}
                    {" · "}
                    {row.postedOn ?? "Posted date pending"}
                    {" · "}
                    {row.url ? <a href={row.url}>{row.url}</a> : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="sec-title">Content</div>
        {report.contentLinks.length === 0 ? <p>Content links: {NOT_REPORTED}</p> : (
          <ul>
            {report.contentLinks.map((link) => (
              <li key={link}><a href={link}>{link}</a></li>
            ))}
          </ul>
        )}
        {cards.length > 0 ? (
          <>
            <div className="sec-title">Results</div>
            <div className="kpi-row">
              {cards.map((card) => (
                <article className="kpi" key={`${card.kind}-${card.label}-${card.windowLabel ?? ""}-${card.value}`}>
                  <div className="sec-title">{card.label}</div>
                  <b>{card.value}</b>
                  {card.detail ? <p>{card.detail}</p> : null}
                </article>
              ))}
            </div>
          </>
        ) : null}
        <p>Usage rights end date: {report.usageEndsOn ?? NOT_REPORTED}</p>
        {report.nextCampaignNote ? (
          <>
            <div className="sec-title">Next campaign</div>
            <p style={{ whiteSpace: "pre-wrap" }}>{report.nextCampaignNote}</p>
          </>
        ) : null}
      </article>
      {/* Payments stay off. This page only links to the brief. */}
      <p><a className="btn" href={report.rebookHref}>Rebook or extend usage</a></p>
      <p><a className="btn ghost" href={withBasePath(`/brand-recap/${token}/csv`)}>Download CSV</a></p>
      <p className="note">Print or share this page. Tell us about the next campaign, or about extending usage. We reply within 3 business days.</p>
    </PublicShell>
  );
}
