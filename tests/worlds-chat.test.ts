import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import * as THREE from "three";
import { enqueueOfficeCommand, listRecentCommands, updateOfficeCommand } from "../src/lib/worlds/office-command-queue";
import {
  botCapsuleScreenDiameter,
  botCapsuleWorldCenter,
  pickBotCapsule,
  rayFromClient,
} from "../src/lib/worlds/bot-hit";
import {
  APPROVAL_PHRASE,
  CHAT_POLL_MS,
  NOT_DELIVERED_LABEL,
  STALE_QUEUED_MS,
  chatForBot,
  openCommands,
  parseOfficeCommand,
  type OfficeCommand,
} from "../src/lib/worlds/office-commands";
import { buildOfficeLayout } from "../src/lib/worlds/office-layout";
import { OFFICE_FOV, officeCameraHome, roofBlocksClicks } from "../src/lib/worlds/office-move";
import { seedOfficeRecord, upcomingEvents } from "../src/lib/worlds/office-state";
import { openTestDb } from "./harness";

function source(file: string) {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

function command(partial: Partial<OfficeCommand> & Pick<OfficeCommand, "id" | "kind" | "body">): OfficeCommand {
  return {
    status: "queued",
    botIds: ["kash"],
    office: null,
    noteId: null,
    todoId: null,
    decision: null,
    topic: null,
    due: null,
    impactDollars: null,
    result: null,
    createdAt: "2026-10-23T12:00:00.000Z",
    updatedAt: "2026-10-23T12:00:00.000Z",
    ...partial,
  };
}

describe("Worlds object panels", () => {
  test("a message command is addressed to one bot and a reply comes back on the same row", async () => {
    const record = seedOfficeRecord();
    const parsed = parseOfficeCommand({ kind: "message", botId: "kash", text: "Bring the Friday list." }, record);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.kind, "message");
    assert.deepEqual(parsed.value.botIds, ["kash"]);
    assert.equal(parsed.value.body, "Bring the Friday list.");
    assert.equal(parsed.value.status, "queued");

    const previousPayments = process.env.WORLDS_PAYMENTS_ENABLED;
    delete process.env.WORLDS_PAYMENTS_ENABLED;
    const db = openTestDb();
    const calls: { body: string }[] = [];
    try {
      const queued = await enqueueOfficeCommand(db, {
        kind: "message",
        botId: "kash",
        text: "Bring the Friday list.",
      }, {
        webhookUrl: "https://bots.example/wake",
        fetchImpl: async (_url, init) => {
          calls.push({ body: init.body });
          return { ok: true };
        },
      });
      assert.equal(queued.ok, true);
      if (!queued.ok) return;
      const stored = queued.body.command;
      assert.equal(calls.length, 1);
      assert.deepEqual(JSON.parse(calls[0]?.body ?? "{}"), stored);
      assert.equal(stored.kind, "message");
      assert.deepEqual(stored.botIds, ["kash"]);
      assert.equal(stored.body, "Bring the Friday list.");
      assert.equal(stored.status, "queued");
      assert.equal(stored.result, null);
      assert.deepEqual(chatForBot([stored], "kash"), [
        { id: stored.id, from: "owner", text: "Bring the Friday list.", state: "queued" },
      ]);

      const picked = await updateOfficeCommand(db, { id: stored.id, status: "picked_up" });
      assert.equal(picked.ok, true);
      const started = await updateOfficeCommand(db, { id: stored.id, status: "in_progress" });
      assert.equal(started.ok, true);
      const done = await updateOfficeCommand(db, { id: stored.id, status: "done", result: "List is on your desk." });
      assert.equal(done.ok, true);
      if (!done.ok) return;
      const turns = chatForBot([done.body.command], "kash");
      assert.equal(turns[0]?.state, "sent");
      assert.equal(turns[1]?.from, "bot");
      assert.equal(turns[1]?.text, "List is on your desk.");

      const sensitive = await enqueueOfficeCommand(db, {
        kind: "message",
        botId: "money",
        text: "Please pay the sample vendor.",
      }, {
        webhookUrl: "https://bots.example/wake",
        fetchImpl: async () => ({ ok: true }),
      });
      assert.equal(sensitive.ok, true);
      if (!sensitive.ok) return;
      assert.equal(sensitive.body.command.status, "needs_approval");
      assert.equal(sensitive.body.command.result, APPROVAL_PHRASE);
      assert.equal(sensitive.body.webhookSent, false);
      assert.equal(sensitive.charged, false);
      assert.deepEqual(chatForBot([sensitive.body.command], "money"), [
        { id: sensitive.body.command.id, from: "owner", text: "Please pay the sample vendor.", state: "needs_approval" },
      ]);
      const recent = await listRecentCommands(db);
      assert.equal(recent.some((item) => item.id === stored.id && item.result === "List is on your desk."), true);
    } finally {
      if (previousPayments === undefined) delete process.env.WORLDS_PAYMENTS_ENABLED;
      else process.env.WORLDS_PAYMENTS_ENABLED = previousPayments;
    }
  });

  test("chat history ignores other command kinds and keeps the latest lines", () => {
    const task = command({ id: "task", kind: "assign_task", body: "File the note.", botIds: ["kash"] });
    const older = command({
      id: "older",
      kind: "message",
      body: "First",
      status: "done",
      result: "Heard.",
      createdAt: "2026-10-23T11:00:00.000Z",
    });
    const newer = command({
      id: "newer",
      kind: "message",
      body: "Second",
      status: "picked_up",
      result: "On it.",
      createdAt: "2026-10-23T12:00:00.000Z",
    });
    const turns = chatForBot([newer, task, older], "kash", 3);
    assert.deepEqual(turns.map((turn) => turn.text), ["Heard.", "Second", "On it."]);
    assert.equal(chatForBot([task], "kash").length, 0);
  });

  test("calendar, to-do, box, and meeting queues stay on their own objects", () => {
    const now = Date.parse("2026-10-23T16:00:00-04:00");
    const events = upcomingEvents(seedOfficeRecord().calendar, now);
    assert.equal(events.some((event) => event.id === "cal-hq"), false);
    assert.equal(events.some((event) => event.id === "cal-business"), true);

    const queued = [
      command({ id: "event", kind: "add_event", body: "Sponsor check-in", office: "business", status: "queued" }),
      command({ id: "todo", kind: "add_todo", body: "Call the printer", office: "business", status: "picked_up" }),
      command({ id: "check", kind: "check_todo", body: "Check off: sample", office: "business", status: "in_progress" }),
      command({ id: "note", kind: "note_decision", body: "Approve: Friday check-in", office: "business", status: "queued" }),
      command({ id: "meet", kind: "call_meeting", body: "Selected bots", topic: "Selected bots", status: "queued" }),
      command({ id: "done-event", kind: "add_event", body: "Already applied", office: "business", status: "done" }),
      command({ id: "other", kind: "add_event", body: "HQ only", office: "hq", status: "queued" }),
    ];
    assert.deepEqual(openCommands(queued, "add_event", "business").map((item) => item.id), ["event"]);
    assert.deepEqual(openCommands(queued, "add_todo", "business").map((item) => item.id), ["todo"]);
    assert.deepEqual(openCommands(queued, "check_todo", "business").map((item) => item.id), ["check"]);
    assert.deepEqual(openCommands(queued, "note_decision", "business").map((item) => item.id), ["note"]);
    assert.deepEqual(openCommands(queued, "call_meeting").map((item) => item.id), ["meet"]);
  });

  test("each tappable object opens one small panel and clicks pass the furniture", () => {
    const app = source("src/components/worlds/office-app.tsx");
    const canvas = source("src/components/worlds/office-canvas.tsx");
    const css = source("src/components/worlds/office.css");
    const grounds = source("src/components/worlds/office-grounds.tsx");
    assert.match(app, /kind: "message"/);
    assert.match(app, /aria-label=\{`\$\{bot\.name\} chat`\}/);
    assert.match(app, /aria-label=\{`Message \$\{bot\.name\}`\}/);
    assert.match(app, />Send</);
    assert.match(app, /No messages yet\./);
    assert.match(app, /Assign task/);
    assert.match(app, /aria-label=\{board\.panel === "calendar" \? "Calendar"/);
    assert.match(app, /Add event/);
    assert.match(app, /"To-dos"/);
    assert.match(app, />Check</);
    assert.match(app, /"Box"/);
    assert.match(app, />Approve</);
    assert.match(app, /aria-label="Meeting"/);
    assert.match(app, /Start a meeting/);
    assert.match(app, /Call selected/);
    assert.match(app, /if \(!panelsEnabled\) return/);
    assert.match(app, /event\.key !== "Escape"/);
    assert.match(app, /onClear=\{dismiss\}/);
    assert.match(app, /CHAT_POLL_MS/);
    assert.equal(CHAT_POLL_MS, 4000);
    assert.match(app, /setBoard\(null\)/);
    assert.match(css, /max-height: min\(78vh, 680px\)/);
    assert.match(css, /office-chat/);
    assert.match(css, /min-width: 801px/);
    assert.match(canvas, /setCanvasCursor\(event, "pointer"\)/);
    assert.match(canvas, /raycast=\{skipPointer\}/);
    assert.match(canvas, /name="bot-capsule"/);
    assert.match(canvas, /name="bot-hover"/);
    assert.match(canvas, /pickBotCapsule/);
    assert.match(canvas, /stopImmediatePropagation\(\)/);
    assert.match(canvas, /onSelect\(id\)/);
    assert.match(app, /NOT_DELIVERED_LABEL/);
    assert.match(app, /kind: "message", botId: bot\.id, text: turn\.text/);
    assert.equal(NOT_DELIVERED_LABEL, "not delivered, tap to resend");
    assert.match(canvas, /onPointerMissed/);
    assert.equal(canvas.includes("onClick={(event) => { event.stopPropagation(); onClear(); }}"), false);
    assert.match(canvas, /panel: "calendar"/);
    assert.match(canvas, /panel: "todos"/);
    assert.match(canvas, /panel: "notes"/);
    assert.match(canvas, /onOpenMeet/);
    assert.match(grounds, /roofBlocksClicks/);
    assert.match(grounds, /skipRoofRaycast/);
    assert.equal(app.includes("api.stripe.com"), false);
    assert.equal(canvas.includes("api.stripe.com"), false);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshBasicMaterial());
    desk.position.set(0, 0.5, 1.2);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.2, 1.2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    pad.position.set(0, 1.05, 0);
    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(0, 0.5, 4), new THREE.Vector3(0, 0, -1));

    const blocked = new THREE.Group();
    const solid = new THREE.Group();
    solid.add(desk);
    blocked.add(solid);
    blocked.add(pad);
    blocked.updateMatrixWorld(true);
    assert.equal(raycaster.intersectObject(blocked, true)[0]?.object, desk);

    const open = new THREE.Group();
    const inert = new THREE.Group();
    inert.raycast = () => false;
    inert.add(desk);
    open.add(inert);
    open.add(pad);
    open.updateMatrixWorld(true);
    const hits = raycaster.intersectObject(open, true);
    assert.equal(hits[0]?.object, pad);
    assert.equal(hits.some((hit) => hit.object === desk), false);
    assert.equal(roofBlocksClicks(1), false);
    assert.equal(roofBlocksClicks(0), true);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), new THREE.MeshBasicMaterial());
    glass.position.set(0, 1.2, 2);
    glass.updateMatrixWorld(true);
    const aimed = new THREE.Raycaster();
    aimed.set(new THREE.Vector3(0, 1.6, 6), new THREE.Vector3(0, 0, -1));
    const pose = { id: "content", x: 0, y: 0, z: 0, yaw: Math.PI };
    assert.equal(aimed.intersectObject(glass, true)[0]?.object, glass);
    assert.equal(pickBotCapsule(aimed.ray, [pose]), "content");
  });

  test("a desk bot capsule is easy to hit at the default zoom, ahead of the building", () => {
    const layout = buildOfficeLayout();
    const home = officeCameraHome(layout.width, layout.depth);
    const view = { left: 0, top: 0, width: 1024, height: 768 };
    const diameter = botCapsuleScreenDiameter(home.distance, view.height, OFFICE_FOV);
    assert.ok(diameter >= 72, `capsule diameter is ${diameter.toFixed(1)}px`);

    const camera = new THREE.PerspectiveCamera(OFFICE_FOV, view.width / view.height, 0.1, 800);
    camera.position.copy(home.position);
    camera.lookAt(home.target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const spot = layout.homes.content;
    assert.ok(spot, "content bot has a desk");
    const pose = { id: "content", x: spot.x, y: 0, z: spot.z, yaw: Math.PI };
    const world = botCapsuleWorldCenter(pose);
    const ndc = world.clone().project(camera);
    assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, "content bot is inside the default frame");
    const clientX = ((ndc.x + 1) / 2) * view.width;
    const clientY = ((-ndc.y + 1) / 2) * view.height;
    const ray = rayFromClient(camera, clientX, clientY, view);
    assert.ok(ray);
    assert.equal(pickBotCapsule(ray, [pose]), "content");
    const sloppy = rayFromClient(camera, clientX + diameter * 0.3, clientY, view);
    assert.ok(sloppy);
    assert.equal(pickBotCapsule(sloppy, [pose]), "content");

    const mid = ray.origin.clone().addScaledVector(ray.direction, camera.position.distanceTo(world) * 0.45);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 0.4), new THREE.MeshBasicMaterial());
    glass.position.copy(mid);
    glass.lookAt(camera.position);
    glass.updateMatrixWorld(true);
    const blocked = new THREE.Raycaster(ray.origin, ray.direction);
    const wall = blocked.intersectObject(glass, true)[0];
    assert.ok(wall, "the window sits in front of the bot");
    assert.ok(wall.distance < camera.position.distanceTo(world));
    assert.equal(pickBotCapsule(ray, [pose]), "content");

    const neighbor = { id: "kash", x: spot.x + 1.5, y: 0, z: spot.z, yaw: Math.PI };
    assert.equal(pickBotCapsule(ray, [neighbor, pose]), "content");
    const miss = rayFromClient(camera, 4, 4, view);
    assert.equal(pickBotCapsule(miss!, [pose]), null);
  });

  test("a queued message older than 10 minutes can be resent", () => {
    const now = Date.parse("2026-10-23T20:00:00.000Z");
    const stuck: OfficeCommand = {
      id: "msg-305",
      kind: "message",
      status: "queued",
      botIds: ["content"],
      office: null,
      noteId: null,
      todoId: null,
      decision: null,
      topic: null,
      body: "Hi!",
      due: null,
      impactDollars: null,
      result: null,
      createdAt: new Date(now - STALE_QUEUED_MS - 1).toISOString(),
      updatedAt: new Date(now - STALE_QUEUED_MS - 1).toISOString(),
    };
    const fresh: OfficeCommand = {
      ...stuck,
      id: "msg-fresh",
      createdAt: new Date(now - STALE_QUEUED_MS).toISOString(),
      updatedAt: new Date(now - STALE_QUEUED_MS).toISOString(),
    };
    const approval: OfficeCommand = {
      ...stuck,
      id: "msg-pay",
      status: "needs_approval",
      result: APPROVAL_PHRASE,
      body: "Please pay the printer.",
    };
    assert.equal(chatForBot([stuck], "content", 12, now)[0]?.state, "not_delivered");
    assert.equal(chatForBot([fresh], "content", 12, now)[0]?.state, "queued");
    assert.equal(chatForBot([approval], "content", 12, now)[0]?.state, "needs_approval");
    assert.equal(NOT_DELIVERED_LABEL, "not delivered, tap to resend");
  });

  test("queued commands wake the webhook while payments are off, and approval rows do not", async () => {
    const previousPayments = process.env.WORLDS_PAYMENTS_ENABLED;
    delete process.env.WORLDS_PAYMENTS_ENABLED;
    const db = openTestDb();
    const calls: { body: string; authorization?: string }[] = [];
    const fetchImpl = async (_url: string, init: { headers: { authorization?: string }; body: string }) => {
      calls.push({ body: init.body, authorization: init.headers.authorization });
      return { ok: true, status: 204 };
    };
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map((item) => String(item)).join(" "));
    };
    try {
      const message = await enqueueOfficeCommand(db, {
        kind: "message",
        botId: "content",
        text: "Office check.",
      }, {
        fetchImpl,
        webhookUrl: "https://bots.example/wake?token=secret-value",
        webhookSecret: "test-secret",
      });
      assert.equal(message.ok, true);
      if (!message.ok) return;
      assert.equal(message.body.command.status, "queued");
      assert.equal(message.body.webhookSent, true);
      assert.equal(calls[0]?.authorization, "Bearer test-secret");
      const stored = JSON.parse(calls[0]?.body ?? "{}") as { kind: string; status: string; botIds: string[]; body: string };
      assert.equal(stored.kind, "message");
      assert.equal(stored.status, "queued");
      assert.deepEqual(stored.botIds, ["content"]);
      assert.equal(stored.body, "Office check.");

      const meeting = await enqueueOfficeCommand(db, {
        kind: "call_meeting",
        botIds: ["content", "kash"],
        topic: "Friday pass",
      }, { fetchImpl, webhookUrl: "https://bots.example/wake" });
      const event = await enqueueOfficeCommand(db, {
        kind: "add_event",
        office: "business",
        title: "Sponsor check-in",
        start: "2026-10-24T09:00:00-04:00",
        end: "2026-10-24T09:30:00-04:00",
      }, { fetchImpl, webhookUrl: "https://bots.example/wake" });
      const todo = await enqueueOfficeCommand(db, {
        kind: "add_todo",
        office: "business",
        text: "Read the sample brief.",
        botId: "content",
        due: "2026-10-24",
        impactDollars: 0,
      }, { fetchImpl, webhookUrl: "https://bots.example/wake" });
      const note = await enqueueOfficeCommand(db, {
        kind: "note_decision",
        noteId: "note-business-new",
        decision: "approve",
      }, { fetchImpl, webhookUrl: "https://bots.example/wake" });
      assert.equal(meeting.ok && event.ok && todo.ok && note.ok, true);
      assert.deepEqual(calls.map((call) => JSON.parse(call.body).kind), [
        "message",
        "call_meeting",
        "add_event",
        "add_todo",
        "note_decision",
      ]);

      const blocked = await enqueueOfficeCommand(db, {
        kind: "message",
        botId: "content",
        text: "Please pay the sample vendor.",
      }, { fetchImpl, webhookUrl: "https://bots.example/wake" });
      assert.equal(blocked.ok, true);
      if (!blocked.ok) return;
      assert.equal(blocked.body.command.status, "needs_approval");
      assert.equal(blocked.body.webhookSent, false);
      assert.equal(calls.length, 5);

      const failed = await enqueueOfficeCommand(db, {
        kind: "message",
        botId: "content",
        text: "Second office check.",
      }, {
        webhookUrl: "https://bots.example/wake?token=secret-value",
        fetchImpl: async () => ({ ok: false, status: 502 }),
      });
      assert.equal(failed.ok, true);
      if (!failed.ok) return;
      assert.equal(failed.body.webhookSent, false);
      assert.match(errors.join("\n"), /HTTP 502/);
      assert.equal(errors.some((line) => line.includes("secret-value")), false);

      const missing = await enqueueOfficeCommand(db, {
        kind: "message",
        botId: "content",
        text: "Third office check.",
      }, { webhookUrl: "" });
      assert.equal(missing.ok, true);
      if (!missing.ok) return;
      assert.equal(missing.body.webhookSent, false);
      assert.match(errors.join("\n"), /WORLDS_COMMAND_WEBHOOK_URL is not set/);
    } finally {
      console.error = original;
      if (previousPayments === undefined) delete process.env.WORLDS_PAYMENTS_ENABLED;
      else process.env.WORLDS_PAYMENTS_ENABLED = previousPayments;
    }
  });
});
