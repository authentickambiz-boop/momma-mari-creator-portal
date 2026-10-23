"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { withBasePath } from "@/lib/format";
import { buildOfficeLayout } from "@/lib/worlds/office-layout";
import {
  APPROVAL_PHRASE,
  COMMANDS_PATH,
  speechForBots,
  type CommandStatus,
  type OfficeCommand,
} from "@/lib/worlds/office-commands";
import { assignBotRooms, createOfficeSimStore, placeBotsInRooms, simActivity } from "@/lib/worlds/office-sim";
import {
  OFFICE_LABEL,
  OFFICE_POLL_MS,
  OFFICE_STATUS_PATH,
  notesForView,
  type OfficeStatusResponse,
} from "@/lib/worlds/office-state";
import {
  OPEN_METEO_URL,
  WEATHER_POLL_MS,
  weatherFromClock,
  weatherFromOpenMeteo,
  type OfficeWeather,
} from "@/lib/worlds/office-weather";
import {
  WALLETS_PATH,
  formatWalletMoney,
  type WalletList,
  type WalletType,
} from "@/lib/worlds/office-wallets";
import type { BoardOpen, OfficeCameraApi } from "./office-canvas";
import "./office.css";

type LayoutHold = {
  key: string;
  sections: OfficeStatusResponse["sections"];
  hqBotId: string;
  botIds: string[];
  rooms: Record<string, string>;
};

function layoutHold(status: OfficeStatusResponse): LayoutHold {
  return {
    key: `${status.hqBotId}|${status.sections.map((section) => `${section.name}:${section.manager}:${section.members.join(",")}`).join(";")}|${status.bots.map((item) => item.id).join(",")}`,
    sections: status.sections,
    hqBotId: status.hqBotId,
    botIds: status.bots.map((item) => item.id),
    rooms: Object.fromEntries(status.bots.map((item) => [item.id, item.room])),
  };
}

const OfficeCanvas = dynamic(() => import("./office-canvas"), {
  ssr: false,
  loading: () => <div className="office-loading">Opening the bot office…</div>,
});

const PANELS_KEY = "mm-worlds-panels";

type OfficeSheet = "info" | "bot" | "board" | "meet" | "vault" | "log" | "achievements";

function CloseRow({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="office-row">
      <h2>{title}</h2>
      <button className="office-close" type="button" aria-label="Close" onClick={onClose}>×</button>
    </div>
  );
}

const NOTE_LABEL = {
  new: "New",
  with_kash: "With Kash",
  approved_to_show: "Showing",
  held: "Held",
} as const;

const COMMAND_LABEL: Record<CommandStatus, string> = {
  queued: "Queued",
  picked_up: "Picked up",
  in_progress: "In progress",
  done: "Done",
  needs_approval: APPROVAL_PHRASE,
  declined: "Declined",
};

function isWalletList(value: unknown): value is WalletList {
  if (!value || typeof value !== "object") return false;
  const record = value as WalletList;
  return Array.isArray(record.wallets) && typeof record.total === "number";
}

function isCommandList(value: unknown): value is { commands: OfficeCommand[] } {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as { commands?: unknown }).commands);
}

function isStatus(value: unknown): value is OfficeStatusResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as OfficeStatusResponse;
  return Array.isArray(record.bots) && Array.isArray(record.calendar) && Array.isArray(record.todos) && Array.isArray(record.notes);
}

