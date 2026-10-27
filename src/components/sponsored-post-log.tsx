import Link from "next/link";
import { Fragment } from "react";
import { archiveSponsoredPostAction, saveSponsoredPostAction, saveSponsoredSnapshotAction } from "@/app/sponsored-post-actions";
import {
  checkpointSummary,
  formatSponsoredAverage,
  formatSponsoredCount,
  formatSponsoredDay,
  isStandardCheckpoint,
  metricLabel,
  metricStat,
  safeSponsoredText,
  SNAPSHOT_METRICS,
  snapshotMetricPairs,
  SPONSORED_CHECKPOINTS,
  sponsoredCheckpointPlan,
  sponsoredPostHref,
  type GroupRollup,
  type MetricStat,
  type SnapshotDueStatus,
  type SponsoredChoices,
  type SponsoredDueItem,
  type SponsoredPostView,
  type SponsoredRollup,
  type SponsoredSnapshotView,
  type SponsoredSort,
} from "@/lib/sponsored-posts";

const SAVED: Record<string, string> = {
  post: "Saved the post. Nothing was emailed.",
  snapshot: "Saved the checkpoint. Nothing was emailed.",
  archived: "Archived. The post stays in the log and is hidden from averages.",
  restored: "The post is on the list again.",
};

type Filters = {
  creator: string;
  brand: string;
  sort: SponsoredSort;
  dir: "asc" | "desc";
  show: string;
};

function figure(stat: MetricStat | null) {
  if (!stat) return "Not entered";
  return formatSponsoredAverage(stat.average);
}

function totalFigure(stat: MetricStat | null) {
  if (!stat) return "Not entered";
  return formatSponsoredCount(stat.total);
}

function shownText(value: string) {
  return safeSponsoredText(value) ?? "Held back.";
}

function listHref(filters: Filters, patch: Partial<Filters>) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.creator) params.set("creator", next.creator);
  if (next.brand) params.set("brand", next.brand);
  params.set("sort", next.sort);
  params.set("dir", next.dir);
  if (next.show) params.set("show", next.show);
  return `/sponsored-posts?${params.toString()}`;
}

function nextDir(column: SponsoredSort, filters: Filters): "asc" | "desc" {
  if (column !== filters.sort) return column === "views7d" || column === "postedOn" ? "desc" : "asc";
  return filters.dir === "asc" ? "desc" : "asc";
}

function ReturnFields({ filters }: { filters: Filters }) {
  return (
    <>
      <input type="hidden" name="returnCreator" value={filters.creator} />
      <input type="hidden" name="returnBrand" value={filters.brand} />
      <input type="hidden" name="returnSort" value={filters.sort} />
      <input type="hidden" name="returnDir" value={filters.dir} />
      <input type="hidden" name="returnShow" value={filters.show} />
    </>
  );
}

function SortHeader({ label, column, filters }: { label: string; column: SponsoredSort; filters: Filters }) {
  const active = filters.sort === column;
  const dir = nextDir(column, filters);
  return (
    <th scope="col" aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={listHref(filters, { sort: column, dir })}>
        {label}{active ? (filters.dir === "asc" ? " ↑" : " ↓") : ""}
      </Link>
    </th>
  );
}

function dueChip(status: SnapshotDueStatus) {
  if (status === "late") return "c-red";
  if (status === "due") return "c-sun";
  if (status === "captured") return "c-sage";
  return "c-gray";
}

function views(post: SponsoredPostView, checkpoint: string) {
  const value = post.snapshots.find((snapshot) => snapshot.checkpoint === checkpoint)?.views;
  return value == null ? "Not entered" : formatSponsoredCount(value);
}

