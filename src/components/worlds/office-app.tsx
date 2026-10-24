"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { withBasePath } from "@/lib/format";
import { OWNER_ACTOR_ID, buildOfficeLayout } from "@/lib/worlds/office-layout";
import {
  APPROVAL_PHRASE,
  CHAT_POLL_MS,
  COMMANDS_PATH,
  NOT_DELIVERED_LABEL,
  chatForBot,
  openCommands,
  speechForBots,
  type CommandStatus,
  type OfficeCommand,
} from "@/lib/worlds/office-commands";
import { CHARACTER_PATH, LOOKS_POLL_MS, OWNER_LOOK_SEED, defaultCharacter, parseCharacter, type CharacterConfig } from "@/lib/worlds/character";
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
import { formatGameUnits, GAME_WALLET_PATH } from "@/lib/worlds/game-wallet";
import type { BoardOpen, OfficeCameraApi, OfficeLayers, OfficeQuality } from "./office-canvas";
import { CityChrome } from "./city/city-panel";
import { officeInteractables } from "@/lib/worlds/city/interactables";
import { buildCityDistrict } from "@/lib/worlds/city/locations";
import type { HomeTier } from "@/lib/worlds/economy";
import { OfficeJoystick } from "./office-joystick";
import { panelsEnabledFromStorage, panelsStorageValue } from "@/lib/worlds/office-chrome";
import type { Stick } from "@/lib/worlds/office-move";
import "./office.css";

type GameCatalogItem = {
  sku: string;
  name: string;
  category: string;
  price: number;
  owned: boolean;
  note: string | null;
};

type GameLedgerLine = {
  direction: string;
  amount: number;
  reason: string;
  source: string;
  bucket: string;
  createdAt: string;
};

type GameMoneyRow = { id: string; name: string; wallet: number; bank: number; uncollected: number };

type GameWalletView = {
  wallet: {
    balance: number;
    bank: number;
    uncollected: number;
    interestWeeklyPercent: number;
    perks: { id: string; name: string; note: string }[];
    history: GameLedgerLine[];
    historyNote: string | null;
  };
  catalog: GameCatalogItem[];
  rates: Record<string, number> | null;
  bots: GameMoneyRow[];
  creators: GameMoneyRow[];
};

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

type OfficeSheet = "info" | "bot" | "you" | "board" | "meet" | "vault" | "log" | "achievements" | "currency" | "bank";

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

