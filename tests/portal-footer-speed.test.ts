import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, test } from "node:test";
import { build } from "esbuild";
import { assetOriginFromPrefix } from "../src/lib/asset-origin";
import { ensureCreatorDeposits, ensureOpenDeposits } from "../src/lib/brand-deposits";
import { listCreatorOpenTasks } from "../src/lib/creator-tasks";
import { gather, queriesInParallel } from "../src/lib/parallel";
import { publicPageCacheControl } from "../src/lib/public-cache";
import { listDealsForViewer } from "../src/lib/queries";
import { clearSignupCodeCache, setSignupCodeRequired, signupCodeRequired } from "../src/lib/signup-codes";
import { sessionProfileFresh, sessionProfileFromViewer, SESSION_PROFILE_TTL_MS } from "../src/lib/session";
import type { Viewer } from "../src/lib/types";
import { admin, mariclare, openTestDb } from "./harness";
import { homeDepositStubs } from "./home-deposit-order-stubs";

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

  test("deposits are ensured before listDealsForViewer when parallel queries are on", async () => {
    const home = source("src/app/page.tsx");
    const depositBlock = [
      "  if (portal.viewer.role === \"admin\") await ensureOpenDeposits(portal.db);",
      "  else if (portal.viewer.creatorId) await ensureCreatorDeposits(portal.db, portal.viewer.creatorId);",
      "  else if (portal.viewedId && portal.viewedId !== \"all\") await ensureCreatorDeposits(portal.db, portal.viewedId);",
    ].join("\n");
    const depositAt = home.indexOf(depositBlock);
    const gatherAt = home.indexOf("gather(");
    assert.ok(depositAt > 0);
    assert.equal(home.split(depositBlock).length, 2);
    assert.ok(gatherAt > depositAt);
    assert.ok(home.indexOf("listCreatorOpenTasks(") > gatherAt);

    const previous = process.env.PORTAL_PARALLEL_QUERIES;
    process.env.PORTAL_PARALLEL_QUERIES = "1";
    try {
      assert.equal(queriesInParallel(), true);
      const db = openTestDb();
      const g = globalThis as typeof globalThis & {
        __homeDepositOrder?: { depositsDone: boolean; events: string[]; inflight: number; max: number };
        __homeDepositPortal?: {
          db: ReturnType<typeof openTestDb>;
          viewer: Viewer;
          creators: { id: string; name: string }[];
          viewedId: string;
          viewed: { id: string; name: string } | null;
          creatorFree: boolean;
        };
        __homeDepositRun?: {
          ensureOpenDeposits: typeof ensureOpenDeposits;
          ensureCreatorDeposits: typeof ensureCreatorDeposits;
          listDealsForViewer: typeof listDealsForViewer;
          listCreatorOpenTasks: typeof listCreatorOpenTasks;
        };
      };
      let dealsRan = 0;
      let tasksRan = 0;
      g.__homeDepositRun = {
        async ensureOpenDeposits(database) {
          await ensureOpenDeposits(database);
        },
        async ensureCreatorDeposits(database, creatorId) {
          await ensureCreatorDeposits(database, creatorId);
        },
        async listDealsForViewer(database, viewer, creatorId, names) {
          dealsRan += 1;
          assert.equal(g.__homeDepositOrder?.depositsDone, true);
          return listDealsForViewer(database, viewer, creatorId, names);
        },
        async listCreatorOpenTasks(database, creatorId) {
          tasksRan += 1;
          assert.equal(g.__homeDepositOrder?.depositsDone, true);
          return listCreatorOpenTasks(database, creatorId);
        },
      };
      const bundled = await build({
        absWorkingDir: process.cwd(),
        entryPoints: [path.join(process.cwd(), "src/app/page.tsx")],
        bundle: true,
        format: "esm",
        platform: "node",
        jsx: "automatic",
        write: false,
        logLevel: "silent",
        plugins: [{
          name: "home-deposit-stubs",
          setup(esbuild) {
            esbuild.onResolve({ filter: /.*/ }, (args) => {
              if (args.kind === "entry-point") return undefined;
              if (args.path === "@/lib/parallel") return { path: path.join(process.cwd(), "src/lib/parallel.ts") };
              if (args.path in homeDepositStubs) return { path: args.path, namespace: "home-deposit-stub" };
              if (args.path.startsWith("@/") || args.path.startsWith("next/")) {
                return { errors: [{ text: `Home page import needs a test stub: ${args.path}` }] };
              }
              return undefined;
            });
            esbuild.onLoad({ filter: /.*/, namespace: "home-deposit-stub" }, (args) => ({
              contents: homeDepositStubs[args.path],
              loader: "js",
            }));
          },
        }],
      });
      const file = bundled.outputFiles[0];
      assert.ok(file);
      const outfile = path.join(mkdtempSync(path.join(tmpdir(), "home-deposit-")), "home.mjs");
      writeFileSync(outfile, file.text);
      const page = (await import(pathToFileURL(outfile).href) as { default: (props: { searchParams: Promise<Record<string, string | undefined>> }) => Promise<unknown> }).default;

      const manager: Viewer = {
        email: "riley.manager@example.com",
        role: "manager",
        creatorId: null,
        name: "Riley",
        managerId: "riley",
        assignedCreatorIds: ["mariclare"],
      };
      const cases = [
        {
          viewer: admin,
          viewedId: "all",
          viewed: null,
          ensure: "ensureOpenDeposits",
          tasks: false,
        },
        {
          viewer: mariclare,
          viewedId: "mariclare",
          viewed: { id: "mariclare", name: "MariClare" },
          ensure: "ensureCreatorDeposits",
          tasks: true,
        },
        {
          viewer: manager,
          viewedId: "mariclare",
          viewed: { id: "mariclare", name: "MariClare" },
          ensure: "ensureCreatorDeposits",
          tasks: false,
        },
      ];
      for (const item of cases) {
        g.__homeDepositOrder = { depositsDone: false, events: [], inflight: 0, max: 0 };
        g.__homeDepositPortal = {
          db,
          viewer: item.viewer,
          creators: [{ id: "mariclare", name: "MariClare" }],
          viewedId: item.viewedId,
          viewed: item.viewed,
          creatorFree: false,
        };
        await page({ searchParams: Promise.resolve({}) });
        const state = g.__homeDepositOrder;
        assert.ok(state);
        assert.equal(state.events.includes("listDeals-before"), false);
        assert.equal(state.events.includes("tasks-before"), false);
        assert.ok(state.events.indexOf(item.ensure) >= 0);
        assert.ok(state.events.indexOf(item.ensure) < state.events.indexOf("listDeals-after"));
        if (item.tasks) {
          assert.ok(state.events.indexOf("listDeals-after") < state.events.indexOf("tasks-after"));
        } else {
          assert.equal(state.events.includes("tasks-after"), false);
        }
        assert.ok(state.max >= 2);
      }
      assert.equal(dealsRan, 3);
      assert.equal(tasksRan, 1);
    } finally {
      if (previous === undefined) delete process.env.PORTAL_PARALLEL_QUERIES;
      else process.env.PORTAL_PARALLEL_QUERIES = previous;
    }
  });
});
