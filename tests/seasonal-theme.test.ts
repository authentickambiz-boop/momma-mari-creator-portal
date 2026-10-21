import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import type { PortalDb } from "../src/db/index";
import { isPublicMarketingPath } from "../src/lib/public-site";
import { SCENE_INK, SEASONAL_CALENDAR } from "../src/lib/seasonal-calendar";
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
  THEME_FLOATERS,
  wallClockParts,
} from "../src/lib/seasonal-theme";
import { readThemeOverride, saveThemeOverride } from "../src/lib/seasonal-theme-store";
import { admin, mariclare, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

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
    assert.equal(at("2026-11-02T00:00:00"), null);
    assert.equal(at("2026-11-26T12:00:00"), null);
    assert.equal(at("2026-12-04T00:00:00"), null);
    assert.equal(at("2026-12-25T12:00:00"), null);
    assert.equal(at("2027-01-01T12:00:00"), null);
    assert.equal(at("2027-02-14T12:00:00"), null);
    assert.equal(at("2027-03-17T12:00:00"), null);
    assert.equal(at("2027-03-28T12:00:00"), null);
    assert.equal(at("2027-05-09T12:00:00"), null);
    assert.equal(at("2027-06-20T12:00:00"), null);
    assert.equal(at("2027-07-04T12:00:00"), null);
    assert.equal(at("2027-09-01T12:00:00"), null);
    assert.equal(at("2027-10-01T00:00:00"), null);

    for (let i = 1; i < SEASONAL_CALENDAR.length; i += 1) {
      const previous = SEASONAL_CALENDAR[i - 1];
      const next = SEASONAL_CALENDAR[i];
      assert.equal(parseThemeInstant(next.start), parseThemeInstant(previous.end) + 1000, `${previous.id} -> ${next.id}`);
    }
    const hanukkah = SEASONAL_CALENDAR.find((entry) => entry.id === "hanukkah");
    assert.match(hanukkah?.note ?? "", /sundown Friday, December 4/);
    assert.match(hanukkah?.note ?? "", /nightfall Saturday, December 12/);
    assert.equal(hanukkah?.preview, true);
    for (const theme of SEASONAL_THEMES) {
      if (theme.id === "halloween") {
        assert.equal(theme.preview, false);
        continue;
      }
      assert.equal(theme.preview, true, theme.id);
      assert.equal(selectSeasonalTheme({ now: dateInNewYork(theme.start) }), null, theme.id);
      assert.equal(selectSeasonalTheme({ now: dateInNewYork(theme.start), preview: theme.id })?.id, theme.id);
    }

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
    assert.equal(selectSeasonalTheme({ now: dateInNewYork("2026-11-10T12:00:00"), dismissed: ["halloween"] }), null);
    assert.equal(selectSeasonalTheme({ now: dateInNewYork("2026-11-26T12:00:00"), override: "thanksgiving" }), null);
    assert.equal(selectSeasonalTheme({ now: dateInNewYork("2026-10-21T15:00:00"), preview: "christmas" })?.id, "christmas");
    assert.equal((await saveThemeOverride(db, admin, "thanksgiving")).ok, false);
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
    assert.match(frame, /IllustratedScene/);
    assert.match(frame, /HarvestFrame/);
    assert.match(css, /seasonal-harvest/);
    assert.match(css, /data-seasonal="thanksgiving"\] \.seasonal-scene[\s\S]*100dvh/);
    assert.match(frame, /mm_preview/);
    assert.match(frame, /loading="lazy"/);
    assert.match(frame, /requestIdleCallback/);
    assert.match(source("src/lib/seasonal-calendar.ts"), /halloween-site\.svg/);
    assert.match(source("src/lib/seasonal-calendar.ts"), /halloween-portal\.svg/);
    assert.match(source("src/lib/seasonal-calendar.ts"), /halloween-mobile\.svg/);
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
    assert.equal(halloween?.preview, false);
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
      assert.equal(theme.placeholder, false, theme.id);
      assert.ok(theme.greeting, theme.id);
      const inks = [SCENE_INK.ink, SCENE_INK.muted, SCENE_INK.heading, SCENE_INK.link, SCENE_INK.accent];
      for (const alpha of [SCENE_INK.alpha, SCENE_INK.mobileAlpha]) {
        const worst = compositeHex(theme.glass.fill, SCENE_INK.scene, alpha);
        for (const ink of inks) {
          const ratio = contrastRatio(ink, worst);
          assert.ok(ratio >= 4.5, `${theme.id} ${ink} on ${worst} at ${alpha} is ${ratio.toFixed(2)}`);
        }
      }
      assert.ok(contrastRatio(theme.glass.popInk, theme.glass.pop) >= 4.5, theme.id);
      const site = source(`public/seasonal/${theme.scenes.site}`);
      const portal = source(`public/seasonal/${theme.scenes.portal}`);
      const mobile = source(`public/seasonal/${theme.scenes.mobile}`);
      assert.notEqual(site, portal, theme.id);
      assert.ok(mobile.length < site.length, theme.id);
      if (theme.id !== "halloween") {
        const motif = {
          thanksgiving: /id="cornucopia"/,
          hanukkah: /id="menorah"/,
          christmas: /id="christmas-tree"/,
          "new-year": /id="firework"/,
          valentines: /id="flowers"/,
          "st-patricks": /id="rainbow"/,
          easter: /id="bunny"/,
          "mothers-day": /id="bouquet"/,
          "fathers-day": /id="grill"/,
          summer: /id="firework"/,
          "back-to-school": /id="schoolhouse"/,
        }[theme.id];
        assert.match(site, motif, theme.id);
        assert.match(portal, motif, theme.id);
        assert.match(mobile, motif, theme.id);
        assert.ok(site.length > 5000, `${theme.id} site should fill the frame`);
        assert.ok(portal.length > 4000, `${theme.id} portal should fill the frame`);
      }
      const siteCast = THEME_FLOATERS.filter((item) => item.theme === theme.id && item.surface === "site");
      const portalCast = THEME_FLOATERS.filter((item) => item.theme === theme.id && item.surface === "portal");
      const places = (items: readonly { top: string; left: string }[]) => items.map((item) => `${item.top}:${item.left}`).join("|");
      assert.notEqual(places(siteCast), places(portalCast), theme.id);
      assert.ok(siteCast.length >= 3 && siteCast.length <= 8, theme.id);
    }
    const home = source("src/app/page.tsx");
    assert.match(home, /creatorHome \? <SeasonalGreeting/);
    assert.match(source("src/components/seasonal-greeting.tsx"), /active\?\.greeting/);
  });

  test("the Thanksgiving scene keeps the harvest brief and stays a preview", () => {
    const theme = SEASONAL_THEMES.find((item) => item.id === "thanksgiving");
    assert.equal(theme?.preview, true);
    for (const file of ["thanksgiving-site.svg", "thanksgiving-portal.svg", "thanksgiving-mobile.svg"]) {
      const art = source(`public/seasonal/${file}`);
      assert.match(art, /id="cornucopia"/, file);
      assert.match(art, /id="turkey"/, file);
      assert.match(art, /id="harvest-table"/, file);
      assert.match(art, /id="harvest-border"/, file);
      assert.match(art, /wheat-sway/, file);
      assert.match(art, /prefers-reduced-motion:\s*reduce/, file);
    }
    assert.match(source("docs/thanksgiving-decor.md"), /horn of plenty/i);
    assert.match(source("src/app/seasonal-theme.css"), /seasonal-floater-leaf/);
    assert.match(source("public/seasonal/embed.css"), /mm-floater-leaf/);
    const cast = THEME_FLOATERS.filter((item) => item.theme === "thanksgiving" && item.surface === "site");
    assert.equal(cast.length, 8);
    assert.ok(cast.every((item) => item.kind === "leaf"));
  });
});
