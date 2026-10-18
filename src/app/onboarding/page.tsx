import Link from "next/link";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { PortalFrame } from "@/components/portal-frame";
import { publicBasePath } from "@/lib/format";
import { loadPortal } from "@/lib/current-user";
import { onboardingPlatformLabel } from "@/lib/onboarding-fields";
import { gmailConnectionState, onboardingForCreator } from "@/lib/onboarding";

const GMAIL_ERRORS: Record<string, string> = {
  oauth: "Google didn't finish connecting your email. Try the button again.",
  no_refresh: "Google didn't give us a way to stay connected. Try Connect your email again and accept the permissions.",
  not_configured: "Email connection isn't set up on this server yet. Kamron still needs to add the encryption key.",
  creator_only: "Connect your email from your own sign-in. Kamron can't connect a creator's mailbox for her.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; connected?: string; done?: string; error?: string; gmail?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const creator = portal.viewer.role === "creator" ? portal.viewed : portal.viewed;
  const connection = creator ? await gmailConnectionState(portal.db, creator.id) : null;
  const profile = creator ? await onboardingForCreator(portal.db, creator.id) : null;
  const own = portal.viewer.role === "creator";
  const gmailError = params.gmail ? GMAIL_ERRORS[params.gmail] : null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="connect"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>{own ? "Set up your bot" : "Creator onboarding"}</h1>
            <p>Connect email first, then name the bot and fill in a short profile. Kamron is told when it's finished.</p>
          </div>
        </div>
      }
    >
      {gmailError ? <p className="private-note">{gmailError}</p> : null}
      {params.connected === "1" ? <p className="callout">Email connected. Finish the questions below.</p> : null}
      {params.done === "1" ? <p className="callout">You&apos;re set. Kamron has &quot;New creator ready for bot&quot; and will set the bot up with you.</p> : null}
      {!creator ? <p className="note">Pick a creator to see her profile.</p> : null}
      {creator && connection && !connection.connected ? (
        <div className="card">
          <h2>Connect your email</h2>
          <p>This is separate from signing in. Google asks for permission to read brand mail and to draft replies. We store that permission locked, and we never see your password.</p>
          {own ? (
            <a className="btn" href={`${publicBasePath()}/api/auth/gmail`}>Connect your email</a>
          ) : (
            <p className="note">{creator.name} connects this from her own sign-in.</p>
          )}
        </div>
      ) : null}
      {creator && connection?.connected && own && !profile?.finishedAt ? (
        <OnboardingWizard creatorName={creator.name} suggestedBotName={`${creator.name} Bot`} error={params.error === "1"} />
      ) : null}
      {creator && profile?.finishedAt ? (
        <div className="card">
          <h2>{profile.botName}</h2>
          <p className="note">{connection?.gmailEmail ? `Email connected as ${connection.gmailEmail}` : "Email connected"}</p>
          <ul>
            <li>Niche: {profile.niche}</li>
            <li>Style: {profile.contentStyle}</li>
            <li>Kids&apos; ages: {profile.kidsAges || "Not shared"}</li>
            <li>Rates: {profile.rates}</li>
            <li>Favorite brands: {profile.favoriteBrands || "None listed"}</li>
            <li>Platforms: {profile.platforms.map(onboardingPlatformLabel).join(", ")}</li>
          </ul>
          <p className="note">Finished. Kamron sees &quot;New creator ready for bot&quot;.</p>
          <Link href="/connect">Back to connected accounts</Link>
        </div>
      ) : null}
    </PortalFrame>
  );
}
