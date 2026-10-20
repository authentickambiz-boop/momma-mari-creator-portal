import { compactCount, commaCount } from "@/lib/format";
import type { CreatorProfile, DailyMetric, PostMetric } from "@/lib/types";
import { summarizeAnalytics } from "@/lib/queries";

export function AnalyticsPanel({ creator, daily, posts }: { creator: CreatorProfile; daily: DailyMetric[]; posts: PostMetric[] }) {
  const summary = summarizeAnalytics(daily, posts);
  if (summary.daily.length === 0) {
    return (
      <div className="card empty-state">
        <h3>No analytics yet</h3>
        <p className="note">
          Daily numbers show up here after accounts are connected. The bot writes one row per platform per day.
          Nothing on this page is estimated.
        </p>
      </div>
    );
  }
  const maxViews = Math.max(...summary.daily.map((row) => row.views ?? 0), 1);
  return (
    <>
      {summary.exampleMode ? (
        <div className="card callout">
          <span className="example">EXAMPLE DATA</span> These numbers are made up to show the layout. Real numbers fill in daily once your accounts are connected (see &quot;Connect accounts&quot;).
        </div>
      ) : null}
      <div className="stats">
        <div className="card stat">
          {summary.exampleMode ? <span className="example">EXAMPLE</span> : null}
          <div className="n">{summary.followers != null ? commaCount(summary.followers) : "—"}</div>
          <div className="l">TikTok followers{creator.handles ? ` · ${creator.handles}` : ""}</div>
        </div>
        <div className="card stat">
          {summary.exampleMode ? <span className="example">EXAMPLE</span> : null}
          <div className="n">+{commaCount(summary.newFollowers)}</div>
          <div className="l">New followers, last 7 days</div>
        </div>
        <div className="card stat">
          {summary.exampleMode ? <span className="example">EXAMPLE</span> : null}
          <div className="n">{summary.averageViews != null ? compactCount(summary.averageViews) : "—"}</div>
          <div className="l">Average views per video, last 30 days</div>
        </div>
        <div className="card stat">
          {summary.exampleMode ? <span className="example">EXAMPLE</span> : null}
          <div className="n">{summary.engagementRate != null ? `${summary.engagementRate}%` : "—"}</div>
          <div className="l">Engagement rate, last 30 days</div>
        </div>
      </div>
      <div className="card">
        <div className="sec-title">Daily views, last 14 days {summary.exampleMode ? <span className="example">EXAMPLE</span> : null}</div>
        <div className="bars">
          {summary.daily.slice(-14).map((row) => (
            <div key={row.id} style={{ height: `${Math.max(4, Math.round(((row.views ?? 0) / maxViews) * 100))}%` }}>
              <span>{Number(row.metricDate.slice(8))}</span>
            </div>
          ))}
        </div>
        <div style={{ height: 22 }} />
        <p className="note">Kamron sees the same numbers when he&apos;s negotiating, so quotes stay consistent and backed by current stats.</p>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="sec-title">Top posts {summary.exampleMode ? <span className="example">EXAMPLE</span> : null}</div>
        {summary.posts.length === 0 ? <p className="note empty">No posts recorded yet.</p> : (
          <table>
            <thead><tr><th>Post</th><th>Platform</th><th>Views</th><th>Saves</th></tr></thead>
            <tbody>
              {summary.posts.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td>{post.platform}</td>
                  <td>{post.views != null ? compactCount(post.views) : "—"}</td>
                  <td>{post.saves != null ? compactCount(post.saves) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
