"use client";

import { useState } from "react";
import { disconnectAccountAction } from "@/app/account-actions";
import {
  accountButtonState,
  connectionStatus,
  connectionStatusLabel,
  disconnectConfirmMessage,
  type ConnectionStatus,
  type ConnectPlatform,
} from "@/lib/account-connection-status";
import { STRIPE_CATALOG } from "@/lib/email-setup";
import { publicBasePath } from "@/lib/format";
import type { CreatorProfile } from "@/lib/types";

const SOCIALS = [
  { key: "tiktok", label: "TikTok", note: "Daily stats + post scheduling", mark: "TT", color: "#111" },
  { key: "instagram", label: "Instagram", note: "Needs a Business or Creator account", mark: "IG", color: "#C13584" },
  { key: "facebook", label: "Facebook Page", note: "Pick the Page you post from", mark: "f", color: "#1877F2" },
  { key: "youtube", label: "YouTube", note: "Optional", mark: "YT", color: "#FF0000" },
] as const;

function ConnectionLink({
  text,
  enabled,
  href,
  external,
  onUnavailable,
}: {
  text: string;
  enabled: boolean;
  href: string | null;
  external: boolean;
  onUnavailable: () => void;
}) {
  if (enabled && href) {
    return (
      <a className="btn" href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>{text}</a>
    );
  }
  return (
    <button className="btn" type="button" disabled={!enabled} onClick={() => { if (enabled) onUnavailable(); }}>
      {text}
    </button>
  );
}

export function AccountActions({
  creatorId,
  platform,
  label,
  status,
  connectHref,
  external = false,
  unavailableNote,
  onUnavailable,
}: {
  creatorId: string;
  platform: ConnectPlatform;
  label: string;
  status: ConnectionStatus;
  connectHref: string | null;
  external?: boolean;
  unavailableNote?: string;
  onUnavailable?: (note: string) => void;
}) {
  const buttons = accountButtonState(status);
  const chip = status === "connected" ? "chip c-sage" : status === "needs_reconnect" ? "chip c-sun" : "chip c-gray";
  const missing = unavailableNote ?? `${label}: the connect link isn't ready yet.`;
  const reportMissing = () => onUnavailable?.(missing);
  return (
    <div className="connect-actions">
      <span className={chip}>{connectionStatusLabel(status)}</span>
      <ConnectionLink text="Connect" enabled={buttons.connect} href={connectHref} external={external} onUnavailable={reportMissing} />
      <ConnectionLink text="Reconnect" enabled={buttons.reconnect} href={connectHref} external={external} onUnavailable={reportMissing} />
      <form
        action={disconnectAccountAction}
        onSubmit={(event) => {
          if (!confirm(disconnectConfirmMessage(label))) event.preventDefault();
        }}
      >
        <input type="hidden" name="creatorId" value={creatorId} />
        <input type="hidden" name="platform" value={platform} />
        <button className="btn ghost" type="submit" disabled={!buttons.disconnect}>Disconnect</button>
      </form>
    </div>
  );
}

