/**
 * Hanukkah 2026 candle count.
 * The festival begins at sundown on Friday, December 4 and the eighth night
 * ends at nightfall on Saturday, December 12. Nights switch at 5:00 p.m.
 * America/New_York, which is close enough to sundown for this scene.
 *
 * Candles are placed from the viewer's right toward the left. They are lit
 * newest first: the shamash, then the leftmost new candle, then toward the right.
 * A review link can force a night with `?mm_night=N` (0 is the countdown).
 */

import { wallClockKey, wallClockParts } from "@/lib/seasonal-theme";

export const HANUKKAH_NIGHT_PARAM = "mm_night";

export const HANUKKAH_2026 = {
  year: 2026,
  month: 12,
  day: 4,
  /** Hour the next night's candles light. */
  sundownHour: 17,
  nights: 8,
} as const;

export type HanukkahCandle = {
  /** 1 is the first night's candle, on the viewer's right. 8 is the leftmost. */
  night: number;
  /** 0 is the viewer's left. 7 is the viewer's right. */
  fromLeft: number;
  lit: boolean;
  /** 0 catches first among the branch candles. Null when that branch is dark. */
  lightIndex: number | null;
};

export type HanukkahView = {
  /** 0 is the countdown, before the first sundown. 1–8 are the nights. */
  night: number;
  /** Whole calendar days until December 4. Null once a night is showing. */
  daysUntil: number | null;
  shamashLit: boolean;
  /** Left to right, shamash excluded. */
  candles: HanukkahCandle[];
  label: string;
};

type WallParts = ReturnType<typeof wallClockParts>;

function partsOf(now: Date): WallParts {
  return wallClockParts(now);
}

/** Calendar days from today's New York date until December 4, 2026. Never negative. */
export function daysUntilHanukkah(now: Date) {
  const parts = partsOf(now);
  const today = Date.UTC(parts.year, parts.month - 1, parts.day);
  const start = Date.UTC(HANUKKAH_2026.year, HANUKKAH_2026.month - 1, HANUKKAH_2026.day);
  return Math.max(0, Math.round((start - today) / 86_400_000));
}

/** Night from the clock alone. 0 before the first sundown, then 1–8. */
export function hanukkahNightFromClock(now: Date) {
  const parts = partsOf(now);
  const key = wallClockKey(parts);
  const first = wallClockKey({
    year: HANUKKAH_2026.year,
    month: HANUKKAH_2026.month,
    day: HANUKKAH_2026.day,
    hour: HANUKKAH_2026.sundownHour,
    minute: 0,
    second: 0,
  });
  if (key < first) return 0;
  const passed = Math.floor((key - first) / 86_400_000) + 1;
  return Math.min(HANUKKAH_2026.nights, passed);
}

/** `?mm_night=` accepts 0–8. Anything else is ignored. */
export function parseHanukkahNight(value: string | null | undefined): number | null {
  if (value == null || !/^[0-8]$/.test(value)) return null;
  return Number(value);
}

export function hanukkahLabel(night: number, daysUntil: number | null) {
  if (night <= 0) {
    const days = daysUntil ?? 0;
    if (days === 0) return "Hanukkah begins at sundown";
    if (days === 1) return "1 day until Hanukkah";
    return `${days} days until Hanukkah`;
  }
  if (night === 1) return "Night 1 · the shamash and one candle";
  return `Night ${night} · the shamash and ${night} candles`;
}

/**
 * Seconds after load before a flame catches.
 * The shamash is first, then the newest branch candle, then older ones to the right.
 */
export function hanukkahFlameDelay(lightIndex: number | "shamash") {
  if (lightIndex === "shamash") return 0.05;
  return 0.28 + lightIndex * 0.16;
}

function usableOverride(nightOverride: number | null | undefined) {
  if (nightOverride == null || !Number.isInteger(nightOverride)) return null;
  if (nightOverride < 0 || nightOverride > HANUKKAH_2026.nights) return null;
  return nightOverride;
}

export function hanukkahView(now: Date, nightOverride?: number | null): HanukkahView {
  const forced = usableOverride(nightOverride);
  const night = forced == null ? hanukkahNightFromClock(now) : forced;
  const daysUntil = night === 0 ? daysUntilHanukkah(now) : null;
  const candles: HanukkahCandle[] = [];
  for (let fromLeft = 0; fromLeft < HANUKKAH_2026.nights; fromLeft += 1) {
    const placedNight = HANUKKAH_2026.nights - fromLeft;
    const lit = night > 0 && placedNight <= night;
    candles.push({
      night: placedNight,
      fromLeft,
      lit,
      lightIndex: lit ? fromLeft - (HANUKKAH_2026.nights - night) : null,
    });
  }
  return {
    night,
    daysUntil,
    shamashLit: night > 0,
    candles,
    label: hanukkahLabel(night, daysUntil),
  };
}
