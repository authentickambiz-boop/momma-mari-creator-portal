import Image from "next/image";
import Link from "next/link";
import { capturedLabel } from "@/lib/analytics-snapshots";
import { workWithHref, workWithLabel, type PublicMeetCreator, type PublicPlatformCard } from "@/lib/public-creators";

function PlatformBlock({ platform }: { platform: PublicPlatformCard }) {
  const hasNumbers = Boolean(platform.followers || platform.engagement || platform.averageViews || platform.averageViewParts?.length);
  return (
    <section className="meet-platform">
      <h3>{platform.platform}</h3>
      {platform.handle ? <p className="note">{platform.handle}</p> : null}
      {hasNumbers ? (
        <dl className="meet-metrics">
          {platform.followers ? (
            <div>
              <dt>{platform.followersLabel}</dt>
              <dd>{platform.followers}</dd>
            </div>
          ) : null}
          {platform.engagement ? (
            <div>
              <dt>Engagement rate</dt>
              <dd>{platform.engagement}</dd>
            </div>
          ) : null}
          {platform.averageViews ? (
            <div>
              <dt>Average views</dt>
              <dd>{platform.averageViews}</dd>
            </div>
          ) : null}
          {platform.averageViewParts?.map((part) => (
            <div key={part.label}>
              <dt>Average views, {part.label}</dt>
              <dd>{part.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {platform.audience?.length ? (
        <ul className="meet-audience">
          {platform.audience.map((item) => (
            <li key={item.label}><span>{item.label}</span> {item.value}</li>
          ))}
        </ul>
      ) : null}
      <p className="note">
        Last updated {capturedLabel(platform.capturedOn)}
        {platform.period ? ` · ${platform.period}` : ""}
        {platform.source ? ` · ${platform.source}` : ""}
      </p>
    </section>
  );
}

export function MeetCreators({ creators }: { creators: PublicMeetCreator[] }) {
  if (!creators.length) return <p className="note">No creators are on the public page yet.</p>;
  return (
    <div className="meet-grid">
      {creators.map((creator) => (
        <article key={creator.id} id={creator.id} className="card meet-card">
          {creator.photo ? (
            <Image className="meet-photo" src={creator.photo} alt={creator.name} width={400} height={400} />
          ) : (
            <div className="avatar meet-fallback" aria-hidden="true">{creator.initials}</div>
          )}
          <h2>{creator.name}</h2>
          {creator.bio ? <p>{creator.bio}</p> : null}
          {creator.location ? <p className="note">{creator.location}</p> : null}
          {creator.totalAudience ? <p className="note">Total audience {creator.totalAudience}</p> : null}
          <p className="note">Last updated {creator.lastUpdatedLabel}</p>
          {creator.platforms.map((platform) => (
            <PlatformBlock key={platform.platform} platform={platform} />
          ))}
          <Link className="btn accent" href={workWithHref(creator.id)}>{workWithLabel(creator.name)}</Link>
        </article>
      ))}
    </div>
  );
}
