import { addDays, isIsoDate, type CalendarItem } from "./calendar";
import { agencyTimeZone } from "./format";
import { scrubMemberText } from "./member-profile";
import { findSafetyKinds } from "./safety-shared";

export type ScheduleEntry = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  source: "portal" | "google";
};

export type CalendarView = "week" | "month";

export function calendarView(value: string | undefined): CalendarView {
  return value === "month" ? "month" : "week";
}

export function todayIso(timeZone = agencyTimeZone(), now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${bag.year}-${bag.month}-${bag.day}`;
}

export function anchorDate(value: string | undefined, now = new Date()) {
  if (value && isIsoDate(value)) return value;
  return todayIso(agencyTimeZone(), now);
}

export function shiftAnchor(anchor: string, view: CalendarView, direction: -1 | 1) {
  if (view === "week") return addDays(anchor, direction * 7);
  const [year, month, day] = anchor.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + direction, 1));
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, last));
  return next.toISOString().slice(0, 10);
}

export function weekDates(anchor: string) {
  const [year, month, day] = anchor.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return Array.from({ length: 7 }, (_, index) => addDays(date.toISOString().slice(0, 10), index));
}

export function monthDates(anchor: string) {
  const [year, month] = anchor.split("-").map(Number);
  const first = `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const monthKey = first.slice(0, 7);
  const cells: { date: string; inMonth: boolean }[] = [];
  let cursor = weekDates(first)[0];
  for (let index = 0; index < 42; index += 1) {
    const inMonth = cursor.slice(0, 7) === monthKey;
    if (!inMonth && cells.some((cell) => cell.inMonth) && cells.length % 7 === 0) break;
    cells.push({ date: cursor, inMonth });
    cursor = addDays(cursor, 1);
  }
  return cells;
}

export function visibleSpan(anchor: string, view: CalendarView) {
  if (view === "week") {
    const days = weekDates(anchor);
    return { from: days[0], to: days[6] };
  }
  const cells = monthDates(anchor);
  return { from: cells[0].date, to: cells[cells.length - 1].date };
}

export function calendarEventTitle(summary: string) {
  const clean = scrubMemberText(summary).replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) return "Busy";
  if (findSafetyKinds({ caption: clean }).length > 0) return "Busy";
  return clean;
}

function zonedStamp(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${bag.year}-${bag.month}-${bag.day}`, time: `${bag.hour}:${bag.minute}` };
}

export type GoogleCalendarItem = {
  id?: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export function googleItemsToEntries(items: GoogleCalendarItem[], timeZone: string, span: { from: string; to: string }): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  items.forEach((item, index) => {
    if (item.status === "cancelled" || item.transparency === "transparent") return;
    const title = calendarEventTitle(item.summary ?? "");
    const id = item.id || `google-${index}`;
    if (item.start?.date) {
      const end = item.end?.date && isIsoDate(item.end.date) ? item.end.date : addDays(item.start.date, 1);
      let cursor = item.start.date;
      let guard = 0;
      while (cursor < end && guard < 62) {
        if (cursor >= span.from && cursor <= span.to) {
          entries.push({ id: `${id}-${cursor}`, date: cursor, time: null, title, source: "google" });
        }
        cursor = addDays(cursor, 1);
        guard += 1;
      }
      return;
    }
    if (!item.start?.dateTime) return;
    const start = zonedStamp(item.start.dateTime, timeZone);
    if (!start || start.date < span.from || start.date > span.to) return;
    const end = item.end?.dateTime ? zonedStamp(item.end.dateTime, timeZone) : null;
    entries.push({
      id,
      date: start.date,
      time: start.time,
      title,
      source: "google",
    });
    if (end && end.date > start.date && end.date <= span.to) {
      entries.push({ id: `${id}-end`, date: end.date, time: end.time, title, source: "google" });
    }
  });
  return entries;
}

export function portalItemsToEntries(items: CalendarItem[], span: { from: string; to: string }): ScheduleEntry[] {
  return items.flatMap((item) => {
    if (item.dueOn < span.from || item.dueOn > span.to) return [];
    const title = item.kind === "draft" ? `Draft due · ${item.brand}` : `Post due · ${item.brand}`;
    return [{ id: `portal-${item.id}`, date: item.dueOn, time: null, title, source: "portal" as const }];
  });
}

export function mergeSchedule(portal: ScheduleEntry[], google: ScheduleEntry[]) {
  return [...portal, ...google].sort((left, right) => {
    const date = left.date.localeCompare(right.date);
    if (date !== 0) return date;
    if (left.time === right.time) return left.title.localeCompare(right.title);
    if (!left.time) return -1;
    if (!right.time) return 1;
    return left.time.localeCompare(right.time);
  });
}

export function dayLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
