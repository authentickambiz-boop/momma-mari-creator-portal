/**
 * Seasonal calendar for mommamari.com and the creator portal.
 * Every range is an inclusive America/New_York wall clock (YYYY-MM-DDTHH:mm:ss).
 * Theme windows and the neutral default between them share this list.
 * They do not overlap, and each row starts the second after the previous row ends.
 *
 * Halloween is the only live theme. Every other theme is `preview: true`.
 * A preview theme paints only when that page is opened with `?mm_preview=<id>`.
 * The flag is not stored, and the public calendar does not turn those themes on.
 *
 * Hanukkah 2026 begins at sundown on Friday, December 4, 2026 and ends at
 * nightfall on Saturday, December 12, 2026 (eight nights). Christmas starts the
 * next calendar day, December 13, and runs through December 26. The two do not overlap.
 */

export const SEASONAL_PREVIEW_PARAM = "mm_preview";

export type SeasonalThemeId =
  | "halloween"
  | "thanksgiving"
  | "hanukkah"
  | "christmas"
  | "new-year"
  | "valentines"
  | "st-patricks"
  | "easter"
  | "mothers-day"
  | "fathers-day"
  | "summer"
  | "back-to-school";

export type CalendarKind = "theme" | "neutral";

export type CalendarEntry = {
  id: string;
  name: string;
  kind: CalendarKind;
  /** Inclusive start, America/New_York wall clock. */
  start: string;
  /** Inclusive end, America/New_York wall clock. */
  end: string;
  /**
   * Preview themes never paint from the clock. Live themes do.
   * Neutral rows are not themes, so this stays false.
   */
  preview: boolean;
  note: string;
};