export function ConnectPanel({
  creator,
  canManage,
  gmailStatus,
  gmailEmail,
  gmailConnectHref,
  driveStatus,
  driveConnectHref,
  emailSetup,
  hostedEmailAddress,
  showBilling = true,
  showOwnSetup = false,
}: {
  creator: CreatorProfile;
  canManage: boolean;
  gmailStatus: ConnectionStatus;
  gmailEmail: string | null;
  gmailConnectHref: string | null;
  driveStatus: ConnectionStatus;
  driveConnectHref: string | null;
  emailSetup: "business" | "personal" | "hosted" | null;
  hostedEmailAddress: string | null;
  showBilling?: boolean;
  showOwnSetup?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  const rows: {
    key: ConnectPlatform;
    label: string;
    note: string;
    mark: string;
    color: string;
    status: ConnectionStatus;
    connectHref: string | null;
    external: boolean;
    unavailableNote: string;
  }[] = [
    {
      key: "gmail",
      label: "Gmail",
      note: gmailEmail ? `Watched inbox ${gmailEmail}. The portal only reads mail.` : "Separate from sign-in. The portal only reads mail.",
      mark: "@",
      color: "#EA4335",
      status: gmailStatus,
      connectHref: gmailConnectHref,
      external: false,
      unavailableNote: "Gmail is connected from this creator's own sign-in.",
    },
    {
      key: "drive",
      label: "Google Drive",
      note: "Files you choose to share. This does not change the agency upload folder.",
      mark: "D",
      color: "#0F9D58",
      status: driveStatus,
      connectHref: driveConnectHref,
      external: false,
      unavailableNote: "Google Drive is connected from this creator's own sign-in.",
    },
    ...SOCIALS.map((platform) => {
      const account = creator.accounts[platform.key];
      return {
        key: platform.key,
        label: platform.label,
        note: platform.note,
        mark: platform.mark,
        color: platform.color,
        status: connectionStatus(account.status),
        connectHref: account.connectUrl,
        external: true,
        unavailableNote: `${platform.label}: the Zernio connect link isn't ready yet. Your bot will add it here.`,
      };
    }),
  ];
  return (
    <div className="card">
      <h3>Connect your accounts</h3>
      <p className="note" style={{ marginTop: 4 }}>
        Gmail, Google Drive, and each social account show Connected, Needs reconnect, or Not connected.
        Connect and Reconnect open a secure sign-in. Disconnect asks you to confirm, then removes that connection.
        You stay signed in to the portal.
      </p>
      {rows.map((row) => (
        <div className="connect" key={row.key}>
          <div className="pf">
            <div className="ic" style={{ background: row.color }}>{row.mark}</div>
            <div>
              <b>{row.label}</b>
              <div className="note">{row.note}</div>
            </div>
          </div>
          {canManage ? (
            <AccountActions
              creatorId={creator.id}
              platform={row.key}
              label={row.label}
              status={row.status}
              connectHref={row.connectHref}
              external={row.external}
              unavailableNote={row.unavailableNote}
              onUnavailable={setNote}
            />
          ) : (
            <span className={row.status === "connected" ? "chip c-sage" : row.status === "needs_reconnect" ? "chip c-sun" : "chip c-gray"}>
              {connectionStatusLabel(row.status)}
            </span>
          )}
        </div>
      ))}
      {gmailStatus === "needs_reconnect" ? (
        <p className="note" style={{ marginTop: 10 }}>
          Google rejected the saved Gmail sign-in. Reconnect this inbox. You do not need to sign out.
        </p>
      ) : null}
      {emailSetup === "personal" ? (
        <p className="note" style={{ marginTop: 10 }}>We only process brand-related mail. Your bot sorts those threads and labels them.</p>
      ) : null}
      {emailSetup === "hosted" && hostedEmailAddress ? (
        <p className="note" style={{ marginTop: 10 }}>
          Your address will be {hostedEmailAddress}.
          {showBilling ? ` Roster price: ${STRIPE_CATALOG.hostedCreatorEmail.roster.priceLabel}. Nothing is charged from this page.` : ""}
        </p>
      ) : null}
      {showOwnSetup ? (
        <p className="note" style={{ marginTop: 10 }}>
          <a href={`${publicBasePath()}/onboarding`}>Set up your bot</a>
          {emailSetup === "business" || emailSetup === "personal" ? " after your email is connected." : "."}
        </p>
      ) : gmailStatus !== "connected" ? (
        <p className="note" style={{ marginTop: 10 }}>{creator.name} connects Gmail and Google Drive from her own sign-in.</p>
      ) : null}
      {!canManage ? (
        <p className="note" style={{ marginTop: 10 }}>You can see these connections. The creator connects and disconnects them from her own sign-in.</p>
      ) : null}
      {note ? <p className="note" style={{ marginTop: 10 }}>{note}</p> : null}
      {creator.isSeed && creator.id !== "mariclare" ? (
        <p className="note">This creator&apos;s sign-in email is placeholder seed data until Kamron replaces it.</p>
      ) : null}
    </div>
  );
}
