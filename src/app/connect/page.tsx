import { AccountActions, ConnectPanel } from "@/components/connect-panel";
import { PortalFrame } from "@/components/portal-frame";
import { driveConnectionState, driveConnectHref, gmailConnectHref } from "@/lib/account-connections";
import { canManageCreatorAccounts, mappedConnectionNote, storedConnectionStatus } from "@/lib/account-connection-status";
import { loadPortal } from "@/lib/current-user";
import { withBasePath } from "@/lib/format";
import { gmailBridgeConnectHref, gmailSyncEnabled, gmailSyncStatusLine } from "@/lib/gmail-bridge";
import { WATCH_MAILBOXES } from "@/lib/gmail-push";
import { emailSetupFor, gmailConnectionState } from "@/lib/onboarding";

const GMAIL_ERRORS: Record<string, string> = {
  oauth: "Google didn't finish connecting that email. Try again.",
  email: "Enter the inbox email.",
  inbox: "No watched inbox uses that email.",
  no_refresh: "Google didn't give us a way to stay connected. Try again and accept the permissions.",
  not_configured: "Email connection isn't set up on this server yet.",
  creator_only: "Only that creator, or an admin, can connect this inbox.",
  wrong_mailbox: "Sign in to Google as the inbox named on the button. That mailbox was not connected.",
};

const DRIVE_NOTES: Record<string, string> = {
  connected: "Google Drive is connected for the files you choose.",
  oauth: "Google didn't finish connecting Drive. Try again.",
  no_refresh: "Google didn't give us a way to stay connected to Drive. Try again and accept the permission.",
  not_configured: "Drive connection isn't set up on this server yet.",
  creator_only: "A creator connects her own Drive from her sign-in.",
};

const ACCOUNT_NOTES: Record<string, string> = {
  disconnected: "That connection is removed. You are still signed in.",
  forbidden: "You can only change your own accounts.",
  error: "That account could not be disconnected. Try again.",
};

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; gmail?: string; drive?: string; account?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const creators = portal.viewed ? [portal.viewed] : portal.creators;
  const connections = await Promise.all(creators.map((creator) => gmailConnectionState(portal.db, creator.id)));
  const drives = await Promise.all(creators.map((creator) => driveConnectionState(portal.db, creator.id)));
  const setups = await Promise.all(creators.map((creator) => emailSetupFor(portal.db, creator.id)));
  const gmailError = params.gmail && params.gmail !== "connected" && params.gmail !== "disconnected"
    ? mappedConnectionNote(GMAIL_ERRORS, params.gmail)
    : null;
  const driveNote = mappedConnectionNote(DRIVE_NOTES, params.drive);
  const accountNote = mappedConnectionNote(ACCOUNT_NOTES, params.account);
  const watched = portal.viewer.role === "admin"
    ? await Promise.all(WATCH_MAILBOXES.map(async (box) => ({ box, state: await gmailConnectionState(portal.db, box.creatorId) })))
    : [];
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="connect"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Connect accounts</h1><p>Connect, reconnect, or disconnect Gmail, Google Drive, and each social account. You stay signed in.</p></div></div>}
    >
      {params.gmail === "connected" ? <p className="note">That inbox is connected. The portal can read it. It will not send mail.</p> : null}
      {params.gmail === "disconnected" ? <p className="note">That inbox is disconnected. Connect it again with the current Google client. You are still signed in.</p> : null}
      {gmailError ? <p className="private-note">{gmailError}</p> : null}
      {driveNote ? <p className={params.drive === "connected" ? "note" : "private-note"}>{driveNote}</p> : null}
      {accountNote ? <p className={params.account === "disconnected" ? "note" : "private-note"}>{accountNote}</p> : null}
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Brand inbox</h2>
        <p className="note">{gmailSyncStatusLine(portal.viewer.role)} The connect button asks Google for read-only access. It does not send mail.</p>
        {!gmailSyncEnabled() ? <p className="note">Live sync is off.</p> : null}
        {portal.viewer.role === "manager" ? <p className="note">You can see whether an inbox is connected. You do not get the creator's login.</p> : null}
        {creators.map((creator) => {
          const href = gmailBridgeConnectHref(portal.viewer, creator.id);
          if (!href) return null;
          return (
            <div className="connect" key={`bridge-${creator.id}`}>
              <div>
                <b>{creator.name}</b>
                <div className="note">Read-only Gmail for brand threads.</div>
              </div>
              <a className="btn" href={href}>Connect Gmail (read only)</a>
            </div>
          );
        })}
      </section>
      {watched.length > 0 ? (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2>Watched inboxes</h2>
          <p className="note">Brand mail in these inboxes becomes a hidden offer within seconds of arriving. The portal files it under an MM/ label and saves a reply draft. Prices and dates stay [CONFIRM] until you fill them in. It never sends or deletes mail, and it leaves Sintra&apos;s drafts alone. Disconnect asks you to confirm and does not sign you out.</p>
          {watched.map(({ box, state }) => {
            const matches = state.connected && state.gmailEmail === box.email;
            const status = storedConnectionStatus(matches, matches && state.needsReconnect);
            return (
              <div className="connect" key={box.creatorId}>
                <div>
                  <b>{box.label}</b>
                  <div className="note">{box.email}</div>
                </div>
                <AccountActions
                  creatorId={box.creatorId}
                  platform="gmail"
                  label={`${box.label} Gmail`}
                  status={status}
                  connectHref={withBasePath(`/api/auth/gmail/watch?creator=${box.creatorId}`)}
                />
              </div>
            );
          })}
        </section>
      ) : null}
      <div className="stack">
        {creators.map((creator, index) => {
          const gmail = connections[index];
          const drive = drives[index];
          const self = portal.viewer.role === "creator" && portal.viewer.creatorId === creator.id;
          return (
            <section key={creator.id}>
              {!portal.viewed ? <h2 style={{ marginBottom: 8 }}>{creator.name}</h2> : null}
              <ConnectPanel
                creator={creator}
                canManage={canManageCreatorAccounts(portal.viewer, creator.id)}
                gmailStatus={storedConnectionStatus(gmail?.connected ?? false, gmail?.needsReconnect ?? false)}
                gmailEmail={gmail?.gmailEmail ?? null}
                gmailConnectHref={gmailConnectHref(portal.viewer, creator.id)}
                driveStatus={storedConnectionStatus(drive?.connected ?? false, drive?.needsReconnect ?? false)}
                driveConnectHref={driveConnectHref(portal.viewer, creator.id)}
                emailSetup={setups[index]?.choice ?? null}
                hostedEmailAddress={setups[index]?.hostedEmailAddress ?? null}
                showBilling={portal.viewer.role !== "manager"}
                showOwnSetup={self}
              />
            </section>
          );
        })}
      </div>
    </PortalFrame>
  );
}
