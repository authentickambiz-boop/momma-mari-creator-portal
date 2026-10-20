import Link from "next/link";
import { savePodAction } from "@/app/growth-actions";
import { PortalFrame } from "@/components/portal-frame";
import { SIZE_BANDS } from "@/lib/creator-rank";
import { loadPortal } from "@/lib/current-user";
import { listManagers } from "@/lib/managers";
import { listPods, suggestPods } from "@/lib/pods";
import { growthErrorNote } from "@/lib/growth-notes";

export default async function PodsPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; growthError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const pods = await listPods(portal.db, portal.viewer);
  const suggestion = portal.viewer.role === "admin" ? await suggestPods(portal.db, portal.viewer) : null;
  const managers = portal.viewer.role === "admin" ? await listManagers(portal.db) : [];
  const growthNote = growthErrorNote(params.growthError);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="pods"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Pods</h1><p>Creators grouped by niche and size. You only see the pods that belong to your sign-in.</p></div></div>}
    >
      {growthNote ? <p className="private-note">{growthNote}</p> : null}
      <div className="stack">
        {pods.map((pod) => (
          <Link className="card" key={pod.id} href={`/pods/${pod.id}`}>
            <b>{pod.name}</b>
            <p>{pod.niche} · {pod.sizeBand} · {pod.managerName} · {pod.memberIds.length} creators</p>
          </Link>
        ))}
        {pods.length ? null : <p className="note empty">No pod on this sign-in yet.</p>}
      </div>
      {suggestion?.ok ? (
        <div className="stack" style={{ marginTop: 14 }}>
          <div className="sec-title">Suggested groups</div>
          <p className="note">A starting point from niche, follower band, and the assigned manager. Save the ones you want. You can rename them and change who is in them.</p>
          {suggestion.groups.map((group) => (
            <form action={savePodAction} className="card stack" key={`${group.niche}-${group.sizeBand}-${group.managerId}`}>
              {group.creatorIds.map((id) => <input key={id} type="hidden" name="creatorId" value={id} />)}
              <input type="hidden" name="niche" value={group.niche} />
              <input type="hidden" name="sizeBand" value={group.sizeBand} />
              <p>{group.names.join(", ")}</p>
              <p>{group.niche} · {SIZE_BANDS.find((band) => band.id === group.sizeBand)?.label ?? group.sizeBand}</p>
              <label>Pod name<input name="name" defaultValue={`${group.niche} ${group.sizeBand}`} /></label>
              <label>
                Manager
                <select name="managerId" defaultValue={group.managerId === "unassigned" ? "" : group.managerId}>
                  <option value="">Pick a manager</option>
                  {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                </select>
              </label>
              <button className="btn" type="submit">Save this pod</button>
            </form>
          ))}
        </div>
      ) : null}
    </PortalFrame>
  );
}
