"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/getDb";
import { currentViewer } from "@/lib/current-user";
import {
  parseDismissedThemes,
  THEME_OFF_COOKIE,
  themeById,
  themeErrorCode,
  type SeasonalThemeId,
} from "@/lib/seasonal-theme";
import { saveThemeOverride } from "@/lib/seasonal-theme-store";

const HALF_YEAR_SECONDS = 180 * 24 * 60 * 60;

function themeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (process.env.APP_BASE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: HALF_YEAR_SECONDS,
  };
}

function safeReturn(value: string | null) {
  if (!value) return "/";
  try {
    const url = new URL(value);
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return "/";
    return url.pathname;
  } catch {
    if (value.startsWith("/") && !value.startsWith("//") && value.length < 300 && !value.includes("?")) return value;
    return "/";
  }
}

async function returnPath() {
  const headerList = await headers();
  return safeReturn(headerList.get("referer") ?? headerList.get("next-url"));
}

async function writeDismissed(ids: SeasonalThemeId[]) {
  const jar = await cookies();
  if (ids.length === 0) {
    jar.delete(THEME_OFF_COOKIE);
    return;
  }
  jar.set(THEME_OFF_COOKIE, ids.join(","), themeCookieOptions());
}

export async function dismissSeasonalThemeAction(formData: FormData) {
  const theme = themeById(String(formData.get("theme") ?? ""));
  const next = await returnPath();
  if (!theme) redirect(next);
  const jar = await cookies();
  const dismissed = parseDismissedThemes(jar.get(THEME_OFF_COOKIE)?.value);
  if (!dismissed.includes(theme.id)) dismissed.push(theme.id);
  await writeDismissed(dismissed);
  redirect(next);
}

export async function restoreSeasonalThemeAction(formData: FormData) {
  const theme = themeById(String(formData.get("theme") ?? ""));
  const next = await returnPath();
  if (!theme) redirect(next);
  const jar = await cookies();
  const dismissed = parseDismissedThemes(jar.get(THEME_OFF_COOKIE)?.value).filter((id) => id !== theme.id);
  await writeDismissed(dismissed);
  redirect(next);
}

export async function saveSeasonalThemeAction(formData: FormData) {
  const viewer = await currentViewer();
  if (!viewer) redirect("/login");
  const db = await getDb();
  const result = await saveThemeOverride(db, viewer, String(formData.get("theme") ?? ""));
  if (!result.ok) redirect(`/settings?themeError=${themeErrorCode(result.error)}`);
  redirect("/settings?themeSaved=1");
}
