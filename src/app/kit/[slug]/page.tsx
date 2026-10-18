import { notFound } from "next/navigation";
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
      <p className="note">Stats were entered by hand. This page does not show pay or contact details.</p>
    </main>
  );
}
