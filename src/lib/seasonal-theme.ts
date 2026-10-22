/**
 * Seasonal themes for mommamari.com and the creator portal.
 * The year's dates, preview flags, and neutral gaps live in seasonal-calendar.ts.
 * Halloween is the only theme the clock turns on. Other themes are preview-only.
 * Readable text sits on that theme's dark glass, not on the raw illustration.
 */

import {
  SEASONAL_CALENDAR,
  THEME_LOOK,
  type SeasonalPalette,
  type SeasonalThemeId,
  type ThemeGlass,
} from "@/lib/seasonal-calendar";

export {
  SCENE_INK,
  SEASONAL_CALENDAR,
  SEASONAL_PREVIEW_PARAM,
  THEME_LOOK,
  type CalendarEntry,
  type SeasonalThemeId,
} from "@/lib/seasonal-calendar";

export const SEASONAL_TIME_ZONE = "America/New_York";

export const THEME_OFF_COOKIE = "mm_theme_off";

export type { SeasonalPalette, ThemeGlass };

export type SeasonalTheme = {
  id: SeasonalThemeId;
  name: string;
  /** Inclusive start, America/New_York wall clock, YYYY-MM-DDTHH:mm:ss. */
  start: string;
  /** Inclusive end, America/New_York wall clock, YYYY-MM-DDTHH:mm:ss. */
  end: string;
  /** True when the clock must not paint this theme. See `?mm_preview=`. */
  preview: boolean;
  /** Kept for older callers. Drafted scenes are not placeholders. */
  placeholder: boolean;
  greeting: string;
  night: boolean;
  palette: SeasonalPalette;
  glass: ThemeGlass;
  scenes: { site: string; portal: string; mobile: string };
};

export const SEASONAL_THEMES: readonly SeasonalTheme[] = SEASONAL_CALENDAR.flatMap((entry) => {
  if (entry.kind !== "theme") return [];
  const look = THEME_LOOK[entry.id as SeasonalThemeId];
  return [{
    id: entry.id as SeasonalThemeId,
    name: entry.name,
    start: entry.start,
    end: entry.end,
    preview: entry.preview,
    placeholder: false,
    greeting: look.greeting,
    night: look.night,
    palette: look.palette,
    glass: look.glass,
    scenes: look.scenes,
  }];
});

/** Owner override can follow the clock, turn themes off, or force Halloween. It cannot publish a preview. */
export type ThemeOverride = "auto" | "none" | "halloween";

export type SeasonalSurface = "site" | "portal";

export type FloaterKind = "ghost" | "bat" | "leaf" | "star" | "flake" | "spark" | "heart" | "clover" | "petal" | "burst" | "apple" | "dreidel";

export type ThemeFloater = {
  theme: SeasonalThemeId;
  kind: FloaterKind;
  surface: SeasonalSurface;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
  /** Each letter is a different parallax path. */
  drift: "a" | "b" | "c";
};

export type HalloweenFloater = Omit<ThemeFloater, "theme">;

/**
 * Characters that float across the whole scene, in front of the illustration
 * and behind the glass panels. The portal cast is a different arrangement.
 */
