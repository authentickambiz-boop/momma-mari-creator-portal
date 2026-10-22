import {
  importRecapSnapshotsAction,
  importReportSnapshotsAction,
  logRecapPostAction,
  saveNextCampaignNoteAction,
  saveRecapGoalAction,
  saveRecapSnapshotAction,
} from "@/app/brand-recap-actions";
import { PortalFrame } from "@/components/portal-frame";
import { recapEditor, recapSavedNote } from "@/lib/brand-recap-edit";
import { recapErrorNote } from "@/lib/brand-recap-notes";
import {
  RECAP_GOAL_TYPES,
  RECAP_PLATFORMS,
  RECAP_SNAPSHOT_METRICS,
  RECAP_SNAPSHOT_WINDOWS,
  RECAP_SOURCES,
} from "@/lib/brand-recap-report";
import { loadPortal } from "@/lib/current-user";

export default async function BrandRecapEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ dealId: string }>;
  searchParams: Promise<{ creator?: string; saved?: string; recapError?: string }>;
}) {
  const [{ dealId }, query] = await Promise.all([params, searchParams]);
  const portal = await loadPortal(query.creator ?? null);
  const errorNote = recapErrorNote(query.recapError);
  const savedNote = recapSavedNote(query.saved);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brand recap</h1>}>
        <p className="note">Recaps stay with the owner.</p>
      </PortalFrame>
    );
  }
  const loaded = await recapEditor(portal.db, portal.viewer, dealId);
  if (!loaded.ok) {
    return (
      <PortalFrame viewer={portal.viewer} tab="dashboard" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Brand recap</h1>}>
        <p className="private-note" role="alert">{recapErrorNote(loaded.error === "Only the owner can edit a recap." ? "owner" : "deal")}</p>
      </PortalFrame>
    );
  }
  const editor = loaded.editor;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="dashboard"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>{editor.brand}</h1><p>{editor.creatorName}{editor.goLiveOn ? ` · Live since ${editor.goLiveOn}` : ""}</p></div></div>}
    >
      {errorNote ? <p className="private-note" role="alert">{errorNote}</p> : null}
      {savedNote ? <p className="note">{savedNote}</p> : null}
      <div className="card stack">
        <div className="sec-title">Kickoff goal</div>
        <p className="note">Views, clicks, sales, or UGC assets, plus the target number. The shared recap shows that target next to the sourced result.</p>
        {editor.goalFromCampaign ? <p className="note">This goal is filled in from the campaign. Saving here keeps a copy on this deal.</p> : null}
        <form action={saveRecapGoalAction} className="stage-form">
          <input type="hidden" name="dealId" value={editor.dealId} />
          <label>Goal
            <select name="goalType" defaultValue={editor.goalType}>
              <option value="">No goal yet</option>
              {RECAP_GOAL_TYPES.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}
            </select>
          </label>
          <label>Target number<input name="goalTarget" inputMode="numeric" defaultValue={editor.goalTarget} placeholder="100000" /></label>
          <button className="btn" type="submit">Save goal</button>
        </form>
      </div>
      <div className="card stack" style={{ marginTop: 14 }}>
        <div className="sec-title">Posts against the contract</div>
        {editor.contractLines.length === 0 ? <p className="note">Add deliverables on the deal before logging a post against the contract.</p> : (
          <ul>
            {editor.contractLines.map((line) => {
              const posted = editor.posts.filter((post) => post.deliverableLabel?.toLowerCase() === line.toLowerCase());
              return (
                <li key={line}>
                  {posted.length === 0 ? `${line} · Pending` : posted.map((post) => (
                    <span key={post.id}>{line} · {post.platformLabel ?? post.platform} · {post.postedOn ?? "Posted date pending"} · {post.url}</span>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
        {editor.contractLines.length > 0 ? (
          <form action={logRecapPostAction} className="stage-form">
            <input type="hidden" name="dealId" value={editor.dealId} />
            <label>Deliverable
              <select name="deliverable" defaultValue={editor.contractLines[0]}>
                {editor.contractLines.map((line) => <option key={line} value={line}>{line}</option>)}
              </select>
            </label>
            <label>Platform
              <select name="platform" defaultValue="tiktok">
                {RECAP_PLATFORMS.map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
              </select>
            </label>
            <label>Post link<input type="url" name="url" required placeholder="https://" /></label>
            <label>Posted date<input type="date" name="postedOn" required /></label>
            <button className="btn" type="submit">Log post</button>
          </form>
        ) : null}
      </div>
      <div className="card stack" style={{ marginTop: 14 }}>
        <div className="sec-title">48-hour and 7-day snapshots</div>
        <p className="note">Each window is stored on its own. The source is WithJuly / platform, link check, or creator-submitted. A card with no recorded figure stays off the shared page.</p>
        {editor.snapshots.length === 0 ? <p className="note empty">No snapshot yet.</p> : (
          <ul>
            {editor.snapshots.map((snapshot) => (
              <li key={`${snapshot.window}-${snapshot.metric}-${snapshot.postId ?? "deal"}`}>
                {snapshot.metricLabel} · {snapshot.windowLabel} · {snapshot.value} · {snapshot.sourceLabel}{snapshot.postLabel ? ` · ${snapshot.postLabel}` : ""}
              </li>
            ))}
          </ul>
        )}
        <form action={saveRecapSnapshotAction} className="stage-form">
          <input type="hidden" name="dealId" value={editor.dealId} />
          <label>Window
            <select name="window" defaultValue="48h">
              {RECAP_SNAPSHOT_WINDOWS.map((window) => <option key={window.id} value={window.id}>{window.label}</option>)}
            </select>
          </label>
          <label>Metric
            <select name="metric" defaultValue="views">
              {RECAP_SNAPSHOT_METRICS.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}
            </select>
          </label>
          <label>Recorded figure<input name="value" required /></label>
          <label>Source
            <select name="source" defaultValue="withjuly_platform">
              {RECAP_SOURCES.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
          </label>
          {editor.posts.length > 0 ? (
            <label>Post
              <select name="postId" defaultValue="">
                <option value="">Whole campaign</option>
                {editor.posts.map((post) => <option key={post.id} value={post.id}>{post.platformLabel ?? post.platform}</option>)}
              </select>
            </label>
          ) : null}
          <button className="btn" type="submit">Save snapshot</button>
        </form>
        <form action={importRecapSnapshotsAction} className="stage-form">
          <input type="hidden" name="dealId" value={editor.dealId} />
          <label>Import lines
            <textarea name="import" rows={4} placeholder={"48h, views, 12400, withjuly_platform\n7d, clicks, 86, link_check"} />
          </label>
          <button className="btn" type="submit">Import snapshots</button>
        </form>
        {editor.savedMetrics.length > 0 ? (
          <form action={importReportSnapshotsAction} className="stage-form">
            <input type="hidden" name="dealId" value={editor.dealId} />
            <p className="note">Saved report figures: {editor.savedMetrics.map((metric) => `${metric.label} ${metric.value}`).join(", ")}.</p>
            <label>Window
              <select name="window" defaultValue="7d">
                {RECAP_SNAPSHOT_WINDOWS.map((window) => <option key={window.id} value={window.id}>{window.label}</option>)}
              </select>
            </label>
            <label>Source
              <select name="source" defaultValue="withjuly_platform">
                {RECAP_SOURCES.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
              </select>
            </label>
            <button className="btn" type="submit">Import saved report figures</button>
          </form>
        ) : null}
      </div>
      <div className="card stack" style={{ marginTop: 14 }}>
        <div className="sec-title">Next campaign</div>
        {editor.drafts.length === 0 ? <p className="note">The note can be saved once the 7-day or 30-day draft is on the list. It stays off the shared page until then.</p> : editor.drafts.map((draft) => (
          <form key={draft.milestone} action={saveNextCampaignNoteAction} className="stage-form">
            <input type="hidden" name="dealId" value={editor.dealId} />
            <input type="hidden" name="milestone" value={String(draft.milestone)} />
            <p><a href={draft.href}>{draft.milestoneLabel}</a> · <a href={draft.csvHref}>Download CSV</a></p>
            <label>Note for {draft.milestoneLabel}
              <textarea name="note" rows={3} defaultValue={draft.note} maxLength={500} />
            </label>
            <button className="btn" type="submit">Save note</button>
          </form>
        ))}
      </div>
    </PortalFrame>
  );
}
