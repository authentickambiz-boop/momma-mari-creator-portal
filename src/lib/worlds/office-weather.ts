/**
 * Live sky for the bot office. Mooresville, NC, from Open-Meteo (no key).
 * Day and night follow America/New_York. Foliage follows the month there.
 */

export const MOORESVILLE = { lat: 35.58, lon: -80.81, timezone: "America/New_York" } as const;

export const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=35.58&longitude=-80.81&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day&timezone=America%2FNew_York";

export const WEATHER_POLL_MS = 10 * 60 * 1000;

export type SkyKind = "clear" | "clouds" | "rain" | "fog" | "snow";
export type Foliage = "winter" | "spring" | "summer" | "fall";

export type OfficeWeather = {
  kind: SkyKind;
  cloud: number;
  rain: number;
  snow: number;
  fog: number;
  wind: number;
  tempC: number | null;
  hour: number;
  month: number;
  sunElevation: number;
  isDay: boolean;
  foliage: Foliage;
  label: string;
};

const SKY_LABEL: Record<SkyKind, string> = {
  clear: "Clear",
  clouds: "Cloudy",
  rain: "Rain",
  fog: "Fog",
  snow: "Snow",
};

export function zonedParts(date: Date, timeZone = MOORESVILLE.timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    month: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  let hour = Number(bag.hour);
  if (!Number.isFinite(hour)) hour = 12;
  if (hour === 24) hour = 0;
  const minute = Number(bag.minute);
  return {
    hour: hour + (Number.isFinite(minute) ? minute / 60 : 0),
    month: Number(bag.month) || 1,
  };
}

/** 1 at local noon, 0 at 6:00 and 18:00, negative at night. */
export function sunElevation(hour: number) {
  return Math.sin(((hour - 6) / 12) * Math.PI);
}

export function foliageForMonth(month: number): Foliage {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "fall";
}

export const FOLIAGE_COLORS: Record<Foliage, { canopy: string[]; blossom: string | null; grass: string; flower: string[] }> = {
  winter: { canopy: ["#6d5a3a", "#4e5c42", "#8a7a62"], blossom: null, grass: "#8a8f6e", flower: ["#c9b89a", "#8a9a7a"] },
  spring: { canopy: ["#7ea84a", "#9ccc5a", "#5e8f3a"], blossom: "#f2b4c4", grass: "#7ea85a", flower: ["#f2b4c4", "#f6e27a", "#ffffff"] },
  summer: { canopy: ["#2f6b34", "#3e8a42", "#1f5a32"], blossom: null, grass: "#5d8f45", flower: ["#e85d4c", "#f2d24b", "#f7f3ea"] },
  fall: { canopy: ["#c45a1a", "#d38a22", "#8d3a28", "#c9a24a"], blossom: null, grass: "#8a9a52", flower: ["#d98a2a", "#f2e2a8", "#a33b32"] },
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function skyKindFromCode(code: number, precip: number): SkyKind {
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || precip >= 0.2) return "rain";
  if (code >= 2) return "clouds";
  return "clear";
}

function weatherLabel(kind: SkyKind, wind: number, tempC: number | null) {
  const temp = tempC === null ? "" : `${Math.round((tempC * 9) / 5 + 32)}°F · `;
  const windNote = wind >= 8 ? " · windy" : "";
  return `Mooresville · ${temp}${SKY_LABEL[kind]}${windNote}`;
}

export function weatherFromClock(date: Date, extras?: Partial<Pick<OfficeWeather, "kind" | "cloud" | "rain" | "snow" | "fog" | "wind" | "tempC">>): OfficeWeather {
  const { hour, month } = zonedParts(date);
  const elevation = sunElevation(hour);
  const kind = extras?.kind ?? "clear";
  const cloud = extras?.cloud ?? (kind === "clear" ? 0.15 : kind === "fog" ? 0.4 : 0.75);
  const rain = extras?.rain ?? (kind === "rain" ? 0.7 : 0);
  const snow = extras?.snow ?? (kind === "snow" ? 0.7 : 0);
  const fog = extras?.fog ?? (kind === "fog" ? 0.85 : kind === "rain" ? 0.25 : 0);
  const wind = extras?.wind ?? 2;
  const tempC = extras?.tempC ?? null;
  return {
    kind,
    cloud,
    rain,
    snow,
    fog,
    wind,
    tempC,
    hour,
    month,
    sunElevation: elevation,
    isDay: elevation > 0,
    foliage: foliageForMonth(month),
    label: weatherLabel(kind, wind, tempC),
  };
}

export function weatherFromOpenMeteo(body: unknown, now: Date): OfficeWeather {
  const current = isRecord(body) && isRecord(body.current) ? body.current : {};
  const code = typeof current.weather_code === "number" ? current.weather_code : 0;
  const precip = typeof current.precipitation === "number" ? current.precipitation : 0;
  const kind = skyKindFromCode(code, precip);
  const cloud = clamp01((typeof current.cloud_cover === "number" ? current.cloud_cover : kind === "clear" ? 10 : 70) / 100);
  const wind = typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : 0;
  const tempC = typeof current.temperature_2m === "number" ? current.temperature_2m : null;
  return weatherFromClock(now, {
    kind,
    cloud: kind === "clear" && code === 1 ? Math.max(cloud, 0.35) : cloud,
    rain: kind === "rain" ? clamp01(0.35 + precip / 3) : 0,
    snow: kind === "snow" ? 0.75 : 0,
    fog: kind === "fog" ? 0.9 : kind === "rain" ? 0.28 : 0,
    wind,
    tempC,
  });
}

export function skyColor(weather: OfficeWeather) {
  const elev = weather.sunElevation;
  if (elev < -0.08) return weather.kind === "clear" ? "#0e1730" : "#151a22";
  if (elev < 0.14) return "#e39a62";
  if (weather.kind === "fog") return "#c5c8c4";
  if (weather.kind === "rain" || weather.kind === "snow") return "#8ea0ae";
  if (weather.kind === "clouds" || weather.cloud > 0.65) return "#b7c5d1";
  return "#8ec4ea";
}

export function fogDistances(weather: OfficeWeather) {
  if (weather.kind === "fog" || weather.fog > 0.6) return { near: 10, far: 48 };
  if (weather.kind === "rain" || weather.kind === "snow") return { near: 22, far: 90 };
  if (weather.sunElevation < 0) return { near: 28, far: 110 };
  return { near: 55, far: 190 };
}

export function sunPosition(hour: number, site: { width: number; depth: number }) {
  const elev = sunElevation(hour);
  const az = ((hour - 6) / 12) * Math.PI;
  return {
    x: site.width / 2 + Math.cos(az) * 48,
    y: 4 + Math.max(0, elev) * 38,
    z: site.depth / 2 + Math.sin(az) * 16,
  };
}
