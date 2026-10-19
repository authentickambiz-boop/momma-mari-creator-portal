import { capturedLabel, metricLabel, parseDisplayedCount, type CreatorSnapshotCard, type SnapshotMetrics, type SnapshotTrendPoint } from "@/lib/analytics-snapshots";
import { formatMoney } from "@/lib/format";

function MetricList({ metrics }: { metrics: SnapshotMetrics }) {
  const entries = Object.entries(metrics);
  if (!entries.length) return null;
  return (
    <div className="snap-metrics">
      {entries.map(([key, value]) => {
        if (value && typeof value === "object") {
          return (
            <div key={key}>
              <div className="sec-title">{key === "longForm" ? "Long-form" : key === "shorts" ? "Shorts" : metricLabel(key)}</div>
              <MetricList metrics={value} />
            </div>
          );
        }
        return (
          <div key={key} className="snap-metric">
            <span>{metricLabel(key)}</span>
            <b>{value == null ? "Unavailable" : value}</b>
          </div>
        );
      })}
    </div>
  );
}

function Trend({ points }: { points: SnapshotTrendPoint[] }) {
  if (points.length < 2) return <p className="note">One week on file, so there is no trend yet.</p>;
  const counts = points.map((point) => parseDisplayedCount(point.followers) ?? 0);
  const max = Math.max(...counts, 1);
  return (
    <div>
      <div className="bars" aria-hidden="true">
        {counts.map((count, index) => (
          <div key={points[index].capturedOn} style={{ height: `${Math.max(8, Math.round((count / max) * 100))}%` }} />
        ))}
      </div>
      <p className="note">{points.map((point) => `${capturedLabel(point.capturedOn)} ${point.followers ?? "not shown"}`).join(" · ")}</p>
    </div>
  );
}

export function SnapshotBoard({ creators, showRevenue }: { creators: CreatorSnapshotCard[]; showRevenue: boolean }) {
  if (!creators.length) {
    return <div className="card"><p className="note">No creators on this sign-in have a snapshot yet.</p></div>;
  }
  return (
    <div className="stack">
      {creators.map((creator) => (
        <section key={creator.creatorId} className="card">
          <h2>{creator.name}</h2>
          <p className="note">
            {creator.location ? `${creator.location} · ` : ""}
            {creator.totalAudience ? `Total audience ${creator.totalAudience}` : "Total audience not shown"}
            {creator.largestPlatform ? ` · Largest platform ${creator.largestPlatform}` : ""}
          </p>
          {creator.platforms.length ? null : <p className="note">No snapshot yet.</p>}
          <div className="snap-grid">
            {creator.platforms.map((platform) => (
              <article key={platform.platform} className="box">
                <div className="sec-title">{platform.platform}{platform.period ? ` · ${platform.period}` : ""}</div>
                <p className="note">
                  {platform.handle ?? platform.channelName ?? platform.platform}
                  {` · ${platform.source} · ${capturedLabel(platform.capturedOn)}`}
                  {platform.updatedLabel ? ` · ${platform.updatedLabel}` : ""}
                </p>
                {platform.benchmark ? <p>{platform.benchmark}</p> : null}
                <MetricList metrics={platform.metrics} />
                {platform.audience ? (
                  <div className="snap-audience">
                    {Object.entries(platform.audience).map(([group, lines]) => (
                      <p key={group}><b>{group[0].toUpperCase()}{group.slice(1)}.</b> {lines.join("; ")}</p>
                    ))}
                  </div>
                ) : null}
                {platform.clips?.length ? <p className="note">Clips: {platform.clips.join("; ")}</p> : null}
                <p className="note">
                  {platform.change
                    ? `Since ${capturedLabel(platform.change.previousOn)}: followers ${platform.change.followers ?? "not shown"}, engagement ${platform.change.engagement ?? "not shown"}.`
                    : "No earlier snapshot, so there is no week-over-week change yet."}
                </p>
                <Trend points={platform.trend} />
                {showRevenue && platform.revenueCents != null ? <p className="note">Revenue {formatMoney(platform.revenueCents)}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
