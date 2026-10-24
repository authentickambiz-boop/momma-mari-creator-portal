import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, test } from "node:test";
import { eq } from "drizzle-orm";
import type { PortalDb } from "../src/db/index";
import { gmailBridgeStarts } from "../src/db/schema";
import { syncConnectedMailboxes } from "../src/lib/gmail-bridge";
import {
  GMAIL_BRIDGE_CONNECT_PROMPT,
  gmailBridgeFirstLoginPrompt,
  gmailBridgeStartFor,
  onCreatorGmailConsent,
  onCreatorPortalLogin,
} from "../src/lib/gmail-bridge-start";
import { gmailSyncEnabled } from "../src/lib/gmail-sync-flag";
import { saveGmailConnection } from "../src/lib/onboarding";
import { getDealForViewer } from "../src/lib/queries";
import type { Viewer } from "../src/lib/types";
import { abby, admin, mariclare, openTestDb } from "./harness";

const authentic: Viewer = {
  email: "authentickam@example.com",
  role: "creator",
  creatorId: "authentickam",
  name: "AuthenticKam",
};

function source(name: string) {
  return readFileSync(path.join(process.cwd(), name), "utf8");
}

function restoreEnv(name: string, previous: string | undefined) {
  if (previous == null) delete process.env[name];
  else process.env[name] = previous;
}

