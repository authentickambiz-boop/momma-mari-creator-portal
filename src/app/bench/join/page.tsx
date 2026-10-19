import Link from "next/link";
import { joinBenchAction } from "@/app/bench-actions";
import { TagPicker } from "@/components/tag-picker";
import { NICHE_CATALOG, PLATFORM_OPTIONS } from "@/lib/niche-catalog";

export const metadata = { robots: { index: false, follow: false } };

export default async function JoinBenchPage({ searchParams }: { searchParams: Promise<{ saved?: string; benchError?: string }> }) {
  const params = await searchParams;
  return (
    <main className="wrap">
      <h1>Join the bench</h1>
      <p>This is free. There is no fee and no subscription. Roster creators see a job first. You are offered what they pass on, and Kamron approves each offer. The agency's 20% applies only when a job is paid.</p>
      {params.saved ? <p className="note">You're on the bench. Nothing was charged.</p> : null}
      {params.benchError ? <p className="private-note">{params.benchError}</p> : null}
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
        <button className="btn" type="submit">Join free</button>
      </form>
      <p><Link href="/login">Creator sign-in</Link></p>
    </main>
  );
}
