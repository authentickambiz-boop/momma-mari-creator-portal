import { saveIncidentAction, resolveIncidentAction } from "@/app/incident-actions";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import { incidentErrorNote } from "@/lib/incident-notes";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";
import { INCIDENT_STATES, portalHealth, statusSnapshot } from "@/lib/status-page";

export const metadata = {
  ...publicPageMeta({
    title: "Momma Mari status",
    description: "Whether the portal is up, and any incident Kamron has written down.",
    path: "/status",
  }),
  robots: PUBLIC_ROBOTS,
};

export default async function StatusPage({ searchParams }: { searchParams: Promise<{ saved?: string; incidentError?: string }> }) {
  const params = await searchParams;
  const note = incidentErrorNote(params.incidentError);
  const db = await getDb();
  const health = await portalHealth();
  const snapshot = await statusSnapshot(db, health);
  const viewer = await currentViewer();
  return (
    <PublicShell title="Status" lede="This reads the portal health check, plus any incident written here. Nothing is emailed.">
      {snapshot.banner ? <p className="private-note" role="alert">{health.ok ? "An incident is open." : "The portal is not responding."}</p> : <p className="note">The portal health check is up.</p>}
      {params.saved ? <p className="note">Saved in the portal. Nothing was emailed.</p> : null}
      {note ? <p className="private-note">{note}</p> : null}
      {snapshot.incidents.length === 0 ? <p className="note">No incidents written down.</p> : (
        <ul className="timeline">
          {snapshot.incidents.map((incident) => (
            <li key={incident.id}>
              <b>{incident.title}</b>
              <div className="note">{incident.state} · {incident.body}</div>
              {viewer?.role === "admin" && incident.state !== "resolved" ? (
                <form action={resolveIncidentAction}>
                  <input type="hidden" name="id" value={incident.id} />
                  <button className="btn ghost" type="submit">Mark resolved</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {viewer?.role === "admin" ? (
        <form action={saveIncidentAction} className="card stack">
          <div className="sec-title">Write an incident</div>
          <label>Title<input name="title" required maxLength={140} /></label>
          <label>What people should know<textarea name="body" required rows={4} maxLength={2000} /></label>
          <label>State
            <select name="state" defaultValue="investigating">
              {INCIDENT_STATES.map((state) => <option key={state}>{state}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Save incident</button>
        </form>
      ) : null}
    </PublicShell>
  );
}
