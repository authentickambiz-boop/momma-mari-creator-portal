import { saveSettingsAction } from "@/app/account-actions";
import { ConnectPanel } from "@/components/connect-panel";
import { PortalFrame } from "@/components/portal-frame";
import { readOwnAccount } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";
import { emailSetupFor, gmailConnectionState } from "@/lib/onboarding";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; settingsError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const account = await readOwnAccount(portal.db, portal.viewer);
  const creator = portal.viewer.role === "creator" ? portal.creators.find((row) => row.id === portal.viewer.creatorId) ?? null : null;
  const connection = creator ? await gmailConnectionState(portal.db, creator.id) : null;
  const setup = creator ? await emailSetupFor(portal.db, creator.id) : null;
  return (
    <PortalFrame viewer={portal.viewer} tab="settings" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Settings</h1><p>Connected accounts and the notices you want.</p></div>}>
      {params.saved ? <p className="note">Saved.</p> : null}
      {params.settingsError ? <p className="private-note">{params.settingsError}</p> : null}
      <div className="card stack">
        <div className="sec-title">Connected accounts</div>
        {creator ? (
          <ConnectPanel
            creator={creator}
            canConnectEmail={true}
            emailConnected={connection?.connected ?? false}
            gmailEmail={connection?.gmailEmail ?? null}
            emailSetup={setup?.choice ?? null}
            hostedEmailAddress={setup?.hostedEmailAddress ?? null}
            showBilling={false}
          />
        ) : (
          <p className="note">Creators connect their own accounts from their sign-in. Staff still have Connect accounts in the tab row.</p>
        )}
      </div>
      {account ? (
        <form action={saveSettingsAction} className="card stack" style={{ marginTop: 14 }}>
          <div className="sec-title">Notices</div>
          <label><input type="checkbox" name="emailNotices" value="1" defaultChecked={account.emailNotices} /> Email notices</label>
          <label><input type="checkbox" name="pushNotices" value="1" defaultChecked={account.pushNotices} /> Push notices</label>
          <label><input type="checkbox" name="quietHours" value="1" defaultChecked={account.quietHours} /> Quiet hours, 9 PM to 8 AM ET</label>
          <label><input type="checkbox" name="communityVisible" value="1" defaultChecked={account.communityVisible} /> Show me in the community</label>
          <button className="btn" type="submit">Save settings</button>
        </form>
      ) : null}
    </PortalFrame>
  );
}
