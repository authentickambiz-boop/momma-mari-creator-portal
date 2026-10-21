import Link from "next/link";
import { joinBenchAction } from "@/app/bench-actions";
import { PrivacyNotice } from "@/components/privacy-notice";
import { TagPicker } from "@/components/tag-picker";
import { benchErrorNote } from "@/lib/bench-notes";
import { NICHE_CATALOG, PLATFORM_OPTIONS } from "@/lib/niche-catalog";

export const metadata = { robots: { index: false, follow: false } };

export default async function JoinBenchPage({ searchParams }: { searchParams: Promise<{ saved?: string; benchError?: string }> }) {
  const params = await searchParams;
  return (
    <main className="wrap">
      <h1>Join the bench</h1>
      <p>This is free. There is no fee and no subscription. Roster creators see a job first. You are offered what they pass on. Momma Mari reviews each offer. The 20% applies only when a job is paid.</p>
      {params.saved ? <p className="note">You are on the bench. There is no fee.</p> : null}
      {benchErrorNote(params.benchError) ? <p className="private-note">{benchErrorNote(params.benchError)}</p> : null}
      <form action={joinBenchAction} className="card stack">
        <label>Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={[]} placeholder="Search niches" />
        <TagPicker name="platforms" label="Platforms" options={PLATFORM_OPTIONS} selected={[]} />
        <div className="sec-title">UGC samples</div>
        {[0, 1, 2].map((index) => (
          <div key={index} className="stage-form">
            <label>Sample title<input name={`title-${index}`} /></label>
            <label>Link<input name={`url-${index}`} /></label>
          </div>
        ))}
        <PrivacyNotice />
        <button className="btn" type="submit">Join free</button>
      </form>
      <p><Link href="/gifts/apply">Free products, if you are already on the bench</Link></p>
      <p><Link href="/login">Creator sign-in</Link></p>
    </main>
  );
}
