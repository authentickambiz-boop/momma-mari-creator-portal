import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { approvalEmails, analyticsSnapshots, pricingWaitlist } from "../src/db/schema";
import { analyticsEnabled } from "../src/lib/analytics-flag";
import { analyticsHookPayload, recordAnalyticsHook } from "../src/lib/analytics-hooks";
import { boldSignEnabled } from "../src/lib/boldsign";
import { gmailSyncEnabled } from "../src/lib/gmail-sync-flag";
import { pushEnabled } from "../src/lib/home-screen";
import { LEGAL_EFFECTIVE_BANNER } from "../src/lib/legal-banner";
import { paymentsEnabled } from "../src/lib/payments-config";
import { hideWeakPublicStats, WEAK_PUBLIC_FOLLOWER_COUNT } from "../src/lib/public-creators";
import { joinPricingWaitlist } from "../src/lib/pricing-waitlist";
import { getDealForViewer } from "../src/lib/queries";
import { admin, openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("site review follow-up", { concurrency: 1 }, () => {
  let db: PortalDb;
  before(() => {
    db = openTestDb();
  });

  test("legal copy, public stats, the waitlist, and analytics hooks stay off the network", async () => {
    const kosblingBefore = await getDealForViewer(db, admin, "kosbling");
    const approvalsBefore = (await db.select().from(approvalEmails)).length;
    const snapshotsBefore = (await db.select().from(analyticsSnapshots)).length;

    assert.equal(LEGAL_EFFECTIVE_BANNER, "Effective Oct 20, 2026, pending legal review");
    assert.doesNotMatch(source("src/app/privacy/page.tsx"), /LEGAL_EFFECTIVE_BANNER/);
    assert.doesNotMatch(source("src/app/terms/page.tsx"), /LEGAL_EFFECTIVE_BANNER/);

    const hidden = hideWeakPublicStats([
      {
        id: "a",
        name: "A",
        initials: "A",
        lastUpdated: "2026-10-19",
        lastUpdatedLabel: "Oct 19, 2026",
        platforms: [{
          platform: "Instagram",
          followers: "15.8k",
          followersLabel: "Followers",
          engagement: "1.57%",
          capturedOn: "2026-10-19",
        }, {
          platform: "Facebook",
          followers: "2",
          followersLabel: "Followers",
          capturedOn: "2026-10-19",
        }],
      },
      {
        id: "b",
        name: "B",
        initials: "B",
        lastUpdated: "2026-10-19",
        lastUpdatedLabel: "Oct 19, 2026",
        platforms: [{
          platform: "Instagram",
          followers: "1,728",
          followersLabel: "Followers",
          engagement: "1.57%",
          capturedOn: "2026-10-19",
        }],
      },
    ]);
    assert.equal(WEAK_PUBLIC_FOLLOWER_COUNT, 10);
    assert.equal(hidden[0]?.platforms.some((platform) => platform.platform === "Facebook"), false);
    assert.equal(hidden[0]?.platforms[0]?.followers, "15.8k");
    assert.equal(Object.hasOwn(hidden[0]?.platforms[0] ?? {}, "engagement"), false);
    assert.equal(Object.hasOwn(hidden[1]?.platforms[0] ?? {}, "engagement"), false);
    assert.equal((await db.select().from(analyticsSnapshots)).length, snapshotsBefore);

    const rejected = await joinPricingWaitlist(db, "person@example.invalid");
    assert.equal(rejected.ok, false);
    const joined = await joinPricingWaitlist(db, "Fan@Example.test");
    assert.equal(joined.ok, true);
    if (joined.ok) assert.equal(joined.already, false);
    const again = await joinPricingWaitlist(db, "fan@example.test");
    assert.equal(again.ok, true);
    if (again.ok) assert.equal(again.already, true);
    const rows = await db.select().from(pricingWaitlist).where(eq(pricingWaitlist.email, "fan@example.test"));
    assert.equal(rows.length, 1);
    assert.equal((await db.select().from(approvalEmails)).length, approvalsBefore);

    const previous = process.env.ANALYTICS_ENABLED;
    delete process.env.ANALYTICS_ENABLED;
    try {
      assert.equal(analyticsEnabled(), false);
      assert.equal(analyticsHookPayload(), null);
      assert.deepEqual(recordAnalyticsHook("waitlist_join"), { sent: false });
      process.env.ANALYTICS_ENABLED = "true";
      assert.equal(analyticsEnabled(), true);
      const payload = analyticsHookPayload();
      assert.equal(payload?.ready, true);
      assert.equal(payload?.hooks.includes("waitlist_join"), true);
      assert.equal(payload?.hooks.includes("page_view"), true);
      assert.deepEqual(recordAnalyticsHook("waitlist_join"), { sent: false, ready: true, name: "waitlist_join" });
      assert.deepEqual(recordAnalyticsHook("not-a-hook"), { sent: false });
      process.env.ANALYTICS_ENABLED = "TRUE";
      assert.equal(analyticsEnabled(), false);
    } finally {
      if (previous == null) delete process.env.ANALYTICS_ENABLED;
      else process.env.ANALYTICS_ENABLED = previous;
    }

    const hooks = source("src/lib/analytics-hooks.ts");
    assert.equal(hooks.includes("fetch("), false);
    assert.equal(hooks.includes("api.stripe.com"), false);
    assert.match(source("src/app/layout.tsx"), /AnalyticsHooks/);
    assert.match(source("src/components/analytics-hooks.tsx"), /if \(!payload\) return null/);
    assert.equal(paymentsEnabled(), false);
    assert.equal(gmailSyncEnabled(), false);
    assert.equal(pushEnabled(), false);
    assert.equal(boldSignEnabled(), false);
    assert.match(source(".env.example"), /^ANALYTICS_ENABLED=$/m);
    assert.match(source(".env.example"), /^PAYMENTS_ENABLED=$/m);
    assert.match(source(".env.example"), /^GMAIL_SYNC_ENABLED=$/m);
    assert.match(source(".env.example"), /^PUSH_ENABLED=$/m);
    assert.match(source(".env.example"), /^BOLDSIGN_ENABLED=$/m);
    assert.equal(source("drizzle/0044_pricing_waitlist.sql").toLowerCase().includes("delete "), false);
    assert.equal(source("drizzle/0044_pricing_waitlist.sql").includes("update deals"), false);

    const kosblingAfter = await getDealForViewer(db, admin, "kosbling");
    assert.equal(kosblingAfter?.workflowStage, kosblingBefore?.workflowStage);
    assert.equal(kosblingAfter?.brand, "KOSBLING");
    assert.equal(kosblingAfter?.drafts.length, kosblingBefore?.drafts.length);
  });
});
