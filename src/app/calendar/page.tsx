import { connectCalendarAction, saveDeliverableDateAction } from "@/app/calendar-actions";
import { PortalFrame } from "@/components/portal-frame";
import { calendarConnected, listCalendar } from "@/lib/calendar";
import { calendarErrorNote } from "@/lib/calendar-notes";
import { loadPortal } from "@/lib/current-user";
import { withBasePath } from "@/lib/format";
import { listDealsForViewer } from "@/lib/queries";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; calendarError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  const dates = await listCalendar(portal.db, portal.viewer);
  const deals = await listDealsForViewer(portal.db, portal.viewer, portal.viewedId);
  const connected = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await calendarConnected(portal.db, portal.viewer.creatorId)
    : false;
  const calendarError = calendarErrorNote(params.calendarError);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="calendar"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><h1>Calendar</h1><p>Draft and post dates. A reminder lands 3 days ahead, in the portal or in the approval queue. Nothing is emailed on its own.</p></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {calendarError ? <p className="private-note">{calendarError}</p> : null}
      {dates.length === 0 ? <p className="note">No due dates yet.</p> : null}
      {dates.length > 0 ? (
        <div className="card">
          <table>
            <thead>
              <tr><th>Brand</th><th>What</th><th>Due</th><th>Reminder</th></tr>
            </thead>
            <tbody>
              {dates.map((item) => (
                <tr key={item.id}>
                  <td>{item.brand}</td>
                  <td>{item.kind === "draft" ? "Draft" : "Post"}</td>
                  <td>{item.dueOn}</td>
                  <td>{item.remindOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {staff ? (
        <form action={saveDeliverableDateAction} className="card stack" style={{ marginTop: 14 }}>
          <div className="sec-title">Set a due date</div>
          <label>Deal
            <select name="dealId" required defaultValue={deals[0]?.id ?? ""}>
              {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.brand}</option>)}
            </select>
          </label>
          <label>What
            <select name="kind" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="post">Post</option>
            </select>
          </label>
          <label>Due<input type="date" name="dueOn" required /></label>
          <button className="btn" type="submit">Save date</button>
        </form>
      ) : null}
      {portal.viewer.role === "creator" ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Your calendar</div>
          <p className="note">{connected ? "Connected. Download the file and add it to your calendar. The portal does not send the dates anywhere else." : "Off. Dates stay in this portal until you connect."}</p>
          <form action={connectCalendarAction}>
            <input type="hidden" name="connected" value={connected ? "0" : "1"} />
            <button className="btn ghost" type="submit">{connected ? "Disconnect calendar" : "Connect calendar"}</button>
          </form>
          {connected ? <p style={{ marginTop: 10 }}><a href={withBasePath("/api/calendar")}>Download calendar file</a></p> : null}
        </div>
      ) : null}
    </PortalFrame>
  );
}
