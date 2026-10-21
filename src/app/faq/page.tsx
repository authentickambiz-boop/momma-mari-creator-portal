import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";
import { SIGN_FOLLOWER_MINIMUM } from "@/lib/signing-thresholds";

export const metadata = {
  ...publicPageMeta({
    title: "Momma Mari FAQ",
    description: "How to apply, how existing creators finish a profile, and how to reach Kamron.",
    path: "/faq",
  }),
  robots: PUBLIC_ROBOTS,
};

export default function FaqPage() {
  const followers = SIGN_FOLLOWER_MINIMUM.toLocaleString("en-US");
  return (
    <PublicShell title="FAQ" lede="Short answers. Longer help articles are not published here yet.">
      <article className="card">
        <h2>How do I apply?</h2>
        <p>Use <Link href="/apply">Apply</Link>. There is no fee. Creators with {followers} followers or more on a platform are reviewed for the roster. If you are still growing, the application sends you to the creator curriculum.</p>
      </article>
      <article className="card">
        <h2>I already have a portal login. What do I fill in?</h2>
        <p>Sign in and complete your profile: legal name, mailing address, phone, and handles. That stays on your intake record. Nothing is emailed from the form.</p>
      </article>
      <article className="card">
        <h2>Do brands see creator rates?</h2>
        <p>No. What a creator charges stays with Kamron. It is not listed on public pages or brand-facing pages.</p>
      </article>
      <article className="card">
        <h2>Is the bench a paid list?</h2>
        <p><Link href="/bench/join">Join the bench</Link> has no fee. Momma Mari reviews each offer. The bench page explains the fee that applies only when a job is paid.</p>
      </article>
      <article className="card">
        <h2>What about kids in content?</h2>
        <p>Read <Link href="/our-standard">Kids in content</Link>. Applications ask for age ranges only, not a child&apos;s name or birthday.</p>
      </article>
      <article className="card">
        <h2>How do I reach Kamron?</h2>
        <p>Use the <Link href="/contact">contact form</Link>. It is saved in the portal. Nothing is emailed from that form on its own.</p>
      </article>
    </PublicShell>
  );
}
