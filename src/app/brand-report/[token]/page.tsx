import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { publicBrandReport } from "@/lib/brand-report";
import { REPLY_PROMISE } from "@/lib/public-site";

export const metadata = {
  title: "Campaign report · Momma Mari",
  robots: { index: false, follow: false },
};

function line(label: string, value: string | null) {
  return <p>{label}: {value ?? "Numbers will show here once the campaign is measured."}</p>;
}

export default async function BrandReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const report = await publicBrandReport(await getDb(), token);
  if (!report) notFound();
  return (
    <PublicShell title={report.title} lede={`${report.brand} with ${report.creatorName}.`}>
      <section className="card stack">
        {line("Views", report.views)}
        {line("Engagement", report.engagement)}
        {line("Clicks", report.clicks)}
        {line("Comments", report.comments)}
        <p>Content: {report.links ?? "Links will show here once the posts are live."}</p>
        <p>Usage ends: {report.usageEndsOn ?? "No usage window on file."}</p>
        <p>Exclusivity ends: {report.exclusivityEndsOn ?? "No exclusivity window on file."}</p>
      </section>
      {/* Priced packages and invoices stay behind PAYMENTS_ENABLED. This page only links to the brief. */}
      <p><Link className="btn" href={report.rebookHref}>Rebook</Link></p>
      <p className="note">Tell us about the next campaign, or about extending usage. {REPLY_PROMISE}</p>
    </PublicShell>
  );
}
