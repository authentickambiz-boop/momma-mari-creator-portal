"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { COMMUNITY_EMOJIS, COMMUNITY_GUIDELINES, privateKinds } from "@/lib/community-shared";
import { publicBasePath, withBasePath } from "@/lib/format";
import { isPublicMarketingPath } from "@/lib/public-site";

type Message = {
  id: string;
  channelId: string;
  authorName: string;
  authorMemberId: string;
  mine: boolean;
  body: string | null;
  pinned: boolean;
  held: boolean;
  createdAt: string;
  photoUrl: string | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
};

type Snapshot = {
  cursor: string;
  me: { name: string; communityRole: "admin" | "moderator" | "member"; guidelines: boolean; muted: boolean };
  channels: { id: string; name: string; kind: string }[];
  messages: Message[];
  reports: { id: string; messageId: string; excerpt: string }[];
  audit: { id: string; actorName: string; action: string; targetName: string | null; createdAt: string }[];
  settings: { readOnly: boolean; slowSeconds: number };
  held: { id: string }[];
  photosEnabled?: boolean;
};

function channelLabel(channel: { kind: string; name: string }) {
  if (channel.kind === "announcements") return "📣 Announcements";
  if (channel.kind === "wins") return "🎉 wins";
  return "# everyone";
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function resizePhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("Could not resize that photo.");
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

export function CommunityPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [hidden, setHidden] = useState(false);
  const [state, setState] = useState<"open" | "collapsed" | "sheet">("open");
  const [channelId, setChannelId] = useState("everyone");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingPrivate, setPendingPrivate] = useState(false);
  const [photo, setPhoto] = useState<{ base64: string; childFace: boolean | null } | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);
  const cursor = useRef("");
  const logRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const publicPage = isPublicMarketingPath(usePathname() ?? "", publicBasePath());

  useEffect(() => {
    const saved = window.localStorage.getItem("mm-community-panel");
    const width = window.innerWidth;
    if (width < 1024) setState(saved === "open" ? "sheet" : "collapsed");
    else if (width < 1280) setState(saved === "open" ? "open" : "collapsed");
    else setState(saved === "collapsed" ? "collapsed" : "open");
  }, []);

  useEffect(() => {
    if (publicPage) {
      delete document.body.dataset.community;
      return;
    }
    const open = state === "open" || state === "sheet";
    document.body.dataset.community = state === "open" ? "open" : state === "collapsed" ? "collapsed" : "sheet";
    if (state !== "sheet") window.localStorage.setItem("mm-community-panel", open ? "open" : "collapsed");
    if (open && snapshot) {
      const newest = snapshot.messages.reduce((max, message) => (message.createdAt > max ? message.createdAt : max), "");
      if (newest) window.localStorage.setItem("mm-community-read", newest);
    }
  }, [state, snapshot, publicPage]);

  useEffect(() => {
    if (publicPage) return;
    let timer = 0;
    let stopped = false;
    async function tick() {
      if (stopped) return;
      try {
        const response = await fetch(withBasePath(`/api/community/events?after=${encodeURIComponent(cursor.current)}`), { cache: "no-store" });
        if (response.status === 401 || response.status === 403) {
          setHidden(true);
          return;
        }
        if (response.status === 204) {
          // Nothing new.
        } else if (!response.ok) {
          const data = await response.json().catch(() => null) as { error?: string } | null;
          setNotice(data?.error ?? "Chat didn't load.");
        } else {
          const data = await response.json() as Snapshot;
          if (!data.cursor || !data.channels) {
            setNotice("Chat didn't load.");
          } else {
            cursor.current = data.cursor;
            setSnapshot(data);
            setHidden(false);
            setNotice("");
          }
        }
      } catch {
        setNotice("Chat didn't refresh.");
      }
      const open = stateRef.current === "open" || stateRef.current === "sheet";
      const wait = document.visibilityState === "hidden" ? 60_000 : open ? 5_000 : 30_000;
      timer = window.setTimeout(tick, wait);
    }
    void tick();
    const onVis = () => {
      window.clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [publicPage]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [snapshot, channelId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey && event.key === "/") {
        event.preventDefault();
        setState((current) => {
          const width = window.innerWidth;
          const opening = current === "collapsed";
          if (width < 1024) return opening ? "sheet" : "collapsed";
          return opening ? "open" : "collapsed";
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (hidden || publicPage) return null;

  if (!snapshot) {
    return (
      <>
        <aside className="community-panel" data-state={state} aria-label="Community chat">
          <div className="community-head">
            <strong>Chat</strong>
            <button className="community-toggle" type="button" onClick={toggle} aria-label="Collapse chat">✕</button>
          </div>
          <p className="community-note">{notice || "Opening chat…"}</p>
        </aside>
        {state === "collapsed" ? (
          <button className="community-fab" type="button" onClick={() => setState("sheet")}>💬 Chat</button>
        ) : null}
      </>
    );
  }

  const role = snapshot.me.communityRole;
  const staff = role === "admin" || role === "moderator";
  const messages = snapshot.messages.filter((message) => message.channelId === channelId);
  const readAt = typeof window === "undefined" ? "" : window.localStorage.getItem("mm-community-read") ?? "";
  const unread = snapshot.messages.filter((message) => message.createdAt > readAt && !message.mine).length;
  const channel = snapshot.channels.find((item) => item.id === channelId) ?? snapshot.channels[0];

  function toggle() {
    const width = window.innerWidth;
    setState((current) => {
      if (current === "collapsed") return width < 1024 ? "sheet" : "open";
      return "collapsed";
    });
  }

  async function refresh() {
    cursor.current = "";
    const response = await fetch(withBasePath("/api/community/events?after="), { cache: "no-store" });
    if (response.ok) {
      const data = await response.json() as Snapshot;
      cursor.current = data.cursor;
      setSnapshot(data);
    }
  }

  async function agree() {
    const response = await fetch(withBasePath("/api/community/guidelines"), { method: "POST" });
    if (response.ok) await refresh();
  }

  async function send(acknowledgePrivate = false) {
    if (!channel) return;
    const kinds = privateKinds(draft);
    if (kinds.length && !acknowledgePrivate && !pendingPrivate) {
      setPendingPrivate(true);
      setNotice("This looks private. Post anyway?");
      return;
    }
    let photoId: string | undefined;
    if (photo) {
      if (photo.childFace == null) {
        setNotice("Does this show a child's face?");
        return;
      }
      const uploaded = await fetch(withBasePath("/api/community/photos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bytesBase64: photo.base64, contentType: "image/jpeg", childFace: photo.childFace }),
      });
      const payload = await uploaded.json() as { id?: string; error?: string };
      if (!uploaded.ok || !payload.id) {
        setNotice(payload.error ?? "That photo was not saved.");
        return;
      }
      photoId = payload.id;
    }
    const response = await fetch(withBasePath("/api/community/messages"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, body: draft, photoId, acknowledgePrivate: acknowledgePrivate || pendingPrivate }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setNotice(payload.error ?? "That message was not posted.");
      if (response.status === 409) setPendingPrivate(true);
      return;
    }
    setDraft("");
    setPhoto(null);
    setPendingPrivate(false);
    setNotice("");
    await refresh();
  }

  async function act(action: string, extra: Record<string, string | number | boolean | null> = {}) {
    await fetch(withBasePath("/api/community/moderation"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setMenuId(null);
    await refresh();
  }

  const collapsed = state === "collapsed";

  return (
    <>
      <aside className="community-panel" data-state={state} aria-label="Community chat">
        <div className="community-rail">
          <button className="community-toggle" type="button" onClick={toggle} aria-label={collapsed ? "Open chat" : "Collapse chat"}>
            💬
            {collapsed && unread > 0 ? <span className="community-unread">{unread}</span> : null}
          </button>
        </div>
        {collapsed ? null : (
          <div className="community-body">
            <div className="community-head">
              <strong>Chat</strong>
              <button className="community-toggle" type="button" onClick={toggle} aria-label="Collapse chat">✕</button>
            </div>
            <div className="community-channels">
              {snapshot.channels.map((item) => (
                <button key={item.id} type="button" className={item.id === channel?.id ? "on" : ""} onClick={() => setChannelId(item.id)}>
                  {channelLabel(item)}
                </button>
              ))}
            </div>
            {staff ? (
              <button className="community-reports" type="button" onClick={() => setShowReports((open) => !open)}>
                Reports ({snapshot.reports.length})
              </button>
            ) : null}
            {showReports && staff ? (
              <div className="community-queue">
                {snapshot.reports.length === 0 ? <p>No open reports.</p> : snapshot.reports.map((report) => (
                  <div key={report.id}>
                    <p>{report.excerpt}</p>
                    <button type="button" onClick={() => act("dismiss", { reportId: report.id })}>Dismiss</button>
                    <button type="button" onClick={() => act("delete", { messageId: report.messageId })}>Delete</button>
                    <button type="button" onClick={() => act("mute", { messageId: report.messageId })}>Mute</button>
                    {role === "admin" ? <button type="button" onClick={() => act("remove", { messageId: report.messageId })}>Remove</button> : null}
                  </div>
                ))}
                {role === "admin" && snapshot.audit.length > 0 ? (
                  <ul>
                    {snapshot.audit.map((row) => (
                      <li key={row.id}>{row.action}{row.targetName ? ` · ${row.targetName}` : ""} · {row.actorName}</li>
                    ))}
                  </ul>
                ) : null}
                {role === "admin" ? (
                  <div className="community-modes">
                    <button type="button" onClick={() => act("read_only", { readOnly: !snapshot.settings.readOnly })}>
                      {snapshot.settings.readOnly ? "Turn off read-only" : "Read-only"}
                    </button>
                    <button type="button" onClick={() => act("slow", { slowSeconds: snapshot.settings.slowSeconds ? 0 : 30 })}>
                      {snapshot.settings.slowSeconds ? "Turn off slow mode" : "Slow mode"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="community-log" aria-live="polite" ref={logRef}>
              {messages.map((message) => (
                <article key={message.id} className={message.pinned ? "pinned" : ""}>
                  <header>
                    <b>{message.authorName}</b>
                    {message.pinned ? <span>Pinned</span> : null}
                    {message.held ? <span>Held for Kamron</span> : null}
                    <button type="button" aria-label="Message actions" onClick={() => setMenuId(menuId === message.id ? null : message.id)}>⋯</button>
                  </header>
                  {message.body ? <p>{message.body}</p> : null}
                  {message.photoUrl ? <img src={message.photoUrl} alt="" /> : null}
                  <div className="community-reacts">
                    {COMMUNITY_EMOJIS.map((emoji) => {
                      const found = message.reactions.find((reaction) => reaction.emoji === emoji);
                      return (
                        <button key={emoji} type="button" onClick={() => fetch(withBasePath("/api/community/reactions"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: message.id, emoji }) }).then(refresh)}>
                          {emoji} {found?.count ?? ""}
                        </button>
                      );
                    })}
                  </div>
                  {menuId === message.id ? (
                    <div className="community-menu">
                      {message.mine || staff ? <button type="button" onClick={() => act("delete", { messageId: message.id })}>Delete</button> : null}
                      {role === "admin" ? <button type="button" onClick={() => act(message.pinned ? "unpin" : "pin", { messageId: message.id })}>Pin</button> : null}
                      {staff ? <button type="button" onClick={() => act("mute", { messageId: message.id })}>Mute 24h</button> : null}
                      {role === "admin" ? <button type="button" onClick={() => act("remove", { messageId: message.id })}>Remove member</button> : null}
                      {!message.mine ? <button type="button" onClick={() => fetch(withBasePath("/api/community/reports"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: message.id }) }).then(() => { setMenuId(null); void refresh(); })}>Report</button> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {snapshot.settings.readOnly && role !== "admin" ? <p className="community-note">Read-only</p> : null}
            {snapshot.me.muted ? <p className="community-note">You are muted.</p> : null}
            {!snapshot.me.guidelines ? (
              <div className="community-guidelines">
                <p>{COMMUNITY_GUIDELINES}</p>
                <button className="btn" type="button" onClick={agree}>I agree</button>
              </div>
            ) : (
              <form className="community-compose" onSubmit={(event) => { event.preventDefault(); void send(false); }}>
                <label>
                  Message
                  <textarea value={draft} onChange={(event) => { setDraft(event.target.value); setPendingPrivate(false); }} rows={3} />
                </label>
                {snapshot.photosEnabled ? (
                  <label className="community-file">
                    Photo
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      aria-label="Photo"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        void resizePhoto(file).then((base64) => setPhoto({ base64, childFace: null })).catch(() => setNotice("Could not resize that photo."));
                      }}
                    />
                  </label>
                ) : (
                  <p className="community-note">Photos are off until photo storage is connected.</p>
                )}
                {photo && photo.childFace == null ? (
                  <div className="community-note">
                    <p>Does this show a child's face?</p>
                    <button type="button" onClick={() => setPhoto({ ...photo, childFace: true })}>Yes</button>
                    <button type="button" onClick={() => setPhoto({ ...photo, childFace: false })}>No</button>
                  </div>
                ) : null}
                {notice ? <p className="community-note">{notice}</p> : null}
                {pendingPrivate ? <button className="btn" type="button" onClick={() => void send(true)}>Post anyway</button> : <button className="btn" type="submit">Post</button>}
              </form>
            )}
            {role === "admin" && snapshot.held.length > 0 ? (
              <div className="community-note">
                {snapshot.held.map((photoHold) => (
                  <button key={photoHold.id} type="button" onClick={() => act("approve_photo", { photoId: photoHold.id })}>Approve held photo</button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </aside>
      {state === "collapsed" ? (
        <button className="community-fab" type="button" onClick={() => setState("sheet")}>
          💬 Chat{unread > 0 ? ` (${unread})` : ""}
        </button>
      ) : null}
    </>
  );
}
