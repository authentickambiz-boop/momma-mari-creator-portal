/**
 * Live bot-office state: wings, bots, calendars, to-dos, notes, and verified wins.
 * The seed is sample data. A scheduler replaces it with POST /api/worlds/status.
 * Private rate floors and private relationship details are rejected.
 */

import {
  BOT_LEVEL_XP,
  BOT_STATUSES,
  LOCKED_ACHIEVEMENTS,
  OFFICE_BOTS,
  OFFICE_SNAPSHOT,
  OFFICE_TOPICS,
  STATUS_LABEL,
  TEAM_LEVEL_XP,
  UNLOCKED_ACHIEVEMENTS,
  botXp,
  chatHrefFor,
  containsPrivateOfficeDetail,
  findOfficeBot,
  teamLevel,
  teamXp,
  type BotStatus,
  type LockedAchievement,
  type OfficeAchievement,
  type OfficeBot,
} from "./office-catalog";
import {
  HQ_BOT_ID,
  OFFICE_SECTIONS,
  buildOfficeLayout,
  roomAt,
  wingSlug,
  type OfficeLayout,
  type OfficeSection,
  type Vec,
} from "./office-layout";

export { containsPrivateOfficeDetail };

export const OFFICE_KEYS = ["personal", "business", "creators", "hq"] as const;
export type OfficeKey = (typeof OFFICE_KEYS)[number];

