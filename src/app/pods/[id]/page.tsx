import {
  addCollabAction,
  addGoalAction,
  addPodDateAction,
  addShoutoutAction,
  markCollabPostedAction,
  pairCollabAction,
  recordPodMetricAction,
  setGoalProgressAction,
} from "@/app/growth-actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { collabLift, listGoals, listPodDates, listShoutouts, podById, podCollabs, podMetricRows } from "@/lib/pods";

export default async function PodPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creator?: string; saved?: string; growthError?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(query.creator ?? null);
  const pod = await podById(portal.db, portal.viewer, id);
  if (!pod) {
    return (
      <PortalFrame viewer={portal.viewer} tab="pods" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Pod</h1>}>
        <p className="note">That pod is not on your list.</p>
      </PortalFrame>
    );
  }
  const names = new Map(portal.creators.map((creator) => [creator.id, creator.name]));
  const dates = await listPodDates(portal.db, pod.id);
  const ideas = await podCollabs(portal.db, pod.id);
  const shouts = await listShoutouts(portal.db, pod.id);
  const goals = await listGoals(portal.db, pod.id);
  const metrics = await podMetricRows(portal.db, pod.id);
  const maxFollowers = Math.max(1, ...metrics.map((row) => row.followers));
  const lift = collabLift(metrics);
  const staff = portal.viewer.role === "admin" || portal.viewer.role === "manager";
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="pods"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>{pod.name}</h1><p>{pod.niche} · {pod.sizeBand} · {pod.managerName}. The pod room is private to these creators.</p></div></div>}
    >
      {query.saved ? <p className="note">Saved.</p> : null}
      {query.growthError ? <p className="private-note">{query.growthError}</p> : null}
      <div className="card">
        <div className="sec-title">Creators</div>
        <p>{pod.memberIds.map((memberId) => names.get(memberId) ?? memberId).join(", ")}</p>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Shared calendar</div>
        {dates.map((row) => <p key={row.id}>{row.onDate}: {row.title}</p>)}
        <form action={addPodDateAction} className="stack">
          <input type="hidden" name="podId" value={pod.id} />
          <label>Title<input name="title" /></label>
          <label>Date<input name="onDate" placeholder="2026-11-02" /></label>
          <button className="btn" type="submit">Add date</button>
        </form>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Collab board</div>
        {ideas.map((idea) => (
          <div key={idea.id}>
            <p><b>{idea.title}</b> · {idea.status}{idea.partnerId ? ` with ${names.get(idea.partnerId) ?? "a partner"}` : ""}</p>
            <p>{idea.body}</p>
            {staff && idea.status === "idea" ? (
              <form action={pairCollabAction}>
                <input type="hidden" name="podId" value={pod.id} />
                <input type="hidden" name="ideaId" value={idea.id} />
                <select name="partnerId">
                  {pod.memberIds.map((memberId) => <option key={memberId} value={memberId}>{names.get(memberId) ?? memberId}</option>)}
                </select>
                <button className="btn ghost" type="submit">Pair</button>
              </form>
            ) : null}
            {idea.status !== "posted" ? (
              <form action={markCollabPostedAction}>
                <input type="hidden" name="podId" value={pod.id} />
                <input type="hidden" name="ideaId" value={idea.id} />
                <button className="btn ghost" type="submit">Mark posted</button>
              </form>
            ) : null}
          </div>
        ))}
        <form action={addCollabAction} className="stack">
          <input type="hidden" name="podId" value={pod.id} />
          <label>Idea<input name="title" /></label>
          <label>Notes<input name="body" /></label>
          <button className="btn" type="submit">Post idea</button>
        </form>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Group growth</div>
        <div className="bars" style={{ marginBottom: 28 }}>
          {metrics.map((row) => (
            <div key={row.id} style={{ height: `${Math.max(8, Math.round((row.followers / maxFollowers) * 120))}px` }} title={row.month}>
              <span>{row.month.slice(5)}</span>
            </div>
          ))}
        </div>
        <p>Collab lift: {lift} followers against months with no collab posts.</p>
        {staff ? (
          <form action={recordPodMetricAction} className="stack">
            <input type="hidden" name="podId" value={pod.id} />
            <label>Month<input name="month" placeholder="2026-10" /></label>
            <label>Followers<input name="followers" inputMode="numeric" /></label>
            <label>Collab posts<input name="collabPosts" inputMode="numeric" /></label>
            <button className="btn" type="submit">Save month</button>
          </form>
        ) : null}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Wins</div>
        {shouts.map((row) => <p key={row.id}>{row.body}</p>)}
        <form action={addShoutoutAction} className="stack">
          <input type="hidden" name="podId" value={pod.id} />
          <label>Shout-out<input name="body" /></label>
          <button className="btn" type="submit">Share a win</button>
        </form>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Goals</div>
        {goals.map((goal) => (
          <div key={goal.id}>
            <p>{goal.title}: {goal.progress} of {goal.target}</p>
            <div className="progress"><span style={{ width: `${Math.round((goal.progress / goal.target) * 100)}%` }} /></div>
            {staff ? (
              <form action={setGoalProgressAction}>
                <input type="hidden" name="podId" value={pod.id} />
                <input type="hidden" name="goalId" value={goal.id} />
                <input name="progress" defaultValue={goal.progress} inputMode="numeric" />
                <button className="btn ghost" type="submit">Update</button>
              </form>
            ) : null}
          </div>
        ))}
        {staff ? (
          <form action={addGoalAction} className="stack">
            <input type="hidden" name="podId" value={pod.id} />
            <label>Goal<input name="title" /></label>
            <label>Target<input name="target" inputMode="numeric" /></label>
            <button className="btn" type="submit">Add goal</button>
          </form>
        ) : null}
      </div>
    </PortalFrame>
  );
}
