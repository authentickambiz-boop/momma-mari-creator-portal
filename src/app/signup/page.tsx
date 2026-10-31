import type { Metadata } from "next";
import Link from "next/link";
import { beginFreeSignupAction } from "@/app/signup-actions";
import { PublicShell } from "@/components/public-shell";
import { getDb } from "@/db/getDb";
import { publicBasePath } from "@/lib/format";
import { googleConfigured } from "@/lib/google-oauth";
import { publicPageMeta } from "@/lib/public-meta";
import { PUBLIC_ROBOTS } from "@/lib/public-site";
import { signupCodeRequired, signupErrorNote } from "@/lib/signup-codes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...publicPageMeta({
    title: "Create a free account · Momma Mari",
    description: "Create a free Momma Mari account with Google. An invite code is required while sign-up is invite-only.",
    path: "/signup",
  }),
  robots: PUBLIC_ROBOTS,
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const db = await getDb();
  const required = await signupCodeRequired(db);
  const note = signupErrorNote(params.error);
  const base = publicBasePath();
  return (
    <PublicShell title="Create a free account" lede="Type your handles, upload your stats, and read where to start. Platform connections and a custom bot unlock on a paid plan.">
      {note ? <p className="private-note" role="alert">{note}</p> : null}
      {required ? <p>Sign-up is invite-only right now. Use the code from a signed creator or a Pro or Business member.</p> : <p>An invite code is optional right now. You can still enter one if someone shared theirs.</p>}
      <form action={beginFreeSignupAction} className="card stack">
        <label>
          Invite code {required ? null : <span className="note">optional</span>}
          <input name="code" autoComplete="off" required={required} aria-label="Invite code" />
        </label>
        <div className="leave-blank" aria-hidden="true">
          <label>Leave this blank
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {googleConfigured() ? (
          <button className="btn google" type="submit">Continue with Google</button>
        ) : (
          <p className="note">Google sign-in is waiting on a client id and secret.</p>
        )}
      </form>
      <p className="note">Already on the roster? <Link href="/login">Sign in</Link>. Want management? <Link href="/apply">Apply to join Momma Mari</Link>.</p>
      <p className="note">Paid plans are on <Link href="/pricing">Plans</Link>. Nothing is charged on this page.</p>
      <p className="note"><a href={`${base}/login`}>Back to sign in</a></p>
    </PublicShell>
  );
}