export const SEASONAL_CALENDAR: readonly CalendarEntry[] = [
  {
    id: "halloween",
    name: "Halloween",
    kind: "theme",
    start: "2026-10-01T00:00:00",
    end: "2026-11-01T23:59:59",
    preview: false,
    note: "Live. Already on the site and the homepage through November 1, 2026.",
  },
  {
    id: "gap-after-halloween",
    name: "Neutral",
    kind: "neutral",
    start: "2026-11-02T00:00:00",
    end: "2026-11-19T23:59:59",
    preview: false,
    note: "Default. No scene between Halloween and Thanksgiving.",
  },
  {
    id: "thanksgiving",
    name: "Thanksgiving",
    kind: "theme",
    start: "2026-11-20T00:00:00",
    end: "2026-11-29T23:59:59",
    preview: true,
    note: "Thanksgiving Day is Thursday, November 26, 2026. Friday, November 20 through Sunday, November 29.",
  },
  {
    id: "gap-before-hanukkah",
    name: "Neutral",
    kind: "neutral",
    start: "2026-11-30T00:00:00",
    end: "2026-12-03T23:59:59",
    preview: false,
    note: "Default. No scene between Thanksgiving and Hanukkah.",
  },
  {
    id: "hanukkah",
    name: "Hanukkah",
    kind: "theme",
    start: "2026-12-04T00:00:00",
    end: "2026-12-12T23:59:59",
    preview: true,
    note: "Hanukkah 2026 begins at sundown Friday, December 4 and ends at nightfall Saturday, December 12 (eight nights). Preview only.",
  },
  {
    id: "christmas",
    name: "Christmas",
    kind: "theme",
    start: "2026-12-13T00:00:00",
    end: "2026-12-26T23:59:59",
    preview: true,
    note: "December 13, the day after Hanukkah, through December 26, 2026. Preview only until that window.",
  },
  {
    id: "gap-before-new-year",
    name: "Neutral",
    kind: "neutral",
    start: "2026-12-27T00:00:00",
    end: "2026-12-30T23:59:59",
    preview: false,
    note: "Default. No scene between Christmas and New Year's Eve.",
  },
  {
    id: "new-year",
    name: "New Year",
    kind: "theme",
    start: "2026-12-31T00:00:00",
    end: "2027-01-02T23:59:59",
    preview: true,
    note: "New Year's Eve 2026 through Sunday, January 2, 2027.",
  },
  {
    id: "gap-winter",
    name: "Neutral",
    kind: "neutral",
    start: "2027-01-03T00:00:00",
    end: "2027-02-07T23:59:59",
    preview: false,
    note: "Default. No scene through the rest of winter.",
  },
  {
    id: "valentines",
    name: "Valentine's Day",
    kind: "theme",
    start: "2027-02-08T00:00:00",
    end: "2027-02-15T23:59:59",
    preview: true,
    note: "Valentine's Day is Sunday, February 14, 2027. The Monday after is included.",
  },
  {
    id: "gap-before-patrick",
    name: "Neutral",
    kind: "neutral",
    start: "2027-02-16T00:00:00",
    end: "2027-03-09T23:59:59",
    preview: false,
    note: "Default. No scene between Valentine's Day and St. Patrick's Day.",
  },
  {
    id: "st-patricks",
    name: "St. Patrick's Day",
    kind: "theme",
    start: "2027-03-10T00:00:00",
    end: "2027-03-17T23:59:59",
    preview: true,
    note: "St. Patrick's Day is Wednesday, March 17, 2027.",
  },
  {
    id: "gap-before-easter",
    name: "Neutral",
    kind: "neutral",
    start: "2027-03-18T00:00:00",
    end: "2027-03-20T23:59:59",
    preview: false,
    note: "Default. No scene between St. Patrick's Day and Palm Sunday.",
  },
  {
    id: "easter",
    name: "Easter & Spring",
    kind: "theme",
    start: "2027-03-21T00:00:00",
    end: "2027-04-04T23:59:59",
    preview: true,
    note: "Easter Sunday is March 28, 2027. Palm Sunday, March 21, through the Sunday after, April 4.",
  },
  {
    id: "gap-spring",
    name: "Neutral",
    kind: "neutral",
    start: "2027-04-05T00:00:00",
    end: "2027-05-02T23:59:59",
    preview: false,
    note: "Default. No scene between spring and Mother's Day.",
  },
  {
    id: "mothers-day",
    name: "Mother's Day",
    kind: "theme",
    start: "2027-05-03T00:00:00",
    end: "2027-05-09T23:59:59",
    preview: true,
    note: "Mother's Day is Sunday, May 9, 2027.",
  },
  {
    id: "gap-before-fathers",
    name: "Neutral",
    kind: "neutral",
    start: "2027-05-10T00:00:00",
    end: "2027-06-13T23:59:59",
    preview: false,
    note: "Default. No scene between Mother's Day and Father's Day.",
  },
  {
    id: "fathers-day",
    name: "Father's Day",
    kind: "theme",
    start: "2027-06-14T00:00:00",
    end: "2027-06-20T23:59:59",
    preview: true,
    note: "Father's Day is Sunday, June 20, 2027.",
  },
  {
    id: "gap-before-summer",
    name: "Neutral",
    kind: "neutral",
    start: "2027-06-21T00:00:00",
    end: "2027-06-27T23:59:59",
    preview: false,
    note: "Default. No scene between Father's Day and the Fourth of July.",
  },
  {
    id: "summer",
    name: "Summer & Fourth of July",
    kind: "theme",
    start: "2027-06-28T00:00:00",
    end: "2027-07-05T23:59:59",
    preview: true,
    note: "The Fourth of July 2027 is a Sunday. The window runs through Monday, July 5.",
  },
  {
    id: "gap-midsummer",
    name: "Neutral",
    kind: "neutral",
    start: "2027-07-06T00:00:00",
    end: "2027-08-15T23:59:59",
    preview: false,
    note: "Default. No scene through the rest of summer.",
  },
  {
    id: "back-to-school",
    name: "Back to School & Fall",
    kind: "theme",
    start: "2027-08-16T00:00:00",
    end: "2027-09-30T23:59:59",
    preview: true,
    note: "Fall, from August 16 through September 30, 2027. October 1 is left open for the next Halloween decision.",
  },
];

