"use client";

import { useState } from "react";
import type { CreatorProfile } from "@/lib/types";

const PLATFORMS = [
  { key: "tiktok", label: "TikTok", note: "Daily stats + post scheduling", mark: "TT", color: "#111", ghost: false },
  { key: "instagram", label: "Instagram", note: "Needs a Business or Creator account", mark: "IG", color: "#C13584", ghost: false },
  { key: "facebook", label: "Facebook Page", note: "Pick the Page you post from", mark: "f", color: "#1877F2", ghost: false },
  { key: "youtube", label: "YouTube", note: "Optional", mark: "YT", color: "#FF0000", ghost: true },
] as const;

export function ConnectPanel({ creator }: { creator: CreatorProfile }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="card">
      <h3>Connect your accounts</h3>
      <p className="note" style={{ marginTop: 4 }}>
        One-time setup. Each button will open a secure Momma Mari sign-in page powered by Zernio.
        You log in on the platform&apos;s own page, and we never see your password. You can disconnect at any time.
      </p>
      {PLATFORMS.map((platform) => {
        const account = creator.accounts[platform.key];
        const ready = Boolean(account.connectUrl);
        return (
          <div className="connect" key={platform.key}>
            <div className="pf">
              <div className="ic" style={{ background: platform.color }}>{platform.mark}</div>
              <div>
                <b>{platform.label}</b>
                <div className="note">{platform.note}</div>
              </div>
            </div>
            {account.status === "connected" ? <span className="chip c-sage">Connected</span> : ready ? (
              <a className={`btn ${platform.ghost ? "ghost" : ""}`} href={account.connectUrl ?? "#"} target="_blank" rel="noreferrer">Connect</a>
            ) : (
              <button
                className={`btn ${platform.ghost ? "ghost" : ""}`}
                type="button"
                onClick={() => setNote(`${platform.label}: the Zernio connect link isn't ready yet. Your bot will add it here.`)}
              >
                Connect
              </button>
            )}
          </div>
        );
      })}
      <div className="connect">
        <div className="pf">
          <div className="ic" style={{ background: "#EA4335" }}>@</div>
          <div>
            <b>Email ({creator.email})</b>
            <div className="note">Lets your bot track brand threads</div>
          </div>
        </div>
        {creator.accounts.email.status === "connected" ? <span className="chip c-sage">Connected</span> : <span className="chip c-gray">Not connected</span>}
      </div>
      {note ? <p className="note" style={{ marginTop: 10 }}>{note}</p> : null}
      {creator.isSeed && creator.id !== "mariclare" ? (
        <p className="note">This creator&apos;s sign-in email is placeholder seed data until Kamron replaces it.</p>
      ) : null}
    </div>
  );
}