export const THEME_FLOATERS: readonly ThemeFloater[] = [
  { theme: "halloween", kind: "ghost", surface: "site", top: "14%", left: "12%", size: 120, duration: "22s", delay: "0s", drift: "a" },
  { theme: "halloween", kind: "ghost", surface: "site", top: "30%", left: "58%", size: 88, duration: "26s", delay: "-8s", drift: "b" },
  { theme: "halloween", kind: "bat", surface: "site", top: "10%", left: "36%", size: 56, duration: "18s", delay: "-4s", drift: "c" },
  { theme: "halloween", kind: "bat", surface: "site", top: "22%", left: "78%", size: 44, duration: "24s", delay: "-12s", drift: "a" },
  { theme: "halloween", kind: "ghost", surface: "site", top: "46%", left: "82%", size: 54, duration: "28s", delay: "-6s", drift: "c" },
  { theme: "halloween", kind: "ghost", surface: "portal", top: "90%", left: "34%", size: 108, duration: "24s", delay: "-3s", drift: "b" },
  { theme: "halloween", kind: "bat", surface: "portal", top: "8%", left: "62%", size: 48, duration: "20s", delay: "-9s", drift: "a" },
  { theme: "halloween", kind: "bat", surface: "portal", top: "28%", left: "22%", size: 40, duration: "27s", delay: "-5s", drift: "c" },
  { theme: "halloween", kind: "ghost", surface: "portal", top: "86%", left: "72%", size: 60, duration: "30s", delay: "-14s", drift: "a" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "6%", left: "10%", size: 58, duration: "22s", delay: "0s", drift: "a" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "14%", left: "28%", size: 36, duration: "26s", delay: "-4s", drift: "b" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "8%", left: "48%", size: 28, duration: "20s", delay: "-8s", drift: "c" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "18%", left: "66%", size: 44, duration: "24s", delay: "-2s", drift: "a" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "12%", left: "84%", size: 34, duration: "28s", delay: "-11s", drift: "b" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "28%", left: "16%", size: 40, duration: "22s", delay: "-6s", drift: "c" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "32%", left: "42%", size: 26, duration: "30s", delay: "-14s", drift: "a" },
  { theme: "thanksgiving", kind: "leaf", surface: "site", top: "24%", left: "74%", size: 32, duration: "26s", delay: "-1s", drift: "b" },
  { theme: "thanksgiving", kind: "leaf", surface: "portal", top: "8%", left: "72%", size: 52, duration: "24s", delay: "-3s", drift: "b" },
  { theme: "thanksgiving", kind: "leaf", surface: "portal", top: "16%", left: "22%", size: 34, duration: "28s", delay: "-9s", drift: "a" },
  { theme: "thanksgiving", kind: "leaf", surface: "portal", top: "26%", left: "48%", size: 28, duration: "22s", delay: "-5s", drift: "c" },
  { theme: "thanksgiving", kind: "leaf", surface: "portal", top: "12%", left: "88%", size: 40, duration: "26s", delay: "-12s", drift: "a" },
  { theme: "thanksgiving", kind: "leaf", surface: "portal", top: "30%", left: "64%", size: 36, duration: "20s", delay: "-2s", drift: "b" },
  { theme: "thanksgiving", kind: "leaf", surface: "portal", top: "20%", left: "8%", size: 30, duration: "30s", delay: "-7s", drift: "c" },
  { theme: "hanukkah", kind: "star", surface: "site", top: "8%", left: "18%", size: 42, duration: "24s", delay: "0s", drift: "a" },
  { theme: "hanukkah", kind: "dreidel", surface: "site", top: "18%", left: "72%", size: 54, duration: "26s", delay: "-7s", drift: "c" },
  { theme: "hanukkah", kind: "spark", surface: "site", top: "6%", left: "48%", size: 20, duration: "20s", delay: "-3s", drift: "b" },
  { theme: "hanukkah", kind: "star", surface: "site", top: "28%", left: "30%", size: 28, duration: "28s", delay: "-11s", drift: "a" },
  { theme: "hanukkah", kind: "dreidel", surface: "site", top: "14%", left: "88%", size: 40, duration: "22s", delay: "-5s", drift: "b" },
  { theme: "hanukkah", kind: "spark", surface: "site", top: "34%", left: "60%", size: 16, duration: "24s", delay: "-9s", drift: "c" },
  { theme: "hanukkah", kind: "dreidel", surface: "portal", top: "16%", left: "18%", size: 48, duration: "26s", delay: "-4s", drift: "b" },
  { theme: "hanukkah", kind: "star", surface: "portal", top: "8%", left: "62%", size: 34, duration: "22s", delay: "-2s", drift: "a" },
  { theme: "hanukkah", kind: "spark", surface: "portal", top: "22%", left: "40%", size: 18, duration: "28s", delay: "-8s", drift: "c" },
  { theme: "hanukkah", kind: "star", surface: "portal", top: "30%", left: "78%", size: 26, duration: "24s", delay: "-6s", drift: "b" },
  { theme: "hanukkah", kind: "spark", surface: "portal", top: "10%", left: "28%", size: 16, duration: "20s", delay: "-1s", drift: "a" },
  { theme: "christmas", kind: "flake", surface: "site", top: "6%", left: "14%", size: 34, duration: "20s", delay: "0s", drift: "a" },
  { theme: "christmas", kind: "flake", surface: "site", top: "16%", left: "70%", size: 26, duration: "26s", delay: "-8s", drift: "c" },
  { theme: "christmas", kind: "flake", surface: "site", top: "28%", left: "36%", size: 22, duration: "24s", delay: "-4s", drift: "b" },
  { theme: "christmas", kind: "flake", surface: "site", top: "10%", left: "88%", size: 30, duration: "28s", delay: "-12s", drift: "a" },
  { theme: "christmas", kind: "flake", surface: "site", top: "34%", left: "56%", size: 18, duration: "22s", delay: "-2s", drift: "c" },
  { theme: "christmas", kind: "flake", surface: "portal", top: "8%", left: "40%", size: 32, duration: "22s", delay: "-6s", drift: "b" },
  { theme: "christmas", kind: "flake", surface: "portal", top: "22%", left: "16%", size: 22, duration: "28s", delay: "-3s", drift: "a" },
  { theme: "christmas", kind: "flake", surface: "portal", top: "14%", left: "78%", size: 28, duration: "24s", delay: "-9s", drift: "c" },
  { theme: "christmas", kind: "flake", surface: "portal", top: "32%", left: "58%", size: 18, duration: "26s", delay: "-1s", drift: "b" },
  { theme: "new-year", kind: "spark", surface: "site", top: "8%", left: "12%", size: 36, duration: "18s", delay: "0s", drift: "a" },
  { theme: "new-year", kind: "burst", surface: "site", top: "14%", left: "62%", size: 44, duration: "24s", delay: "-6s", drift: "c" },
  { theme: "new-year", kind: "spark", surface: "site", top: "26%", left: "34%", size: 22, duration: "22s", delay: "-3s", drift: "b" },
  { theme: "new-year", kind: "burst", surface: "site", top: "10%", left: "84%", size: 30, duration: "28s", delay: "-11s", drift: "a" },
  { theme: "new-year", kind: "spark", surface: "site", top: "32%", left: "48%", size: 18, duration: "20s", delay: "-2s", drift: "c" },
  { theme: "new-year", kind: "burst", surface: "portal", top: "12%", left: "28%", size: 40, duration: "22s", delay: "-5s", drift: "b" },
  { theme: "new-year", kind: "spark", surface: "portal", top: "22%", left: "72%", size: 24, duration: "26s", delay: "-8s", drift: "a" },
  { theme: "new-year", kind: "spark", surface: "portal", top: "8%", left: "50%", size: 20, duration: "20s", delay: "-1s", drift: "c" },
  { theme: "new-year", kind: "burst", surface: "portal", top: "30%", left: "16%", size: 28, duration: "28s", delay: "-10s", drift: "b" },
  { theme: "valentines", kind: "heart", surface: "site", top: "10%", left: "14%", size: 52, duration: "22s", delay: "0s", drift: "a" },
  { theme: "valentines", kind: "heart", surface: "site", top: "22%", left: "76%", size: 36, duration: "26s", delay: "-7s", drift: "c" },
  { theme: "valentines", kind: "petal", surface: "site", top: "8%", left: "48%", size: 28, duration: "24s", delay: "-3s", drift: "b" },
  { theme: "valentines", kind: "heart", surface: "site", top: "30%", left: "28%", size: 30, duration: "28s", delay: "-12s", drift: "a" },
  { theme: "valentines", kind: "petal", surface: "site", top: "18%", left: "62%", size: 22, duration: "20s", delay: "-5s", drift: "c" },
  { theme: "valentines", kind: "heart", surface: "portal", top: "12%", left: "58%", size: 46, duration: "24s", delay: "-4s", drift: "b" },
  { theme: "valentines", kind: "petal", surface: "portal", top: "20%", left: "18%", size: 26, duration: "28s", delay: "-9s", drift: "a" },
  { theme: "valentines", kind: "heart", surface: "portal", top: "8%", left: "34%", size: 32, duration: "22s", delay: "-2s", drift: "c" },
  { theme: "valentines", kind: "petal", surface: "portal", top: "32%", left: "78%", size: 24, duration: "26s", delay: "-7s", drift: "b" },
  { theme: "st-patricks", kind: "clover", surface: "site", top: "12%", left: "16%", size: 48, duration: "22s", delay: "0s", drift: "a" },
  { theme: "st-patricks", kind: "clover", surface: "site", top: "24%", left: "74%", size: 34, duration: "26s", delay: "-6s", drift: "c" },
  { theme: "st-patricks", kind: "clover", surface: "site", top: "8%", left: "46%", size: 26, duration: "20s", delay: "-2s", drift: "b" },
  { theme: "st-patricks", kind: "clover", surface: "site", top: "30%", left: "28%", size: 30, duration: "28s", delay: "-10s", drift: "a" },
  { theme: "st-patricks", kind: "clover", surface: "site", top: "18%", left: "88%", size: 22, duration: "24s", delay: "-4s", drift: "c" },
  { theme: "st-patricks", kind: "clover", surface: "portal", top: "14%", left: "62%", size: 42, duration: "24s", delay: "-5s", drift: "b" },
  { theme: "st-patricks", kind: "clover", surface: "portal", top: "26%", left: "20%", size: 30, duration: "28s", delay: "-8s", drift: "a" },
  { theme: "st-patricks", kind: "clover", surface: "portal", top: "8%", left: "40%", size: 24, duration: "22s", delay: "-1s", drift: "c" },
  { theme: "st-patricks", kind: "clover", surface: "portal", top: "32%", left: "82%", size: 28, duration: "26s", delay: "-11s", drift: "b" },
  { theme: "easter", kind: "petal", surface: "site", top: "10%", left: "18%", size: 36, duration: "22s", delay: "0s", drift: "a" },
  { theme: "easter", kind: "petal", surface: "site", top: "22%", left: "72%", size: 26, duration: "26s", delay: "-5s", drift: "c" },
  { theme: "easter", kind: "petal", surface: "site", top: "8%", left: "48%", size: 22, duration: "20s", delay: "-9s", drift: "b" },
  { theme: "easter", kind: "petal", surface: "site", top: "30%", left: "30%", size: 28, duration: "28s", delay: "-3s", drift: "a" },
  { theme: "easter", kind: "petal", surface: "site", top: "16%", left: "86%", size: 20, duration: "24s", delay: "-7s", drift: "c" },
  { theme: "easter", kind: "petal", surface: "portal", top: "12%", left: "24%", size: 34, duration: "22s", delay: "-4s", drift: "b" },
  { theme: "easter", kind: "petal", surface: "portal", top: "26%", left: "66%", size: 24, duration: "28s", delay: "-8s", drift: "a" },
  { theme: "easter", kind: "petal", surface: "portal", top: "8%", left: "48%", size: 20, duration: "20s", delay: "-2s", drift: "c" },
  { theme: "easter", kind: "petal", surface: "portal", top: "34%", left: "16%", size: 28, duration: "26s", delay: "-10s", drift: "b" },
  { theme: "mothers-day", kind: "petal", surface: "site", top: "10%", left: "16%", size: 40, duration: "22s", delay: "0s", drift: "a" },
  { theme: "mothers-day", kind: "heart", surface: "site", top: "20%", left: "76%", size: 34, duration: "26s", delay: "-6s", drift: "c" },
  { theme: "mothers-day", kind: "petal", surface: "site", top: "8%", left: "44%", size: 24, duration: "20s", delay: "-2s", drift: "b" },
  { theme: "mothers-day", kind: "petal", surface: "site", top: "28%", left: "28%", size: 30, duration: "28s", delay: "-11s", drift: "a" },
  { theme: "mothers-day", kind: "heart", surface: "site", top: "16%", left: "60%", size: 22, duration: "24s", delay: "-4s", drift: "c" },
  { theme: "mothers-day", kind: "heart", surface: "portal", top: "12%", left: "70%", size: 36, duration: "24s", delay: "-5s", drift: "b" },
  { theme: "mothers-day", kind: "petal", surface: "portal", top: "24%", left: "22%", size: 28, duration: "28s", delay: "-9s", drift: "a" },
  { theme: "mothers-day", kind: "petal", surface: "portal", top: "8%", left: "40%", size: 22, duration: "22s", delay: "-2s", drift: "c" },
  { theme: "mothers-day", kind: "heart", surface: "portal", top: "32%", left: "54%", size: 26, duration: "26s", delay: "-7s", drift: "b" },
  { theme: "fathers-day", kind: "leaf", surface: "site", top: "10%", left: "18%", size: 44, duration: "22s", delay: "0s", drift: "a" },
  { theme: "fathers-day", kind: "spark", surface: "site", top: "22%", left: "64%", size: 22, duration: "18s", delay: "-6s", drift: "c" },
  { theme: "fathers-day", kind: "leaf", surface: "site", top: "8%", left: "42%", size: 30, duration: "26s", delay: "-3s", drift: "b" },
  { theme: "fathers-day", kind: "leaf", surface: "site", top: "28%", left: "82%", size: 36, duration: "28s", delay: "-10s", drift: "a" },
  { theme: "fathers-day", kind: "spark", surface: "site", top: "34%", left: "30%", size: 18, duration: "20s", delay: "-2s", drift: "c" },
  { theme: "fathers-day", kind: "spark", surface: "portal", top: "18%", left: "16%", size: 24, duration: "20s", delay: "-4s", drift: "b" },
  { theme: "fathers-day", kind: "leaf", surface: "portal", top: "12%", left: "72%", size: 40, duration: "26s", delay: "-8s", drift: "a" },
  { theme: "fathers-day", kind: "leaf", surface: "portal", top: "28%", left: "40%", size: 28, duration: "24s", delay: "-1s", drift: "c" },
  { theme: "fathers-day", kind: "spark", surface: "portal", top: "8%", left: "28%", size: 18, duration: "22s", delay: "-11s", drift: "b" },
  { theme: "summer", kind: "burst", surface: "site", top: "8%", left: "16%", size: 48, duration: "20s", delay: "0s", drift: "a" },
  { theme: "summer", kind: "spark", surface: "site", top: "18%", left: "58%", size: 24, duration: "24s", delay: "-6s", drift: "c" },
  { theme: "summer", kind: "burst", surface: "site", top: "12%", left: "82%", size: 36, duration: "28s", delay: "-2s", drift: "b" },
  { theme: "summer", kind: "spark", surface: "site", top: "28%", left: "34%", size: 20, duration: "22s", delay: "-9s", drift: "a" },
  { theme: "summer", kind: "burst", surface: "site", top: "6%", left: "46%", size: 28, duration: "26s", delay: "-4s", drift: "c" },
  { theme: "summer", kind: "burst", surface: "portal", top: "10%", left: "74%", size: 46, duration: "22s", delay: "-5s", drift: "b" },
  { theme: "summer", kind: "spark", surface: "portal", top: "20%", left: "22%", size: 22, duration: "26s", delay: "-8s", drift: "a" },
  { theme: "summer", kind: "burst", surface: "portal", top: "8%", left: "46%", size: 30, duration: "20s", delay: "-1s", drift: "c" },
  { theme: "summer", kind: "spark", surface: "portal", top: "30%", left: "60%", size: 18, duration: "28s", delay: "-10s", drift: "b" },
  { theme: "back-to-school", kind: "leaf", surface: "site", top: "8%", left: "14%", size: 52, duration: "22s", delay: "0s", drift: "a" },
  { theme: "back-to-school", kind: "apple", surface: "site", top: "20%", left: "70%", size: 36, duration: "26s", delay: "-6s", drift: "c" },
  { theme: "back-to-school", kind: "leaf", surface: "site", top: "12%", left: "42%", size: 30, duration: "24s", delay: "-3s", drift: "b" },
  { theme: "back-to-school", kind: "leaf", surface: "site", top: "28%", left: "84%", size: 40, duration: "28s", delay: "-11s", drift: "a" },
  { theme: "back-to-school", kind: "apple", surface: "site", top: "32%", left: "24%", size: 26, duration: "20s", delay: "-2s", drift: "c" },
  { theme: "back-to-school", kind: "apple", surface: "portal", top: "16%", left: "26%", size: 34, duration: "24s", delay: "-7s", drift: "b" },
  { theme: "back-to-school", kind: "leaf", surface: "portal", top: "10%", left: "64%", size: 46, duration: "28s", delay: "-3s", drift: "a" },
  { theme: "back-to-school", kind: "leaf", surface: "portal", top: "26%", left: "82%", size: 28, duration: "22s", delay: "-9s", drift: "c" },
  { theme: "back-to-school", kind: "apple", surface: "portal", top: "8%", left: "40%", size: 24, duration: "26s", delay: "-1s", drift: "b" },
];

