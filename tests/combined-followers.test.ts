import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteFooter } from "../src/components/site-footer";
import { COMBINED_FOLLOWERS } from "../src/lib/combined-followers";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("combined followers", () => {
  test("the shared footer shows 2.9M+ Combined Followers from one figure", () => {
    assert.equal(COMBINED_FOLLOWERS.figure, "2.9M+");
    assert.equal(COMBINED_FOLLOWERS.label, "Combined Followers");

    const html = renderToStaticMarkup(createElement(SiteFooter));
    assert.match(html, /2\.9M\+/);
    assert.match(html, /Combined Followers/);
    assert.match(html, /class="mm-foot-followers"/);

    const footer = source("src/components/site-footer.tsx");
    const layout = source("src/app/layout.tsx");
    const figureFile = source("src/lib/combined-followers.ts");
    assert.match(footer, /COMBINED_FOLLOWERS\.figure/);
    assert.match(footer, /COMBINED_FOLLOWERS\.label/);
    assert.equal(footer.includes("2.9M+"), false);
    assert.match(layout, /<SiteFooter \/>/);
    assert.equal(figureFile.split("2.9M+").length - 1, 1);

    const css = source("src/app/globals.css");
    const rule = css.slice(css.indexOf(".mm-foot-followers {"), css.indexOf(".mm-foot-followers strong"));
    assert.match(rule, /display:\s*flex/);
    assert.equal(rule.includes("display: none"), false);
    assert.equal(css.includes(".mm-foot-followers { display: none"), false);
  });
});
