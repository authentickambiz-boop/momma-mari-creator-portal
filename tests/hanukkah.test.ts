import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  daysUntilHanukkah,
  hanukkahFlameDelay,
  hanukkahLabel,
  hanukkahNightFromClock,
  hanukkahView,
  parseHanukkahNight,
} from "../src/lib/hanukkah";
import { dateInNewYork, selectSeasonalTheme, SEASONAL_THEMES, THEME_FLOATERS } from "../src/lib/seasonal-theme";

const require = createRequire(import.meta.url);
const embed = require("../public/seasonal/embed.js") as {
  hanukkahView: (now: Date, nightOverride?: number | null) => {
    night: number;
    daysUntil: number | null;
    shamashLit: boolean;
    label: string;
    candles: { night: number; fromLeft: number; lit: boolean; lightIndex: number | null }[];
  };
};

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function at(iso: string, nightOverride?: number | null) {
  return hanukkahView(dateInNewYork(iso), nightOverride);
}

describe("hanukkah nights", () => {
  test("the countdown runs until the first sundown, then each night lights at 5 p.m. Eastern", () => {
    assert.equal(daysUntilHanukkah(dateInNewYork("2026-10-21T15:00:00")), 44);
    assert.equal(daysUntilHanukkah(dateInNewYork("2026-11-30T12:00:00")), 4);
    assert.equal(daysUntilHanukkah(dateInNewYork("2026-12-03T23:59:59")), 1);
    assert.equal(daysUntilHanukkah(dateInNewYork("2026-12-04T00:00:00")), 0);
    assert.equal(daysUntilHanukkah(dateInNewYork("2026-12-04T16:59:59")), 0);

    assert.equal(hanukkahNightFromClock(new Date("2026-10-22T03:30:00Z")), 0);
    assert.equal(daysUntilHanukkah(new Date("2026-10-22T03:30:00Z")), 44);
    assert.equal(daysUntilHanukkah(new Date("2026-10-22T04:30:00Z")), 43);
    assert.equal(hanukkahNightFromClock(new Date("2026-12-04T21:59:00Z")), 0);
    assert.equal(hanukkahNightFromClock(new Date("2026-12-04T22:00:00Z")), 1);

    const before = at("2026-12-04T16:59:59");
    assert.equal(before.night, 0);
    assert.equal(before.daysUntil, 0);
    assert.equal(before.shamashLit, false);
    assert.equal(before.label, "Hanukkah begins at sundown");
    assert.ok(before.candles.every((candle) => !candle.lit));

    assert.equal(at("2026-12-03T18:00:00").label, "1 day until Hanukkah");
    assert.equal(at("2026-10-21T15:00:00").label, "44 days until Hanukkah");

    assert.equal(at("2026-12-04T17:00:00").night, 1);
    assert.equal(at("2026-12-05T16:59:59").night, 1);
    assert.equal(at("2026-12-05T17:00:00").night, 2);
    assert.equal(at("2026-12-06T16:59:59").night, 2);
    assert.equal(at("2026-12-06T17:00:00").night, 3);
    assert.equal(at("2026-12-07T17:00:00").night, 4);
    assert.equal(at("2026-12-08T12:00:00").night, 4);
    assert.equal(at("2026-12-08T17:00:00").night, 5);
    assert.equal(at("2026-12-10T17:00:00").night, 7);
    assert.equal(at("2026-12-11T16:59:59").night, 7);
    assert.equal(at("2026-12-11T17:00:00").night, 8);
    assert.equal(at("2026-12-12T16:59:59").night, 8);
    assert.equal(at("2026-12-12T17:00:00").night, 8);
    assert.equal(at("2026-12-12T23:59:59").night, 8);
  });

  test("candles are placed right to left and lit newest first", () => {
    const night1 = at("2026-12-04T17:00:00");
    assert.equal(night1.shamashLit, true);
    assert.equal(night1.daysUntil, null);
    assert.deepEqual(night1.candles.map((candle) => candle.lit), [false, false, false, false, false, false, false, true]);
    assert.equal(night1.candles[7].night, 1);
    assert.equal(night1.candles[7].lightIndex, 0);
    assert.equal(night1.label, "Night 1 · the shamash and one candle");

    const night3 = at("2026-12-06T17:00:00");
    assert.deepEqual(night3.candles.filter((candle) => candle.lit).map((candle) => candle.fromLeft), [5, 6, 7]);
    assert.deepEqual(night3.candles.filter((candle) => candle.lit).map((candle) => candle.night), [3, 2, 1]);
    assert.deepEqual(night3.candles.filter((candle) => candle.lit).map((candle) => candle.lightIndex), [0, 1, 2]);
    assert.equal(night3.label, "Night 3 · the shamash and 3 candles");

    const night8 = at("2026-12-11T17:00:00");
    assert.equal(night8.candles.filter((candle) => candle.lit).length, 8);
    assert.ok(night8.shamashLit);
    assert.deepEqual(night8.candles.map((candle) => candle.lightIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(night8.candles.map((candle) => candle.night), [8, 7, 6, 5, 4, 3, 2, 1]);
    assert.ok(hanukkahFlameDelay("shamash") < hanukkahFlameDelay(0));
    assert.ok(hanukkahFlameDelay(0) < hanukkahFlameDelay(1));
    assert.equal(hanukkahLabel(8, null), "Night 8 · the shamash and 8 candles");

    for (const night of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const view = hanukkahView(dateInNewYork("2026-10-21T12:00:00"), night);
      const lit = view.candles.map((candle) => candle.lit);
      assert.deepEqual(lit.slice(0, 8 - night).every((value) => value === false), true, `night ${night} left`);
      assert.deepEqual(lit.slice(8 - night).every((value) => value === true), true, `night ${night} right`);
      const order = view.candles.filter((candle) => candle.lit).map((candle) => candle.lightIndex);
      assert.deepEqual(order, order.map((_, index) => index));
    }
  });

  test("mm_night reviews one state and anything else follows the clock", () => {
    assert.equal(parseHanukkahNight("0"), 0);
    assert.equal(parseHanukkahNight("8"), 8);
    assert.equal(parseHanukkahNight("9"), null);
    assert.equal(parseHanukkahNight("08"), null);
    assert.equal(parseHanukkahNight("nope"), null);
    assert.equal(parseHanukkahNight(""), null);
    assert.equal(parseHanukkahNight(null), null);

    const during = "2026-12-08T18:00:00";
    assert.equal(at(during).night, 5);
    assert.equal(at(during, 0).night, 0);
    assert.equal(at(during, 0).label, "Hanukkah begins at sundown");
    assert.equal(at(during, 3).night, 3);
    assert.equal(at(during, 3).candles.filter((candle) => candle.lit).length, 3);
    assert.equal(at(during, 8).night, 8);
    assert.equal(at("2026-10-21T15:00:00", 0).daysUntil, 44);
    assert.equal(hanukkahView(dateInNewYork(during), 9).night, 5);
    assert.equal(hanukkahView(dateInNewYork(during), null).night, 5);

    const theme = SEASONAL_THEMES.find((item) => item.id === "hanukkah");
    assert.equal(theme?.preview, true);
    assert.equal(theme?.start, "2026-12-04T00:00:00");
    assert.equal(theme?.end, "2026-12-12T23:59:59");
    assert.equal(selectSeasonalTheme({ now: dateInNewYork("2026-12-08T18:00:00") }), null);
    assert.equal(selectSeasonalTheme({ now: dateInNewYork("2026-12-04T17:00:00"), preview: "hanukkah" })?.id, "hanukkah");
  });

  test("the public site and the portal drawings stay previews, and the embed uses the same nights", () => {
    for (const file of ["hanukkah-site.svg", "hanukkah-portal.svg", "hanukkah-mobile.svg"]) {
      const art = source(`public/seasonal/${file}`);
      assert.match(art, /id="menorah"/, file);
      assert.match(art, /id="dreidel"/, file);
      assert.match(art, /id="gelt"/, file);
      assert.match(art, /id="star-of-david"/, file);
      assert.match(art, /sparkle-twinkle/, file);
      assert.match(art, /prefers-reduced-motion:\s*reduce/, file);
    }
    const site = source("public/seasonal/hanukkah-site.svg");
    const portal = source("public/seasonal/hanukkah-portal.svg");
    const mobile = source("public/seasonal/hanukkah-mobile.svg");
    assert.notEqual(site, portal);
    assert.ok(mobile.length < site.length);
    assert.match(site, /id="houses"/);
    assert.match(portal, /id="table"/);
    assert.match(source("docs/hanukkah-decor.md"), /right to left/i);
    assert.match(source("docs/hanukkah-decor.md"), /mm_night/);
    assert.match(source("src/app/seasonal-theme.css"), /hanukkah-flicker/);
    assert.match(source("src/app/seasonal-theme.css"), /prefers-reduced-motion:\s*reduce/);
    assert.match(source("src/app/seasonal-theme.css"), /data-seasonal="hanukkah"\] \.seasonal-scene[\s\S]*100dvh/);
    assert.match(source("src/components/seasonal-theme.tsx"), /HanukkahMenorah/);
    assert.match(source("src/components/seasonal-menorah.tsx"), /HANUKKAH_NIGHT_PARAM/);
    assert.match(source("src/lib/hanukkah.ts"), /mm_night/);
    assert.match(source("public/seasonal/embed.js"), /mm_night/);
    assert.match(source("public/seasonal/embed.js"), /scene\.id === "hanukkah"/);
    assert.match(source("public/seasonal/embed.css"), /mm-flame/);
    assert.match(source("public/seasonal/embed.css"), /data-mm-theme="hanukkah"\] \.mm-scene[\s\S]*100dvh/);

    const siteCast = THEME_FLOATERS.filter((item) => item.theme === "hanukkah" && item.surface === "site");
    const portalCast = THEME_FLOATERS.filter((item) => item.theme === "hanukkah" && item.surface === "portal");
    const places = (items: readonly { top: string; left: string }[]) => items.map((item) => `${item.top}:${item.left}`).join("|");
    assert.notEqual(places(siteCast), places(portalCast));
    assert.ok(siteCast.some((item) => item.kind === "dreidel"));
    assert.ok(portalCast.some((item) => item.kind === "dreidel"));

    const samples = [
      "2026-10-21T15:00:00",
      "2026-12-03T23:59:59",
      "2026-12-04T16:59:59",
      "2026-12-04T17:00:00",
      "2026-12-06T17:00:00",
      "2026-12-11T17:00:00",
      "2026-12-12T23:59:59",
    ];
    for (const iso of samples) {
      const now = dateInNewYork(iso);
      for (const override of [undefined, 0, 3, 8] as const) {
        const portalView = hanukkahView(now, override);
        const copy = embed.hanukkahView(now, override);
        assert.equal(copy.night, portalView.night, iso);
        assert.equal(copy.daysUntil, portalView.daysUntil, iso);
        assert.equal(copy.shamashLit, portalView.shamashLit, iso);
        assert.equal(copy.label, portalView.label, iso);
        assert.deepEqual(copy.candles, portalView.candles, iso);
      }
    }
  });
});