describe("gmail bridge start", { concurrency: 1 }, () => {
  let db: PortalDb;
  let kosblingDrafts = 0;
  let kosblingEvents = 0;

  before(async () => {
    db = openTestDb();
    const beforeDeal = await getDealForViewer(db, admin, "kosbling");
    kosblingDrafts = beforeDeal?.drafts.length ?? 0;
    kosblingEvents = beforeDeal?.stageEvents?.length ?? 0;
  });

  async function kosblingUntouched() {
    const after = await getDealForViewer(db, admin, "kosbling");
    assert.equal(after?.workflowStage, "draft_due");
    assert.equal(after?.visibleToCreator, true);
    assert.equal(after?.brand, "KOSBLING");
    assert.equal(after?.contact, null);
    assert.equal(after?.drafts.length, kosblingDrafts);
    assert.equal(after?.contracts.length, 0);
    assert.equal(after?.stageEvents?.length, kosblingEvents);
  }

  test("first login without Gmail does not start the bridge", async () => {
    const previousSync = process.env.GMAIL_SYNC_ENABLED;
    process.env.GMAIL_SYNC_ENABLED = "true";
    let reads = 0;
    try {
      let setups = 0;
      const started = await onCreatorPortalLogin(db, mariclare, {
        setup: () => {
          setups += 1;
        },
      });
      assert.equal(started.started, false);
      assert.equal(started.reason, "no_gmail");
      assert.equal(started.startedAt, null);
      assert.equal(setups, 0);
      assert.equal(await gmailBridgeStartFor(db, "mariclare"), null);
      assert.equal(await gmailBridgeFirstLoginPrompt(db, "mariclare"), GMAIL_BRIDGE_CONNECT_PROMPT);
      assert.equal(GMAIL_BRIDGE_CONNECT_PROMPT.toLowerCase().includes("minimum"), false);
      assert.match(GMAIL_BRIDGE_CONNECT_PROMPT, /never send mail/i);
      assert.match(GMAIL_BRIDGE_CONNECT_PROMPT, /read-only/i);

      const manager = await onCreatorPortalLogin(
        db,
        { email: "riley.bridge@gmail.com", role: "manager", creatorId: null, name: "Riley" },
        { setup: () => { setups += 1; } },
      );
      assert.equal(manager.reason, "not_creator");
      assert.equal(setups, 0);

      const synced = await syncConnectedMailboxes(db, {
        read: async () => {
          reads += 1;
          return [];
        },
      });
      assert.equal(synced.enabled, true);
      assert.equal(reads, 0);
      assert.match(source("src/app/connect/page.tsx"), /gmailBridgeFirstLoginPrompt/);
      assert.match(source("src/app/onboarding/page.tsx"), /gmailBridgeFirstLoginPrompt/);
      assert.match(source("src/app/settings/page.tsx"), /gmailBridgeFirstLoginPrompt/);
      assert.match(source("src/app/api/auth/callback/route.ts"), /rememberCreatorLogin/);
      assert.match(source("src/app/api/auth/callback/route.ts"), /rememberGmailConsent/);
      assert.match(source("src/app/actions.ts"), /rememberCreatorLogin/);
      const startSource = source("src/lib/gmail-bridge-start.ts");
      assert.equal(startSource.includes("messages/send"), false);
      assert.equal(startSource.includes("gmail.send"), false);
      assert.equal(startSource.includes("sendMail"), false);
      assert.equal(startSource.includes("stripe"), false);
      assert.equal(startSource.includes("/portal/worlds"), false);
      const migration = source("drizzle/0068_gmail_bridge_start.sql").toLowerCase();
      assert.equal(migration.includes("drop "), false);
      assert.equal(migration.includes("delete "), false);
      assert.match(migration, /create table gmail_bridge_starts/);
      assert.match(migration, /create table creator_portal_logins/);
      await kosblingUntouched();
    } finally {
      restoreEnv("GMAIL_SYNC_ENABLED", previousSync);
    }
  });

  test("first login with Gmail connected starts once, and a repeat login does not", async () => {
    const previousSync = process.env.GMAIL_SYNC_ENABLED;
    process.env.GMAIL_SYNC_ENABLED = "true";
    const token = "super-secret-refresh-token-abby-bridge";
    try {
      const saved = await saveGmailConnection(db, "abby", { refreshToken: token, gmailEmail: "abby.brand@gmail.com" });
      assert.equal(saved.ok, true);
      const other = await saveGmailConnection(db, "authentickam", { refreshToken: "other-refresh-token-not-started", gmailEmail: "authentic.brand@gmail.com" });
      assert.equal(other.ok, true);

      let setups = 0;
      const early = await onCreatorGmailConsent(db, "abby", { setup: () => { setups += 1; } });
      assert.equal(early.reason, "not_signed_in");
      assert.equal(early.started, false);
      assert.equal(setups, 0);
      assert.equal(await gmailBridgeStartFor(db, "abby"), null);

      const first = await onCreatorPortalLogin(db, abby, { setup: () => { setups += 1; } });
      assert.equal(first.started, true);
      assert.equal(first.reason, "started");
      assert.equal(typeof first.startedAt, "string");
      assert.equal(setups, 1);
      const row = await gmailBridgeStartFor(db, "abby");
      assert.equal(row?.startedAt, first.startedAt);
      assert.equal(row?.mailbox, "abby.brand@gmail.com");
      assert.equal(await gmailBridgeFirstLoginPrompt(db, "abby"), null);

      const reads: string[] = [];
      const synced = await syncConnectedMailboxes(db, {
        read: async ({ creatorId, refreshToken }) => {
          reads.push(creatorId);
          assert.equal(refreshToken, token);
          return [];
        },
      });
      assert.equal(synced.enabled, true);
      assert.deepEqual(reads, ["abby"]);
      assert.equal(JSON.stringify(synced).includes(token), false);

      const again = await onCreatorPortalLogin(db, abby, { setup: () => { setups += 1; } });
      assert.equal(again.started, false);
      assert.equal(again.reason, "already");
      assert.equal(again.startedAt, first.startedAt);
      assert.equal(setups, 1);

      const reconnected = await saveGmailConnection(db, "abby", { refreshToken: token, gmailEmail: "abby.brand@gmail.com" });
      assert.equal(reconnected.ok, true);
      const consent = await onCreatorGmailConsent(db, "abby", { setup: () => { setups += 1; } });
      assert.equal(consent.started, false);
      assert.equal(consent.reason, "already");
      assert.equal(consent.startedAt, first.startedAt);
      assert.equal(setups, 1);
      assert.equal((await db.select().from(gmailBridgeStarts).where(eq(gmailBridgeStarts.creatorId, "abby"))).length, 1);
      assert.equal(await gmailBridgeStartFor(db, "authentickam"), null);
      await kosblingUntouched();
    } finally {
      restoreEnv("GMAIL_SYNC_ENABLED", previousSync);
    }
  });

  test("gate off does not start the bridge", async () => {
    const previousSync = process.env.GMAIL_SYNC_ENABLED;
    delete process.env.GMAIL_SYNC_ENABLED;
    const token = "super-secret-refresh-token-authentic";
    try {
      assert.equal(gmailSyncEnabled(), false);
      assert.equal(source("src/lib/gmail-sync-flag.ts").includes('process.env.GMAIL_SYNC_ENABLED === "true"'), true);
      assert.match(source(".env.example"), /^GMAIL_SYNC_ENABLED=$/m);

      const saved = await saveGmailConnection(db, "authentickam", { refreshToken: token, gmailEmail: "authentic.brand@gmail.com" });
      assert.equal(saved.ok, true);
      let setups = 0;
      const first = await onCreatorPortalLogin(db, authentic, { setup: () => { setups += 1; } });
      assert.equal(first.started, false);
      assert.equal(first.reason, "gate");
      assert.equal(first.startedAt, null);
      assert.equal(setups, 0);
      assert.equal(await gmailBridgeStartFor(db, "authentickam"), null);

      const consent = await onCreatorGmailConsent(db, "authentickam", { setup: () => { setups += 1; } });
      assert.equal(consent.reason, "gate");
      assert.equal(setups, 0);

      const again = await onCreatorPortalLogin(db, authentic, { setup: () => { setups += 1; } });
      assert.equal(again.started, false);
      assert.equal(again.reason, "gate");
      assert.equal(setups, 0);
      assert.equal(await gmailBridgeStartFor(db, "authentickam"), null);

      let reads = 0;
      const synced = await syncConnectedMailboxes(db, {
        read: async () => {
          reads += 1;
          return [];
        },
      });
      assert.equal(synced.enabled, false);
      assert.equal(reads, 0);
      assert.equal(JSON.stringify(synced).includes(token), false);
      await kosblingUntouched();
    } finally {
      restoreEnv("GMAIL_SYNC_ENABLED", previousSync);
    }
  });
});
