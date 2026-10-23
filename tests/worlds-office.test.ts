import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { accountMenuItems } from "../src/lib/creator-home";
import { botXp, chatHrefFor, teamLevel, teamXp } from "../src/lib/worlds/office-catalog";
import {
  buildOfficeLayout,
  connectedRoomIds,
  roomAt,
  route,
} from "../src/lib/worlds/office-layout";
import { isBotOfficePath } from "../src/lib/worlds/office-path";
import { assignBotRooms, createSimState, spotForRoom } from "../src/lib/worlds/office-sim";
import { enqueueOfficeCommand, listPendingCommands, listRecentCommands, updateOfficeCommand } from "../src/lib/worlds/office-command-queue";
import { APPROVAL_PHRASE, nextCommandState, speechForBots, type OfficeCommand } from "../src/lib/worlds/office-commands";
import { loadOfficeStatus, saveOfficeSnapshot, saveOfficeWrite } from "../src/lib/worlds/office-status";
import {
  OFFICE_KEYS,
  OFFICE_POLL_MS,
  applyOfficeWrite,
  boardStations,
  containsPrivateOfficeDetail,
  notesForView,
  officeText,
  parseOfficeSnapshot,
  recordFromStored,
  seedOfficeRecord,
} from "../src/lib/worlds/office-state";
import { containsPrivateOfficeDetail as privateDetail } from "../src/lib/worlds/office-catalog";
import { foliageForMonth, skyKindFromCode, sunElevation, weatherFromOpenMeteo, zonedParts } from "../src/lib/worlds/office-weather";
import { worldsPaymentsEnabled } from "../src/lib/worlds/office-payments";
import { formatWalletMoney, parseWalletWrite, vaultPilePlan } from "../src/lib/worlds/office-wallets";
import { listOfficeWallets, saveOfficeWallet } from "../src/lib/worlds/office-wallet-store";
import { openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("bot office", () => {
  test("the floor plan has a wing office and manager room, and every room connects through doors", () => {
    const layout = buildOfficeLayout();
    for (const name of ["Personal", "Business", "Creators"]) {
      assert.ok(layout.rooms.some((room) => room.kind === "office" && room.wing === name));
      assert.ok(layout.rooms.some((room) => room.kind === "manager" && room.wing === name));
    }
    for (const id of ["hall", "hq", "conference", "library", "break", "vault"]) {
      assert.ok(layout.rooms.some((room) => room.id === id));
    }
    const vault = layout.rooms.find((room) => room.id === "vault");
    assert.equal(vault?.kind, "vault");
    assert.ok(layout.doors.some((door) => door.a === "hall" && door.b === "vault"));
    if (vault) {
      const intoVault = route(layout, layout.homes.kash, { x: vault.x + vault.w / 2, z: vault.z + vault.d / 2 });
      assert.ok(intoVault.some((point) => roomAt(layout, point).id === "hall"));
      assert.equal(layout.windows.some((opening) => (
        opening.x >= vault.x && opening.x <= vault.x + vault.w && opening.z >= vault.z && opening.z <= vault.z + vault.d
      )), false);
    }
    const connected = connectedRoomIds(layout);
    assert.equal(connected.size, layout.rooms.length);
    assert.equal(roomAt(layout, layout.homes.kash).id, "hq");
    assert.equal(roomAt(layout, layout.homes.life).id, "office:personal");
    assert.equal(roomAt(layout, layout.homes.lifemgr).id, "manager:personal");
    assert.equal(roomAt(layout, layout.homes.money).id, "office:business");
    assert.equal(roomAt(layout, layout.homes.mari).id, "office:creators");
    const path = route(layout, layout.homes.life, layout.breakSpots[0]);
    assert.ok(path.some((point) => roomAt(layout, point).id === "hall"));
    const managerDoor = route(layout, layout.homes.life, layout.homes.lifemgr);
    assert.equal(managerDoor.some((point) => roomAt(layout, point).id === "hall"), false);
  });

  test("each wing and HQ has a calendar, whiteboard, and inbox inside its room", () => {
    const layout = buildOfficeLayout();
    const stations = boardStations(layout);
    assert.deepEqual(stations.map((station) => station.office), ["personal", "business", "creators", "hq"]);
    for (const station of stations) {
      for (const point of [station.calendar, station.whiteboard, station.inbox]) {
        assert.equal(roomAt(layout, point).id, station.roomId);
      }
    }
  });

  test("a snapshot room change walks the bot there instead of teleporting on every poll", () => {
    const layout = buildOfficeLayout();
    const state = createSimState(layout, ["life"]);
    assignBotRooms(state, layout, { life: "break" });
    const life = state.bots.life;
    assert.equal(life?.assignedRoom, "break");
    assert.ok((life?.path.length ?? 0) > 0);
    assert.equal(roomAt(layout, life?.path[life.path.length - 1] ?? { x: 0, z: 0 }).id, "break");
    const again = life?.path.length ?? 0;
    assignBotRooms(state, layout, { life: "break" });
    assert.equal(life?.path.length, again);
    const spot = spotForRoom(layout, "library", "mari");
    assert.equal(spot ? roomAt(layout, spot).id : "", "library");
  });

  test("the seed is the prototype roster plus sample boards, with chat links only where the prototype had an id", () => {
    const record = seedOfficeRecord();
    const ids = record.bots.map((bot) => bot.id);
    for (const id of ["kash", "lifemgr", "bizmgr", "cremgr", "life", "travel", "finance", "home", "health", "family", "money", "growth", "intake", "outreach", "content", "dm", "ak", "mari", "ops"]) {
      assert.ok(ids.includes(id), id);
    }
    assert.equal(record.bots.find((bot) => bot.id === "travel")?.chatId, null);
    assert.equal(chatHrefFor("kash"), "grokbot://app/v1/agent?id=kash");
    assert.equal(chatHrefFor(null), null);
    for (const office of OFFICE_KEYS) {
      assert.ok(record.calendar.some((event) => event.office === office));
      assert.ok(record.todos.some((todo) => todo.office === office));
    }
    assert.ok(notesForView(record.notes, "main").every((note) => note.status === "approved_to_show"));
    assert.ok(notesForView(record.notes, "review").length >= 3);
    assert.equal(notesForView(record.notes, "review").some((note) => note.status === "held"), true);
    assert.equal(notesForView(record.notes, "main").some((note) => note.status === "held"), false);
    assert.equal(privateDetail(officeText(record)), false);
    assert.equal(JSON.stringify(record).toLowerCase().includes("minimum rate"), false);
    assert.equal(teamXp(record.achievements), 2360);
    assert.equal(teamLevel(2360), 5);
    assert.equal(botXp("money", record.achievements), 550);
    const parsed = parseOfficeSnapshot(record);
    assert.equal(parsed.ok, true);
  });

  test("managers can update their own board, Kash sets note status, and a full snapshot replaces wins", async () => {
    const seed = seedOfficeRecord();
    const otherWing = applyOfficeWrite(seed, {
      actor: "lifemgr",
      office: "business",
      todos: [{ id: "todo-x", office: "business", task: "Sample task.", ownerBot: "money", due: "2026-10-25", impactDollars: 0, done: false }],
    });
    assert.equal(otherWing.ok, false);
    if (!otherWing.ok) assert.equal(otherWing.status, 403);

    const ownWing = applyOfficeWrite(seed, {
      actor: "bizmgr",
      office: "business",
      todos: [{ id: "todo-money", office: "business", task: "Sample: watch the invoice list.", ownerBot: "money", due: "2026-10-25", impactDollars: 40, done: false }],
    });
    assert.equal(ownWing.ok, true);
    if (ownWing.ok) {
      assert.equal(ownWing.value.todos.some((todo) => todo.id === "todo-money"), true);
      assert.equal(ownWing.value.todos.some((todo) => todo.office === "personal"), true);
    }

    const denied = applyOfficeWrite(seed, { actor: "mari", notes: [{ id: "note-business-new", status: "approved_to_show" }] });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 403);

    const approved = applyOfficeWrite(seed, { actor: "kash", notes: [{ id: "note-business-new", status: "approved_to_show" }] });
    assert.equal(approved.ok, true);
    if (approved.ok) assert.equal(approved.value.notes.find((note) => note.id === "note-business-new")?.status, "approved_to_show");

    const dropped = applyOfficeWrite(seed, {
      actor: "mari",
      notes: [{ office: "creators", date: "2026-10-23", idea: "Sample: add a roster check to the Friday list.", whyNow: "The intake fields are in." }],
    });
    assert.equal(dropped.ok, true);
    if (dropped.ok) {
      const note = dropped.value.notes.find((item) => item.idea.startsWith("Sample: add a roster"));
      assert.equal(note?.status, "new");
      assert.equal(note?.bot, "mari");
    }

    const held = applyOfficeWrite(seed, {
      actor: "outreach",
      notes: [{ office: "business", date: "2026-10-23", idea: "Sample idea.", whyNow: "Sample reason.", status: "held" }],
    });
    assert.equal(held.ok, false);

    const privateTask = applyOfficeWrite(seed, { bots: [{ id: "life", task: "Ask about the minimum rate." }] });
    assert.equal(privateTask.ok, false);

    const dirty = parseOfficeSnapshot({ ...seed, bots: seed.bots.map((bot) => bot.id === "life" ? { ...bot, task: "Ask about the minimum rate." } : bot) });
    assert.equal(dirty.ok, false);

    const db = openTestDb();
    const before = await loadOfficeStatus(db);
    assert.equal(before.updatedAt, null);
    assert.equal(before.pollMs, OFFICE_POLL_MS);
    const posted = await saveOfficeSnapshot(db, { ...seed, achievements: [{ icon: "🏁", title: "Sample win", date: "Oct 22", detail: "A sourced sample win.", source: "team-notes/closed-items.md", xp: 40, credit: ["kash"] }] });
    assert.equal(posted.ok, true);
    if (posted.ok) assert.equal(posted.body.team.xp, 40);
    const loaded = await loadOfficeStatus(db);
    assert.ok(loaded.updatedAt);
    assert.equal(loaded.team.xp, 40);
    const patched = await saveOfficeWrite(db, { bots: [{ id: "kash", room: "break", status: "waiting" }] });
    assert.equal(patched.ok, true);
    const after = await loadOfficeStatus(db);
    assert.equal(after.bots.find((bot) => bot.id === "kash")?.room, "break");
    assert.equal(after.bots.find((bot) => bot.id === "kash")?.status, "waiting");
    assert.equal(after.team.xp, 40);

    const merged = recordFromStored({ bots: { mari: { update: "Sample update from the overlay." } } });
    assert.equal(merged.bots.find((bot) => bot.id === "mari")?.update, "Sample update from the overlay.");
    assert.ok(merged.calendar.length >= 4);
  });

  test("the route, page, and redirect stay owner-only and do not touch payments or mail", () => {
    assert.equal(isBotOfficePath("/worlds"), true);
    assert.equal(isBotOfficePath("/portal/worlds", "/portal"), true);
    assert.equal(isBotOfficePath("/worlds/extra"), false);
    assert.equal(OFFICE_POLL_MS >= 30_000 && OFFICE_POLL_MS <= 60_000, true);
    assert.equal(containsPrivateOfficeDetail("creator minimum rate"), true);

    const page = source("src/app/worlds/page.tsx");
    const route = source("src/app/api/worlds/status/route.ts");
    const app = source("src/components/worlds/office-app.tsx");
    const redirects = source("next.config.ts");
    assert.match(page, /requireViewer/);
    assert.match(page, /isOwner/);
    assert.match(page, /notFound\(\)/);
    assert.match(page, /index: false/);
    assert.match(route, /authorizeBot/);
    assert.match(route, /isOwner/);
    assert.match(route, /saveOfficeSnapshot/);
    assert.match(route, /saveOfficeWrite/);
    assert.match(route, /export async function POST/);
    assert.match(route, /export async function GET/);
    assert.match(app, /OFFICE_POLL_MS/);
    assert.match(app, /ssr:\s*false/);
    assert.match(app, /notesForView/);
    assert.match(app, /Open chat/);
    assert.match(redirects, /source:\s*"\/admin\/world"/);
    assert.match(redirects, /destination:\s*"\/worlds"/);
    assert.equal(accountMenuItems("admin").some((item) => item.href === "/worlds" && item.newTab), true);
    assert.equal(accountMenuItems("creator").some((item) => item.href === "/worlds"), false);
    assert.equal(accountMenuItems("manager").some((item) => item.href === "/worlds"), false);

    const readme = source("README.md");
    assert.match(readme, /POST \/api\/worlds\/status/);
    assert.match(readme, /impactDollars/);
    assert.match(readme, /approved_to_show/);
    assert.match(readme, /BOT_API_TOKEN/);
    assert.match(readme, /45 seconds/);
    assert.match(readme, /POST \/api\/worlds\/commands/);
    assert.match(readme, /WORLDS_COMMAND_WEBHOOK_URL/);
    assert.match(readme, /WORLDS_PAYMENTS_ENABLED/);
    assert.match(readme, /needs your OK in Grok Bot/);
    assert.match(readme, /\/api\/worlds\/wallets/);
    assert.match(app, /Add wallet/);
    assert.match(app, /Panels/);
    assert.match(app, /mm-worlds-panels/);
    assert.match(app, /localStorage/);
    assert.match(app, /onOpenMeet/);
    assert.match(app, /onClear/);
    assert.match(source("src/components/worlds/office.css"), /45vh/);
    assert.match(source("src/components/worlds/office.css"), /office-sheet/);
    const walletsRoute = source("src/app/api/worlds/wallets/route.ts");
    assert.match(walletsRoute, /authorizeBot/);
    assert.match(walletsRoute, /isOwner/);
    assert.match(walletsRoute, /export async function GET/);
    assert.match(walletsRoute, /export async function POST/);
    const walletMigration = source("drizzle/0061_office_wallets.sql");
    assert.match(walletMigration, /CREATE TABLE office_wallets/);
    assert.equal(walletMigration.toLowerCase().includes("delete "), false);
    assert.equal(walletMigration.toLowerCase().includes("drop table"), false);

    const migration = source("drizzle/0059_office_world.sql");
    assert.match(migration, /CREATE TABLE office_world_status/);
    assert.equal(migration.toLowerCase().includes("delete "), false);
    assert.equal(migration.toLowerCase().includes("drop table"), false);
    const commandMigration = source("drizzle/0060_office_commands.sql");
    assert.match(commandMigration, /CREATE TABLE office_world_commands/);
    assert.equal(commandMigration.toLowerCase().includes("delete "), false);
    assert.equal(commandMigration.toLowerCase().includes("drop table"), false);

    const commandsRoute = source("src/app/api/worlds/commands/route.ts");
    assert.match(commandsRoute, /authorizeBot/);
    assert.match(commandsRoute, /isOwner/);
    assert.match(commandsRoute, /enqueueOfficeCommand/);
    assert.match(commandsRoute, /export async function POST/);
    assert.match(commandsRoute, /export async function PATCH/);
    assert.match(app, /Mission log/);
    assert.match(app, /needs your OK in Grok Bot/);
    assert.match(app, /Assign task/);
    const canvas = source("src/components/worlds/office-canvas.tsx");
    assert.match(canvas, /anisotropy/);
    assert.match(canvas, /OfficeSite/);
    assert.match(canvas, /VaultDoor/);
    assert.match(canvas, /onOpenMeet/);
    assert.match(canvas, /MapControls/);
    assert.match(canvas, /THREE\.MOUSE\.PAN/);
    assert.match(canvas, /THREE\.MOUSE\.ROTATE/);
    assert.match(canvas, /THREE\.TOUCH\.PAN/);
    assert.match(canvas, /THREE\.TOUCH\.DOLLY_ROTATE/);
    assert.match(canvas, /MAP_MIN_DISTANCE/);
    assert.match(canvas, /clampMapTarget/);
    assert.match(app, /Recenter/);
    assert.match(app, /aria-label="Zoom in"/);
    assert.match(app, /aria-label="Zoom out"/);
    const grounds = source("src/components/worlds/office-grounds.tsx");
    assert.match(grounds, /Momma Mari/);
    const weather = source("src/lib/worlds/office-weather.ts");
    assert.match(weather, /35\.58/);
    assert.match(weather, /-80\.81/);
    assert.match(weather, /America\/New_York/);
    assert.match(weather, /api\.open-meteo\.com/);
    assert.match(source(".env.example"), /WORLDS_COMMAND_WEBHOOK_URL/);
    assert.match(source(".env.example"), /WORLDS_PAYMENTS_ENABLED/);
    const layout = source("src/app/layout.tsx");
    assert.match(layout, /x-bot-office/);
    assert.match(layout, /SiteFooter/);
    assert.match(source("src/proxy.ts"), /x-bot-office/);

    const files = [
      "src/app/worlds/page.tsx",
      "src/app/api/worlds/status/route.ts",
      "src/app/api/worlds/commands/route.ts",
      "src/components/worlds/office-app.tsx",
      "src/components/worlds/office-canvas.tsx",
      "src/components/worlds/office-grounds.tsx",
      "src/lib/worlds/office-state.ts",
      "src/lib/worlds/office-status.ts",
      "src/lib/worlds/office-catalog.ts",
      "src/lib/worlds/office-commands.ts",
      "src/lib/worlds/office-command-queue.ts",
      "src/lib/worlds/office-payments.ts",
      "src/app/api/worlds/wallets/route.ts",
      "src/lib/worlds/office-wallets.ts",
      "src/lib/worlds/office-wallet-store.ts",
    ];
    for (const file of files) {
      const text = source(file);
      assert.equal(text.includes("api.stripe.com"), false, file);
      assert.equal(text.includes("BOLDSIGN"), false, file);
      assert.equal(text.includes("startCheckoutAction"), false, file);
      assert.equal(text.toLowerCase().includes("minimum rate"), false, file);
    }
  });

  test("commands queue, wake a webhook, and stop send/pay/delete until Kamron says OK", async () => {
    const previousPayments = process.env.WORLDS_PAYMENTS_ENABLED;
    delete process.env.WORLDS_PAYMENTS_ENABLED;
    const db = openTestDb();
    const calls: { url: string; body: string }[] = [];
    const fetchImpl = async (url: string, init: { method: "POST"; headers: { "content-type": string }; body: string }) => {
      calls.push({ url, body: init.body });
      return { ok: true };
    };
    try {
    assert.equal(worldsPaymentsEnabled(), false);
    const queued = await enqueueOfficeCommand(db, {
      kind: "assign_task",
      botId: "money",
      text: "Watch the sample invoice list.",
      due: "2026-10-24",
    }, { fetchImpl, webhookUrl: "https://bots.example/wake" });
    assert.equal(queued.ok, true);
    if (!queued.ok) return;
    assert.equal(queued.body.command.status, "queued");
    assert.equal(queued.body.webhookSent, true);
    assert.equal(calls.length, 1);
    assert.equal(JSON.parse(calls[0]?.body ?? "{}").id, queued.body.command.id);

    const pending = await listPendingCommands(db);
    assert.equal(pending.some((command) => command.id === queued.body.command.id), true);

    const picked = await updateOfficeCommand(db, { id: queued.body.command.id, status: "picked_up", result: "On it." });
    assert.equal(picked.ok, true);
    const started = await updateOfficeCommand(db, { id: queued.body.command.id, status: "in_progress" });
    assert.equal(started.ok, true);
    const done = await updateOfficeCommand(db, { id: queued.body.command.id, status: "done", result: "List checked." });
    assert.equal(done.ok, true);
    const after = await listPendingCommands(db);
    assert.equal(after.some((command) => command.id === queued.body.command.id), false);
    const log = await listRecentCommands(db);
    assert.equal(log[0]?.result, "List checked.");

    const illegal = nextCommandState("done", "picked_up", null);
    assert.equal(illegal.ok, false);

    const callsBeforePay = calls.length;
    const blocked = await enqueueOfficeCommand(db, {
      kind: "ask",
      botId: "kash",
      text: "Please pay the sample vendor.",
    }, {
      fetchImpl,
      webhookUrl: "https://bots.example/wake",
    });
    assert.equal(blocked.ok, true);
    if (!blocked.ok) return;
    assert.equal(blocked.body.command.status, "needs_approval");
    assert.equal(blocked.body.command.result, APPROVAL_PHRASE);
    assert.equal(blocked.charged, false);
    assert.equal(blocked.body.charged, false);
    assert.equal(blocked.body.webhookSent, false);
    assert.equal(calls.length, callsBeforePay);
    const stillThere = await listRecentCommands(db);
    assert.equal(stillThere.some((command) => command.id === blocked.body.command.id), true);
    const notPending = await listPendingCommands(db);
    assert.equal(notPending.some((command) => command.id === blocked.body.command.id), false);
    const denied = await updateOfficeCommand(db, { id: blocked.body.command.id, status: "done" });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.status, 403);
      assert.equal(denied.error, "Worlds payments are off. Nothing was charged.");
      assert.equal("charged" in denied ? denied.charged : undefined, false);
    }
    const held = await listRecentCommands(db);
    assert.equal(held.find((command) => command.id === blocked.body.command.id)?.status, "needs_approval");

    const meeting = await enqueueOfficeCommand(db, {
      kind: "call_meeting",
      botIds: ["kash", "money"],
      topic: "Friday brand batch",
    }, { webhookUrl: "" });
    assert.equal(meeting.ok, true);
    if (meeting.ok) {
      const bubble = speechForBots([meeting.body.command]);
      assert.equal(bubble.money, "Friday brand batch");
      assert.equal(speechForBots([blocked.body.command]).kash, APPROVAL_PHRASE);
    }

    const note = await enqueueOfficeCommand(db, { kind: "note_decision", noteId: "note-business-new", decision: "approve" });
    assert.equal(note.ok, true);
    if (note.ok) assert.deepEqual(note.body.command.botIds.includes("kash") && note.body.command.botIds.includes("outreach"), true);

    const missing = await enqueueOfficeCommand(db, { kind: "assign_task", botId: "nope", text: "Hi", due: "2026-10-24" });
    assert.equal(missing.ok, false);

    const sample: OfficeCommand = blocked.body.command;
    assert.equal(sample.result, "needs your OK in Grok Bot");

    process.env.WORLDS_PAYMENTS_ENABLED = "true";
    assert.equal(worldsPaymentsEnabled(), true);
    const paidCalls: { url: string }[] = [];
    const paid = await enqueueOfficeCommand(db, {
      kind: "ask",
      botId: "money",
      text: "Please pay the sample vendor.",
    }, {
      fetchImpl: async (url) => {
        paidCalls.push({ url });
        return { ok: true };
      },
      webhookUrl: "https://bots.example/wake",
    });
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.equal(paid.body.command.status, "needs_approval");
    assert.equal(paid.body.command.result, APPROVAL_PHRASE);
    assert.equal(paid.charged, false);
    assert.equal(paid.body.charged, false);
    assert.equal(paid.body.webhookSent, true);
    assert.equal(paidCalls.length, 1);
    const stillBlocked = await updateOfficeCommand(db, { id: paid.body.command.id, status: "done" });
    assert.equal(stillBlocked.ok, false);
    if (!stillBlocked.ok) {
      assert.equal(stillBlocked.status, 403);
      assert.match(stillBlocked.error, /does not move money/);
    }
    const paidRow = await listRecentCommands(db);
    assert.equal(paidRow.find((command) => command.id === paid.body.command.id)?.status, "needs_approval");
    } finally {
      if (previousPayments === undefined) delete process.env.WORLDS_PAYMENTS_ENABLED;
      else process.env.WORLDS_PAYMENTS_ENABLED = previousPayments;
    }
  });

  test("the vault stores balances only and the piles grow with the USD total", async () => {
    assert.equal(formatWalletMoney(0), "$0");
    assert.equal(vaultPilePlan(0).count, 0);
    assert.ok(vaultPilePlan(100000).cashHeight > vaultPilePlan(100).cashHeight);
    assert.ok(vaultPilePlan(100000).goldHeight > vaultPilePlan(100).goldHeight);
    assert.ok(vaultPilePlan(100000).count > vaultPilePlan(100).count);

    const extra = parseWalletWrite({ name: "Operating cash", type: "cash", balance: 10, currency: "USD", accountNumber: "123456789" });
    assert.equal(extra.ok, false);
    const numbered = parseWalletWrite({ name: "acct 123456789", type: "bank", balance: 10, currency: "USD" });
    assert.equal(numbered.ok, false);

    const db = openTestDb();
    const empty = await listOfficeWallets(db);
    assert.equal(empty.total, 0);
    assert.deepEqual(empty.wallets, []);

    const created = await saveOfficeWallet(db, { name: "Operating cash", type: "cash", balance: 4200, currency: "usd" });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.status, 201);
    assert.equal(created.body.total, 4200);
    assert.equal(created.body.wallet.currency, "USD");
    assert.equal(created.body.wallet.type, "cash");
    assert.ok(created.body.wallet.updatedAt);

    const updated = await saveOfficeWallet(db, { name: "Operating cash", type: "bank", balance: 2500.5, currency: "USD" });
    assert.equal(updated.ok, true);
    if (!updated.ok) return;
    assert.equal(updated.status, 200);
    assert.equal(updated.body.wallets.length, 1);
    assert.equal(updated.body.wallet.id, created.body.wallet.id);
    assert.equal(updated.body.wallet.balance, 2500.5);

    const gold = await saveOfficeWallet(db, { name: "Bars", type: "gold", balance: 800, currency: "USD" });
    assert.equal(gold.ok, true);
    const euros = await saveOfficeWallet(db, { name: "Euro drawer", type: "other", balance: 50, currency: "EUR" });
    assert.equal(euros.ok, true);
    const listed = await listOfficeWallets(db);
    assert.equal(listed.wallets.length, 3);
    assert.equal(listed.total, 3300.5);
    assert.equal(listed.currency, "USD");
    assert.equal(listed.wallets.some((wallet) => wallet.currency === "EUR" && wallet.balance === 50), true);

    const missing = await saveOfficeWallet(db, { id: "wallet_missing", name: "Nope", type: "cash", balance: 1, currency: "USD" });
    assert.equal(missing.ok, false);
  });

  test("Mooresville weather follows the code, the local hour, and the season", () => {
    assert.equal(skyKindFromCode(0, 0), "clear");
    assert.equal(skyKindFromCode(3, 0), "clouds");
    assert.equal(skyKindFromCode(61, 0), "rain");
    assert.equal(skyKindFromCode(45, 0), "fog");
    assert.equal(skyKindFromCode(71, 0), "snow");
    assert.equal(foliageForMonth(1), "winter");
    assert.equal(foliageForMonth(4), "spring");
    assert.equal(foliageForMonth(7), "summer");
    assert.equal(foliageForMonth(10), "fall");
    const noon = zonedParts(new Date("2026-07-15T16:00:00Z"));
    assert.ok(sunElevation(noon.hour) > 0.9);
    const night = zonedParts(new Date("2026-01-15T05:00:00Z"));
    assert.ok(sunElevation(night.hour) < -0.9);
    const live = weatherFromOpenMeteo({
      current: { weather_code: 63, cloud_cover: 90, precipitation: 1.2, wind_speed_10m: 12, temperature_2m: 8 },
    }, new Date("2026-10-23T16:00:00Z"));
    assert.equal(live.kind, "rain");
    assert.equal(live.foliage, "fall");
    assert.ok(live.wind >= 8);
    assert.match(live.label, /Mooresville/);
    assert.match(live.label, /windy/);
  });
});