export const NOTE_STATUSES = ["new", "with_kash", "approved_to_show", "held"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const OFFICE_POLL_MS = 45_000;
export const OFFICE_STATUS_PATH = "/api/worlds/status";

/** Default manager bot for each board. The live record can name a different manager. */
export const OFFICE_MANAGERS: Record<OfficeKey, string> = {
  personal: "lifemgr",
  business: "bizmgr",
  creators: "cremgr",
  hq: "kash",
};

export const OFFICE_LABEL: Record<OfficeKey, string> = {
  personal: "Personal",
  business: "Business",
  creators: "Creators",
  hq: "Managers HQ",
};

export type CalendarEvent = {
  id: string;
  office: OfficeKey;
  title: string;
  start: string;
  end: string;
};

export type OfficeTodo = {
  id: string;
  office: OfficeKey;
  task: string;
  ownerBot: string;
  due: string;
  impactDollars: number;
  done: boolean;
};

export type OfficeNote = {
  id: string;
  office: OfficeKey;
  date: string;
  bot: string;
  idea: string;
  whyNow: string;
  status: NoteStatus;
};

export type SnapshotBot = {
  id: string;
  name: string;
  short: string;
  role: string;
  task: string;
  update: string;
  status: BotStatus;
  room: string;
  chatId: string | null;
};

export type OfficeRecord = {
  sections: OfficeSection[];
  hqBotId: string;
  bots: SnapshotBot[];
  calendar: CalendarEvent[];
  todos: OfficeTodo[];
  notes: OfficeNote[];
  achievements: OfficeAchievement[];
  locked: LockedAchievement[];
};

export type OfficeResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const SNAPSHOT_KEYS = new Set(["sections", "hqBotId", "bots", "calendar", "todos", "notes", "achievements", "locked"]);

function fail(status: number, error: string): OfficeResult<never> {
  return { ok: false, status, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, max = 400): OfficeResult<string> {
  if (typeof value !== "string" || !value.trim()) return fail(400, `${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) return fail(400, `${label} is too long.`);
  if (containsPrivateOfficeDetail(trimmed)) return fail(400, `${label} includes a private detail. Leave it out of the office.`);
  return { ok: true, value: trimmed };
}

function officeKey(value: unknown): OfficeResult<OfficeKey> {
  if (typeof value !== "string" || !OFFICE_KEYS.includes(value as OfficeKey)) {
    return fail(400, "office must be personal, business, creators, or hq.");
  }
  return { ok: true, value: value as OfficeKey };
}

function idOf(value: unknown, label: string): OfficeResult<string> {
  const parsed = text(value, label, 80);
  if (!parsed.ok) return parsed;
  if (!/^[a-zA-Z0-9:_-]+$/.test(parsed.value)) return fail(400, `${label} has an unsupported character.`);
  return parsed;
}

function uniqueIds(ids: string[], label: string): OfficeResult<true> {
  if (new Set(ids).size !== ids.length) return fail(400, `${label} ids must be unique.`);
  return { ok: true, value: true };
}

export function layoutFor(record: Pick<OfficeRecord, "sections" | "hqBotId" | "bots">): OfficeLayout {
  return buildOfficeLayout({
    sections: record.sections,
    hqBotId: record.hqBotId,
    extraBotIds: record.bots.map((bot) => bot.id),
  });
}

export function managerForOffice(record: Pick<OfficeRecord, "sections" | "hqBotId">, office: OfficeKey) {
  if (office === "hq") return record.hqBotId || OFFICE_MANAGERS.hq;
  const section = record.sections.find((item) => wingSlug(item.name) === office)
    ?? record.sections.find((item) => item.manager === OFFICE_MANAGERS[office]);
  return section?.manager ?? OFFICE_MANAGERS[office];
}

export function notesForView(notes: OfficeNote[], view: "main" | "review") {
  return notes.filter((note) => (view === "main" ? note.status === "approved_to_show" : note.status !== "approved_to_show"));
}

/** Events whose end is still ahead. A clock that cannot be parsed stays on the list. */
export function upcomingEvents<T extends { start: string; end: string }>(events: T[], now = Date.now()) {
  return events
    .filter((event) => {
      const end = Date.parse(event.end);
      return Number.isNaN(end) || end >= now;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function boardStations(layout: OfficeLayout, sections: OfficeSection[] = OFFICE_SECTIONS) {
  const wings: { office: OfficeKey; roomId: string }[] = (["personal", "business", "creators"] as const).map((office) => {
    const section = sections.find((item) => item.manager === OFFICE_MANAGERS[office])
      ?? sections.find((item) => wingSlug(item.name) === office);
    return { office, roomId: section ? `office:${wingSlug(section.name)}` : `office:${office}` };
  });
  wings.push({ office: "hq", roomId: "hq" });
  return wings.flatMap((wing) => {
    const room = layout.rooms.find((item) => item.id === wing.roomId);
    if (!room) return [];
    return [{
      office: wing.office,
      roomId: wing.roomId,
      calendar: { x: room.x + Math.min(1.6, room.w * 0.22), z: room.z + 0.32 } satisfies Vec,
      whiteboard: { x: room.x + room.w - Math.min(1.8, room.w * 0.24), z: room.z + 0.32 } satisfies Vec,
      inbox: { x: room.x + Math.min(1.35, room.w * 0.2), z: room.z + room.d - 1.4 } satisfies Vec,
    }];
  });
}

function botFromCatalog(bot: OfficeBot, room: string): SnapshotBot {
  return {
    id: bot.id,
    name: bot.name,
    short: bot.short,
    role: bot.role,
    task: bot.task,
    update: bot.update,
    status: bot.status,
    room,
    chatId: bot.chatId,
  };
}

export function seedOfficeRecord(): OfficeRecord {
  const sections = OFFICE_SECTIONS.map((section) => ({ ...section, members: [...section.members] }));
  const draft: OfficeRecord = {
    sections,
    hqBotId: HQ_BOT_ID,
    bots: [],
    calendar: [
      { id: "cal-personal", office: "personal", title: "Sample: personal wing check-in", start: "2026-10-24T09:00:00-04:00", end: "2026-10-24T09:20:00-04:00" },
      { id: "cal-business", office: "business", title: "Sample: Friday brand batch", start: "2026-10-24T09:00:00-04:00", end: "2026-10-24T09:30:00-04:00" },
      { id: "cal-creators", office: "creators", title: "Sample: roster intake review", start: "2026-10-24T11:00:00-04:00", end: "2026-10-24T11:30:00-04:00" },
      { id: "cal-hq", office: "hq", title: "Sample: evening team sync", start: "2026-10-22T20:00:00-04:00", end: "2026-10-22T20:30:00-04:00" },
    ],
    todos: [
      { id: "todo-life", office: "personal", task: "Sample: confirm the personal list is still empty.", ownerBot: "life", due: "2026-10-24", impactDollars: 0, done: false },
      { id: "todo-growth", office: "business", task: "Sample: look at the stalled deposit build.", ownerBot: "growth", due: "2026-10-23", impactDollars: 0, done: false },
      { id: "todo-ops", office: "creators", task: "Sample: review the streamer intake fields.", ownerBot: "ops", due: "2026-10-24", impactDollars: 0, done: false },
      { id: "todo-kash", office: "hq", task: "Sample: deliver the sync note to each wing.", ownerBot: "kash", due: "2026-10-23", impactDollars: 0, done: false },
    ],
    notes: [
      { id: "note-personal-show", office: "personal", date: "2026-10-22", bot: "life", idea: "Sample: block a quiet hour for personal planning.", whyNow: "The personal wing has no live tasks yet.", status: "approved_to_show" },
      { id: "note-personal-held", office: "personal", date: "2026-10-21", bot: "travel", idea: "Sample: reopen a paused trip checklist.", whyNow: "It was held earlier. Kept here so it can be asked again.", status: "held" },
      { id: "note-business-new", office: "business", date: "2026-10-22", bot: "outreach", idea: "Sample: add a Friday gaming-sponsor check-in.", whyNow: "The sponsor list is already finished.", status: "new" },
      { id: "note-business-kash", office: "business", date: "2026-10-22", bot: "growth", idea: "Sample: pin the deposit build on the HQ board.", whyNow: "The build has been quiet since the evening sprint.", status: "with_kash" },
      { id: "note-creators-show", office: "creators", date: "2026-10-22", bot: "ops", idea: "Sample: walk the streamer intake fields with Creator Ops.", whyNow: "Those fields landed in the portal the same day.", status: "approved_to_show" },
      { id: "note-hq-show", office: "hq", date: "2026-10-22", bot: "kash", idea: "Sample: post the evening sync on the HQ board.", whyNow: "The sync is written and still needs to be delivered.", status: "approved_to_show" },
    ],
    achievements: UNLOCKED_ACHIEVEMENTS.map((achievement) => ({ ...achievement, credit: [...achievement.credit] })),
    locked: LOCKED_ACHIEVEMENTS.map((achievement) => ({ ...achievement })),
  };
  const layout = layoutFor({ ...draft, bots: OFFICE_BOTS.map((bot) => botFromCatalog(bot, "hq")) });
  draft.bots = OFFICE_BOTS.map((bot) => {
    const home = layout.homes[bot.id];
    const room = home ? roomAt(layout, home).id : "hq";
    return botFromCatalog(bot, room);
  });
  return draft;
}

function parseSections(value: unknown): OfficeResult<OfficeSection[]> {
  if (!Array.isArray(value) || value.length === 0) return fail(400, "sections must list each wing.");
  const sections: OfficeSection[] = [];
  for (const item of value) {
    if (!isRecord(item)) return fail(400, "Each section needs a name, manager, and members.");
    const name = text(item.name, "section name", 80);
    if (!name.ok) return name;
    const manager = idOf(item.manager, "section manager");
    if (!manager.ok) return manager;
    if (!Array.isArray(item.members) || item.members.length === 0) return fail(400, "Each section needs members.");
    const members: string[] = [];
    for (const member of item.members) {
      const parsed = idOf(member, "section member");
      if (!parsed.ok) return parsed;
      members.push(parsed.value);
    }
    if (!members.includes(manager.value)) return fail(400, "The section manager has to be a member of that wing.");
    sections.push({ name: name.value, manager: manager.value, members });
  }
  return { ok: true, value: sections };
}

function parseBots(value: unknown, rooms: Set<string>, sections: OfficeSection[]): OfficeResult<SnapshotBot[]> {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return fail(400, "bots must list the office roster.");
  const bots: SnapshotBot[] = [];
  for (const item of value) {
    if (!isRecord(item)) return fail(400, "Each bot needs an id, name, status, and room.");
    const id = idOf(item.id, "bot id");
    if (!id.ok) return id;
    const name = text(item.name, "bot name", 80);
    if (!name.ok) return name;
    const short = item.short === undefined ? { ok: true as const, value: name.value.slice(0, 2).toUpperCase() } : text(item.short, "bot short", 8);
    if (!short.ok) return short;
    const role = item.role === undefined ? { ok: true as const, value: "" } : text(item.role, "bot role");
    if (!role.ok) return role;
    const task = item.task === undefined ? { ok: true as const, value: "" } : text(item.task, "bot task");
    if (!task.ok) return task;
    const update = item.update === undefined ? { ok: true as const, value: "" } : text(item.update, "bot update");
    if (!update.ok) return update;
    if (typeof item.status !== "string" || !BOT_STATUSES.includes(item.status as BotStatus)) {
      return fail(400, "status must be working, waiting, or idle.");
    }
    const room = idOf(item.room, "bot room");
    if (!room.ok) return room;
    if (!rooms.has(room.value)) return fail(400, `room ${room.value} is not on this floor plan.`);
    let chatId: string | null;
    if (item.chatId === undefined) chatId = findOfficeBot(id.value)?.chatId ?? null;
    else if (item.chatId === null) chatId = null;
    else {
      const parsed = idOf(item.chatId, "chat id");
      if (!parsed.ok) return parsed;
      chatId = parsed.value;
    }
    bots.push({
      id: id.value,
      name: name.value,
      short: short.value,
      role: role.value,
      task: task.value,
      update: update.value,
      status: item.status as BotStatus,
      room: room.value,
      chatId,
    });
  }
  const ids = uniqueIds(bots.map((bot) => bot.id), "bot");
  if (!ids.ok) return ids;
  const known = new Set(bots.map((bot) => bot.id));
  for (const section of sections) {
    for (const member of section.members) {
      if (!known.has(member)) return fail(400, `Section member ${member} is not in bots.`);
    }
  }
  return { ok: true, value: bots };
}

function parseCalendar(value: unknown): OfficeResult<CalendarEvent[]> {
  if (!Array.isArray(value) || value.length > 80) return fail(400, "calendar must be a list.");
  const events: CalendarEvent[] = [];
  for (const item of value) {
    if (!isRecord(item)) return fail(400, "Each calendar event needs an id, office, title, start, and end.");
    const id = idOf(item.id, "calendar id");
    if (!id.ok) return id;
    const office = officeKey(item.office);
    if (!office.ok) return office;
    const title = text(item.title, "calendar title", 160);
    if (!title.ok) return title;
    const start = text(item.start, "calendar start", 40);
    if (!start.ok) return start;
    const end = text(item.end, "calendar end", 40);
    if (!end.ok) return end;
    events.push({ id: id.value, office: office.value, title: title.value, start: start.value, end: end.value });
  }
  const ids = uniqueIds(events.map((event) => event.id), "calendar");
  if (!ids.ok) return ids;
  return { ok: true, value: events };
}

function parseTodos(value: unknown, botIds: Set<string>): OfficeResult<OfficeTodo[]> {
  if (!Array.isArray(value) || value.length > 80) return fail(400, "todos must be a list.");
  const todos: OfficeTodo[] = [];
  for (const item of value) {
    if (!isRecord(item)) return fail(400, "Each to-do needs a task, owner, due date, impact, and done flag.");
    const id = idOf(item.id, "todo id");
    if (!id.ok) return id;
    const office = officeKey(item.office);
    if (!office.ok) return office;
    const task = text(item.task, "todo task");
    if (!task.ok) return task;
    const ownerBot = idOf(item.ownerBot, "todo owner");
    if (!ownerBot.ok) return ownerBot;
    if (!botIds.has(ownerBot.value)) return fail(400, "That to-do owner is not on the office roster.");
    const due = text(item.due, "todo due", 40);
    if (!due.ok) return due;
    if (typeof item.impactDollars !== "number" || !Number.isFinite(item.impactDollars) || item.impactDollars < 0 || item.impactDollars > 10_000_000) {
      return fail(400, "impactDollars must be a dollar amount, or 0 when there is no sample impact.");
    }
    if (typeof item.done !== "boolean") return fail(400, "done must be true or false.");
    todos.push({
      id: id.value,
      office: office.value,
      task: task.value,
      ownerBot: ownerBot.value,
      due: due.value,
      impactDollars: Math.round(item.impactDollars * 100) / 100,
      done: item.done,
    });
  }
  const ids = uniqueIds(todos.map((todo) => todo.id), "todo");
  if (!ids.ok) return ids;
  return { ok: true, value: todos };
}

function parseNotes(value: unknown, botIds: Set<string>): OfficeResult<OfficeNote[]> {
  if (!Array.isArray(value) || value.length > 80) return fail(400, "notes must be a list.");
  const notes: OfficeNote[] = [];
  for (const item of value) {
    if (!isRecord(item)) return fail(400, "Each note needs a date, bot, idea, why now, and status.");
    const id = idOf(item.id, "note id");
    if (!id.ok) return id;
    const office = officeKey(item.office);
    if (!office.ok) return office;
    const date = text(item.date, "note date", 40);
    if (!date.ok) return date;
    const bot = idOf(item.bot, "note bot");
    if (!bot.ok) return bot;
    if (!botIds.has(bot.value)) return fail(400, "That note bot is not on the office roster.");
    const idea = text(item.idea, "note idea");
    if (!idea.ok) return idea;
    const whyNow = text(item.whyNow, "why now");
    if (!whyNow.ok) return whyNow;
    if (typeof item.status !== "string" || !NOTE_STATUSES.includes(item.status as NoteStatus)) {
      return fail(400, "note status must be new, with_kash, approved_to_show, or held.");
    }
    notes.push({
      id: id.value,
      office: office.value,
      date: date.value,
      bot: bot.value,
      idea: idea.value,
      whyNow: whyNow.value,
      status: item.status as NoteStatus,
    });
  }
  const ids = uniqueIds(notes.map((note) => note.id), "note");
  if (!ids.ok) return ids;
  return { ok: true, value: notes };
}

function parseAchievements(value: unknown): OfficeResult<OfficeAchievement[]> {
  if (!Array.isArray(value) || value.length > 60) return fail(400, "achievements must be a list of verified wins.");
  const achievements: OfficeAchievement[] = [];
  for (const item of value) {
    if (!isRecord(item)) return fail(400, "Each achievement needs a title, source, xp, and credit.");
    const icon = item.icon === undefined ? { ok: true as const, value: "🏁" } : text(item.icon, "achievement icon", 8);
    if (!icon.ok) return icon;
    const title = text(item.title, "achievement title", 80);
    if (!title.ok) return title;
    const date = text(item.date, "achievement date", 40);
    if (!date.ok) return date;
    const detail = text(item.detail, "achievement detail");
    if (!detail.ok) return detail;
    const source = text(item.source, "achievement source", 200);
    if (!source.ok) return source;
    if (typeof item.xp !== "number" || !Number.isInteger(item.xp) || item.xp < 0 || item.xp > 10000) {
      return fail(400, "achievement xp must be a whole number.");
    }
    if (!Array.isArray(item.credit) || item.credit.length === 0) return fail(400, "achievement credit must name the bots.");
    const credit: string[] = [];
    for (const bot of item.credit) {
      const parsed = idOf(bot, "achievement credit");
      if (!parsed.ok) return parsed;
      credit.push(parsed.value);
    }
    achievements.push({ icon: icon.value, title: title.value, date: date.value, detail: detail.value, source: source.value, xp: item.xp, credit });
  }
  return { ok: true, value: achievements };
}

function parseLocked(value: unknown): OfficeResult<LockedAchievement[]> {
  if (value === undefined) return { ok: true, value: LOCKED_ACHIEVEMENTS.map((item) => ({ ...item })) };
  if (!Array.isArray(value) || value.length > 40) return fail(400, "locked must be a list.");
  const locked: LockedAchievement[] = [];
  for (const item of value) {
    if (!isRecord(item)) return fail(400, "Each locked goal needs an icon, title, and goal.");
    const icon = text(item.icon, "locked icon", 8);
    if (!icon.ok) return icon;
    const title = text(item.title, "locked title", 80);
    if (!title.ok) return title;
    const goal = text(item.goal, "locked goal");
    if (!goal.ok) return goal;
    locked.push({ icon: icon.value, title: title.value, goal: goal.value });
  }
  return { ok: true, value: locked };
}

/** Full snapshot from the scheduler. XP is computed from achievements, not sent as its own number. */
export function parseOfficeSnapshot(body: unknown): OfficeResult<OfficeRecord> {
  if (!isRecord(body)) return fail(400, "Expected a JSON object.");
  const extra = Object.keys(body).filter((key) => !SNAPSHOT_KEYS.has(key));
  if (extra.length) return fail(400, "The snapshot has a field the office does not store.");
  for (const key of ["sections", "bots", "calendar", "todos", "notes", "achievements"]) {
    if (!(key in body)) return fail(400, `Snapshot is missing ${key}.`);
  }
  const sections = parseSections(body.sections);
  if (!sections.ok) return sections;
  const hqBotId = body.hqBotId === undefined ? { ok: true as const, value: HQ_BOT_ID } : idOf(body.hqBotId, "hq bot");
  if (!hqBotId.ok) return hqBotId;
  const layout = buildOfficeLayout({
    sections: sections.value,
    hqBotId: hqBotId.value,
    extraBotIds: Array.isArray(body.bots) ? body.bots.flatMap((bot) => (isRecord(bot) && typeof bot.id === "string" ? [bot.id] : [])) : [],
  });
  const rooms = new Set(layout.rooms.map((room) => room.id));
  const bots = parseBots(body.bots, rooms, sections.value);
  if (!bots.ok) return bots;
  if (!bots.value.some((bot) => bot.id === hqBotId.value)) return fail(400, "The HQ bot has to be on the roster.");
  const botIds = new Set(bots.value.map((bot) => bot.id));
  const calendar = parseCalendar(body.calendar);
  if (!calendar.ok) return calendar;
  const todos = parseTodos(body.todos, botIds);
  if (!todos.ok) return todos;
  const notes = parseNotes(body.notes, botIds);
  if (!notes.ok) return notes;
  const achievements = parseAchievements(body.achievements);
  if (!achievements.ok) return achievements;
  const locked = parseLocked(body.locked);
  if (!locked.ok) return locked;
  return {
    ok: true,
    value: {
      sections: sections.value,
      hqBotId: hqBotId.value,
      bots: bots.value,
      calendar: calendar.value,
      todos: todos.value,
      notes: notes.value,
      achievements: achievements.value,
      locked: locked.value,
    },
  };
}

function mergeOverlay(record: OfficeRecord, raw: unknown): OfficeRecord {
  if (!isRecord(raw)) return record;
  const patches = raw.bots;
  if (!isRecord(patches) || Array.isArray(patches)) return record;
  const bots = record.bots.map((bot) => {
    const patch = patches[bot.id];
    if (!isRecord(patch)) return bot;
    const next = { ...bot };
    if (typeof patch.status === "string" && BOT_STATUSES.includes(patch.status as BotStatus)) next.status = patch.status as BotStatus;
    if (typeof patch.task === "string" && patch.task.trim() && !containsPrivateOfficeDetail(patch.task)) next.task = patch.task.trim().slice(0, 400);
    if (typeof patch.update === "string" && patch.update.trim() && !containsPrivateOfficeDetail(patch.update)) next.update = patch.update.trim().slice(0, 400);
    if (typeof patch.room === "string") {
      const rooms = new Set(layoutFor(record).rooms.map((room) => room.id));
      if (rooms.has(patch.room)) next.room = patch.room;
    }
    return next;
  });
  return { ...record, bots };
}

export function recordFromStored(raw: unknown): OfficeRecord {
  const seed = seedOfficeRecord();
  if (!isRecord(raw)) return seed;
  if (Array.isArray(raw.bots)) {
    const parsed = parseOfficeSnapshot(raw);
    return parsed.ok ? parsed.value : seed;
  }
  return mergeOverlay(seed, raw);
}

function botPatch(record: OfficeRecord, body: Record<string, unknown>): OfficeResult<OfficeRecord> {
  if (!Array.isArray(body.bots) || body.bots.length === 0) return fail(400, "bots must list at least one bot.");
  const bots = record.bots.map((bot) => ({ ...bot }));
  const byId = new Map(bots.map((bot) => [bot.id, bot]));
  const rooms = new Set(layoutFor(record).rooms.map((room) => room.id));
  for (const item of body.bots) {
    if (!isRecord(item)) return fail(400, "Each bot patch must be an object.");
    const unknown = Object.keys(item).find((key) => !["id", "status", "task", "update", "room"].includes(key));
    if (unknown) return fail(400, "A bot patch can set id, status, task, update, and room.");
    if (typeof item.id !== "string" || !byId.has(item.id)) return fail(400, "That bot is not on the office roster.");
    const stored = byId.get(item.id);
    if (!stored) return fail(400, "That bot is not on the office roster.");
    if (item.status !== undefined) {
      if (typeof item.status !== "string" || !BOT_STATUSES.includes(item.status as BotStatus)) return fail(400, "status must be working, waiting, or idle.");
      stored.status = item.status as BotStatus;
    }
    if (item.task !== undefined) {
      const parsed = text(item.task, "task");
      if (!parsed.ok) return parsed;
      stored.task = parsed.value;
    }
    if (item.update !== undefined) {
      const parsed = text(item.update, "update");
      if (!parsed.ok) return parsed;
      stored.update = parsed.value;
    }
    if (item.room !== undefined) {
      const parsed = idOf(item.room, "room");
      if (!parsed.ok) return parsed;
      if (!rooms.has(parsed.value)) return fail(400, `room ${parsed.value} is not on this floor plan.`);
      stored.room = parsed.value;
    }
    if (item.status === undefined && item.task === undefined && item.update === undefined && item.room === undefined) {
      return fail(400, "Set a status, task, update, or room.");
    }
  }
  return { ok: true, value: { ...record, bots } };
}

function boardPatch(record: OfficeRecord, body: Record<string, unknown>): OfficeResult<OfficeRecord> {
  const actor = idOf(body.actor, "actor");
  if (!actor.ok) return actor;
  const office = officeKey(body.office);
  if (!office.ok) return office;
  if (actor.value !== managerForOffice(record, office.value)) {
    return fail(403, "Only that wing's manager can update its calendar and to-dos.");
  }
  if (body.calendar === undefined && body.todos === undefined) return fail(400, "Send a calendar, a to-do list, or both.");
  const botIds = new Set(record.bots.map((bot) => bot.id));
  let calendar = record.calendar;
  let todos = record.todos;
  if (body.calendar !== undefined) {
    const parsed = parseCalendar(body.calendar);
    if (!parsed.ok) return parsed;
    if (parsed.value.some((event) => event.office !== office.value)) return fail(400, "Those events are for a different office.");
    calendar = [...record.calendar.filter((event) => event.office !== office.value), ...parsed.value];
  }
  if (body.todos !== undefined) {
    const parsed = parseTodos(body.todos, botIds);
    if (!parsed.ok) return parsed;
    if (parsed.value.some((todo) => todo.office !== office.value)) return fail(400, "Those to-dos are for a different office.");
    todos = [...record.todos.filter((todo) => todo.office !== office.value), ...parsed.value];
  }
  return { ok: true, value: { ...record, calendar, todos } };
}

function notePatch(record: OfficeRecord, body: Record<string, unknown>): OfficeResult<OfficeRecord> {
  const actor = idOf(body.actor, "actor");
  if (!actor.ok) return actor;
  if (!Array.isArray(body.notes) || body.notes.length === 0) return fail(400, "notes must list at least one note.");
  const roster = new Set(record.bots.map((bot) => bot.id));
  if (!roster.has(actor.value)) return fail(403, "That bot is not on the office roster.");
  const notes = record.notes.map((note) => ({ ...note }));
  const byId = new Map(notes.map((note) => [note.id, note]));
  const canStatus = actor.value === "kash" || actor.value === record.hqBotId;
  for (const item of body.notes) {
    if (!isRecord(item)) return fail(400, "Each note patch must be an object.");
    if (typeof item.id === "string" && byId.has(item.id)) {
      const keys = Object.keys(item).filter((key) => key !== "id");
      if (keys.length !== 1 || keys[0] !== "status") return fail(400, "An existing note can only change status, and only Kash Bot can do that.");
      if (!canStatus) return fail(403, "Only Kash Bot can change a note's status.");
      if (typeof item.status !== "string" || !NOTE_STATUSES.includes(item.status as NoteStatus)) {
        return fail(400, "note status must be new, with_kash, approved_to_show, or held.");
      }
      const existing = byId.get(item.id);
      if (existing) existing.status = item.status as NoteStatus;
      continue;
    }
    if (item.status !== undefined && item.status !== "new") return fail(403, "A new note starts as new. Kash Bot sets the later status.");
    const office = officeKey(item.office);
    if (!office.ok) return office;
    const date = text(item.date, "note date", 40);
    if (!date.ok) return date;
    const idea = text(item.idea, "note idea");
    if (!idea.ok) return idea;
    const whyNow = text(item.whyNow, "why now");
    if (!whyNow.ok) return whyNow;
    const id = item.id === undefined ? { ok: true as const, value: `note-${crypto.randomUUID()}` } : idOf(item.id, "note id");
    if (!id.ok) return id;
    if (byId.has(id.value)) return fail(400, "That note id is already on the board.");
    const created: OfficeNote = {
      id: id.value,
      office: office.value,
      date: date.value,
      bot: actor.value,
      idea: idea.value,
      whyNow: whyNow.value,
      status: "new",
    };
    notes.push(created);
    byId.set(created.id, created);
  }
  return { ok: true, value: { ...record, notes } };
}

/** Manager calendar/to-do writes, Kash note status, bot task/room updates, or a dropped note. */
export function applyOfficeWrite(record: OfficeRecord, body: unknown): OfficeResult<OfficeRecord> {
  if (!isRecord(body)) return fail(400, "Expected a JSON object.");
  const keys = Object.keys(body);
  if (keys.includes("achievements") || keys.includes("sections") || keys.includes("locked")) {
    return fail(400, "Send a full snapshot with POST to replace wings, wins, or the whole office.");
  }
  const modes = [keys.includes("bots"), keys.includes("calendar") || keys.includes("todos"), keys.includes("notes")].filter(Boolean);
  if (modes.length !== 1) return fail(400, "Send bots, a wing calendar or to-do list, or notes. Not more than one.");
  if (keys.includes("bots")) return botPatch(record, body);
  if (keys.includes("notes")) return notePatch(record, body);
  return boardPatch(record, body);
}

export function officeText(record: OfficeRecord) {
  return JSON.stringify(record);
}

export function officeStatusDocument(record: OfficeRecord, updatedAt: string | null) {
  const xp = teamXp(record.achievements);
  const into = xp % TEAM_LEVEL_XP;
  return {
    updatedAt,
    snapshot: OFFICE_SNAPSHOT,
    pollMs: OFFICE_POLL_MS,
    sections: record.sections,
    hqBotId: record.hqBotId,
    offices: OFFICE_KEYS.map((id) => ({ id, label: OFFICE_LABEL[id] })),
    bots: record.bots.map((bot) => {
      const xpForBot = botXp(bot.id, record.achievements);
      return {
        ...bot,
        chatHref: chatHrefFor(bot.chatId),
        xp: xpForBot,
        level: Math.floor(xpForBot / BOT_LEVEL_XP) + 1,
        intoLevel: xpForBot % BOT_LEVEL_XP,
        badges: record.achievements.filter((achievement) => achievement.credit.includes(bot.id)).map((achievement) => ({
          icon: achievement.icon,
          title: achievement.title,
        })),
        statusLabel: STATUS_LABEL[bot.status],
      };
    }),
    calendar: record.calendar,
    todos: record.todos,
    notes: record.notes,
    achievements: record.achievements,
    locked: record.locked,
    topics: OFFICE_TOPICS,
    team: {
      xp,
      level: teamLevel(xp),
      intoLevel: into,
      levelSize: TEAM_LEVEL_XP,
      toNext: TEAM_LEVEL_XP - into || TEAM_LEVEL_XP,
    },
    botLevelSize: BOT_LEVEL_XP,
  };
}

export type OfficeStatusResponse = ReturnType<typeof officeStatusDocument>;
