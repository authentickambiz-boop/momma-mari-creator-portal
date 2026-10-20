import { redirect } from "next/navigation";
import { addManagerAction, assignManagersAction, setManagerActiveAction, setManagerPermissionsAction } from "@/app/actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { listManagers } from "@/lib/managers";
import { teamErrorNote } from "@/lib/team-notes";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ teamError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  if (portal.viewer.role !== "admin") redirect("/");
  const managers = await listManagers(portal.db);
  const active = managers.filter((manager) => manager.active);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="team"
      creators={portal.creators}
      viewedId="all"
      hello={
        <div className="hello">
          <div>
            <h1>Team</h1>
            <p>Add a manager with the Google email they will use to sign in. They only see the creators you assign, and you can change that any time.</p>
          </div>
        </div>
      }
    >
      {params.teamError ? (
        teamErrorNote(params.teamError) ? (
          <p className="note">{teamErrorNote(params.teamError)}</p>
        ) : (
          <div className="callout"><b>That was not saved.</b> Use a real Google email that is not already an owner or a creator, and pick two different active managers when you set a backup.</div>
        )
      ) : null}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="sec-title">Add a manager</div>
        <form action={addManagerAction} className="stage-form">
          <label>
            Name
            <input type="text" name="name" required placeholder="Riley" aria-label="Manager name" />
          </label>
          <label>
            Google email
            <input type="email" name="email" required placeholder="riley@gmail.com" aria-label="Manager Google email" />
          </label>
          <p className="note">They sign in with this Google account. Emails and videos are on. Contracts and countersigning stay with you until you turn them on.</p>
          <label className="contract-choices"><input type="checkbox" name="approveEmail" value="1" defaultChecked /> Approve brand emails</label>
          <label className="contract-choices"><input type="checkbox" name="approveVideo" value="1" defaultChecked /> Approve videos</label>
          <label className="contract-choices"><input type="checkbox" name="approveContract" value="1" /> Approve contracts</label>
          <label className="contract-choices"><input type="checkbox" name="countersign" value="1" /> Countersign</label>
          <label className="contract-choices"><input type="checkbox" name="canPriceDeals" value="1" /> Edit deal rules and see dollar amounts</label>
          <button className="btn" type="submit">Add manager</button>
        </form>
      </div>
      {managers.length === 0 ? <p className="note empty">No managers yet.</p> : null}
      {managers.map((manager) => (
        <div className="card" key={manager.id} style={{ marginBottom: 14 }}>
          <h2>{manager.name}</h2>
          <p className="note">{manager.email} · {manager.active ? "Active" : "Deactivated"}</p>
          <form action={setManagerPermissionsAction} className="stage-form">
            <input type="hidden" name="managerId" value={manager.id} />
            <label className="contract-choices"><input type="checkbox" name="approveEmail" value="1" defaultChecked={manager.permissions.approveEmail} /> Approve brand emails</label>
            <label className="contract-choices"><input type="checkbox" name="approveVideo" value="1" defaultChecked={manager.permissions.approveVideo} /> Approve videos</label>
            <label className="contract-choices"><input type="checkbox" name="approveContract" value="1" defaultChecked={manager.permissions.approveContract} /> Approve contracts</label>
            <label className="contract-choices"><input type="checkbox" name="countersign" value="1" defaultChecked={manager.permissions.countersign} /> Countersign</label>
            <label className="contract-choices"><input type="checkbox" name="canPriceDeals" value="1" defaultChecked={manager.permissions.canPriceDeals} /> Edit deal rules and see dollar amounts</label>
            <button className="btn ghost" type="submit">Save permissions</button>
          </form>
          <form action={setManagerActiveAction}>
            <input type="hidden" name="managerId" value={manager.id} />
            <input type="hidden" name="active" value={manager.active ? "0" : "1"} />
            <button className="btn ghost" type="submit">{manager.active ? "Deactivate" : "Reactivate"}</button>
          </form>
        </div>
      ))}
      <div className="card">
        <div className="sec-title">Assign creators</div>
        <p className="note">Each creator can have a primary manager and an optional backup. You can move them whenever you want. A deactivated manager stays on the old assignment, and the backup covers new notices.</p>
        {portal.creators.map((creator) => (
          <form key={creator.id} action={assignManagersAction} className="stage-form">
            <input type="hidden" name="creatorId" value={creator.id} />
            <b>{creator.name}</b>
            <label>
              Primary manager
              <select name="primaryManagerId" defaultValue={creator.primaryManagerId ?? ""} aria-label={`Primary manager for ${creator.name}`}>
                <option value="">No manager</option>
                {active.map((manager) => (
                  <option key={manager.id} value={manager.id}>{manager.name}</option>
                ))}
              </select>
            </label>
            <label>
              Backup manager
              <select name="backupManagerId" defaultValue={creator.backupManagerId ?? ""} aria-label={`Backup manager for ${creator.name}`}>
                <option value="">No backup</option>
                {active.map((manager) => (
                  <option key={manager.id} value={manager.id}>{manager.name}</option>
                ))}
              </select>
            </label>
            <button className="btn ghost" type="submit">Save assignment</button>
          </form>
        ))}
      </div>
    </PortalFrame>
  );
}
