import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { NOT_REPORTED, publicBrandRecap } from "@/lib/brand-recap";

export const metadata = {
  title: "Campaign recap · Momma Mari",
  robots: { index: false, follow: false },
};

export default async function BrandRecapPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await publicBrandRecap(await getDb(), token);
  if (!report) notFound();
  return (
    <PublicShell title={report.title} lede={`${report.creatorName} for ${report.brand}. Live since ${report.goLiveOn}.`}>
      <article className="card stack recap-sheet">
        <div className="sec-title">Deliverables</div>
        {report.deliverables.length === 0 ? <p>Deliverables: {NOT_REPORTED}</p> : (
          <ul>
            {report.deliverables.map((line) => <li key={line}>{line}</li>)}
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
        <div className="sec-title">Results</div>
        {report.metrics.map((metric) => <p key={metric.label}>{metric.label}: {metric.value}</p>)}
        <p>Usage rights end date: {report.usageEndsOn ?? NOT_REPORTED}</p>
      </article>
      {/* Payments stay off. This page only links to the brief. */}
      <p><a className="btn" href={report.rebookHref}>Rebook or extend usage</a></p>
      <p className="note">Print or share this page. Tell us about the next campaign, or about extending usage. We reply within 3 business days.</p>
    </PublicShell>
  );
}