export function OfficeApp({ charactersEnabled = false, cityMode = false }: { charactersEnabled?: boolean; cityMode?: boolean }) {
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
  const [looks, setLooks] = useState<Record<string, CharacterConfig>>({});
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
  const [gameWallet, setGameWallet] = useState<GameWalletView | null>(null);
  const [gameError, setGameError] = useState("");
  const [gameRates, setGameRates] = useState<Record<string, string>>({});
  const [interestPercent, setInterestPercent] = useState("1");
  const [bankAmount, setBankAmount] = useState("");
  const [cityLocation, setCityLocation] = useState<string | null>(null);
  const [homeTier, setHomeTier] = useState<HomeTier>("studio");
  const setTier = useCallback((tier: HomeTier) => {
    setHomeTier((current) => (current === tier ? current : tier));
  }, []);
  const bankKey = useRef("");
  const [savingGame, setSavingGame] = useState(false);
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
    async function load() {
      try {
        const response = await fetch(withBasePath(GAME_WALLET_PATH), { cache: "no-store", credentials: "same-origin" });
        const body = await response.json().catch(() => null) as (GameWalletView & { error?: string }) | null;
        if (stop || !response.ok || !body?.wallet) return;
        setGameWallet(body);
        if (body.rates) {
          setGameRates(Object.fromEntries(Object.entries(body.rates).map(([key, value]) => [key, String(value)])));
        }
        if (typeof body.wallet.interestWeeklyPercent === "number") {
          setInterestPercent(String(body.wallet.interestWeeklyPercent));
        }
      } catch {
        // A later visit to the bank loads the balances again.
      }
    }
    void load();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    async function loadLooks() {
      const fresh = Date.now();
      let botsOk = false;
      const nextBots: Record<string, CharacterConfig> = {};
      let mineConfig: CharacterConfig | undefined;
      let mineOk = false;
      try {
        const response = await fetch(withBasePath(`${CHARACTER_PATH}?kind=bot&fresh=${fresh}`), {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "cache-control": "no-cache", pragma: "no-cache" },
        });
        const body = await response.json().catch(() => null) as { characters?: { subjectId?: string; config?: unknown }[] } | null;
        if (!stop && response.ok && body && Array.isArray(body.characters)) {
          botsOk = true;
          for (const item of body.characters) {
            if (!item || typeof item.subjectId !== "string" || item.subjectId === OWNER_ACTOR_ID) continue;
            const parsed = parseCharacter(item.config);
            nextBots[item.subjectId] = parsed.ok ? parsed.value : defaultCharacter(item.subjectId);
          }
        }
      } catch {
        // Keep the bot looks already on screen.
      }
      try {
        const response = await fetch(withBasePath(`${CHARACTER_PATH}?mine=1&fresh=${fresh}`), {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "cache-control": "no-cache", pragma: "no-cache" },
        });
        const body = await response.json().catch(() => null) as { character?: { config?: unknown } } | null;
        if (!stop && response.ok && body?.character) {
          const parsed = parseCharacter(body.character.config);
          mineConfig = parsed.ok ? parsed.value : defaultCharacter(OWNER_LOOK_SEED);
          mineOk = true;
        }
      } catch {
        // Keep the owner's look already on screen.
      }
      if (stop || (!botsOk && !mineOk)) return;
      setLooks((current) => {
        const next = botsOk ? { ...nextBots } : { ...current };
        if (mineOk && mineConfig) next[OWNER_ACTOR_ID] = mineConfig;
        else if (current[OWNER_ACTOR_ID]) next[OWNER_ACTOR_ID] = current[OWNER_ACTOR_ID];
        return next;
      });
    }
    function onVisible() {
      if (document.visibilityState === "visible") void loadLooks();
    }
    void loadLooks();
    const timer = window.setInterval(() => void loadLooks(), LOOKS_POLL_MS);
    window.addEventListener("focus", loadLooks);
    window.addEventListener("pageshow", loadLooks);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", loadLooks);
      window.removeEventListener("pageshow", loadLooks);
      document.removeEventListener("visibilitychange", onVisible);
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
    const store = createOfficeSimStore(layout, [...hold.botIds.filter((id) => id !== OWNER_ACTOR_ID), OWNER_ACTOR_ID]);
    placeBotsInRooms(store.state, layout, hold.rooms);
    return store;
  }, [layout, hold]);
  const sceneBots = useMemo(() => {
    const roster = (status?.bots ?? []).filter((item) => item.id !== OWNER_ACTOR_ID);
    return [...roster, { id: OWNER_ACTOR_ID, name: "You", short: "You", status: "idle" as const }];
  }, [status]);
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
    setSheet(id === OWNER_ACTOR_ID ? "you" : "bot");
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

  function applyGameWallet(body: GameWalletView) {
    setGameWallet(body);
    if (body.rates) {
      setGameRates(Object.fromEntries(Object.entries(body.rates).map(([key, value]) => [key, String(value)])));
    }
    if (typeof body.wallet.interestWeeklyPercent === "number") {
      setInterestPercent(String(body.wallet.interestWeeklyPercent));
    }
  }

  async function loadGameWallet(announce = true) {
    try {
      const response = await fetch(withBasePath(GAME_WALLET_PATH), { cache: "no-store", credentials: "same-origin" });
      const body = await response.json().catch(() => null) as (GameWalletView & { error?: string }) | null;
      if (!response.ok || !body || !body.wallet) {
        if (announce) setGameError(body?.error || "The currency wallet did not load.");
        return false;
      }
      setGameError("");
      applyGameWallet(body);
      return true;
    } catch {
      if (announce) setGameError("The currency wallet did not load.");
      return false;
    }
  }

  function openCurrency() {
    if (!panelsEnabled) return;
    setMenuOpen(false);
    setSheet("currency");
    setGameError("");
    void loadGameWallet();
  }

  function openBank() {
    if (!panelsEnabled) return;
    setMenuOpen(false);
    setSheet("bank");
    setGameError("");
    void loadGameWallet();
  }

  async function postGameWallet(payload: unknown) {
    setSavingGame(true);
    setGameError("");
    try {
      const response = await fetch(withBasePath(GAME_WALLET_PATH), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null) as { error?: string; wallet?: GameWalletView["wallet"]; rates?: Record<string, number> } | null;
      if (!response.ok) {
        setGameError(body?.error || "That currency action did not finish.");
        return false;
      }
      await loadGameWallet();
      return true;
    } catch {
      setGameError("That currency action did not finish.");
      return false;
    } finally {
      setSavingGame(false);
    }
  }

  async function sendBankMove(action: "collect" | "deposit" | "withdraw", destination?: "wallet" | "bank") {
    const typed = bankAmount.trim();
    const amount = typed === "" ? undefined : Number(typed);
    if (typed !== "" && !Number.isFinite(amount)) {
      setGameError("Enter an amount.");
      return;
    }
    if (action !== "collect" && (amount === undefined || amount <= 0)) {
      setGameError("Enter an amount.");
      return;
    }
    if (!bankKey.current) bankKey.current = crypto.randomUUID();
    const ok = await postGameWallet({
      action,
      amount,
      destination,
      idempotencyKey: bankKey.current,
    });
    if (ok) {
      bankKey.current = "";
      setBankAmount("");
    }
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

  function openCity(id: string) {
    setCityLocation(id);
    setSheet(null);
    setBoard(null);
    setMenuOpen(false);
    if (!layout) return;
    const plot = buildCityDistrict(layout, homeTier).plots.find((item) => item.id === id);
    if (plot) cameraApiRef.current?.focus(plot.entrance.x, plot.entrance.z);
  }

  const officeTaps = useMemo(
    () => (cityMode && layout && status ? officeInteractables(layout, status.sections, status.bots) : []),
    [cityMode, layout, status],
  );

  const reviewCount = status ? notesForView(status.notes, "review").length : 0;
  const boardNotes = status && board ? status.notes.filter((note) => note.office === board.office) : [];

  return (
    <div className="bot-office" ref={root} onContextMenu={(event) => event.preventDefault()}>
      <div className="office-stage">
        {layout && sim && status ? (
          <OfficeCanvas
            layout={layout}
            sections={status.sections}
            bots={sceneBots}
            looks={looks}
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
            bankBalance={gameWallet?.wallet.bank ?? 0}
            onOpenBank={() => openBank()}
            stickRef={stickRef}
            city={cityMode ? { homeTier, selectedId: cityLocation, onOpenLocation: openCity } : null}
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
            {charactersEnabled ? <Link className="office-link" href="/worlds/create">Your character</Link> : null}
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
                {sceneBots.map((item) => {
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
              <button type="button" disabled={!panelsEnabled} onClick={() => openCurrency()}>Currency</button>
              <button type="button" onClick={() => void toggleFullscreen()}>Fullscreen</button>
            </div>
          </div>
        ) : null}
      </div>

      <OfficeJoystick stickRef={stickRef} lifted={sheet !== null || cityLocation !== null} />

      {cityMode ? (
        <CityChrome
          locationId={cityLocation}
          officeTaps={officeTaps}
          lifted={sheet !== null}
          onOpenLocation={openCity}
          onClose={() => setCityLocation(null)}
          onOpenBank={() => openBank()}
          onTier={setTier}
        />
      ) : null}

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
          <button type="button" onClick={() => openCurrency()}>Currency</button>
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

      {sheet === "you" ? (
        <section className="office-panel office-sheet office-chat" aria-label="You">
          <CloseRow title="You" onClose={dismiss} />
          <p>This is your character at the HQ desk.</p>
          {charactersEnabled ? <Link className="office-link" href="/worlds/create">Customize</Link> : null}
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
                {turn.from === "owner" && turn.state === "not_delivered" ? (
                  <button
                    type="button"
                    className="office-resend"
                    disabled={saving}
                    onClick={() => void postCommand({ kind: "message", botId: bot.id, text: turn.text })}
                  >
                    {NOT_DELIVERED_LABEL}
                  </button>
                ) : null}
                {turn.from === "owner" && turn.state !== "not_delivered" ? (
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
          <div className="office-card-links">
            {bot.chatHref ? <a className="office-link" href={bot.chatHref}>Open chat</a> : null}
            {charactersEnabled ? <Link className="office-link" href={`/worlds/create?bot=${encodeURIComponent(bot.id)}`}>Customize</Link> : null}
          </div>
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

      {sheet === "currency" ? (
        <section className="office-panel office-sheet office-vault" aria-label="Currency">
          <CloseRow title="Currency" onClose={dismiss} />
          <p className="office-vault-total">Wallet {gameWallet ? formatGameUnits(gameWallet.wallet.balance) : "…"}</p>
          <p className="office-kicker">Spendable at shops and stores.</p>
          <p className="office-vault-total">Bank {gameWallet ? formatGameUnits(gameWallet.wallet.bank) : "…"}</p>
          <p className="office-kicker">Protected. Earns {gameWallet ? gameWallet.wallet.interestWeeklyPercent : 1}% a week. Visit the outdoor bank to move it.</p>
          {gameWallet && gameWallet.wallet.uncollected > 0 ? (
            <p><b>Uncollected</b> {formatGameUnits(gameWallet.wallet.uncollected)}. Visit the outdoor bank to collect.</p>
          ) : null}
          <p className="office-kicker">In-game currency only. Real money is not moved here.</p>
          {gameError ? <p className="office-error">{gameError}</p> : null}
          <h2>Shop</h2>
          <ul className="office-list">
            {(gameWallet?.catalog ?? []).map((item) => (
              <li key={item.sku}>
                <b>{item.name}</b> · {formatGameUnits(item.price)}
                <div className="office-kicker">{item.category}{item.note ? ` · ${item.note}` : ""}</div>
                <button type="button" disabled={savingGame || item.owned || (gameWallet != null && item.price > gameWallet.wallet.balance)} onClick={() => void postGameWallet({ action: "buy", sku: item.sku })}>
                  {item.owned ? "Owned" : "Buy"}
                </button>
              </li>
            ))}
          </ul>
          <h2>History</h2>
          {gameWallet?.wallet.historyNote ? <p className="office-kicker">{gameWallet.wallet.historyNote}</p> : null}
          {gameWallet && gameWallet.wallet.history.length === 0 ? <p>No currency yet.</p> : null}
          <ul className="office-list">
            {(gameWallet?.wallet.history ?? []).map((entry) => (
              <li key={`${entry.createdAt}-${entry.reason}-${entry.source}-${entry.amount}`}>
                <b>{entry.direction === "debit" ? "Spent" : "Earned"} {formatGameUnits(entry.amount)}</b>
                <div className="office-kicker">{entry.bucket} · {entry.reason} · {entry.source}</div>
              </li>
            ))}
          </ul>
          {gameWallet && gameWallet.bots.length > 0 ? (
            <>
              <h2>Bot wallets</h2>
              <ul className="office-list">
                {gameWallet.bots.map((bot) => <li key={bot.id}><b>{bot.name}</b> · Wallet {formatGameUnits(bot.wallet)} · Bank {formatGameUnits(bot.bank)}</li>)}
              </ul>
            </>
          ) : null}
          {gameWallet && gameWallet.creators.length > 0 ? (
            <>
              <h2>Creator wallets</h2>
              <ul className="office-list">
                {gameWallet.creators.map((person) => <li key={person.id}><b>{person.name}</b> · Wallet {formatGameUnits(person.wallet)} · Bank {formatGameUnits(person.bank)}</li>)}
              </ul>
            </>
          ) : null}
          {gameWallet?.rates ? (
            <form className="office-form" onSubmit={(event) => {
              event.preventDefault();
              const rates = Object.fromEntries(Object.entries(gameRates).map(([key, value]) => [key, Number(value)]));
              void postGameWallet({ action: "set-rates", rates });
            }}>
              <p className="office-kicker">Earn amounts in currency-dollars. Minigames stay unavailable.</p>
              {Object.entries(gameRates).map(([key, value]) => (
                <label key={key} className="office-field"><span className="office-kicker">{key}</span>
                  <input aria-label={`${key} earn amount`} inputMode="decimal" value={value} onChange={(event) => setGameRates((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
              <button type="submit" disabled={savingGame}>Save earn amounts</button>
            </form>
          ) : null}
          <button type="button" disabled title="Real-money purchases are off. Nothing is charged.">Buy currency with real money</button>
          <p className="office-kicker">Real-money purchases are off. Nothing is charged.</p>
        </section>
      ) : null}

      {sheet === "bank" ? (
        <section className="office-panel office-sheet office-vault" aria-label="Bank">
          <CloseRow title="Bank" onClose={dismiss} />
          <p className="office-kicker">In-game currency only. Shops spend the wallet. The bank is protected and earns interest.</p>
          {gameError ? <p className="office-error">{gameError}</p> : null}
          <p><b>Wallet</b> {gameWallet ? formatGameUnits(gameWallet.wallet.balance) : "…"}</p>
          <p><b>Bank</b> {gameWallet ? formatGameUnits(gameWallet.wallet.bank) : "…"}</p>
          <p><b>Uncollected</b> {gameWallet ? formatGameUnits(gameWallet.wallet.uncollected) : "…"}</p>
          <p className="office-kicker">Interest {gameWallet ? gameWallet.wallet.interestWeeklyPercent : 1}% a week, credited daily to the bank.</p>
          <label className="office-field"><span className="office-kicker">Amount</span>
            <input aria-label="Bank amount" inputMode="decimal" value={bankAmount} onChange={(event) => setBankAmount(event.target.value)} placeholder="All uncollected, or a deposit" />
          </label>
          <div className="office-actions">
            <button type="button" disabled={savingGame || !gameWallet?.wallet.uncollected} onClick={() => void sendBankMove("collect", "wallet")}>Collect to wallet</button>
            <button type="button" disabled={savingGame || !gameWallet?.wallet.uncollected} onClick={() => void sendBankMove("collect", "bank")}>Keep in bank</button>
            <button type="button" disabled={savingGame} onClick={() => void sendBankMove("deposit")}>Deposit</button>
            <button type="button" disabled={savingGame} onClick={() => void sendBankMove("withdraw")}>Withdraw</button>
          </div>
          {gameWallet?.rates ? (
            <form className="office-form" onSubmit={(event) => {
              event.preventDefault();
              void postGameWallet({ action: "set-interest", weeklyPercent: Number(interestPercent) });
            }}>
              <label className="office-field"><span className="office-kicker">Weekly interest percent</span>
                <input aria-label="Weekly interest percent" inputMode="decimal" value={interestPercent} onChange={(event) => setInterestPercent(event.target.value)} />
              </label>
              <button type="submit" disabled={savingGame}>Save interest rate</button>
            </form>
          ) : null}
          <h2>Perks</h2>
          <ul className="office-list">
            {(gameWallet?.wallet.perks ?? []).map((perk) => (
              <li key={perk.id}><b>{perk.name}</b><div className="office-kicker">{perk.note}</div></li>
            ))}
          </ul>
          <h2>History</h2>
          {gameWallet?.wallet.historyNote ? <p className="office-kicker">{gameWallet.wallet.historyNote}</p> : null}
          {gameWallet && gameWallet.wallet.history.length === 0 ? <p>No currency yet.</p> : null}
          <ul className="office-list">
            {(gameWallet?.wallet.history ?? []).map((entry) => (
              <li key={`bank-${entry.createdAt}-${entry.bucket}-${entry.reason}-${entry.source}-${entry.amount}`}>
                <b>{entry.direction === "debit" ? "Out" : "In"} {formatGameUnits(entry.amount)}</b>
                <div className="office-kicker">{entry.bucket} · {entry.reason} · {entry.source}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet === "vault" ? (
        <section className="office-panel office-sheet office-vault" aria-label="Vault">
          <CloseRow title="Vault" onClose={dismiss} />
          <p className="office-vault-total">{formatWalletMoney(wallets.total)}</p>
          <p className="office-kicker">Names and amounts. The outdoor bank uses in-game currency. No bank login or card number is stored here.</p>
          {walletError ? <p className="office-error">{walletError}</p> : null}
          {wallets.wallets.length === 0 ? (
            <p>No wallets yet.</p>
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
