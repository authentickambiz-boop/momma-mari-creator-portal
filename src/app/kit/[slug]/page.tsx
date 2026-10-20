import { notFound } from "next/navigation";
import { BrandingFooter } from "@/components/branding-footer";
import { getDb } from "@/db/getDb";
import { publicMediaKit } from "@/lib/media-kit";

export const metadata = { robots: { index: false, follow: false } };

export default async function PublicKitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await getDb();
  const kit = await publicMediaKit(db, slug);
  if (!kit) notFound();
  return (
    <main className="wrap">
      <h1>{kit.displayName}</h1>
      {kit.bio ? <p>{kit.bio}</p> : null}
      <ul>
        {kit.followers != null ? <li>Followers: {kit.followers.toLocaleString("en-US")}</li> : null}
        {kit.avgViews != null ? <li>Average views: {kit.avgViews.toLocaleString("en-US")}</li> : null}
        {kit.engagement ? <li>Engagement: {kit.engagement}</li> : null}
      </ul>
      {kit.niches.length > 0 ? <p>{kit.niches.join(" · ")}</p> : null}
      {kit.platforms.length > 0 ? (
        <ul>
          {kit.platforms.map((item) => <li key={`${item.platform}-${item.metric}`}>{item.platform}: {item.metric} {item.value}</li>)}
        </ul>
      ) : null}
      {kit.weeks.length ? (
        <section>
          <h2>Latest week</h2>
          {kit.weeks.map((week) => (
            <article key={week.platform} className="box">
              <div className="sec-title">{week.platform}{week.period ? ` · ${week.period}` : ""}</div>
              <p className="note">{week.source} · {week.capturedOn}</p>
              <ul>
                {week.followers ? <li>Followers: {week.followers}</li> : null}
                {week.engagement ? <li>Engagement: {week.engagement}</li> : null}
                {week.views ? <li>Views: {week.views}</li> : null}
                {week.reach ? <li>Reach: {week.reach}</li> : null}
                {week.likes ? <li>Likes: {week.likes}</li> : null}
                {week.comments ? <li>Comments: {week.comments}</li> : null}
                {week.shares ? <li>Shares: {week.shares}</li> : null}
                {Object.hasOwn(week, "saves") ? <li>Saves: {week.saves == null ? "Unavailable" : week.saves}</li> : null}
              </ul>
              {week.audience?.gender ? <p>Gender. {week.audience.gender.join("; ")}</p> : null}
              {week.audience?.age ? <p>Age. {week.audience.age.join("; ")}</p> : null}
              {week.audience?.location ? <p>Location. {week.audience.location.join("; ")}</p> : null}
              <p className="note">
                {week.weekChange
                  ? `Since the previous week: followers ${week.weekChange.followers ?? "not shown"}, engagement ${week.weekChange.engagement ?? "not shown"}.`
                  : "No earlier week, so there is no week-over-week change yet."}
              </p>
              <p className="note">
                {week.trend.length > 1
                  ? week.trend.map((point) => `${point.capturedOn} ${point.followers ?? "not shown"}`).join(" · ")
                  : "One week on file, so there is no trend yet."}
              </p>
            </article>
          ))}
        </section>
      ) : null}
      <p className="note">Stats were entered by hand. This page does not show pay or contact details.</p>
      <BrandingFooter />
    </main>
  );
}
