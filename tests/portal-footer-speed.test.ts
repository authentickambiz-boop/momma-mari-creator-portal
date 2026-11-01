import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { assetOriginFromPrefix } from "../src/lib/asset-origin";
import { gather } from "../src/lib/parallel";
import { publicPageCacheControl } from "../src/lib/public-cache";
import { clearSignupCodeCache, setSignupCodeRequired, signupCodeRequired } from "../src/lib/signup-codes";
import { sessionProfileFresh, sessionProfileFromViewer, SESSION_PROFILE_TTL_MS } from "../src/lib/session";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("portal footer and speed", () => {
  test("the footer matches the main site and keeps portal links on a second row", () => {
    const footer = source("src/components/site-footer.tsx");
    const signup = source("src/app/signup/page.tsx");
    assert.match(footer, /Now accepting applications/);
    assert.match(footer, /Ready to grow your creator career\?/);
    assert.match(footer, /Tell us about your content and your goals/);
    assert.match(footer, /Apply to join/);
    assert.match(footer, /Brand inquiry/);
    assert.match(footer, /https:\/\/www\.mommamari\.com\/portal\/apply/);
    assert.match(footer, /https:\/\/www\.mommamari\.com\/portal\/inquire/);
    assert.match(footer, /https:\/\/www\.mommamari\.com\/about/);
    assert.match(footer, /https:\/\/www\.mommamari\.com\/contact/);
    assert.match(footer, /https:\/\/www\.mommamari\.com\/partner-with-us/);
    assert.match(footer, /Privacy Policy/);
    assert.match(footer, /Terms of Service/);
    assert.match(footer, /Kamron@mommamari\.com/);
    assert.match(footer, /https:\/\/instagram\.com\/mommamarillc/);
    assert.match(footer, /https:\/\/linkedin\.com\/company\/mommamari/);
    assert.match(footer, /MariClare Instagram/);
    assert.match(footer, /https:\/\/facebook\.com\/Mommamari/);
    assert.match(footer, /MariClare TikTok/);
    assert.match(footer, /href="\/faq"/);
    assert.match(footer, /href="\/help"/);
    assert.match(footer, /href="\/status"/);
    assert.match(footer, /href="\/feedback"/);
    assert.match(footer, /href="\/careers"/);
    assert.match(footer, /href="\/press"/);
    assert.match(footer, /Kids in content/);
    assert.equal(footer.includes("/portal/about"), false);
    assert.equal(footer.includes("/portal/privacy"), false);
    assert.equal(footer.includes("LLC"), false);
    assert.match(signup, /showFoot=\{false\}/);
    assert.equal(signup.includes("follower minimum"), false);
  });

  test("logged-out login and sign-up can be cached, and a session is not", () => {
    assert.match(publicPageCacheControl("/login", false) ?? "", /s-maxage=120/);
    assert.match(publicPageCacheControl("/portal/signup", false) ?? "", /s-maxage=120/);
    assert.equal(publicPageCacheControl("/portal/login", true), null);
    assert.equal(publicPageCacheControl("/deals", false), null);
    assert.equal(assetOriginFromPrefix("/portal"), null);
    assert.equal(
      assetOriginFromPrefix("https://example.wf-app-prod.cosmic.webflow.services/portal"),
      "https://example.wf-app-prod.cosmic.webflow.services",
    );
  });

  test("independent work overlaps only when asked", async () => {
    let running = 0;
    let max = 0;
    const tasks = [0, 1, 2].map(() => async () => {
      running += 1;
      max = Math.max(max, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running -= 1;
      return 1;
    });
    max = 0;
    await gather(tasks, false);
    assert.equal(max, 1);
    max = 0;
    running = 0;
    await gather([0, 1, 2].map(() => async () => {
      running += 1;
      max = Math.max(max, running);
      await new Promise((resolve) => setTimeout(resolve, 20));
      running -= 1;
      return 1;
    }), true);
    assert.equal(max, 3);
  });

  test("a fresh session profile is reused and sign-up code cache clears on save", async () => {
    const profile = sessionProfileFromViewer({ ...admin, initials: "K" });
    assert.ok(profile);
    assert.equal(sessionProfileFresh(profile ?? undefined), true);
    assert.equal(sessionProfileFresh({ ...profile!, profileCheckedAt: new Date(Date.now() - SESSION_PROFILE_TTL_MS - 1000).toISOString() }), false);
    assert.equal(sessionProfileFromViewer({ email: "a@b.c", role: "creator", creatorId: "x", name: "Ada" }), null);

    const db = openTestDb();
    clearSignupCodeCache();
    assert.equal(await signupCodeRequired(db, { cache: true }), true);
    await db.update((await import("../src/db/schema")).portalSettings).set({ value: "false" }).where((await import("drizzle-orm")).eq((await import("../src/db/schema")).portalSettings.key, "free_signup_requires_code"));
    assert.equal(await signupCodeRequired(db, { cache: true }), true);
    assert.equal((await setSignupCodeRequired(db, admin, false)).ok, true);
    assert.equal(await signupCodeRequired(db, { cache: true }), false);
  });
});
