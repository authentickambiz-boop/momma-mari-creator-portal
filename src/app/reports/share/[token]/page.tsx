import { getDb } from "@/db/getDb";
import { sharedReport } from "@/lib/rank-reports";

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const report = await sharedReport(db, token);
  if (!report) {
    return <main className="wrap"><h1>Report</h1><p className="note">That link does not match a report.</p></main>;
  }
  return (
    <main className="wrap">
      <h1>{report.title}</h1>
      {report.sections.map((section) => (
        <section className="card" key={section.heading} style={{ marginTop: 14 }}>
          <div className="sec-title">{section.heading}</div>
          {section.lines.map((line) => <p key={line}>{line}</p>)}
        </section>
      ))}
    </main>
  );
}
