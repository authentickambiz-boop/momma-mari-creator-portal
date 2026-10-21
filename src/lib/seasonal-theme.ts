/**
 * Seasonal themes for mommamari.com and the creator portal.
 * Ranges are inclusive wall-clock times in America/New_York.
 * Placeholder themes ship a palette only, for the owner to fill in later.
 * Halloween is a full-viewport night scene. Its readable text sits on
 * translucent dark-purple glass (HALLOWEEN_GLASS), not on palette.page.
 * Other themes still put the existing dark text on palette.page.
 */

export const SEASONAL_TIME_ZONE = "America/New_York";

export const THEME_OFF_COOKIE = "mm_theme_off";

export type SeasonalThemeId = "halloween" | "thanksgiving" | "holiday" | "valentines" | "mothers-day";

export type SeasonalPalette = {
  /** Page fallback behind the scene. Halloween text does not sit on this. */
  page: string;
  /** Decoration only. Do not put text on these. */
  orange: string;
  purple: string;
  black: string;
  paper: string;
};

export type SeasonalTheme = {
  id: SeasonalThemeId;
  name: string;
  /** Inclusive start, America/New_York wall clock, YYYY-MM-DDTHH:mm:ss. */
  start: string;
  /** Inclusive end, America/New_York wall clock, YYYY-MM-DDTHH:mm:ss. */
  end: string;
  /** True until the owner replaces the placeholder palette and art. */
  placeholder: boolean;
  /** Shown on the creator home. Null until that theme has a real greeting. */
  greeting: string | null;
  palette: SeasonalPalette;
};

export const SEASONAL_THEMES: readonly SeasonalTheme[] = [
  {
    id: "halloween",
    name: "Halloween",
    start: "2026-10-01T00:00:00",
    end: "2026-11-01T23:59:59",
    placeholder: false,
    greeting: "Happy Halloween",
    palette: {
      page: "#120A1C",
      orange: "#E8873A",
      purple: "#6B46A3",
      black: "#1C1A1F",
      paper: "#FFF6EA",
    },
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    start: "2026-11-02T00:00:00",
    end: "2026-11-27T23:59:59",
    placeholder: true,
    greeting: null,
    palette: {
      page: "#FBF6EE",
      orange: "#E8C49A",
      purple: "#C4A882",
      black: "#3A342C",
      paper: "#FFF8EE",
    },
  },
  {
    id: "holiday",
    name: "Holiday",
    start: "2026-11-28T00:00:00",
    end: "2027-01-01T23:59:59",
    placeholder: true,
    greeting: null,
    palette: {
      page: "#F3F7F6",
      orange: "#E7D7B8",
      purple: "#C5D4DC",
      black: "#2C3336",
      paper: "#F7FBFA",
    },
  },
  {
    id: "valentines",
    name: "Valentine's",
    start: "2027-02-01T00:00:00",
    end: "2027-02-14T23:59:59",
    placeholder: true,
    greeting: null,
    palette: {
      page: "#FBF4F6",
      orange: "#F6D5DE",
      purple: "#E4C6D4",
      black: "#3A2C32",
      paper: "#FFF7F8",
    },
  },
  {
    id: "mothers-day",
    name: "Mother's Day",
    start: "2027-05-02T00:00:00",
    end: "2027-05-09T23:59:59",
    placeholder: true,
    greeting: null,
    palette: {
      page: "#F7F6F1",
      orange: "#F3D9C8",
      purple: "#D9C8E0",
      black: "#2E2A32",
      paper: "#F4F7F2",
    },
  },
];

export type ThemeOverride = "auto" | "none" | SeasonalThemeId;

export type SeasonalSurface = "site" | "portal";

export type HalloweenFloater = {
  kind: "ghost" | "bat";
  surface: SeasonalSurface;
  top: string;
  left: string;
  size: number;
  duration: string;
  delay: string;
  /** Each letter is a different parallax path. */
  drift: "a" | "b" | "c";
};

/**
 * Characters that float across the whole scene, in front of the illustration
 * and behind the glass panels. The portal cast is a different arrangement.
 */
export const HALLOWEEN_FLOATERS: readonly HalloweenFloater[] = [
  { kind: "ghost", surface: "site", top: "14%", left: "12%", size: 120, duration: "22s", delay: "0s", drift: "a" },
  { kind: "ghost", surface: "site", top: "30%", left: "58%", size: 88, duration: "26s", delay: "-8s", drift: "b" },
  { kind: "bat", surface: "site", top: "10%", left: "36%", size: 56, duration: "18s", delay: "-4s", drift: "c" },
  { kind: "bat", surface: "site", top: "22%", left: "78%", size: 44, duration: "24s", delay: "-12s", drift: "a" },
  { kind: "ghost", surface: "site", top: "46%", left: "82%", size: 54, duration: "28s", delay: "-6s", drift: "c" },
  { kind: "ghost", surface: "portal", top: "18%", left: "42%", size: 108, duration: "24s", delay: "-3s", drift: "b" },
  { kind: "bat", surface: "portal", top: "8%", left: "62%", size: 48, duration: "20s", delay: "-9s", drift: "a" },
  { kind: "bat", surface: "portal", top: "28%", left: "22%", size: 40, duration: "27s", delay: "-5s", drift: "c" },
  { kind: "ghost", surface: "portal", top: "40%", left: "70%", size: 60, duration: "30s", delay: "-14s", drift: "a" },
];

export type HalloweenLantern = {
  surface: SeasonalSurface;
  top: string;
  left: string;
  size: number;
  delay: string;
};

/** Soft glows parked over each scene's jack-o'-lanterns. */
export const HALLOWEEN_LANTERNS: readonly HalloweenLantern[] = [
  { surface: "site", top: "62%", left: "74%", size: 150, delay: "0s" },
  { surface: "site", top: "70%", left: "86%", size: 110, delay: "-0.8s" },
  { surface: "portal", top: "66%", left: "16%", size: 170, delay: "-0.4s" },
  { surface: "portal", top: "58%", left: "78%", size: 120, delay: "-1.3s" },
];

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
  return value === "auto" || value === "none" || themeById(value) !== null;
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
 * Admin "none" hides every theme.
 * A forced theme shows even outside its dates.
 * A user's off switch hides that one theme for them.
 * Otherwise the Eastern Time calendar picks the theme.
 */
export function selectSeasonalTheme(input: {
  now: Date;
  override?: string | null;
  dismissed?: readonly string[];
}): SeasonalTheme | null {
  const override = parseThemeOverride(input.override);
  if (override === "none") return null;
  const theme = override === "auto"
    ? SEASONAL_THEMES.find((item) => themeCovers(item, input.now)) ?? null
    : themeById(override);
  if (!theme) return null;
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