function dollars(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function OfficeApp() {
  const root = useRef<HTMLDivElement>(null);
  const cameraApiRef = useRef<OfficeCameraApi | null>(null);
  const [status, setStatus] = useState<OfficeStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [meeting, setMeeting] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [sheet, setSheet] = useState<OfficeSheet | null>(null);
  const [board, setBoard] = useState<BoardOpen | null>(null);
  const [noteView, setNoteView] = useState<"main" | "review">("main");
  const [checkedAt, setCheckedAt] = useState("");
  const [commands, setCommands] = useState<OfficeCommand[]>([]);
  const [commandError, setCommandError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignText, setAssignText] = useState("");
  const [assignDue, setAssignDue] = useState("2026-10-24");
  const [askText, setAskText] = useState("");
  const [requestText, setRequestText] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventStart, setEventStart] = useState("2026-10-24T09:00:00-04:00");
  const [eventEnd, setEventEnd] = useState("2026-10-24T09:30:00-04:00");
  const [todoText, setTodoText] = useState("");
  const [todoDue, setTodoDue] = useState("2026-10-24");
  const [todoImpact, setTodoImpact] = useState("0");
  const [todoOwner, setTodoOwner] = useState("kash");
  const [weather, setWeather] = useState<OfficeWeather>(() => weatherFromClock(new Date()));
  const [wallets, setWallets] = useState<WalletList>({ wallets: [], total: 0, currency: "USD" });
  const [addingWallet, setAddingWallet] = useState(false);
  const [walletName, setWalletName] = useState("");
  const [walletBalance, setWalletBalance] = useState("");
  const [walletType, setWalletType] = useState<WalletType>("cash");
  const [walletError, setWalletError] = useState("");
  const [savingWallet, setSavingWallet] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(PANELS_KEY) === "show") setSheet("info");
    } catch {
      // Private browsing can block storage. The view stays clear.
    }
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const response = await fetch(withBasePath(OFFICE_STATUS_PATH), { cache: "no-store", credentials: "same-origin" });
        const body = await response.json().catch(() => null) as unknown;
        if (stop) return;
        if (!response.ok || !isStatus(body)) {
          setError(response.status === 404 ? "This office is for the owner." : "The office status did not load.");
          return;
        }
        setStatus(body);
        setError("");
        setCheckedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      } catch {
        if (!stop) setError("The office status did not load.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), OFFICE_POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function loadCommands() {
      try {
        const response = await fetch(withBasePath(COMMANDS_PATH), { cache: "no-store", credentials: "same-origin" });
        const body = await response.json().catch(() => null) as unknown;
        if (stop || !response.ok || !isCommandList(body)) return;
        setCommands(body.commands);
      } catch {
        if (!stop) setCommandError("The mission log did not load.");
      }
    }
    void loadCommands();
    const timer = window.setInterval(() => void loadCommands(), OFFICE_POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function loadWallets() {
      try {
        const response = await fetch(withBasePath(WALLETS_PATH), { cache: "no-store", credentials: "same-origin" });
        const body = await response.json().catch(() => null) as unknown;
        if (stop || !response.ok || !isWalletList(body)) return;
        setWallets(body);
      } catch {
        if (!stop) setWalletError("The vault balances did not load.");
      }
    }
    void loadWallets();
    const timer = window.setInterval(() => void loadWallets(), OFFICE_POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function loadWeather() {
      try {
        const response = await fetch(OPEN_METEO_URL);
        const body = await response.json().catch(() => null) as unknown;
        if (stop || !response.ok) return;
        setWeather(weatherFromOpenMeteo(body, new Date()));
      } catch {
        if (!stop) setWeather(weatherFromClock(new Date()));
      }
    }
    void loadWeather();
    const timer = window.setInterval(() => void loadWeather(), WEATHER_POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  const layoutKey = status ? layoutHold(status).key : "";
  const [hold, setHold] = useState<LayoutHold | null>(null);
  const [heldKey, setHeldKey] = useState("");
  if (layoutKey !== heldKey) {
    setHeldKey(layoutKey);
    setHold(status ? layoutHold(status) : null);
  }
  const roomKey = status ? status.bots.map((item) => `${item.id}:${item.room}`).join("|") : "";
  const layout = useMemo(() => {
    if (!hold) return null;
    return buildOfficeLayout({
      sections: hold.sections,
      hqBotId: hold.hqBotId,
      extraBotIds: hold.botIds,
    });
  }, [hold]);
  const sim = useMemo(() => {
    if (!layout || !hold) return null;
    const store = createOfficeSimStore(layout, hold.botIds);
    placeBotsInRooms(store.state, layout, hold.rooms);
    return store;
  }, [layout, hold]);
  useEffect(() => {
    if (!sim || !layout || !status) return;
    assignBotRooms(sim.state, layout, Object.fromEntries(status.bots.map((item) => [item.id, item.room])));
  }, [sim, layout, roomKey, status]);

  const version = useSyncExternalStore(
    (listener) => sim?.subscribe(listener) ?? (() => undefined),
    () => sim?.getVersion() ?? 0,
    () => 0,
  );
  const bot = status?.bots.find((item) => item.id === selected) ?? null;
  const liveBot = bot && sim ? sim.state.bots[bot.id] : undefined;
  const activity = liveBot && layout && version >= 0 ? simActivity(liveBot, layout) : null;

  const speech = useMemo(() => speechForBots(commands), [commands]);

  function rememberPanels(show: boolean) {
    try {
      window.localStorage.setItem(PANELS_KEY, show ? "show" : "hide");
    } catch {
      // The button still works for this visit.
    }
  }

  function dismiss() {
    setSheet(null);
    setBoard(null);
    setSelected("");
    rememberPanels(false);
  }

  function togglePanels() {
    const show = sheet !== "info";
    rememberPanels(show);
    setSheet(show ? "info" : null);
  }

  async function postCommand(payload: unknown) {
    setSaving(true);
    setCommandError("");
    try {
      const response = await fetch(withBasePath(COMMANDS_PATH), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as { error?: string; command?: OfficeCommand } | null;
      if (!response.ok || !body || !("command" in body) || !body.command) {
        setCommandError(body?.error || "The command did not queue.");
        return false;
      }
      setCommands((current) => [body.command as OfficeCommand, ...current.filter((item) => item.id !== body.command?.id)]);
      return true;
    } catch {
      setCommandError("The command did not queue.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function call(ids: string[], topic?: string) {
    setMeeting(ids);
    if (ids.length && topic) void postCommand({ kind: "call_meeting", botIds: ids, topic });
  }

  function openVault(form: boolean) {
    setSheet("vault");
    setAddingWallet(form);
    setWalletError("");
  }

  async function saveWallet(event: { preventDefault: () => void }) {
    event.preventDefault();
    const balance = Number(walletBalance);
    if (!walletName.trim() || !Number.isFinite(balance)) {
      setWalletError("Enter a name and a balance.");
      return;
    }
    setSavingWallet(true);
    setWalletError("");
    try {
      const response = await fetch(withBasePath(WALLETS_PATH), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: walletName.trim(), type: walletType, balance, currency: "USD" }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok || !isWalletList(body)) {
        setWalletError(body?.error || "The wallet did not save.");
        return;
      }
      setWallets(body);
      setWalletName("");
      setWalletBalance("");
      setAddingWallet(false);
    } catch {
      setWalletError("The wallet did not save.");
    } finally {
      setSavingWallet(false);
    }
  }

  async function toggleFullscreen() {
    const node = root.current;
    if (!node) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await node.requestFullscreen();
  }

  const reviewCount = status ? notesForView(status.notes, "review").length : 0;
  const boardNotes = status && board ? status.notes.filter((note) => note.office === board.office) : [];
  const shownNotes = notesForView(boardNotes, noteView);

  return (
    <div className="bot-office" ref={root} onContextMenu={(event) => event.preventDefault()}>
      <div className="office-stage">
        {layout && sim && status ? (
          <OfficeCanvas
            layout={layout}
            sections={status.sections}
            bots={status.bots}
            selected={selected}
            onSelect={(id) => { setSelected(id); setSheet("bot"); }}
            onOpenBoard={(next) => { setBoard(next); setNoteView(next.panel === "notes" ? "main" : noteView); setSheet("board"); }}
            onOpenMeet={() => setSheet("meet")}
            onClear={dismiss}
            meeting={meeting}
            sim={sim}
            cameraApiRef={cameraApiRef}
            weather={weather}
            speech={speech}
            vaultTotal={wallets.total}
            onOpenVault={() => openVault(false)}
          />
        ) : (
          <div className="office-loading">{error || "Opening the bot office…"}</div>
        )}
      </div>

      <button type="button" className="office-panels-toggle" aria-pressed={sheet === "info"} onClick={togglePanels}>Panels</button>

      {sheet === "info" ? (
      <section className="office-panel office-sheet office-tools" aria-label="Office controls">
        <CloseRow title={`Team level ${status?.team.level ?? "…"}`} onClose={dismiss} />
        {status ? (
          <>
            <div>{status.team.xp} XP · {status.team.toNext} to next</div>
            <div className="office-bar" aria-hidden="true"><span style={{ width: `${(status.team.intoLevel / status.team.levelSize) * 100}%` }} /></div>
          </>
        ) : null}
        <div className="office-actions">
          <button type="button" onClick={() => setSheet("achievements")}>Achievements</button>
          <button type="button" onClick={() => setSheet("log")}>Mission log</button>
          <button type="button" onClick={() => cameraApiRef.current?.reset()}>Reset view</button>
          <button type="button" onClick={() => cameraApiRef.current?.zoomBy(0.85)}>Zoom in</button>
          <button type="button" onClick={() => cameraApiRef.current?.zoomBy(1.18)}>Zoom out</button>
          <button type="button" onClick={() => void toggleFullscreen()}>Fullscreen</button>
          <button type="button" onClick={() => openVault(false)}>Vault {formatWalletMoney(wallets.total)}</button>
          {wallets.wallets.length === 0 ? (
            <button type="button" onClick={() => openVault(true)}>Add wallet</button>
          ) : null}
        </div>
        <p className="office-kicker">Drag to orbit. Right-drag to pan. Scroll to zoom. Open this tab on a second monitor.</p>
        <p className="office-kicker">{checkedAt ? `Live · checked ${checkedAt}` : "Checking the office…"} Polls every {Math.round(OFFICE_POLL_MS / 1000)}s.</p>
        <p className="office-kicker">{weather.label}. Roof fades as you zoom inside.</p>
        {error ? <p className="office-error">{error}</p> : null}
        {commandError ? <p className="office-error">{commandError}</p> : null}
        {status ? (
          <div>
            {status.sections.map((section) => (
              <p key={section.name}><b>{section.name}:</b> {section.members.map((id) => status.bots.find((item) => item.id === id)?.name ?? id).join(", ")}</p>
            ))}
            <p><b>Managers HQ:</b> {status.bots.find((item) => item.id === status.hqBotId)?.name}. Click a wall calendar, whiteboard, or inbox tray.</p>
          </div>
        ) : null}
      </section>
      ) : null}

      {sheet === "bot" && bot ? (
        <section className="office-panel office-sheet office-detail" aria-label={`${bot.name} status`}>
          <CloseRow title={bot.name} onClose={dismiss} />
          {commandError ? <p className="office-error">{commandError}</p> : null}
          <p>{bot.statusLabel}</p>
          <p><b>Role:</b> {bot.role}</p>
          <p><b>Current task:</b> {bot.task}</p>
          <p><b>Latest update:</b> {bot.update}</p>
          <p><b>Room from the last sync:</b> {bot.room}</p>
          <p><b>XP:</b> {bot.xp} · Level {bot.level}</p>
          <div className="office-bar" aria-hidden="true"><span style={{ width: `${(bot.intoLevel / (status?.botLevelSize || 1)) * 100}%` }} /></div>
          <p><b>Badges:</b> {bot.badges.map((badge) => `${badge.icon} ${badge.title}`).join(", ") || "None yet"}</p>
          <p><i>Now: {activity?.act || "At desk"} · {activity?.room || bot.room}</i></p>
          {bot.chatHref ? <a className="office-link" href={bot.chatHref}>Open chat</a> : <p className="office-kicker">No chat link is on file for this bot.</p>}
          <form className="office-form" onSubmit={(event) => {
            event.preventDefault();
            void postCommand({ kind: "assign_task", botId: bot.id, text: assignText, due: assignDue }).then((ok) => { if (ok) setAssignText(""); });
          }}>
            <label className="office-field"><span className="office-kicker">Assign a task</span>
              <input aria-label="Task" value={assignText} onChange={(event) => setAssignText(event.target.value)} placeholder="What should this bot do?" />
            </label>
            <label className="office-field"><span className="office-kicker">Due</span>
              <input aria-label="Due" value={assignDue} onChange={(event) => setAssignDue(event.target.value)} />
            </label>
            <button type="submit" disabled={saving}>Assign task</button>
          </form>
          <form className="office-form" onSubmit={(event) => {
            event.preventDefault();
            void postCommand({ kind: "ask", botId: bot.id, text: askText }).then((ok) => { if (ok) setAskText(""); });
          }}>
            <label className="office-field"><span className="office-kicker">Ask a question</span>
              <input aria-label="Question" value={askText} onChange={(event) => setAskText(event.target.value)} placeholder="Ask this bot" />
            </label>
            <button type="submit" disabled={saving}>Ask</button>
          </form>
          <form className="office-form" onSubmit={(event) => {
            event.preventDefault();
            void postCommand({ kind: "request", botId: bot.id, text: requestText }).then((ok) => { if (ok) setRequestText(""); });
          }}>
            <label className="office-field"><span className="office-kicker">Request</span>
              <input aria-label="Request" value={requestText} onChange={(event) => setRequestText(event.target.value)} placeholder="Anything else" />
            </label>
            <button type="submit" disabled={saving}>Send request</button>
          </form>
          <p className="office-kicker">Commands that send, pay, or delete show needs your OK in Grok Bot.</p>
          <div className="office-chips" aria-label="Bots">
            {status?.bots.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === bot.id} onClick={() => setSelected(item.id)}>{item.short}</button>
            ))}
          </div>
        </section>
      ) : null}

      {sheet === "meet" ? (
      <section className="office-panel office-sheet office-meet" aria-label="Conference room">
        <CloseRow title={`Conference room${meeting.length ? ` (${meeting.length} called)` : ""}`} onClose={dismiss} />
        {commandError ? <p className="office-error">{commandError}</p> : null}
        <div className="office-actions">
          <button type="button" onClick={() => call(status?.bots.map((item) => item.id) ?? [], "Everyone")}>Call everyone</button>
          {status ? Object.entries(status.topics).map(([topic, ids]) => (
            <button key={topic} type="button" onClick={() => call(ids, topic)}>{topic}</button>
          )) : null}
          <button type="button" onClick={() => setMeeting([])}>End meeting</button>
        </div>
        <div className="office-chips">
          {status?.bots.map((item) => (
            <button
              key={`pick-${item.id}`}
              type="button"
              aria-pressed={picked.includes(item.id)}
              onClick={() => setPicked((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
            >
              {item.short}
            </button>
          ))}
          <button type="button" onClick={() => call(picked, "Selected bots")}>Call selected ({picked.length})</button>
        </div>
      </section>
      ) : null}

      {sheet === "board" && board && status ? (
        <section className="office-panel office-sheet office-board" aria-label={`${OFFICE_LABEL[board.office]} board`}>
          <CloseRow title={OFFICE_LABEL[board.office]} onClose={dismiss} />
          {commandError ? <p className="office-error">{commandError}</p> : null}
          <div className="office-actions">
            {(["calendar", "todos", "notes"] as const).map((panel) => (
              <button key={panel} type="button" aria-pressed={board.panel === panel} onClick={() => setBoard({ office: board.office, panel })}>
                {panel === "calendar" ? "Calendar" : panel === "todos" ? "To-dos" : "Notes"}
              </button>
            ))}
          </div>
          {board.panel === "calendar" ? (
            <>
              <ul className="office-list">
                {status.calendar.filter((event) => event.office === board.office).map((event) => (
                  <li key={event.id}><b>{event.title}</b><div className="office-kicker">{event.start} – {event.end}</div></li>
                ))}
              </ul>
              <form className="office-form" onSubmit={(event) => {
                event.preventDefault();
                void postCommand({ kind: "add_event", office: board.office, title: eventTitle, start: eventStart, end: eventEnd }).then((ok) => { if (ok) setEventTitle(""); });
              }}>
                <label className="office-field"><span className="office-kicker">Add a calendar event</span>
                  <input aria-label="Event title" value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Title" />
                </label>
                <label className="office-field"><span className="office-kicker">Start</span>
                  <input aria-label="Event start" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
                </label>
                <label className="office-field"><span className="office-kicker">End</span>
                  <input aria-label="Event end" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
                </label>
                <button type="submit" disabled={saving}>Add event</button>
              </form>
            </>
          ) : null}
          {board.panel === "todos" ? (
            <>
              <ul className="office-list">
                {status.todos.filter((todo) => todo.office === board.office).map((todo) => (
                  <li key={todo.id}>
                    <b>{todo.done ? "Done" : "Open"}:</b> {todo.task}
                    <div className="office-kicker">{status.bots.find((item) => item.id === todo.ownerBot)?.name ?? todo.ownerBot} · due {todo.due} · $ impact {dollars(todo.impactDollars)}</div>
                    <button type="button" disabled={saving} onClick={() => void postCommand({ kind: "check_todo", todoId: todo.id })}>Check</button>
                  </li>
                ))}
              </ul>
              <form className="office-form" onSubmit={(event) => {
                event.preventDefault();
                const impact = Number(todoImpact);
                void postCommand({
                  kind: "add_todo",
                  office: board.office,
                  text: todoText,
                  botId: todoOwner,
                  due: todoDue,
                  impactDollars: Number.isFinite(impact) ? impact : 0,
                }).then((ok) => { if (ok) setTodoText(""); });
              }}>
                <label className="office-field"><span className="office-kicker">Add a to-do</span>
                  <input aria-label="To-do" value={todoText} onChange={(event) => setTodoText(event.target.value)} placeholder="Task" />
                </label>
                <label className="office-field"><span className="office-kicker">Owner</span>
                  <select aria-label="To-do owner" value={todoOwner} onChange={(event) => setTodoOwner(event.target.value)}>
                    {status.bots.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="office-field"><span className="office-kicker">Due</span>
                  <input aria-label="To-do due" value={todoDue} onChange={(event) => setTodoDue(event.target.value)} />
                </label>
                <label className="office-field"><span className="office-kicker">Dollar impact</span>
                  <input aria-label="Dollar impact" value={todoImpact} onChange={(event) => setTodoImpact(event.target.value)} />
                </label>
                <button type="submit" disabled={saving}>Add to-do</button>
              </form>
            </>
          ) : null}
          {board.panel === "notes" ? (
            <>
              <div className="office-actions">
                <button type="button" aria-pressed={noteView === "main"} onClick={() => setNoteView("main")}>For Kamron</button>
                <button type="button" aria-pressed={noteView === "review"} onClick={() => setNoteView("review")}>Review ({notesForView(boardNotes, "review").length})</button>
              </div>
              <p className="office-kicker">{noteView === "main" ? "Only notes Kash marked approved to show." : "New, with Kash, and held notes, including ones that were turned down."}</p>
              <ul className="office-list">
                {shownNotes.map((note) => (
                  <li key={note.id}>
                    <b>{NOTE_LABEL[note.status]}</b> · {note.date} · {status.bots.find((item) => item.id === note.bot)?.name ?? note.bot}
                    <div>{note.idea}</div>
                    <div className="office-kicker">Why now: {note.whyNow}</div>
                    <div className="office-actions">
                      {note.status !== "approved_to_show" ? (
                        <button type="button" disabled={saving} onClick={() => void postCommand({ kind: "note_decision", noteId: note.id, decision: "approve" })}>Approve</button>
                      ) : null}
                      {note.status !== "held" ? (
                        <button type="button" disabled={saving} onClick={() => void postCommand({ kind: "note_decision", noteId: note.id, decision: "hold" })}>Hold</button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      {sheet === "log" ? (
        <section className="office-panel office-sheet office-log" aria-label="Mission log">
          <CloseRow title="Mission log" onClose={dismiss} />
          {commandError ? <p className="office-error">{commandError}</p> : null}
          <ul className="office-list">
            {commands.length === 0 ? <li>No commands yet. Assign a task, call a meeting, or update a board.</li> : null}
            {commands.map((command) => (
              <li key={command.id}>
                <b>{command.status === "needs_approval" ? APPROVAL_PHRASE : COMMAND_LABEL[command.status]}</b>
                <div>{command.body}</div>
                <div className="office-kicker">{command.kind} · {command.botIds.join(", ")}{command.status !== "needs_approval" && command.result ? ` · ${command.result}` : ""}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet === "vault" ? (
        <section className="office-panel office-sheet office-vault" aria-label="Vault">
          <CloseRow title="Vault" onClose={dismiss} />
          <p className="office-vault-total">{formatWalletMoney(wallets.total)}</p>
          <p className="office-kicker">Balances only. No bank login or card number is stored here.</p>
          {walletError ? <p className="office-error">{walletError}</p> : null}
          {wallets.wallets.length === 0 ? (
            <p>No wallets yet. The door shows $0 until you add one.</p>
          ) : (
            <ul className="office-list">
              {wallets.wallets.map((wallet) => (
                <li key={wallet.id}>
                  <b>{wallet.name}</b> · {wallet.type} · {formatWalletMoney(wallet.balance, wallet.currency)}
                  <div className="office-kicker">Updated {wallet.updatedAt}</div>
                </li>
              ))}
            </ul>
          )}
          <p><b>Total:</b> {formatWalletMoney(wallets.total)}</p>
          {addingWallet ? (
            <form className="office-form" onSubmit={(event) => void saveWallet(event)}>
              <label className="office-field"><span className="office-kicker">Name</span>
                <input aria-label="Wallet name" value={walletName} onChange={(event) => setWalletName(event.target.value)} placeholder="Operating cash" />
              </label>
              <label className="office-field"><span className="office-kicker">Balance</span>
                <input aria-label="Wallet balance" inputMode="decimal" value={walletBalance} onChange={(event) => setWalletBalance(event.target.value)} placeholder="0" />
              </label>
              <label className="office-field"><span className="office-kicker">Type</span>
                <select aria-label="Wallet type" value={walletType} onChange={(event) => setWalletType(event.target.value as WalletType)}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank balance</option>
                  <option value="gold">Gold</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <button type="submit" disabled={savingWallet}>Save wallet</button>
            </form>
          ) : (
            <button type="button" onClick={() => setAddingWallet(true)}>Add wallet</button>
          )}
        </section>
      ) : null}

      {sheet === "achievements" && status ? (
        <section className="office-panel office-sheet office-achievements" aria-label="Achievements">
          <CloseRow title="Achievements" onClose={dismiss} />
          <p className="office-kicker">Unlocked cards are verified wins. XP is split across the credited bots. {reviewCount} notes are waiting in review across the wings.</p>
          <div className="office-grid">
            {status.achievements.map((achievement) => (
              <article key={achievement.title} className="office-card">
                <div>{achievement.icon}</div>
                <b>{achievement.title}</b>
                <div className="office-kicker">Unlocked {achievement.date} · +{achievement.xp} XP</div>
                <p>{achievement.detail}</p>
                <div className="office-kicker">Source: {achievement.source}</div>
              </article>
            ))}
            {status.locked.map((achievement) => (
              <article key={achievement.title} className="office-card locked">
                <div>{achievement.icon}</div>
                <b>Locked: {achievement.title}</b>
                <p>Goal: {achievement.goal}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