export const HALLOWEEN_FLOATERS: readonly HalloweenFloater[] = THEME_FLOATERS.flatMap((item) => (
  item.theme === "halloween"
    ? [{ kind: item.kind, surface: item.surface, top: item.top, left: item.left, size: item.size, duration: item.duration, delay: item.delay, drift: item.drift }]
    : []
));

export type ThemeGlow = {
  theme: SeasonalThemeId;
  surface: SeasonalSurface;
  top: string;
  left: string;
  size: number;
  delay: string;
};

export type HalloweenLantern = Omit<ThemeGlow, "theme">;

/** Soft glows parked over lanterns, candles, and sparklers. Site and portal differ. */
export const THEME_GLOWS: readonly ThemeGlow[] = [
  { theme: "halloween", surface: "site", top: "62%", left: "74%", size: 150, delay: "0s" },
  { theme: "halloween", surface: "site", top: "70%", left: "86%", size: 110, delay: "-0.8s" },
  { theme: "halloween", surface: "portal", top: "88%", left: "28%", size: 140, delay: "-0.4s" },
  { theme: "halloween", surface: "portal", top: "92%", left: "70%", size: 100, delay: "-1.3s" },
  { theme: "thanksgiving", surface: "site", top: "70%", left: "60%", size: 110, delay: "0s" },
  { theme: "thanksgiving", surface: "site", top: "72%", left: "64%", size: 80, delay: "-0.9s" },
  { theme: "thanksgiving", surface: "portal", top: "72%", left: "22%", size: 100, delay: "-0.4s" },
  { theme: "hanukkah", surface: "site", top: "36%", left: "50%", size: 180, delay: "0s" },
  { theme: "hanukkah", surface: "site", top: "38%", left: "12%", size: 90, delay: "-1.1s" },
  { theme: "hanukkah", surface: "portal", top: "42%", left: "74%", size: 170, delay: "-0.6s" },
  { theme: "christmas", surface: "site", top: "52%", left: "82%", size: 140, delay: "0s" },
  { theme: "christmas", surface: "site", top: "48%", left: "18%", size: 100, delay: "-0.9s" },
  { theme: "christmas", surface: "portal", top: "46%", left: "16%", size: 130, delay: "-0.5s" },
  { theme: "christmas", surface: "portal", top: "60%", left: "56%", size: 90, delay: "-1.2s" },
  { theme: "new-year", surface: "site", top: "16%", left: "16%", size: 150, delay: "0s" },
  { theme: "new-year", surface: "site", top: "14%", left: "72%", size: 130, delay: "-0.7s" },
  { theme: "new-year", surface: "portal", top: "14%", left: "14%", size: 140, delay: "-0.4s" },
  { theme: "new-year", surface: "portal", top: "12%", left: "82%", size: 120, delay: "-1.1s" },
  { theme: "valentines", surface: "site", top: "46%", left: "78%", size: 100, delay: "0s" },
  { theme: "valentines", surface: "portal", top: "38%", left: "72%", size: 110, delay: "-0.6s" },
  { theme: "fathers-day", surface: "site", top: "62%", left: "60%", size: 120, delay: "0s" },
  { theme: "fathers-day", surface: "portal", top: "52%", left: "14%", size: 110, delay: "-0.8s" },
  { theme: "summer", surface: "site", top: "14%", left: "14%", size: 150, delay: "0s" },
  { theme: "summer", surface: "site", top: "12%", left: "74%", size: 160, delay: "-0.9s" },
  { theme: "summer", surface: "portal", top: "12%", left: "74%", size: 150, delay: "-0.5s" },
  { theme: "summer", surface: "portal", top: "10%", left: "16%", size: 100, delay: "-1.2s" },
  { theme: "back-to-school", surface: "site", top: "42%", left: "32%", size: 100, delay: "0s" },
  { theme: "back-to-school", surface: "portal", top: "40%", left: "78%", size: 90, delay: "-0.7s" },
];

