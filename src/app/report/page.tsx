import { draftReportAction } from "@/app/actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { buildMonthlyReport, currentMonth } from "@/lib/report";
import { redirect } from "next/navigation";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; month?: string; drafted?: string; reportError?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role === "manager") redirect("/");
  const creator = portal.viewed ?? portal.creators[0];
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth();
  const built = creator ? await buildMonthlyReport(portal.db, creator.id, month) : null;
  const report = built?.ok ? built.report : null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="report"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>{report ? `${report.monthLabel} report` : "Monthly report"}</h1>
            <p>Earnings, deals, and growth. The email waits in the approval queue. Nothing is sent on its own.</p>
          </div>
        </div>
      }
    >
      {params.drafted === "1" ? (
        <div className="callout">
          <b>This month&apos;s report is in the approval queue. Nothing was sent.</b>
        </div>
      ) : null}
      {params.reportError === "queued" ? <p className="note">This month&apos;s report is already in the approval queue. Nothing was sent.</p> : null}
      {params.reportError === "1" ? <p className="note">That report was not queued. Nothing was sent.</p> : null}
      {!report ? (
        <div className="card"><p>That report isn&apos;t available.</p></div>
      ) : (
        <div className="stack">
          <section className="card">
            <div className="sec-title">Earnings</div>
            <p>Your cut sent: {report.earnings.paidLabel}</p>
            {report.earnings.dealsPaid.length === 0 ? <p className="note">No cut was sent this month.</p> : null}
            <ul>
              {report.earnings.dealsPaid.map((row) => (
                <li key={row.brand}>{row.brand}: {row.payoutLabel}</li>
              ))}
            </ul>
          </section>
          <section className="card">
            <div className="sec-title">Deals</div>
            {report.deals.length === 0 ? <p className="note">No deals moved this month.</p> : null}
            <ul>
              {report.deals.map((row) => (
                <li key={row.brand}>{row.brand}: {row.stageLabel}</li>
              ))}
            </ul>
          </section>
          <section className="card">
            <div className="sec-title">Growth</div>
            <p>{report.growth.followers == null ? "Followers: no new numbers this month." : `Followers: ${report.growth.followers.toLocaleString("en-US")}`}</p>
            {report.growth.followerChange == null ? null : (
              <p>Change: {report.growth.followerChange >= 0 ? "+" : ""}{report.growth.followerChange.toLocaleString("en-US")}</p>
            )}
            <p>{report.growth.views == null ? "Views: no new numbers this month." : `Views: ${report.growth.views.toLocaleString("en-US")}`}</p>
          </section>
          <section className="card">
            <div className="sec-title">Email</div>
            <p><b>{report.email.subject}</b></p>
            <pre className="note" style={{ whiteSpace: "pre-wrap" }}>{report.email.body}</pre>
            {portal.viewer.role === "admin" && creator ? (
              <form action={draftReportAction} className="stage-form">
                <input type="hidden" name="creatorId" value={creator.id} />
                <input type="hidden" name="month" value={month} />
                <button className="btn" type="submit">Draft the email</button>
              </form>
            ) : (
              <p className="note">Only Kamron can draft the monthly report.</p>
            )}
          </section>
        </div>
      )}
    </PortalFrame>
  );
}
