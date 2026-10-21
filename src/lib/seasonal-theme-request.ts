import { cache } from "react";
import { cookies } from "next/headers";
import { getDb } from "@/db/getDb";
import {
  parseDismissedThemes,
  selectSeasonalTheme,
  THEME_OFF_COOKIE,
  type SeasonalTheme,
  type ThemeOverride,
} from "@/lib/seasonal-theme";
import { readThemeOverride } from "@/lib/seasonal-theme-store";

export type SeasonalPresentation = {
  active: SeasonalTheme | null;
  /** The theme the calendar or owner picked, when this visitor turned it off. */
  hidden: SeasonalTheme | null;
  override: ThemeOverride;
};

export const loadSeasonalPresentation = cache(async (): Promise<SeasonalPresentation> => {
  const now = new Date();
  let override: ThemeOverride = "auto";
  try {
    override = await readThemeOverride(await getDb());
  } catch {
    override = "auto";
  }
  const jar = await cookies();
  const dismissed = parseDismissedThemes(jar.get(THEME_OFF_COOKIE)?.value);
  const available = selectSeasonalTheme({ now, override, dismissed: [] });
  const active = selectSeasonalTheme({ now, override, dismissed });
  return {
    active,
    hidden: active ? null : available,
    override,
  };
});