export const HALLOWEEN_LANTERNS: readonly HalloweenLantern[] = THEME_GLOWS.flatMap((item) => (
  item.theme === "halloween"
    ? [{ surface: item.surface, top: item.top, left: item.left, size: item.size, delay: item.delay }]
    : []
));

const SEASONAL_SITE_PATHS = [
  "/services",
  "/packages",
  "/roster",
  "/meet",
  "/work",
  "/our-standard",
  "/inquire",
  "/apply",
  "/apply/thanks",
  "/gift-guide",
  "/privacy",
  "/terms",
] as const;

/** Public marketing pages use the site cast. The creator portal uses the quieter one. */
export function seasonalSurface(pathname: string, basePath = ""): SeasonalSurface {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const stripped = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const path = (stripped.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (path.startsWith("/brand-report/")) return "site";
  if (path.startsWith("/brand-recap/")) return "site";
  if (path === "/pricing" || path === "/pricing/preview") return "site";
  if ((SEASONAL_SITE_PATHS as readonly string[]).includes(path)) return "site";
  return "portal";
}

const THEME_ERRORS = {
  role: "Only the owner can change the seasonal theme.",
  choice: "Choose a theme, or none.",
} as const;

export function themeErrorCode(error: string) {
  if (error === THEME_ERRORS.role) return "role";
  if (error === THEME_ERRORS.choice) return "choice";
  return "1";
}

export function themeErrorNote(code: string | undefined) {
  if (code === "role") return THEME_ERRORS.role;
  if (code === "choice") return THEME_ERRORS.choice;
  if (!code) return null;
  return "That was not saved.";
}

export function themeById(id: string): SeasonalTheme | null {
  return SEASONAL_THEMES.find((theme) => theme.id === id) ?? null;
}

export function isThemeOverride(value: string): value is ThemeOverride {
  return value === "auto" || value === "none" || value === "halloween";
}

export function parseThemeOverride(value: string | null | undefined): ThemeOverride {
  if (value && isThemeOverride(value)) return value;
  return "auto";
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function wallClockParts(date: Date, timeZone = SEASONAL_TIME_ZONE): WallClock {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** A comparable key for a wall clock. This is not a UTC instant. */
export function wallClockKey(parts: WallClock) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;

export function parseThemeInstant(value: string) {
  const match = INSTANT.exec(value);
  if (!match) throw new Error(`Bad theme instant: ${value}`);
  return wallClockKey({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  });
}

export function themeCovers(theme: SeasonalTheme, now: Date) {
  const key = wallClockKey(wallClockParts(now));
  return key >= parseThemeInstant(theme.start) && key <= parseThemeInstant(theme.end);
}

/** Build a Date whose America/New_York wall clock matches `isoLocal`. */
export function dateInNewYork(isoLocal: string) {
  const match = INSTANT.exec(isoLocal);
  if (!match) throw new Error(`Bad theme instant: ${isoLocal}`);
  const target = parseThemeInstant(isoLocal);
  let utc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const key = wallClockKey(wallClockParts(new Date(utc)));
    const delta = target - key;
    if (delta === 0) return new Date(utc);
    utc += delta;
  }
  return new Date(utc);
}

export function parseDismissedThemes(value: string | null | undefined): SeasonalThemeId[] {
  if (!value) return [];
  const ids: SeasonalThemeId[] = [];
  for (const part of value.split(",")) {
    const theme = themeById(part.trim());
    if (theme && !ids.includes(theme.id)) ids.push(theme.id);
  }
  return ids;
}

/**
 * A `preview` id paints that drafted theme for this request only.
 * Admin "none" hides the live calendar. Forcing "halloween" shows it outside its dates.
 * Preview themes are ignored when the clock or the stored override asks for them.
 * A visitor's off switch hides the theme they turned off.
 */
export function selectSeasonalTheme(input: {
  now: Date;
  override?: string | null;
  dismissed?: readonly string[];
  preview?: string | null;
}): SeasonalTheme | null {
  if (input.preview) {
    const flagged = themeById(input.preview);
    if (flagged?.preview && !input.dismissed?.includes(flagged.id)) return flagged;
  }
  const override = parseThemeOverride(input.override);
  if (override === "none") return null;
  const theme = override === "auto"
    ? SEASONAL_THEMES.find((item) => !item.preview && themeCovers(item, input.now)) ?? null
    : themeById(override);
  if (!theme || theme.preview) return null;
  if (input.dismissed?.includes(theme.id)) return null;
  return theme;
}

export type SeasonalMotion = {
  /** CSS animation-play-state for the floating characters. */
  float: "paused" | "running";
  /** Cursor sparkle. Desktop only, and never when motion is reduced. */
  sparkle: boolean;
};

export function seasonalEffects(input: {
  reducedMotion: boolean;
  decorationsOn: boolean;
  finePointer: boolean;
}): SeasonalMotion {
  const moving = input.decorationsOn && !input.reducedMotion;
  return {
    float: moving ? "running" : "paused",
    sparkle: moving && input.finePointer,
  };
}

function channel(hex: string, start: number) {
  return Number.parseInt(hex.slice(start, start + 2), 16) / 255;
}

function linearize(value: number) {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string) {
  const normalized = hex.replace("#", "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((part) => part + part).join("")
    : normalized;
  const red = linearize(channel(expanded, 0));
  const green = linearize(channel(expanded, 2));
  const blue = linearize(channel(expanded, 4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Worst-case glass. `fill` at `alpha` is composited over a white scene pixel
 * (the moon). Text colors have to pass WCAG AA on that blend. Mobile uses a
 * higher alpha because it skips the blur.
 */
export const HALLOWEEN_GLASS = {
  fill: "#200E3A",
  scene: "#FFFFFF",
  alpha: 0.68,
  mobileAlpha: 0.84,
  ink: "#F7F1FF",
  muted: "#F0E4FF",
  heading: "#FFF6EA",
  link: "#FFE7C2",
  accent: "#FFD9A8",
} as const;

/** Opaque result of laying `foreground` over `background` at `alpha`. */
export function compositeHex(foreground: string, background: string, alpha: number) {
  const clean = (value: string) => value.replace("#", "");
  const fg = clean(foreground);
  const bg = clean(background);
  const mix = (index: number) => Math.round(
    Number.parseInt(fg.slice(index, index + 2), 16) * alpha
    + Number.parseInt(bg.slice(index, index + 2), 16) * (1 - alpha),
  );
  const hex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${hex(mix(0))}${hex(mix(2))}${hex(mix(4))}`;
}
