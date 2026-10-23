"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { withBasePath } from "@/lib/format";
import { buildOfficeLayout } from "@/lib/worlds/office-layout";
import {
  APPROVAL_PHRASE,
  CHAT_POLL_MS,
  COMMANDS_PATH,
  chatForBot,
  openCommands,
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
  upcomingEvents,
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
import type { BoardOpen, OfficeCameraApi, OfficeLayers, OfficeQuality } from "./office-canvas";
import { OfficeJoystick } from "./office-joystick";
import { panelsEnabledFromStorage, panelsStorageValue } from "@/lib/worlds/office-chrome";
import type { Stick } from "@/lib/worlds/office-move";
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
const LAYERS_KEY = "mm-worlds-layers";
const QUALITY_KEY = "mm-worlds-quality";
const DEFAULT_LAYERS: OfficeLayers = { offices: true, outdoor: true, weather: true, roof: true };
const LAYER_LABEL = {
  offices: "Offices",
  outdoor: "Outdoor",
  weather: "Weather",
  roof: "Roof",
} as const;

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
  const stickRef = useRef<Stick>({ x: 0, y: 0 });
  const [status, setStatus] = useState<OfficeStatusResponse | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [meeting, setMeeting] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [sheet, setSheet] = useState<OfficeSheet | null>(null);
  const [board, setBoard] = useState<BoardOpen | null>(null);
  const [checkedAt, setCheckedAt] = useState("");
  const [commands, setCommands] = useState<OfficeCommand[]>([]);
  const [commandError, setCommandError] = useState("");
  const [saving, setSaving] = useState(false);
  const [assignText, setAssignText] = useState("");
  const [assignDue, setAssignDue] = useState("2026-10-24");
  const [chatText, setChatText] = useState("");
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
  const [query, setQuery] = useState("");
  const [layers, setLayers] = useState<OfficeLayers>(DEFAULT_LAYERS);
  const [quality, setQuality] = useState<OfficeQuality>("fine");
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelsEnabled, setPanelsEnabled] = useState(true);

  useEffect(() => {
    try {
      setPanelsEnabled(panelsEnabledFromStorage(window.localStorage.getItem(PANELS_KEY)));
      const savedLayers = window.localStorage.getItem(LAYERS_KEY);
      if (savedLayers) {
        const parsed = JSON.parse(savedLayers) as Partial<OfficeLayers>;
        setLayers({
          offices: parsed.offices !== false,
          outdoor: parsed.outdoor !== false,
          weather: parsed.weather !== false,
          roof: parsed.roof !== false,
        });
      }
      const savedQuality = window.localStorage.getItem(QUALITY_KEY);
      if (savedQuality === "fine" || savedQuality === "fast") setQuality(savedQuality);
      else if (window.matchMedia("(pointer: coarse)").matches) setQuality("fast");
    } catch {
      // Private browsing can block storage. The view stays clear.
    }
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setSheet(null);
      setBoard(null);
      setSelected("");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    const pace = sheet === "bot" || sheet === "board" || sheet === "meet" ? CHAT_POLL_MS : OFFICE_POLL_MS;
    const timer = window.setInterval(() => void loadCommands(), pace);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [sheet]);

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
  const chatTurns = bot ? chatForBot(commands, bot.id) : [];
  const botMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !status) return [];
    return status.bots.filter((item) => `${item.name} ${item.short} ${item.role}`.toLowerCase().includes(needle)).slice(0, 6);
  }, [query, status]);

  function persistPanels(enabled: boolean) {
    setPanelsEnabled(enabled);
    if (!enabled) {
      setSheet(null);
      setBoard(null);
      setSelected("");
    }
    try {
      window.localStorage.setItem(PANELS_KEY, panelsStorageValue(enabled));
    } catch {
      // The button still works for this visit.
    }
  }

  function dismiss() {
    setSheet(null);
    setBoard(null);
    setSelected("");
    setMenuOpen(false);
  }

  function openSheet(next: OfficeSheet) {
    if (!panelsEnabled) return;
    setMenuOpen(false);
    setBoard(null);
    setSheet(next);
  }

  function toggleLayer(key: keyof OfficeLayers) {
    setLayers((current) => {
      const next = { ...current, [key]: !current[key] };
      try {
        window.localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
      } catch {
        // The chip still applies for this visit.
      }
      return next;
    });
  }

  function toggleQuality() {
    setQuality((current) => {
      const next = current === "fine" ? "fast" : "fine";
      try {
        window.localStorage.setItem(QUALITY_KEY, next);
      } catch {
        // The toggle still applies for this visit.
      }
      return next;
    });
  }

  function openBot(id: string) {
    if (!panelsEnabled) return;
    setSelected(id);
    setQuery("");
    setMenuOpen(false);
    setBoard(null);
    setSheet("bot");
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
    if (!panelsEnabled) return;
    setMenuOpen(false);
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

  return (
    <div className="bot-office" ref={root} onContextMenu={(event) => event.preventDefault()}>
      <div className="office-stage">
        {layout && sim && status ? (
          <OfficeCanvas
            layout={layout}
            sections={status.sections}
            bots={status.bots}
            selected={selected}
            onSelect={openBot}
            layers={layers}
            quality={quality}
            onOpenBoard={(next) => {
              if (!panelsEnabled) return;
              setBoard(next);
              setSelected("");
              setMenuOpen(false);
              setSheet("board");
            }}
            onOpenMeet={() => openSheet("meet")}
            onClear={dismiss}
            meeting={meeting}
            sim={sim}
            cameraApiRef={cameraApiRef}
            weather={weather}
            speech={speech}
            vaultTotal={wallets.total}
            onOpenVault={() => openVault(false)}
            stickRef={stickRef}
          />
        ) : (
          <div className="office-loading">{error || "Opening the bot office…"}</div>
        )}
      </div>

      <div className="office-corner">
        <button
          type="button"
          className="office-corner-button"
          aria-label="Office tools"
          aria-expanded={menuOpen}
          onClick={() => {
            setMenuOpen((open) => {
              if (!open) {
                setSheet(null);
                setBoard(null);
              }
              return !open;
            });
          }}
        >
          Tools
        </button>
        {menuOpen ? (
          <div className="office-menu" aria-label="Office tools">
            <div className="office-search">
              <input aria-label="Find a bot" placeholder="Find a bot" value={query} onChange={(event) => setQuery(event.target.value)} />
              {query.trim() ? (
                <ul className="office-search-list">
                  {botMatches.length ? botMatches.map((item) => (
                    <li key={item.id}><button type="button" onClick={() => openBot(item.id)}>{item.name}</button></li>
                  )) : <li className="office-kicker">No matching bots</li>}
                </ul>
              ) : null}
            </div>
            <div className="office-layers" role="group" aria-label="Map layers">
              {(Object.keys(LAYER_LABEL) as (keyof OfficeLayers)[]).map((key) => (
                <button key={key} type="button" aria-pressed={layers[key]} onClick={() => toggleLayer(key)}>{LAYER_LABEL[key]}</button>
              ))}
              <button type="button" aria-pressed={quality === "fine"} aria-label="Graphics quality" onClick={toggleQuality}>{quality === "fine" ? "Fine" : "Fast"}</button>
            </div>
            <div className="office-nav">
              <button type="button" aria-label="Zoom in" onClick={() => cameraApiRef.current?.zoomBy(0.82)}>+</button>
              <button type="button" aria-label="Zoom out" onClick={() => cameraApiRef.current?.zoomBy(1.22)}>−</button>
              <button type="button" onClick={() => cameraApiRef.current?.reset()}>Recenter</button>
            </div>
            {layout && sim && status ? (
              <div className="office-minimap" aria-label="Office map">
                <svg viewBox={`0 0 ${layout.width} ${layout.depth}`} aria-hidden="true">
                  {layout.rooms.map((room) => (
                    <rect key={room.id} x={room.x} y={room.z} width={room.w} height={room.d} />
                  ))}
                </svg>
                {status.bots.map((item) => {
                  const live = sim.state.bots[item.id];
                  if (!live || version < 0) return null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={selected === item.id ? "office-map-dot is-selected" : "office-map-dot"}
                      style={{ left: `${(live.x / layout.width) * 100}%`, top: `${(live.z / layout.depth) * 100}%` }}
                      aria-label={item.name}
                      onClick={() => openBot(item.id)}
                    />
                  );
                })}
              </div>
            ) : null}
            <div className="office-actions">
              <button type="button" aria-pressed={panelsEnabled} onClick={() => persistPanels(!panelsEnabled)}>Panels</button>
              <button type="button" disabled={!panelsEnabled} onClick={() => openSheet("info")}>Team</button>
              <button type="button" disabled={!panelsEnabled} onClick={() => openSheet("achievements")}>Achievements</button>
              <button type="button" disabled={!panelsEnabled} onClick={() => openSheet("log")}>Mission log</button>
              <button type="button" disabled={!panelsEnabled} onClick={() => openVault(false)}>Vault {formatWalletMoney(wallets.total)}</button>
              <button type="button" onClick={() => void toggleFullscreen()}>Fullscreen</button>
            </div>
          </div>
        ) : null}
      </div>

      <OfficeJoystick stickRef={stickRef} lifted={sheet !== null} />

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
          <button type="button" onClick={() => cameraApiRef.current?.reset()}>Recenter</button>
          <button type="button" onClick={() => cameraApiRef.current?.zoomBy(0.85)}>Zoom in</button>
          <button type="button" onClick={() => cameraApiRef.current?.zoomBy(1.18)}>Zoom out</button>
          <button type="button" onClick={() => void toggleFullscreen()}>Fullscreen</button>
          <button type="button" onClick={() => openVault(false)}>Vault {formatWalletMoney(wallets.total)}</button>
          {wallets.wallets.length === 0 ? (
            <button type="button" onClick={() => openVault(true)}>Add wallet</button>
          ) : null}
        </div>
        <p className="office-kicker">Drag the ground to pan. Right-drag or twist to rotate. Scroll, pinch, or the plus and minus buttons zoom. On a phone, the joystick moves the view. A drag does not open a panel.</p>
        <p className="office-kicker">{checkedAt ? `Live · checked ${checkedAt}` : "Checking the office…"} Polls every {Math.round(OFFICE_POLL_MS / 1000)}s.</p>
        <p className="office-kicker">{weather.label}. Roof fades as you zoom inside.</p>
        {error ? <p className="office-error">{error}</p> : null}
        {commandError ? <p className="office-error">{commandError}</p> : null}
        {status ? (
          <div>
            {status.sections.map((section) => (
              <p key={section.name}><b>{section.name}:</b> {section.members.map((id) => status.bots.find((item) => item.id === id)?.name ?? id).join(", ")}</p>
            ))}
            <p><b>Managers HQ:</b> {status.bots.find((item) => item.id === status.hqBotId)?.name}. Tap a bot, calendar, to-do board, box, or the conference table.</p>
          </div>
        ) : null}
      </section>
      ) : null}

      {sheet === "bot" && bot ? (
        <section className="office-panel office-sheet office-chat" aria-label={`${bot.name} chat`}>
          <CloseRow title={bot.name} onClose={dismiss} />
          {commandError ? <p className="office-error">{commandError}</p> : null}
          <p className="office-kicker">{bot.role} · {activity?.act || "At desk"}</p>
          <ul className="office-chat-log" aria-label="Messages">
            {chatTurns.length === 0 ? <li>No messages yet.</li> : null}
            {chatTurns.map((turn) => (
              <li key={turn.id} data-from={turn.from}>
                <b>{turn.from === "owner" ? "You" : bot.name}</b>
                <div>{turn.text}</div>
                {turn.from === "owner" ? (
                  <div className="office-kicker">{turn.state === "needs_approval" ? APPROVAL_PHRASE : turn.state}</div>
                ) : null}
              </li>
            ))}
          </ul>
          <form className="office-form office-chat-form" onSubmit={(event) => {
            event.preventDefault();
            void postCommand({ kind: "message", botId: bot.id, text: chatText }).then((ok) => { if (ok) setChatText(""); });
          }}>
            <label className="office-field"><span className="office-kicker">Message</span>
              <input aria-label={`Message ${bot.name}`} value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="Message this bot" />
            </label>
            <button type="submit" disabled={saving}>Send</button>
          </form>
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
          <p className="office-kicker">Commands that send, pay, or delete show needs your OK in Grok Bot.</p>
          {bot.chatHref ? <a className="office-link" href={bot.chatHref}>Open chat</a> : null}
        </section>
      ) : null}

      {sheet === "meet" ? (
      <section className="office-panel office-sheet office-meet" aria-label="Meeting">
        <CloseRow title="Start a meeting" onClose={dismiss} />
        {commandError ? <p className="office-error">{commandError}</p> : null}
        <ul className="office-list">
          {openCommands(commands, "call_meeting").length === 0 ? <li className="office-kicker">No meeting is queued.</li> : null}
          {openCommands(commands, "call_meeting").map((command) => (
            <li key={command.id}><b>Queued:</b> {command.topic || command.body}</li>
          ))}
        </ul>
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
        <p className="office-kicker">{meeting.length ? `${meeting.length} bots on the last call.` : "Pick bots, then call them. The call waits in Grok Bot."}</p>
      </section>
      ) : null}

      {sheet === "board" && board && status ? (
        <section
          className="office-panel office-sheet office-board"
          aria-label={board.panel === "calendar" ? "Calendar" : board.panel === "todos" ? "To-dos" : "Box"}
        >
          <CloseRow
            title={board.panel === "calendar" ? "Calendar" : board.panel === "todos" ? "To-dos" : "Box"}
            onClose={dismiss}
          />
          {commandError ? <p className="office-error">{commandError}</p> : null}
          <p className="office-kicker">{OFFICE_LABEL[board.office]}</p>
          {board.panel === "calendar" ? (
            <>
              <ul className="office-list">
                {upcomingEvents(status.calendar.filter((event) => event.office === board.office)).map((event) => (
                  <li key={event.id}><b>{event.title}</b><div className="office-kicker">{event.start} – {event.end}</div></li>
                ))}
                {openCommands(commands, "add_event", board.office).map((command) => (
                  <li key={command.id}><b>Queued:</b> {command.body}<div className="office-kicker">{command.due} – {command.topic}</div></li>
                ))}
                {upcomingEvents(status.calendar.filter((event) => event.office === board.office)).length === 0
                  && openCommands(commands, "add_event", board.office).length === 0 ? <li>No upcoming events.</li> : null}
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
                    <button type="button" disabled={saving || todo.done} onClick={() => void postCommand({ kind: "check_todo", todoId: todo.id })}>Check</button>
                  </li>
                ))}
                {openCommands(commands, "add_todo", board.office).map((command) => (
                  <li key={command.id}><b>Queued:</b> {command.body}</li>
                ))}
                {openCommands(commands, "check_todo", board.office).map((command) => (
                  <li key={command.id}><b>Queued:</b> {command.body}</li>
                ))}
                {status.todos.filter((todo) => todo.office === board.office).length === 0 ? <li>No to-dos yet.</li> : null}
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
              <p className="office-kicker">Notes waiting for a yes. Approve and hold queue a command for Grok Bot.</p>
              <ul className="office-list">
                {notesForView(boardNotes, "review").length === 0 ? <li>Nothing in the box to approve.</li> : null}
                {notesForView(boardNotes, "review").map((note) => (
                  <li key={note.id}>
                    <b>{NOTE_LABEL[note.status]}</b> · {note.date} · {status.bots.find((item) => item.id === note.bot)?.name ?? note.bot}
                    <div>{note.idea}</div>
                    <div className="office-kicker">Why now: {note.whyNow}</div>
                    <div className="office-actions">
                      <button type="button" disabled={saving} onClick={() => void postCommand({ kind: "note_decision", noteId: note.id, decision: "approve" })}>Approve</button>
                      {note.status !== "held" ? (
                        <button type="button" disabled={saving} onClick={() => void postCommand({ kind: "note_decision", noteId: note.id, decision: "hold" })}>Hold</button>
                      ) : null}
                    </div>
                  </li>
                ))}
                {openCommands(commands, "note_decision", board.office).map((command) => (
                  <li key={command.id}><b>Queued:</b> {command.body}</li>
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
