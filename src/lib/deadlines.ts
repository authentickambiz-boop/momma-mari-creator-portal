import { agencyTimeZone } from "./format";
import { getDealStage } from "./stages";

const DRAFT_SUBMITTED_ORDER = 16;

function isRealDay(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** True only when the text is YYYY-MM-DD and that day is not on the calendar. Other wording is left alone. */
export function isFakeCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  return !isRealDay(year, month, day);
}

export function uploadDueDate(postDate: string | null | undefined) {
  const match = postDate?.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealDay(year, month, day)) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() - 3);
  return utc.toISOString().slice(0, 10);
}

function calendarDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: agencyTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function addDays(isoDate: string, days: number) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** Reminder starts two days before the upload due date. Overdue is the day after it, until the draft is in. */
export function deadlineFlag(postDate: string | null | undefined, workflowStage: string | null | undefined, now = new Date()) {
  const due = uploadDueDate(postDate);
  if (!due) return "none" as const;
  const order = getDealStage(workflowStage)?.order;
  if (order != null && order >= DRAFT_SUBMITTED_ORDER) return "none" as const;
  const today = calendarDay(now);
  if (today > due) return "overdue" as const;
  if (today >= addDays(due, -2)) return "reminder" as const;
  return "none" as const;
}