export type SeasonalPalette = {
  page: string;
  orange: string;
  purple: string;
  black: string;
  paper: string;
};

export type ThemeGlass = {
  /** Opaque fill used for contrast math. */
  fill: string;
  /** CSS rgb channels of `fill`, without the alpha. */
  channels: string;
  pop: string;
  popInk: string;
  button: string;
  buttonHover: string;
};

/** Shared light ink. It has to pass WCAG AA on every theme's glass over white. */
export const SCENE_INK = {
  ink: "#F7F1FF",
  muted: "#F0E4FF",
  heading: "#FFF6EA",
  link: "#FFE7C2",
  accent: "#FFD9A8",
  alpha: 0.68,
  mobileAlpha: 0.84,
  scene: "#FFFFFF",
} as const;

export type ThemeLook = {
  greeting: string;
  /** Night scenes keep the moon and stars. Day scenes hide them. */
  night: boolean;
  palette: SeasonalPalette;
  glass: ThemeGlass;
  scenes: { site: string; portal: string; mobile: string };
};

export const THEME_LOOK: Record<SeasonalThemeId, ThemeLook> = {
  halloween: {
    greeting: "Happy Halloween",
    night: true,
    palette: { page: "#120A1C", orange: "#E8873A", purple: "#6B46A3", black: "#1C1A1F", paper: "#FFF6EA" },
    glass: { fill: "#200E3A", channels: "32, 14, 58", pop: "#E8873A", popInk: "#1C1A1F", button: "#3A2460", buttonHover: "#6B46A3" },
    scenes: { site: "halloween-site.svg", portal: "halloween-portal.svg", mobile: "halloween-mobile.svg" },
  },
  thanksgiving: {
    greeting: "Happy Thanksgiving",
    night: false,
    palette: { page: "#2A120A", orange: "#E09A3A", purple: "#8C4A1A", black: "#1C140E", paper: "#FFF6EA" },
    glass: { fill: "#2A120A", channels: "42, 18, 10", pop: "#E8873A", popInk: "#1C140E", button: "#6B3414", buttonHover: "#8C4A1A" },
    scenes: { site: "thanksgiving-site.svg", portal: "thanksgiving-portal.svg", mobile: "thanksgiving-mobile.svg" },
  },
  hanukkah: {
    greeting: "Happy Hanukkah",
    night: true,
    palette: { page: "#071428", orange: "#E2B657", purple: "#1A3E78", black: "#0C1424", paper: "#F7F1FF" },
    glass: { fill: "#0A1630", channels: "10, 22, 48", pop: "#E2B657", popInk: "#1C1A1F", button: "#16325C", buttonHover: "#24508C" },
    scenes: { site: "hanukkah-site.svg", portal: "hanukkah-portal.svg", mobile: "hanukkah-mobile.svg" },
  },
  christmas: {
    greeting: "Merry Christmas",
    night: true,
    palette: { page: "#07140E", orange: "#C4453A", purple: "#1E4A32", black: "#0C1812", paper: "#FFF6EA" },
    glass: { fill: "#081810", channels: "8, 24, 16", pop: "#C4453A", popInk: "#FFF6EA", button: "#164832", buttonHover: "#1E6A48" },
    scenes: { site: "christmas-site.svg", portal: "christmas-portal.svg", mobile: "christmas-mobile.svg" },
  },
  "new-year": {
    greeting: "Happy New Year",
    night: true,
    palette: { page: "#0A0814", orange: "#E2B657", purple: "#2A2450", black: "#100E1C", paper: "#FFF6EA" },
    glass: { fill: "#100E24", channels: "16, 14, 36", pop: "#E2B657", popInk: "#1C1A1F", button: "#2A2458", buttonHover: "#3E3680" },
    scenes: { site: "new-year-site.svg", portal: "new-year-portal.svg", mobile: "new-year-mobile.svg" },
  },
  valentines: {
    greeting: "Happy Valentine's Day",
    night: true,
    palette: { page: "#2A0C1C", orange: "#E7A0B4", purple: "#8A4060", black: "#1C1016", paper: "#FFF7F8" },
    glass: { fill: "#2A0C1C", channels: "42, 12, 28", pop: "#F4C7D4", popInk: "#2A0C1C", button: "#6A2844", buttonHover: "#8A4060" },
    scenes: { site: "valentines-site.svg", portal: "valentines-portal.svg", mobile: "valentines-mobile.svg" },
  },
  "st-patricks": {
    greeting: "Happy St. Patrick's Day",
    night: false,
    palette: { page: "#081C10", orange: "#F2C14E", purple: "#1E6A48", black: "#0C1812", paper: "#F4F7F2" },
    glass: { fill: "#081C10", channels: "8, 28, 16", pop: "#F2C14E", popInk: "#1C140E", button: "#145C34", buttonHover: "#1E6A48" },
    scenes: { site: "st-patricks-site.svg", portal: "st-patricks-portal.svg", mobile: "st-patricks-mobile.svg" },
  },
  easter: {
    greeting: "Happy Easter",
    night: false,
    palette: { page: "#121830", orange: "#F2C14E", purple: "#7FA0C8", black: "#1C140E", paper: "#FFF6EA" },
    glass: { fill: "#121830", channels: "18, 24, 48", pop: "#F2D48A", popInk: "#1C140E", button: "#2A3A58", buttonHover: "#3E5278" },
    scenes: { site: "easter-site.svg", portal: "easter-portal.svg", mobile: "easter-mobile.svg" },
  },
  "mothers-day": {
    greeting: "Happy Mother's Day",
    night: false,
    palette: { page: "#240E1C", orange: "#E7A0B4", purple: "#C9899A", black: "#1C1016", paper: "#FFF6EA" },
    glass: { fill: "#240E1C", channels: "36, 14, 28", pop: "#F4C7D4", popInk: "#2A0C1C", button: "#6A2844", buttonHover: "#8A4060" },
    scenes: { site: "mothers-day-site.svg", portal: "mothers-day-portal.svg", mobile: "mothers-day-mobile.svg" },
  },
  "fathers-day": {
    greeting: "Happy Father's Day",
    night: false,
    palette: { page: "#1C120C", orange: "#E0A060", purple: "#6B5344", black: "#1C140E", paper: "#FFF6EA" },
    glass: { fill: "#1C120C", channels: "28, 18, 12", pop: "#E0A060", popInk: "#1C140E", button: "#4A3424", buttonHover: "#6B5344" },
    scenes: { site: "fathers-day-site.svg", portal: "fathers-day-portal.svg", mobile: "fathers-day-mobile.svg" },
  },
  summer: {
    greeting: "Happy Fourth of July",
    night: true,
    palette: { page: "#08142A", orange: "#E8873A", purple: "#1B3A6B", black: "#0C1424", paper: "#FFF6EA" },
    glass: { fill: "#08142A", channels: "8, 20, 42", pop: "#E8873A", popInk: "#1C1A1F", button: "#16325C", buttonHover: "#1B3A6B" },
    scenes: { site: "summer-site.svg", portal: "summer-portal.svg", mobile: "summer-mobile.svg" },
  },
  "back-to-school": {
    greeting: "Hello, Fall",
    night: false,
    palette: { page: "#24100A", orange: "#E09A3A", purple: "#8C4A1A", black: "#1C140E", paper: "#FFF6EA" },
    glass: { fill: "#24100A", channels: "36, 16, 10", pop: "#E09A3A", popInk: "#1C140E", button: "#6B3414", buttonHover: "#8C4A1A" },
    scenes: { site: "back-to-school-site.svg", portal: "back-to-school-portal.svg", mobile: "back-to-school-mobile.svg" },
  },
};
