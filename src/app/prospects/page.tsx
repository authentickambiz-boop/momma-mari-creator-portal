import { addProspectAction, convertProspectAction } from "@/app/campaign-actions";
import { PortalFrame } from "@/components/portal-frame";
import { TagPicker } from "@/components/tag-picker";
import { listProspects } from "@/lib/campaigns";
import { loadPortal } from "@/lib/current-user";
import { NICHE_CATALOG } from "@/lib/niche-catalog";
import { prospectErrorNote } from "@/lib/prospect-notes";

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; prospectError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="prospects" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Prospects</h1>}>
        <p className="note">The prospect list is on the owner's sign-in. The full recruiting list lives with Kash Bot.</p>
      </PortalFrame>
    );
  }
  const rows = await listProspects(portal.db);
  const names = new Map(portal.creators.map((creator) => [creator.id, creator.name]));
  const prospectError = prospectErrorNote(params.prospectError);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="prospects"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Prospects</h1><p>A short list for offers the roster passed on. The working prospect list stays in Kash Bot.</p></div></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {prospectError ? <p className="private-note">{prospectError}</p> : null}
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Niches</th><th>Roster</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.niches.join(", ")}</td>
                <td>{row.convertedCreatorId ? names.get(row.convertedCreatorId) ?? "On the roster" : "Not yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length ? null : <p className="note empty">No prospects yet.</p>}
      </div>
      <form action={addProspectAction} className="card stack" style={{ marginTop: 14 }}>
        <div className="sec-title">Add a prospect</div>
        <label>Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Notes<input name="notes" /></label>
        <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={[]} />
        <button className="btn" type="submit">Save prospect</button>
      </form>
      {rows.length ? (
        <form action={convertProspectAction} className="card stack" style={{ marginTop: 14 }}>
          <div className="sec-title">Moved onto the roster</div>
          <label>
            Prospect
            <select name="prospectId">
              {rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <label>
            Roster creator
            <select name="creatorId">
              {portal.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
            </select>
          </label>
          <button className="btn" type="submit">Mark converted</button>
        </form>
      ) : null}
    </PortalFrame>
  );
}