function GroupTable({
  caption,
  groups,
  showRecap,
}: {
  caption: string;
  groups: GroupRollup[];
  showRecap: boolean;
}) {
  if (groups.length === 0) return <p className="note empty">Nothing to average yet.</p>;
  const columns = showRecap ? 7 : 6;
  return (
    <div className="card">
      <table>
        <caption className="note">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Posts</th>
            <th scope="col">Avg 7-day views</th>
            <th scope="col">Total 7-day views</th>
            <th scope="col">Avg 24-hour views</th>
            <th scope="col">Avg 30-day views</th>
            {showRecap ? <th scope="col">Recap</th> : null}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const extra = checkpointSummary(group, "7d", { omit: ["views"] });
            return (
              <Fragment key={group.key}>
                <tr>
                  <th scope="row">{group.label}</th>
                  <td>{group.posts}</td>
                  <td>{figure(metricStat(group, "7d", "views"))}</td>
                  <td>{totalFigure(metricStat(group, "7d", "views"))}</td>
                  <td>{figure(metricStat(group, "24h", "views"))}</td>
                  <td>{figure(metricStat(group, "30d", "views"))}</td>
                  {showRecap ? <td><Link href={`/sponsored-posts/recap?brand=${encodeURIComponent(group.label)}`}>Brand recap</Link></td> : null}
                </tr>
                {extra ? <tr><td className="note" colSpan={columns}>{extra}</td></tr> : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotReadout({ snapshot, canManage }: { snapshot: SponsoredSnapshotView; canManage: boolean }) {
  const pairs = snapshotMetricPairs(snapshot);
  const note = safeSponsoredText(snapshot.note);
  return (
    <div>
      <b>{snapshot.checkpointLabel}</b>
      {pairs.length === 0 ? <p className="note">No counts entered.</p> : (
        <div className="sponsored-metrics">
          {pairs.map((pair) => (
            <div key={pair.metric}>
              <b>{formatSponsoredCount(pair.value)}</b>
              <span>{pair.label}</span>
            </div>
          ))}
        </div>
      )}
      {note ? <p>{note}</p> : null}
      <p className="note">Entered by {shownText(snapshot.enteredByName)}{canManage ? ` (${snapshot.enteredBy})` : ""}</p>
    </div>
  );
}

function SnapshotForm({ postId, snapshot, filters }: { postId: string; snapshot?: SponsoredSnapshotView; filters: Filters }) {
  const standard = snapshot ? isStandardCheckpoint(snapshot.checkpoint) : true;
  return (
    <form action={saveSponsoredSnapshotAction} className="stack">
      <ReturnFields filters={filters} />
      <input type="hidden" name="postId" value={postId} />
      {snapshot ? <input type="hidden" name="snapshotId" value={snapshot.id} /> : null}
      <label>
        Checkpoint
        <select name="checkpoint" defaultValue={snapshot && standard ? snapshot.checkpoint : snapshot ? "" : "7d"}>
          {SPONSORED_CHECKPOINTS.map((checkpoint) => <option key={checkpoint.id} value={checkpoint.id}>{checkpoint.label}</option>)}
          <option value="">Another checkpoint</option>
        </select>
      </label>
      <label>
        Another checkpoint
        <input name="checkpointOther" defaultValue={snapshot && !standard ? snapshot.checkpoint : ""} placeholder="14d" maxLength={20} />
      </label>
      <p className="note">If you fill the other box, that checkpoint is the one saved. A later window is its own row. In the note, label where each count came from, and keep paid or whitelisted spend separate from organic.</p>
      {SNAPSHOT_METRICS.map((metric) => (
        <label key={metric}>
          {metricLabel(metric)}
          <input name={metric} inputMode="numeric" defaultValue={snapshot?.[metric] ?? ""} />
        </label>
      ))}
      <label>
        Note
        <textarea name="note" rows={2} maxLength={400} defaultValue={snapshot?.note ?? ""} />
      </label>
      <button className="btn" type="submit">{snapshot ? "Update checkpoint" : "Add checkpoint"}</button>
    </form>
  );
}

export function SponsoredPostLog({
  canManage,
  list,
  choices,
  filters,
  saved,
  error,
  creatorName,
  asOf,
  due,
}: {
  canManage: boolean;
  list: { posts: SponsoredPostView[]; rollup: SponsoredRollup; brands: string[] };
  choices: SponsoredChoices | null;
  filters: Filters;
  saved: string | null;
  error: string | null;
  creatorName: string | null;
  asOf: string;
  due: SponsoredDueItem[] | null;
}) {
  const views7 = metricStat(list.rollup, "7d", "views");
  const savedNote = saved ? SAVED[saved] ?? null : null;
  return (
    <div className="stack" data-sponsored="log">
      {savedNote ? <p className="note">{savedNote}</p> : null}
      {error ? <p className="private-note" role="alert">{error}</p> : null}
      {canManage && due ? (
        <section aria-labelledby="snapshots-due-title" data-sponsored-due="owner">
          <h2 id="snapshots-due-title">Snapshots due</h2>
          <p className="note">Times use America/New_York. Go-live is 12:00 AM ET on the post date. The 24-hour snapshot is due the next day and late after two days. The 7-day and 30-day snapshots are due on those days and late after two more days. This list is every live post, including ones outside the filter below. Nothing is emailed.</p>
          {due.length === 0 ? <p className="note empty">No snapshots are due right now.</p> : (
            <ul className="sponsored-due">
              {due.map((item) => (
                <li key={`${item.postId}-${item.checkpoint}`} className="card">
                  <p>
                    <span className={`chip ${dueChip(item.status)}`}>{item.statusLabel}</span>
                    {" "}
                    <a href={`${listHref(filters, { creator: "all", brand: "" })}#post-${item.postId}`}>{item.label}</a>
                    {" · "}{item.brand} · {item.creatorName} · {item.platform}
                  </p>
                  <p className="note">Posted {formatSponsoredDay(item.postedOn)}. Due {item.dueLabel}. Late after {item.lateLabel}.</p>
                  <p>{item.reminder}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      <p className="note">
        {creatorName
          ? `Averages on this page are for ${creatorName}. Choose All creators to see the whole log.`
          : "Averages cover every post still on the list."}
        {" "}A 24-hour count and a 7-day count are the same post at two times. They are not added together.
      </p>
      <div className="stats">
        <div className="card stat"><div className="n">{list.rollup.posts}</div><div className="l">Posts on the list</div></div>
        <div className="card stat"><div className="n">{figure(views7)}</div><div className="l">Average 7-day views</div></div>
        <div className="card stat"><div className="n">{totalFigure(views7)}</div><div className="l">Total 7-day views</div></div>
      </div>

      <form method="get" className="card stack">
        <div className="sec-title">Filter the list</div>
        {filters.creator ? <input type="hidden" name="creator" value={filters.creator} /> : null}
        <label>
          Brand
          <select name="brand" defaultValue={filters.brand}>
            <option value="">All brands</option>
            {list.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={filters.sort}>
            <option value="postedOn">Post date</option>
            <option value="brand">Brand</option>
            <option value="creator">Creator</option>
            <option value="platform">Platform</option>
            <option value="views7d">7-day views</option>
          </select>
        </label>
        <label>
          Direction
          <select name="dir" defaultValue={filters.dir}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        {canManage ? (
          <label><input type="checkbox" name="show" value="archived" defaultChecked={filters.show === "archived"} /> Show archived posts</label>
        ) : null}
        <button className="btn ghost" type="submit">Apply</button>
      </form>

      <section>
        <h2>By brand</h2>
        <GroupTable caption="Brand averages. A recap includes every creator on that brand." groups={list.rollup.byBrand} showRecap={canManage} />
      </section>
      {canManage ? (
        <section>
          <h2>By creator</h2>
          <GroupTable caption="Creator averages for the posts in this list." groups={list.rollup.byCreator} showRecap={false} />
        </section>
      ) : null}

      <section>
        <h2>Posts</h2>
        {list.posts.length === 0 ? (
          <p className="note empty">{canManage ? "No sponsored posts on this list yet." : "No sponsored posts logged for you yet."}</p>
        ) : (
          <div className="card">
            <table>
              <thead>
                <tr>
                  <SortHeader label="Brand" column="brand" filters={filters} />
                  <SortHeader label="Creator" column="creator" filters={filters} />
                  <SortHeader label="Platform" column="platform" filters={filters} />
                  <SortHeader label="Posted" column="postedOn" filters={filters} />
                  <th scope="col">24-hour views</th>
                  <SortHeader label="7-day views" column="views7d" filters={filters} />
                  <th scope="col">30-day views</th>
                  <th scope="col">Deliverable</th>
                </tr>
              </thead>
              <tbody>
                {list.posts.map((post) => (
                  <tr key={post.id}>
                    <td>{post.brand}{post.archived ? " · Archived" : ""}</td>
                    <td>{post.creatorName}</td>
                    <td>{post.platform}</td>
                    <td><a href={`#post-${post.id}`}>{formatSponsoredDay(post.postedOn)}</a></td>
                    <td>{views(post, "24h")}</td>
                    <td>{views(post, "7d")}</td>
                    <td>{views(post, "30d")}</td>
                    <td>{shownText(post.deliverableTerms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {list.posts.map((post) => {
        const href = sponsoredPostHref(post.postUrl);
        const deal = choices?.deals.find((item) => item.id === post.dealId)?.label;
        const campaign = choices?.campaigns.find((item) => item.id === post.campaignId)?.label ?? (post.campaignName ? shownText(post.campaignName) : null);
        return (
          <article key={post.id} id={`post-${post.id}`} className="card stack sponsored-log">
            <header>
              <b>{post.brand}</b>
              <p>{post.creatorName} · {post.platform} · {formatSponsoredDay(post.postedOn)}{post.archived ? " · Archived" : ""}</p>
            </header>
            <p>{shownText(post.deliverableTerms)}</p>
            {href ? <p><a href={href} rel="noopener noreferrer">Open post</a></p> : null}
            <p className="note">{post.dealId ? `Linked deal: ${deal ?? "Linked"}` : "No linked deal"}{campaign ? ` · Linked campaign: ${campaign}` : ""}</p>
            <p className="note">Logged by {shownText(post.createdByName)}{canManage ? ` (${post.createdBy})` : ""}</p>
            {canManage ? <CheckpointSchedule post={post} asOf={asOf} /> : null}
            {post.snapshots.length === 0 ? <p className="note">No checkpoints yet.</p> : post.snapshots.map((snapshot) => (
              <SnapshotReadout key={snapshot.id} snapshot={snapshot} canManage={canManage} />
            ))}
            {canManage && choices ? (
              <>
                <details>
                  <summary>Add or edit a checkpoint</summary>
                  <SnapshotForm postId={post.id} filters={filters} />
                  {post.snapshots.map((snapshot) => (
                    <details key={snapshot.id}>
                      <summary>Edit {snapshot.checkpointLabel}</summary>
                      <SnapshotForm postId={post.id} snapshot={snapshot} filters={filters} />
                    </details>
                  ))}
                </details>
                <details>
                  <summary>Correct this post</summary>
                  <form action={saveSponsoredPostAction} className="stack">
                    <ReturnFields filters={filters} />
                    <input type="hidden" name="postId" value={post.id} />
                    <PostFields choices={choices} post={post} />
                    <button className="btn" type="submit">Save post</button>
                  </form>
                </details>
                <form action={archiveSponsoredPostAction}>
                  <ReturnFields filters={filters} />
                  <input type="hidden" name="postId" value={post.id} />
                  <input type="hidden" name="archived" value={post.archived ? "0" : "1"} />
                  <button className="btn ghost" type="submit">{post.archived ? "Show on the list again" : "Archive"}</button>
                </form>
              </>
            ) : null}
          </article>
        );
      })}

      {canManage && choices ? (
        <form action={saveSponsoredPostAction} className="card stack">
          <div className="sec-title">Log a sponsored post</div>
          <p className="note">Link a deal or campaign when the portal already has one. Leave pay figures off this form. Nothing is emailed.</p>
          <ReturnFields filters={filters} />
          <PostFields choices={choices} post={null} defaultCreatorId={filters.creator !== "all" ? filters.creator : choices.creators[0]?.id ?? ""} />
          <button className="btn" type="submit">Add post</button>
        </form>
      ) : null}
    </div>
  );
}

function CheckpointSchedule({ post, asOf }: { post: SponsoredPostView; asOf: string }) {
  const plan = sponsoredCheckpointPlan(post, asOf);
  if (!plan) return null;
  return (
    <div>
      <p className="note">Go-live {plan.goLiveLabel}.</p>
      <ul className="sponsored-schedule">
        {plan.checkpoints.map((item) => (
          <li key={item.checkpoint}>
            <span className={`chip ${dueChip(item.status)}`}>{item.statusLabel}</span>
            {" "}<b>{item.label}</b>
            <p className="note">
              Due {item.dueLabel}. Late after {item.lateLabel}.
              {item.status === "captured" && item.capturedLabel ? ` Captured ${item.capturedLabel}.` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PostFields({
  choices,
  post,
  defaultCreatorId,
}: {
  choices: SponsoredChoices | null;
  post: SponsoredPostView | null;
  defaultCreatorId?: string;
}) {
  return (
    <>
      <label>
        Brand
        <input name="brand" defaultValue={post?.brand ?? ""} maxLength={80} placeholder="Brand name, or leave blank if you link a deal" />
      </label>
      <label>
        Creator
        <select name="creatorId" defaultValue={post?.creatorId ?? defaultCreatorId ?? ""} required>
          {(choices?.creators ?? []).map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
        </select>
      </label>
      <label>
        Deal
        <select name="dealId" defaultValue={post?.dealId ?? ""}>
          <option value="">No linked deal</option>
          {(choices?.deals ?? []).map((deal) => <option key={deal.id} value={deal.id}>{deal.label}</option>)}
        </select>
      </label>
      <label>
        Campaign
        <select name="campaignId" defaultValue={post?.campaignId ?? ""}>
          <option value="">No linked campaign</option>
          {(choices?.campaigns ?? []).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.label}</option>)}
        </select>
      </label>
      <label>
        Platform
        <select name="platform" defaultValue={post?.platform ?? "Instagram"} required>
          {(choices?.platforms ?? []).map((platform) => <option key={platform}>{platform}</option>)}
        </select>
      </label>
      <label>
        Post link
        <input name="postUrl" type="url" required defaultValue={post?.postUrl ?? ""} placeholder="https://" maxLength={500} />
      </label>
      <label>
        Post date
        <input name="postedOn" type="date" required defaultValue={post?.postedOn ?? ""} />
      </label>
      <label>
        Deliverable terms
        <textarea name="deliverableTerms" required rows={3} maxLength={400} defaultValue={post?.deliverableTerms ?? ""} placeholder="1 Reel cross-posted to TikTok, 30-day paid usage" />
      </label>
    </>
  );
}
