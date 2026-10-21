import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { isPublicMarketingPath } from "../src/lib/public-site";
import {
  compositeHex,
  contrastRatio,
  dateInNewYork,
  HALLOWEEN_FLOATERS,
  HALLOWEEN_GLASS,
  HALLOWEEN_LANTERNS,
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
    assert.match(css, /seasonal-scene-site/);
    assert.match(css, /seasonal-scene-portal/);
    assert.match(css, /rgba\(32, 14, 58, 0\.68\)/);
    assert.match(css, /rgba\(32, 14, 58, 0\.84\)/);
    assert.match(css, /backdrop-filter/);
    assert.doesNotMatch(css, /clip-path:\s*inset\(64px/);
    assert.match(sparkle, /seasonalEffects/);
    assert.match(sparkle, /decorationsOn: true/);
    assert.match(frame, /theme\?\.id === "halloween"/);
    assert.match(frame, /HalloweenScene/);
    assert.match(frame, /loading="lazy"/);
    assert.match(frame, /requestIdleCallback/);
    assert.match(frame, /halloween-site\.svg/);
    assert.match(frame, /halloween-portal\.svg/);
    assert.match(frame, /halloween-mobile\.svg/);
  });

  test("the public site and the portal get different full-viewport scenes", () => {
    const site = HALLOWEEN_FLOATERS.filter((item) => item.surface === "site");
    const portal = HALLOWEEN_FLOATERS.filter((item) => item.surface === "portal");
    assert.ok(site.length >= 4 && site.length <= 8);
    assert.ok(portal.length >= 3 && portal.length <= 6);
    const inset = (item: { left: string }) => {
      const value = Number.parseFloat(item.left);
      return item.left.endsWith("%") && value > 10 && value < 90;
    };
    assert.ok(site.some(inset));
    assert.ok(portal.some(inset));
    const places = (items: readonly { top: string; left: string }[]) => items.map((item) => `${item.top}:${item.left}`).join("|");
    assert.notEqual(places(site), places(portal));
    for (const item of HALLOWEEN_FLOATERS) {
      assert.ok(item.kind === "ghost" || item.kind === "bat");
      assert.ok(Number.parseFloat(item.duration) >= 16);
    }
    const siteLamps = HALLOWEEN_LANTERNS.filter((item) => item.surface === "site");
    const portalLamps = HALLOWEEN_LANTERNS.filter((item) => item.surface === "portal");
    assert.notEqual(places(siteLamps), places(portalLamps));
    const siteArt = source("public/seasonal/halloween-site.svg");
    const portalArt = source("public/seasonal/halloween-portal.svg");
    const mobileArt = source("public/seasonal/halloween-mobile.svg");
    assert.match(siteArt, /id="haunted-house"/);
    assert.match(portalArt, /id="porch"/);
    assert.notEqual(siteArt, portalArt);
    assert.ok(mobileArt.length < siteArt.length, "the phone scene should be the lighter file");
    assert.match(source("src/app/seasonal-theme.css"), /max-width:\s*820px/);
    const paths = ["/", "/services", "/meet", "/pricing", "/pricing/preview", "/apply/thanks", "/gift-guide", "/login", "/portal/services", "/brand-report/abc", "/deals/kosbling"];
    for (const path of paths) {
      const base = path.startsWith("/portal/") ? "/portal" : "";
      const marketing = isPublicMarketingPath(path, base);
      assert.equal(seasonalSurface(path, base), marketing ? "site" : "portal", path);
    }
  });

  test("page colors stay WCAG AA for the text that actually sits on them", () => {
    const halloween = SEASONAL_THEMES.find((theme) => theme.id === "halloween");
    assert.equal(halloween?.greeting, "Happy Halloween");
    assert.equal(halloween?.palette.orange, "#E8873A");
    assert.equal(halloween?.palette.purple, "#6B46A3");
    assert.equal(halloween?.palette.black, "#1C1A1F");
    assert.equal(halloween?.palette.page, "#120A1C");
    assert.equal(halloween?.placeholder, false);
    assert.equal(compositeHex(HALLOWEEN_GLASS.fill, HALLOWEEN_GLASS.scene, HALLOWEEN_GLASS.alpha), "#675b79");
    const inks = [HALLOWEEN_GLASS.ink, HALLOWEEN_GLASS.muted, HALLOWEEN_GLASS.heading, HALLOWEEN_GLASS.link, HALLOWEEN_GLASS.accent];
    for (const alpha of [HALLOWEEN_GLASS.alpha, HALLOWEEN_GLASS.mobileAlpha]) {
      const worst = compositeHex(HALLOWEEN_GLASS.fill, HALLOWEEN_GLASS.scene, alpha);
      for (const ink of inks) {
        const ratio = contrastRatio(ink, worst);
        assert.ok(ratio >= 4.5, `${ink} on glass ${worst} at ${alpha} is ${ratio.toFixed(2)}`);
      }
    }
    assert.ok(contrastRatio("#FFF6EA", "#3A2460") >= 4.5);
    assert.ok(contrastRatio("#FFF6EA", "#6B46A3") >= 4.5);
    assert.ok(contrastRatio("#1C1A1F", "#E8873A") >= 4.5);
    assert.ok(contrastRatio("#1C1A1F", "#FFFFFF") >= 4.5);
    for (const theme of SEASONAL_THEMES) {
      if (theme.id === "halloween") continue;
      assert.equal(theme.placeholder, true);
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
