import { saveSettingsAction } from "@/app/account-actions";
import { ConnectPanel } from "@/components/connect-panel";
import { PortalFrame } from "@/components/portal-frame";
import { driveConnectionState, driveConnectHref, gmailConnectHref } from "@/lib/account-connections";
import { canManageCreatorAccounts, storedConnectionStatus } from "@/lib/account-connection-status";
import { readOwnAccount } from "@/lib/creator-home";
import { loadPortal } from "@/lib/current-user";
import { emailSetupFor, gmailConnectionState } from "@/lib/onboarding";
import { settingsErrorNote } from "@/lib/account-notes";
import { SeasonalThemeSettings } from "@/components/seasonal-theme-settings";
import { themeErrorNote } from "@/lib/seasonal-theme";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; settingsError?: string; themeSaved?: string; themeError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  const account = await readOwnAccount(portal.db, portal.viewer);
  const creator = portal.viewer.role === "creator" ? portal.creators.find((row) => row.id === portal.viewer.creatorId) ?? null : null;
  const connection = creator ? await gmailConnectionState(portal.db, creator.id) : null;
  const drive = creator ? await driveConnectionState(portal.db, creator.id) : null;
  const setup = creator ? await emailSetupFor(portal.db, creator.id) : null;
  const settingsError = settingsErrorNote(params.settingsError);
  const themeError = themeErrorNote(params.themeError);
  return (
    <PortalFrame viewer={portal.viewer} tab="settings" creators={portal.creators} viewedId={portal.viewedId} hello={<div className="hello"><h1>Settings</h1><p>Connected accounts and the notices you want.</p></div>}>
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {params.themeSaved ? <p className="note">Seasonal theme saved. Nothing was emailed.</p> : null}
      {settingsError ? <p className="private-note">{settingsError}</p> : null}
      {themeError ? <p className="private-note">{themeError}</p> : null}
      <div className="card stack">
        <div className="sec-title">Connected accounts</div>
        {creator ? (
          <ConnectPanel
            creator={creator}
            canManage={canManageCreatorAccounts(portal.viewer, creator.id)}
            gmailStatus={storedConnectionStatus(connection?.connected ?? false, connection?.needsReconnect ?? false)}
            gmailEmail={connection?.gmailEmail ?? null}
            gmailConnectHref={gmailConnectHref(portal.viewer, creator.id)}
            driveStatus={storedConnectionStatus(drive?.connected ?? false, drive?.needsReconnect ?? false)}
            driveConnectHref={driveConnectHref(portal.viewer, creator.id)}
            emailSetup={setup?.choice ?? null}
            hostedEmailAddress={setup?.hostedEmailAddress ?? null}
            showBilling={false}
            showOwnSetup
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
      {portal.viewer.role === "admin" ? <SeasonalThemeSettings /> : null}
    </PortalFrame>
  );
}
