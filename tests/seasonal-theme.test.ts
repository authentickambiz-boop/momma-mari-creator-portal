import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { isPublicMarketingPath } from "../src/lib/public-site";
import {
  contrastRatio,
  dateInNewYork,
  HALLOWEEN_DRIFTERS,
  parseThemeInstant,
  SEASONAL_THEMES,
  SEASONAL_TIME_ZONE,
  seasonalEffects,
  seasonalSurface,
  selectSeasonalTheme,
  wallClockParts,
} from "../src/lib/seasonal-theme";
import { readThemeOverride, saveThemeOverride } from "../src/lib/seasonal-theme-store";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

const PAGE_TEXT = ["#1C211E", "#1F3B2D", "#4A534D", "#B4532F", "#8C3E22", "#3A443E", "#5C6560", "#16291F"];

describe("seasonal themes", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => { db = openTestDb(); });

  test("the calendar picks a theme in Eastern Time, inclusive of the last minute", () => {
    assert.equal(SEASONAL_TIME_ZONE, "America/New_York");
    const at = (iso: string) => selectSeasonalTheme({ now: dateInNewYork(iso) })?.id ?? null;
    assert.equal(at("2026-09-30T23:59:59"), null);
    assert.equal(at("2026-10-01T00:00:00"), "halloween");
    assert.equal(at("2026-10-21T15:00:00"), "halloween");
    assert.equal(at("2026-11-01T23:59:59"), "halloween");
    assert.equal(at("2026-11-02T00:00:00"), "thanksgiving");
    assert.equal(at("2026-11-27T23:59:59"), "thanksgiving");
    assert.equal(at("2026-11-28T00:00:00"), "holiday");
    assert.equal(at("2027-01-01T23:59:59"), "holiday");
    assert.equal(at("2027-01-02T00:00:00"), null);
    assert.equal(at("2027-02-01T00:00:00"), "valentines");
    assert.equal(at("2027-02-14T23:59:59"), "valentines");
    assert.equal(at("2027-02-15T00:00:00"), null);
    assert.equal(at("2027-05-02T00:00:00"), "mothers-day");
    assert.equal(at("2027-05-09T23:59:59"), "mothers-day");
    assert.equal(at("2027-05-10T00:00:00"), null);

    const halloweenEnd = dateInNewYork("2026-11-01T23:59:59");
    assert.equal(halloweenEnd.toISOString(), "2026-11-02T04:59:59.000Z");
    assert.equal(wallClockParts(halloweenEnd).day, 1);
    assert.equal(dateInNewYork("2026-10-21T15:00:00").toISOString(), "2026-10-21T19:00:00.000Z");

    for (const theme of SEASONAL_THEMES) {
      assert.ok(parseThemeInstant(theme.end) >= parseThemeInstant(theme.start), theme.id);
    }
    for (let i = 0; i < SEASONAL_THEMES.length; i += 1) {
      for (let j = i + 1; j < SEASONAL_THEMES.length; j += 1) {
        const left = SEASONAL_THEMES[i];
        const right = SEASONAL_THEMES[j];
        const overlap = parseThemeInstant(left.start) <= parseThemeInstant(right.end)
          && parseThemeInstant(right.start) <= parseThemeInstant(left.end);
        assert.equal(overlap, false, `${left.id} overlaps ${right.id}`);
      }
    }
  });

  test("an owner can force a theme or none, and a visitor can turn that theme off", async () => {
    const now = dateInNewYork("2026-10-21T15:00:00");
    assert.equal(selectSeasonalTheme({ now, override: "none" }), null);
    assert.equal(selectSeasonalTheme({ now: dateInNewYork("2027-03-01T12:00:00"), override: "halloween" })?.id, "halloween");
    assert.equal(selectSeasonalTheme({ now, dismissed: ["halloween"] }), null);
    assert.equal(selectSeasonalTheme({ now: dateInNewYork("2026-11-10T12:00:00"), dismissed: ["halloween"] })?.id, "thanksgiving");
    assert.equal(selectSeasonalTheme({ now, override: "halloween", dismissed: ["halloween"] }), null);

    assert.equal(await readThemeOverride(db), "auto");
    assert.equal((await saveThemeOverride(db, admin, "none")).ok, true);
    assert.equal(await readThemeOverride(db), "none");
    assert.equal((await saveThemeOverride(db, mariclare, "halloween")).ok, false);
    assert.equal(await readThemeOverride(db), "none");
    assert.equal((await saveThemeOverride(db, admin, "bogus")).ok, false);
    assert.equal((await saveThemeOverride(db, admin, "auto")).ok, true);
    assert.equal(await readThemeOverride(db), "auto");
  });

  test("reduced motion and decorations off pause the drift and the sparkle", () => {
    assert.deepEqual(seasonalEffects({ reducedMotion: false, decorationsOn: true, finePointer: true }), {
      float: "running",
      sparkle: true,
    });
    assert.deepEqual(seasonalEffects({ reducedMotion: true, decorationsOn: true, finePointer: true }), {
      float: "paused",
      sparkle: false,
    });
    assert.deepEqual(seasonalEffects({ reducedMotion: false, decorationsOn: false, finePointer: true }), {
      float: "paused",
      sparkle: false,
    });
    assert.deepEqual(seasonalEffects({ reducedMotion: true, decorationsOn: false, finePointer: false }), {
      float: "paused",
      sparkle: false,
    });
    assert.equal(seasonalEffects({ reducedMotion: false, decorationsOn: true, finePointer: false }).sparkle, false);

    const css = source("src/app/seasonal-theme.css");
    const sparkle = source("src/components/seasonal-sparkle.tsx");
    const frame = source("src/components/seasonal-theme.tsx");
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /animation-play-state:\s*paused/);
    assert.match(css, /pointer-events:\s*none/);
    assert.match(css, /seasonal-sky-site/);
    assert.match(css, /seasonal-sky-portal/);
    assert.match(sparkle, /seasonalEffects/);
    assert.match(sparkle, /decorationsOn: true/);
    assert.match(frame, /theme\?\.id === "halloween"/);
    assert.match(frame, /HalloweenSky/);
  });

  test("the public site and the portal share a cast but not the same motion", () => {
    const site = HALLOWEEN_DRIFTERS.filter((item) => item.surface === "site");
    const portal = HALLOWEEN_DRIFTERS.filter((item) => item.surface === "portal");
    assert.ok(site.length >= 4 && site.length <= 8);
    assert.ok(portal.length >= 3 && portal.length <= 6);
    assert.ok(site.some((item) => item.left !== "auto"));
    assert.ok(site.some((item) => item.right !== "auto"));
    assert.ok(portal.every((item) => item.left === "auto" && item.right !== "auto"));
    assert.ok(Math.max(...site.map((item) => item.size)) > Math.max(...portal.map((item) => item.size)));
    for (const item of HALLOWEEN_DRIFTERS) {
      assert.ok(item.kind === "ghost" || item.kind === "bat" || item.kind === "pumpkin");
    }
    const paths = ["/", "/services", "/meet", "/pricing", "/pricing/preview", "/apply/thanks", "/login", "/portal/services", "/brand-report/abc", "/deals/kosbling"];
    for (const path of paths) {
      const base = path.startsWith("/portal/") ? "/portal" : "";
      const marketing = isPublicMarketingPath(path, base);
      assert.equal(seasonalSurface(path, base), marketing ? "site" : "portal", path);
    }
  });

  test("page colors stay WCAG AA for the existing text colors", () => {
    const halloween = SEASONAL_THEMES.find((theme) => theme.id === "halloween");
    assert.equal(halloween?.greeting, "Happy Halloween");
    assert.equal(halloween?.palette.orange, "#E8873A");
    assert.equal(halloween?.palette.purple, "#6B46A3");
    assert.equal(halloween?.palette.black, "#1C1A1F");
    assert.equal(halloween?.placeholder, false);
    for (const theme of SEASONAL_THEMES) {
      if (theme.id !== "halloween") assert.equal(theme.placeholder, true);
      for (const ink of PAGE_TEXT) {
        const ratio = contrastRatio(ink, theme.palette.page);
        assert.ok(ratio >= 4.5, `${theme.id} ${ink} on ${theme.palette.page} is ${ratio.toFixed(2)}`);
      }
    }
    const home = source("src/app/page.tsx");
    assert.match(home, /creatorHome \? <SeasonalGreeting/);
    assert.match(source("src/components/seasonal-greeting.tsx"), /active\?\.greeting/);
  });
});
