import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { publicPageMeta } from "@/lib/public-meta";
import { CURRICULUM_BANDS, SIGN_FOLLOWER_MINIMUM } from "@/lib/signing-thresholds";

export const metadata = publicPageMeta({
  title: "Creator curriculum",
  description: "Milestone path for creators who are still growing toward the Momma Mari roster.",
  path: "/curriculum",
});

export default async function CurriculumPage({ searchParams }: { searchParams: Promise<{ band?: string }> }) {
  const params = await searchParams;
  const current = CURRICULUM_BANDS.find((band) => band.id === params.band) ?? null;
  return (
    <PublicShell title="Creator curriculum" lede={`Momma Mari signs creators at ${SIGN_FOLLOWER_MINIMUM.toLocaleString("en-US")} followers or more. Under that, this is the path.`}>
      <p>These milestones are a stub. The lessons will be filled in later. Nothing here is a bill, a contract, or an email.</p>
      {current ? <p className="note">Your milestone: {current.label}.</p> : null}
      <div className="public-grid">
        {CURRICULUM_BANDS.map((band) => (
          <article key={band.id} className="card" id={band.id}>
            <h2>{band.label}</h2>
            <p>Milestone placeholder. The work for this range is not written yet.</p>
          </article>
        ))}
      </div>
      <p><Link href="/apply">Back to the application</Link></p>
    </PublicShell>
  );
}
