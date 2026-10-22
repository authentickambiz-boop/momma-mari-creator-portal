import { commaCount } from "@/lib/format";
import type { JulyHeadlineCard } from "@/lib/analytics-snapshots";
import type { DailyMetric, PostMetric } from "@/lib/types";
import { summarizeAnalytics } from "@/lib/queries";

export function AnalyticsPanel({
  daily,
  posts,
  july,
}: {
  daily: DailyMetric[];
  posts: PostMetric[];
  july: { cards: JulyHeadlineCard[] };
}) {
  const summary = summarizeAnalytics(daily, posts);
  const cards = [...july.cards];
  if (summary.newFollowers != null) {
    cards.push({
      id: "newFollowers",
      value: `+${commaCount(summary.newFollowers)}`,
      label: "New followers, last 7 days",
    });
  }
  const chart = summary.daily.filter((row) => row.views != null);
  const realPosts = summary.posts;
  if (!cards.length && !chart.length && !realPosts.length) {
    return (
      <div className="card empty-state">
        <h3>No analytics yet</h3>
        <p className="note">Daily numbers show up here after accounts are connected. Nothing on this page is estimated.</p>
      </div>
    );
  }
  const maxViews = Math.max(...chart.map((row) => row.views ?? 0), 1);
  return (
    <>
      {cards.length ? (
        <div className="stats">
          {cards.map((card) => (
            <div key={`${card.id}-${card.label}`} className="card stat">
              <div className="n">{card.value}</div>
              <div className="l">{card.label}</div>
            </div>
          ))}
        </div>
      ) : null}
      {chart.length ? (
        <div className="card">
          <div className="sec-title">Daily views, last 14 days</div>
          <div className="bars">
            {chart.slice(-14).map((row) => (
              <div key={row.id} style={{ height: `${Math.max(4, Math.round(((row.views ?? 0) / maxViews) * 100))}%` }}>
                <span>{Number(row.metricDate.slice(8))}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 22 }} />
          <p className="note">Kamron sees the same numbers when he&apos;s negotiating, so quotes stay consistent and backed by current stats.</p>
        </div>
      ) : null}
      {realPosts.length ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Top posts</div>
          <table>
            <thead><tr><th>Post</th><th>Platform</th><th>Views</th><th>Saves</th></tr></thead>
            <tbody>
              {realPosts.map((post) => (
                <tr key={post.id}>
                  <td>{post.title}</td>
                  <td>{post.platform}</td>
                  <td>{post.views != null ? commaCount(post.views) : "—"}</td>
                  <td>{post.saves != null ? commaCount(post.saves) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
