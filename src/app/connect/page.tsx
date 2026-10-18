import { ConnectPanel } from "@/components/connect-panel";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { emailSetupFor, gmailConnectionState } from "@/lib/onboarding";

const GMAIL_ERRORS: Record<string, string> = {
  oauth: "Google didn't finish connecting that email. Try again.",
  no_refresh: "Google didn't give us a way to stay connected. Try again and accept the permissions.",
  not_configured: "Email connection isn't set up on this server yet.",
  creator_only: "A creator connects her own email. That button is on her sign-in, not yours.",
};

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ creator?: string; gmail?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const creators = portal.viewed ? [portal.viewed] : portal.creators;
  const connections = await Promise.all(creators.map((creator) => gmailConnectionState(portal.db, creator.id)));
  const setups = await Promise.all(creators.map((creator) => emailSetupFor(portal.db, creator.id)));
  const gmailError = params.gmail ? GMAIL_ERRORS[params.gmail] : null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="connect"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Connect accounts</h1><p>Email uses a separate Google permission. The other buttons wait until a bot adds the Zernio links.</p></div></div>}
    >
      {gmailError ? <p className="private-note">{gmailError}</p> : null}
      <div className="stack">
        {creators.map((creator, index) => (
          <section key={creator.id}>
            {!portal.viewed ? <h2 style={{ marginBottom: 8 }}>{creator.name}</h2> : null}
            <ConnectPanel
              creator={creator}
              canConnectEmail={portal.viewer.role === "creator" && portal.viewer.creatorId === creator.id}
              emailConnected={connections[index]?.connected ?? false}
              gmailEmail={connections[index]?.gmailEmail ?? null}
              emailSetup={setups[index]?.choice ?? null}
              hostedEmailAddress={setups[index]?.hostedEmailAddress ?? null}
            />
          </section>
        ))}
      </div>
    </PortalFrame>
  );
}
