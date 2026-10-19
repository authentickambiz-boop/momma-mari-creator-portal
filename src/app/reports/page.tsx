import Link from "next/link";
import { createReportAction } from "@/app/growth-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { withBasePath } from "@/lib/format";
import { listManagers } from "@/lib/managers";
import { listRankReports } from "@/lib/rank-reports";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; growthError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="reports" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Reports</h1>}>
        <p className="note">Rank reports stay on the owner's sign-in.</p>
      </PortalFrame>
    );
  }
  const reports = await listRankReports(portal.db, portal.viewer);
  const managers = await listManagers(portal.db);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="reports"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Reports</h1><p>Build a creator, team, or cross-team report. You choose the sections, and whether rank numbers are on the copy.</p></div></div>}
    >
      {params.saved ? <p className="note">Saved. The share link shows only what you included.</p> : null}
      {params.growthError ? <p className="private-note">{params.growthError}</p> : null}
      <form action={createReportAction} className="card stack">
        <label>
          Level
          <select name="level" defaultValue="creator">
            <option value="creator">One creator</option>
            <option value="team">One manager's team</option>
            <option value="cross">Cross-team comparison</option>
          </select>
        </label>
        <label>
          Creator or manager
          <select name="subjectId">
            {portal.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
            {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name} (manager)</option>)}
          </select>
        </label>
        <label><input type="checkbox" name="breakdown" value="1" defaultChecked /> Score breakdown</label>
        <label><input type="checkbox" name="strengths" value="1" defaultChecked /> Strengths</label>
        <label><input type="checkbox" name="improve" value="1" defaultChecked /> Room to grow</label>
        <label><input type="checkbox" name="trend" value="1" defaultChecked /> Trend</label>
        <label><input type="checkbox" name="averages" value="1" defaultChecked /> Group averages</label>
        <label><input type="checkbox" name="contributors" value="1" defaultChecked /> Top contributors</label>
        <label><input type="checkbox" name="collabs" value="1" defaultChecked /> Collab results</label>
        <label><input type="checkbox" name="showRanks" value="1" /> Show rank numbers</label>
        <button className="btn" type="submit">Build report</button>
      </form>
      <div className="stack" style={{ marginTop: 14 }}>
        {reports.map((report) => (
          <div className="card" key={report.id}>
            <b>{report.title}</b>
            <p>{report.showRanks ? "Rank numbers included" : "Rank numbers hidden"}</p>
            <p><Link href={`/reports/share/${report.token}`}>Share link</Link> · <a href={withBasePath(`/api/reports/${report.id}/file`)}>PDF</a></p>
          </div>
        ))}
      </div>
    </PortalFrame>
  );
}
