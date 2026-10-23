import Link from "next/link";
import { redirect } from "next/navigation";
import { devLoginAction } from "@/app/actions";
import { BrandMark } from "@/components/brand-mark";
import { getDb } from "@/db/getDb";
import { devLoginEnabled } from "@/lib/authz";
import { currentViewer } from "@/lib/current-user";
import { publicBasePath } from "@/lib/format";
import { googleConfigured } from "@/lib/google-oauth";
import { listManagers } from "@/lib/managers";
import { listCreators } from "@/lib/queries";
import { creatorStartPath } from "@/lib/questionnaire";
import { worldsReturnPath } from "@/lib/worlds/office-return";

const ERRORS: Record<string, string> = {
  not_allowed: "That Google account isn't on the Momma Mari creator list. Use the Gmail Kamron has on file for you, or apply to join if you are new.",
  oauth: "Google sign-in didn't finish. Try again.",
  not_configured: "Google sign-in isn't set up on this server yet.",
  dev_disabled: "The practice sign-in is turned off.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const viewer = await currentViewer();
  const params = await searchParams;
  const db = await getDb();
  const backToWorlds = worldsReturnPath(params.next) === "/worlds";
  if (viewer) redirect(backToWorlds ? "/worlds" : await creatorStartPath(db, viewer));
  const creators = devLoginEnabled() ? await listCreators(db) : [];
  const managers = devLoginEnabled() ? (await listManagers(db)).filter((manager) => manager.active) : [];
  const error = params.error ? ERRORS[params.error] ?? "Sign-in didn't finish. Try again. Nothing was changed." : null;
  const showApplyHint = params.error === "not_allowed" || params.error === "oauth";
  const base = publicBasePath();
  return (
    <div className="login-split">
      <a className="skip" href="#signin">Skip to sign in</a>
      <div className="login-pane" id="signin">
        <BrandMark sub="Creator portal" />
        <h1>Welcome back.</h1>
        <p className="lead">Sign in with the Google account you were invited with. You&apos;ll only see your own deals.</p>
        {error ? <p className="private-note" role="alert">{error}</p> : null}
        {showApplyHint ? <p className="note">If you are new, apply to join Momma Mari. We review each application and reply within 5 business days.</p> : null}
        {backToWorlds ? null : <Link className="btn" href="/apply">New creator? Apply to join Momma Mari</Link>}
        {googleConfigured() ? (
          <a className="btn google" href={backToWorlds ? `${base}/api/auth/google?next=/worlds` : `${base}/api/auth/google`}>Continue with Google</a>
        ) : (
          <p className="note">Google sign-in is waiting on a client id and secret. The steps are in the README.</p>
        )}
        {devLoginEnabled() ? (
          <>
            <div className="sec-title" style={{ marginTop: 18 }}>Practice sign-in</div>
            <p className="note">Local only. These buttons skip Google so you can click through the seed data. Turn AUTH_DEV_LOGIN off before this is on the real site.</p>
            <div className="people">
              <form action={devLoginAction}>
                {backToWorlds ? <input type="hidden" name="next" value="/worlds" /> : null}
                <input type="hidden" name="email" value="Kamron@mommamari.com" />
                <button className="btn ghost" type="submit">Continue as Kamron (admin, sees everyone)</button>
              </form>
              {managers.map((manager) => (
                <form key={manager.id} action={devLoginAction}>
                  {backToWorlds ? <input type="hidden" name="next" value="/worlds" /> : null}
                  <input type="hidden" name="email" value={manager.email} />
                  <button className="btn ghost" type="submit">Continue as {manager.name} (manager)</button>
                </form>
              ))}
              {creators.map((creator) => (
                <form key={creator.id} action={devLoginAction}>
                  {backToWorlds ? <input type="hidden" name="next" value="/worlds" /> : null}
                  <input type="hidden" name="email" value={creator.email} />
                  <button className="btn ghost" type="submit">Continue as {creator.name}</button>
                </form>
              ))}
            </div>
          </>
        ) : null}
        {backToWorlds ? null : <p className="note" style={{ marginTop: 16 }}><Link href="https://mommamari.com">Back to mommamari.com</Link></p>}
      </div>
      <aside className="login-forest">
        <p className="eyebrow">Your creator portal</p>
        <h2>Every deal, draft and payout in one place.</h2>
        <p>Upload drafts from your phone. We handle the brand emails, and nothing goes to a brand without approval.</p>
      </aside>
    </div>
  );
}
