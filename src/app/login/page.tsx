import Link from "next/link";
import { redirect } from "next/navigation";
import { devLoginAction } from "@/app/actions";
import { getDb } from "@/db/getDb";
import { devLoginEnabled } from "@/lib/authz";
import { currentViewer } from "@/lib/current-user";
import { publicBasePath, withBasePath } from "@/lib/format";
import { googleConfigured } from "@/lib/google-oauth";
import { listManagers } from "@/lib/managers";
import { listCreators } from "@/lib/queries";
import { creatorStartPath } from "@/lib/questionnaire";

const ERRORS: Record<string, string> = {
  not_allowed: "That Google account isn't on the Momma Mari creator list. Use the Gmail Kamron has on file for you.",
  oauth: "Google sign-in didn't finish. Try again.",
  not_configured: "Google sign-in isn't set up on this server yet.",
  dev_disabled: "The practice sign-in is turned off.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const viewer = await currentViewer();
  const params = await searchParams;
  const db = await getDb();
  if (viewer) redirect(await creatorStartPath(db, viewer));
  const creators = devLoginEnabled() ? await listCreators(db) : [];
  const managers = devLoginEnabled() ? (await listManagers(db)).filter((manager) => manager.active) : [];
  const error = params.error ? ERRORS[params.error] ?? "Sign-in didn't finish. Try again. Nothing was changed." : null;
  const base = publicBasePath();
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <img className="logo-img" src={withBasePath("/momma-logo.png")} alt="" />
        <h1>Momma Mari</h1>
        <p className="note">Creator portal. Sign in with the Google account Kamron invited. You&apos;ll only see your own deals.</p>
        {error ? <p className="private-note">{error}</p> : null}
        {params.error === "not_allowed" ? (
          <p className="note"><Link href="/apply">Apply to join Momma Mari</Link></p>
        ) : null}
        {googleConfigured() ? (
          <a className="btn" href={`${base}/api/auth/google`}>Continue with Google</a>
        ) : (
          <p className="note">Google sign-in is waiting on a client id and secret. The steps are in the README.</p>
        )}
        {devLoginEnabled() ? (
          <>
            <div className="sec-title" style={{ marginTop: 18 }}>Practice sign-in</div>
            <p className="note">Local only. These buttons skip Google so you can click through the seed data. Turn AUTH_DEV_LOGIN off before this is on the real site.</p>
            <div className="people">
              <form action={devLoginAction}>
                <input type="hidden" name="email" value="Kamron@mommamari.com" />
                <button className="btn ghost" type="submit">Continue as Kamron (admin, sees everyone)</button>
              </form>
              {managers.map((manager) => (
                <form key={manager.id} action={devLoginAction}>
                  <input type="hidden" name="email" value={manager.email} />
                  <button className="btn ghost" type="submit">Continue as {manager.name} (manager)</button>
                </form>
              ))}
              {creators.map((creator) => (
                <form key={creator.id} action={devLoginAction}>
                  <input type="hidden" name="email" value={creator.email} />
                  <button className="btn" type="submit">Continue as {creator.name}</button>
                </form>
              ))}
            </div>
          </>
        ) : null}
        <p className="note" style={{ marginTop: 16 }}><Link href="https://mommamari.com">Back to mommamari.com</Link></p>
      </div>
    </div>
  );
}
