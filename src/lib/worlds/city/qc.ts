/**
 * Per-building QC for Worlds City tasks.
 * Runs the owner practice harness, then writes a pass/fail record.
 * Live social actions and live email sending stay off. Nothing is posted or sent.
 */

import { HQ_BOT_ID, buildOfficeLayout } from "../office-layout";
import { createSimState, stepOfficeSim } from "../office-sim";
import { EARNINGS_CAP_CENTS, REAL_PAYMENTS, findCityShopItem, formatKash } from "../economy";
import { decideEnter, OFFICE_BOT_LOCK } from "./access";
import { CITY_LOCATION_IDS, CITY_LOCATIONS } from "./locations";
import { insideOffice, roleMayStand, tryLeaveOffice } from "./movement";
import { practiceNote, practiceOwnerSession, runPracticeTask } from "./practice";
import {
  LIVE_EMAIL_SEND,
  LIVE_SOCIAL_ACTIONS,
  buyCityItem,
  emptyCitySession,
  submitCityTask,
  taskWindow,
  tasksForLocation,
  type CityTask,
  type ExternalChannel,
} from "./tasks";

export const QC_MARKER_START = "<!-- worlds-qc:start -->";
export const QC_MARKER_END = "<!-- worlds-qc:end -->";

export type QcAssertionName = "autoCheck" | "peerScore" | "ownerGate" | "sent" | "kash" | "dailyCap";

export type QcAssertion = {
  name: QcAssertionName;
  pass: boolean;
  detail: string;
};

export type TaskQc = {
  taskId: string;
  name: string;
  external: ExternalChannel;
  pass: boolean;
  sent: boolean;
  payoutCents: number;
  balanceCents: number;
  score: number | null;
  assertions: QcAssertion[];
};

export type SharedCapQc = {
  windowKey: string;
  limit: number;
  pass: boolean;
  detail: string;
};

export type NegativeQc = {
  id: "spam-comment" | "nsfw" | "apartment-yard" | "non-owner-office" | "office-bot-leave";
  name: string;
  locationId: string;
  pass: boolean;
  detail: string;
};

export type BuildingQcReport = {
  locationId: string;
  name: string;
  pass: boolean;
  liveSocialActions: boolean;
  liveEmailSend: boolean;
  earningsCapCents: number | null;
  realPayments: boolean;
  sent: boolean;
  tasks: TaskQc[];
  sharedCaps: SharedCapQc[];
  negatives: NegativeQc[];
  note: string;
};

export type WorldsQcReport = {
  liveSocialActions: boolean;
  liveEmailSend: boolean;
  earningsCapCents: number | null;
  realPayments: boolean;
  pass: boolean;
  buildings: BuildingQcReport[];
  negatives: NegativeQc[];
};

const ASSERTION_ORDER: readonly QcAssertionName[] = ["autoCheck", "peerScore", "ownerGate", "sent", "kash", "dailyCap"];

function flagsHold() {
  return LIVE_SOCIAL_ACTIONS === false && LIVE_EMAIL_SEND === false && EARNINGS_CAP_CENTS === null && REAL_PAYMENTS === false;
}

function weakNote(task: CityTask): { note: string; pattern: RegExp } | null {
  if (task.taskType === "comment") return { note: "Hey yo", pattern: /auto check/i };
  if (task.external === "email") return { note: "Please look at the Friday cut.", pattern: /auto check/i };
  if (task.taskType === "story") return { note: "Too short.", pattern: /auto check/i };
  if (task.taskType === "rate") return { note: "The line is clear.", pattern: /auto check/i };
  if (task.taskType === "story-post") return { note: "Friday", pattern: /auto check/i };
  if (task.realWork) return { note: "No", pattern: /short note/i };
  return null;
}

function probeAutoCheck(task: CityTask): QcAssertion {
  const listed = task.pipeline.autoChecks.join(" ");
  if (task.pipeline.autoChecks.length === 0) {
    return { name: "autoCheck", pass: false, detail: "No auto check is configured." };
  }
  const probe = weakNote(task);
  if (!probe) {
    return { name: "autoCheck", pass: true, detail: `Auto check is on. ${listed}` };
  }
  const result = submitCityTask(practiceOwnerSession(), task.id, { optIn: true, note: probe.note, now: 8_000_000 });
  if (result.ok || !probe.pattern.test(result.error)) {
    return { name: "autoCheck", pass: false, detail: result.ok ? "A weak note passed the auto check." : result.error };
  }
  return { name: "autoCheck", pass: true, detail: `Weak note rejected. ${listed}` };
}

function fillDailyCap(task: CityTask): QcAssertion {
  if (task.id === "office-check-in") {
    const first = submitCityTask(practiceOwnerSession(), task.id, { optIn: true, note: practiceNote(task), now: 9_000_000 });
    if (!first.ok || first.sent !== false) {
      return { name: "dailyCap", pass: false, detail: "Check-in did not save." };
    }
    const second = submitCityTask(first.session, task.id, { optIn: true, note: practiceNote(task), now: 9_005_000 });
    const pass = !second.ok && /already checked in/i.test(second.error);
    return {
      name: "dailyCap",
      pass,
      detail: pass ? "Check-in is once. The next visit was rejected. No earnings cap." : "A second check-in was accepted.",
    };
  }
  const window = taskWindow(task);
  let session = practiceOwnerSession();
  let now = 9_000_000;
  for (let count = 0; count < window.limit; count += 1) {
    const result = submitCityTask(session, task.id, { optIn: true, note: practiceNote(task), now });
    if (!result.ok || result.sent !== false) {
      const reason = result.ok ? "sent was not false" : result.error;
      return { name: "dailyCap", pass: false, detail: `Stopped on attempt ${count + 1}: ${reason}` };
    }
    if (result.session.kashCents !== task.payoutCents * (count + 1)) {
      return {
        name: "dailyCap",
        pass: false,
        detail: `Balance ${result.session.kashCents} after ${count + 1}. Expected ${task.payoutCents * (count + 1)}.`,
      };
    }
    session = result.session;
    now += window.cooldownMs;
  }
  const extra = submitCityTask(session, task.id, { optIn: true, note: practiceNote(task), now });
  const pass = !extra.ok && extra.error.includes(`limited to ${window.limit}`);
  return {
    name: "dailyCap",
    pass,
    detail: pass
      ? `Accepted ${window.limit}, then blocked. Window ${window.windowKey}. No earnings cap.`
      : `The run past ${window.limit} was not blocked.`,
  };
}

function runTaskQc(task: CityTask): TaskQc {
  const run = runPracticeTask(task.id, 5_000_000);
  const sent = run.ok ? run.sent === false : false;
  const balanceCents = run.ok ? run.balanceCents : 0;
  const score = run.ok ? run.score : null;
  const auto = probeAutoCheck(task);
  if (!run.ok) auto.pass = false;
  if (!run.ok) auto.detail = `Practice run failed: ${run.error}`;

  let peer: QcAssertion;
  if (!run.ok) peer = { name: "peerScore", pass: false, detail: run.error };
  else if (task.pipeline.peerScore) {
    const pass = typeof run.score === "number" && run.score >= 55 && run.score <= 98 && /score/i.test(run.message);
    peer = { name: "peerScore", pass, detail: pass ? `Peer or bot score ${run.score}.` : "The peer or bot score was missing." };
  } else {
    const pass = run.score === null && !/Peer score|Practice score/i.test(run.message);
    peer = { name: "peerScore", pass, detail: pass ? "No peer or bot score on this path." : "A score appeared on a path that does not score." };
  }

  let gate: QcAssertion;
  if (!run.ok) gate = { name: "ownerGate", pass: false, detail: run.error };
  else if (task.external !== "none") {
    const pass = task.pipeline.ownerGate === true && /Owner gate holds this draft|Held for Kamron/.test(run.message);
    gate = {
      name: "ownerGate",
      pass,
      detail: pass ? `Owner gate holds the ${task.external} draft.` : "External work did not stop at the owner gate.",
    };
  } else if (task.pipeline.ownerGate) {
    const pass = /Held for Kamron/.test(run.message);
    gate = { name: "ownerGate", pass, detail: pass ? "Owner gate holds this draft." : "The owner gate did not hold the draft." };
  } else {
    gate = { name: "ownerGate", pass: true, detail: "Stays in the city. No owner gate." };
  }

  const sentCheck: QcAssertion = {
    name: "sent",
    pass: run.ok && sent,
    detail: run.ok && sent ? "sent: false" : "A run reported a send.",
  };

  const payoutOk = run.ok
    && run.balanceCents === task.payoutCents
    && run.payoutCents === task.payoutCents
    && (task.payoutCents === 0 || run.message.includes(formatKash(task.payoutCents)));
  const kash: QcAssertion = {
    name: "kash",
    pass: payoutOk,
    detail: `Payout ${formatKash(task.payoutCents)}. Balance ${formatKash(balanceCents)}.`,
  };

  const dailyCap = fillDailyCap(task);
  const assertions = [auto, peer, gate, sentCheck, kash, dailyCap];
  return {
    taskId: task.id,
    name: task.name,
    external: task.external,
    pass: assertions.every((item) => item.pass) && flagsHold(),
    sent: run.ok ? run.sent : true,
    payoutCents: task.payoutCents,
    balanceCents,
    score,
    assertions,
  };
}

function sharedCapProofs(tasks: readonly CityTask[]): SharedCapQc[] {
  const groups = new Map<string, CityTask[]>();
  for (const task of tasks) {
    if (task.id === "office-check-in") continue;
    const window = taskWindow(task);
    const list = groups.get(window.windowKey) ?? [];
    list.push(task);
    groups.set(window.windowKey, list);
  }
  const proofs: SharedCapQc[] = [];
  for (const [windowKey, group] of groups) {
    if (group.length < 2) continue;
    const first = group[0];
    const second = group[1];
    const window = taskWindow(first);
    let session = practiceOwnerSession();
    let now = 11_000_000;
    let blocked = false;
    for (let count = 0; count < window.limit; count += 1) {
      const result = submitCityTask(session, first.id, { optIn: true, note: practiceNote(first), now });
      if (!result.ok || result.sent !== false) {
        proofs.push({ windowKey, limit: window.limit, pass: false, detail: `Shared cap stopped early on ${first.id}.` });
        blocked = true;
        break;
      }
      session = result.session;
      now += window.cooldownMs;
    }
    if (blocked) continue;
    const extra = submitCityTask(session, second.id, { optIn: true, note: practiceNote(second), now });
    const capped = !extra.ok && extra.error.includes(`limited to ${window.limit}`);
    const own = tasks.find((item) => item.dailyLimit != null && taskWindow(item).windowKey !== windowKey);
    let ownOk = true;
    let ownDetail = "";
    if (own && capped) {
      const still = submitCityTask(session, own.id, { optIn: true, note: practiceNote(own), now: now + 1_000 });
      ownOk = still.ok && still.sent === false;
      ownDetail = ownOk ? ` ${own.id} keeps its own cap of ${taskWindow(own).limit}.` : ` ${own.id} was blocked by the shared window.`;
    }
    proofs.push({
      windowKey,
      limit: window.limit,
      pass: capped && ownOk,
      detail: capped
        ? `${window.limit} ${first.id} runs filled ${windowKey}. The next ${second.id} was rejected.${ownDetail} No earnings cap.`
        : `${second.id} was accepted after ${window.limit} shared runs.`,
    });
  }
  return proofs;
}

function negativeSpam(): NegativeQc {
  const before = practiceOwnerSession();
  const result = submitCityTask(before, "social-comment", {
    optIn: true,
    note: "Buy now click here https://spam.example/deal",
    now: 20_000_000,
  });
  const pass = !result.ok && /Spam comments are rejected/.test(result.error) && before.kashCents === 0 && before.submissions.length === 0;
  return {
    id: "spam-comment",
    name: "Spam comment rejected",
    locationId: "social-club",
    pass,
    detail: pass ? "Spam comment rejected. Nothing was posted." : "A spam comment was accepted.",
  };
}

function negativeNsfw(): NegativeQc {
  const comment = submitCityTask(practiceOwnerSession(), "social-comment", {
    optIn: true,
    note: "This comment is NSFW.",
    now: 20_100_000,
  });
  const story = submitCityTask(practiceOwnerSession(), "library-story", {
    optIn: true,
    note: "A Friday drop turned NSFW on the shelf before anyone pressed play.",
    now: 20_200_000,
  });
  const pass = !comment.ok && /NSFW is blocked/.test(comment.error) && !story.ok && /NSFW is blocked/.test(story.error);
  return {
    id: "nsfw",
    name: "NSFW blocked",
    locationId: "social-club",
    pass,
    detail: pass ? "NSFW is blocked on the comment and the short story. Nothing was posted or sent." : "An NSFW note was accepted.",
  };
}

function negativeYard(): NegativeQc {
  const session = { ...emptyCitySession(), homeTier: "apartment" as const, kashCents: 50_000, ownedSkus: [] as string[] };
  const planter = findCityShopItem("city-planter");
  const result = buyCityItem(session, "city-planter", 21_000_000);
  const pass = planter?.name === "Yard planter"
    && planter.kind === "outdoor"
    && !result.ok
    && /cannot buy yard, outdoor, or oversized/.test(result.error)
    && session.kashCents === 50_000
    && session.ownedSkus.length === 0;
  return {
    id: "apartment-yard",
    name: "Apartment buying a yard item rejected",
    locationId: "furniture-shop",
    pass,
    detail: pass ? "Apartment cannot buy the yard planter. No Kash moved." : "The apartment bought a yard item.",
  };
}

function negativeOfficeEnter(): NegativeQc {
  const office = CITY_LOCATIONS.find((item) => item.id === "office");
  if (!office) {
    return { id: "non-owner-office", name: "Non-owner office enter rejected", locationId: "office", pass: false, detail: "Office is missing." };
  }
  const user = decideEnter(office, "user", emptyCitySession());
  const owner = decideEnter(office, "owner", emptyCitySession());
  const pass = user.open === false && /Only Kamron and the office roster/.test(user.reason) && owner.open === true;
  return {
    id: "non-owner-office",
    name: "Non-owner office enter rejected",
    locationId: "office",
    pass,
    detail: pass ? user.reason : "A non-owner entered the office.",
  };
}

function negativeOfficeBotLeave(): NegativeQc {
  const leave = tryLeaveOffice("officeBot");
  const layout = buildOfficeLayout();
  const state = createSimState(layout, [HQ_BOT_ID]);
  const bot = state.bots[HQ_BOT_ID];
  if (!bot) {
    return { id: "office-bot-leave", name: "Office bot leave blocked", locationId: "office", pass: false, detail: "The roster bot is missing." };
  }
  bot.path = [{ x: -40, z: -40 }];
  stepOfficeSim(state, layout, 0.05, { meeting: [], statuses: {}, rng: () => 0.2 });
  const pass = leave.allowed === false
    && leave.reason === OFFICE_BOT_LOCK
    && roleMayStand("officeBot", layout, -30, -30) === false
    && roleMayStand("officeBot", layout, 4, 4) === true
    && bot.path.length === 0
    && bot.act === "At desk"
    && insideOffice(layout, bot.x, bot.z, 0.2);
  return {
    id: "office-bot-leave",
    name: "Office bot leave blocked",
    locationId: "office",
    pass,
    detail: pass ? OFFICE_BOT_LOCK : "An office bot left HQ.",
  };
}

function runNegatives(): NegativeQc[] {
  return [negativeSpam(), negativeNsfw(), negativeYard(), negativeOfficeEnter(), negativeOfficeBotLeave()];
}

function buildingNote(locationId: string, taskCount: number) {
  if (taskCount > 0) return "Each task ran on a throwaway owner session. Nothing was posted or sent.";
  if (locationId === "clothing-shop" || locationId === "furniture-shop") {
    return "No scored tasks. The shop spends Kash and does not post or send mail.";
  }
  return "No scored tasks.";
}

export function runWorldsQc(): WorldsQcReport {
  const negatives = runNegatives();
  const flagsOk = flagsHold();
  const buildings = CITY_LOCATION_IDS.map((locationId) => {
    const location = CITY_LOCATIONS.find((item) => item.id === locationId);
    const catalog = tasksForLocation(locationId);
    const tasks = catalog.map((task) => runTaskQc(task));
    const sharedCaps = sharedCapProofs(catalog);
    const buildingNegatives = negatives.filter((item) => item.locationId === locationId);
    const sent = tasks.some((item) => item.sent !== false);
    const pass = flagsOk
      && !sent
      && tasks.every((item) => item.pass)
      && sharedCaps.every((item) => item.pass)
      && buildingNegatives.every((item) => item.pass);
    return {
      locationId,
      name: location?.name ?? locationId,
      pass,
      liveSocialActions: LIVE_SOCIAL_ACTIONS,
      liveEmailSend: LIVE_EMAIL_SEND,
      earningsCapCents: EARNINGS_CAP_CENTS,
      realPayments: REAL_PAYMENTS,
      sent,
      tasks,
      sharedCaps,
      negatives: buildingNegatives,
      note: buildingNote(locationId, tasks.length),
    } satisfies BuildingQcReport;
  });
  const pass = flagsOk && buildings.every((item) => item.pass) && negatives.every((item) => item.pass);
  return {
    liveSocialActions: LIVE_SOCIAL_ACTIONS,
    liveEmailSend: LIVE_EMAIL_SEND,
    earningsCapCents: EARNINGS_CAP_CENTS,
    realPayments: REAL_PAYMENTS,
    pass,
    buildings,
    negatives,
  };
}

function cell(pass: boolean, text: string) {
  return pass ? text : `Fail. ${text}`;
}

export function renderBuildingMarkdown(report: BuildingQcReport) {
  const lines = [
    `# ${report.name} QC`,
    "",
    `Result: ${report.pass ? "PASS" : "FAIL"}`,
    "",
    "`LIVE_SOCIAL_ACTIONS` is false. `LIVE_EMAIL_SEND` is false. Nothing is posted or emailed. There is no earnings cap.",
    "",
    report.note,
    "",
    "| Task | Auto check | Peer or bot score | Owner gate | Sent | Kash payout | Daily cap | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  if (report.tasks.length === 0) {
    lines.push(`| — | — | — | — | false | — | — | ${report.pass ? "PASS" : "FAIL"} |`);
  }
  for (const task of report.tasks) {
    const byName = Object.fromEntries(task.assertions.map((item) => [item.name, item]));
    const peer = task.score === null ? "No score" : String(task.score);
    const gate = task.external === "none" ? "Not external" : "Owner gate";
    lines.push(
      `| ${task.name} | ${cell(byName.autoCheck.pass, "Pass")} | ${cell(byName.peerScore.pass, peer)} | ${cell(byName.ownerGate.pass, gate)} | ${task.sent} | ${formatKash(task.payoutCents)} | ${cell(byName.dailyCap.pass, "Blocked at the cap")} | ${task.pass ? "PASS" : "FAIL"} |`,
    );
  }
  if (report.sharedCaps.length > 0) {
    lines.push("", "## Shared daily caps", "");
    for (const cap of report.sharedCaps) {
      lines.push(`- ${cap.pass ? "PASS" : "FAIL"}: ${cap.detail}`);
    }
  }
  if (report.negatives.length > 0) {
    lines.push("", "## Negative checks", "");
    for (const item of report.negatives) {
      lines.push(`- ${item.pass ? "PASS" : "FAIL"}: ${item.detail}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}`;
}

export function renderBuildingJson(report: BuildingQcReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderQcSummary(report: WorldsQcReport) {
  const lines = [
    "`npm run worlds:qc` prints this table. `LIVE_SOCIAL_ACTIONS` and `LIVE_EMAIL_SEND` stay false. Nothing is posted or emailed.",
    "",
    "| Building | Tasks | Passed | Result |",
    "| --- | ---: | ---: | --- |",
  ];
  for (const building of report.buildings) {
    const passed = building.tasks.filter((item) => item.pass).length;
    lines.push(`| ${building.name} | ${building.tasks.length} | ${passed} | ${building.pass ? "PASS" : "FAIL"} |`);
  }
  const passedNegatives = report.negatives.filter((item) => item.pass).length;
  lines.push(`| Negative checks | ${report.negatives.length} | ${passedNegatives} | ${report.negatives.every((item) => item.pass) ? "PASS" : "FAIL"} |`);
  lines.push("");
  lines.push("Negative checks: spam comment rejected, NSFW blocked, apartment buying a yard item rejected, non-owner office enter rejected, office bot leave blocked.");
  lines.push("");
  lines.push("Per-building JSON and markdown reports: `src/lib/worlds/city/qc-reports/`.");
  lines.push("");
  return lines.join("\n");
}

export function formatQcTable(report: WorldsQcReport) {
  const lines = [
    "Worlds City task QC",
    "LIVE_SOCIAL_ACTIONS=false",
    "LIVE_EMAIL_SEND=false",
    "",
    `${"Building".padEnd(20)} ${"Tasks".padStart(5)} ${"Passed".padStart(6)}  Result`,
  ];
  for (const building of report.buildings) {
    const passed = building.tasks.filter((item) => item.pass).length;
    lines.push(`${building.name.padEnd(20)} ${String(building.tasks.length).padStart(5)} ${String(passed).padStart(6)}  ${building.pass ? "PASS" : "FAIL"}`);
  }
  const passedNegatives = report.negatives.filter((item) => item.pass).length;
  const negativesPass = report.negatives.every((item) => item.pass);
  lines.push(`${"Negative checks".padEnd(20)} ${String(report.negatives.length).padStart(5)} ${String(passedNegatives).padStart(6)}  ${negativesPass ? "PASS" : "FAIL"}`);
  const failures: string[] = [];
  for (const building of report.buildings) {
    for (const task of building.tasks) {
      if (task.pass) continue;
      const missed = task.assertions.filter((item) => !item.pass).map((item) => `${item.name}: ${item.detail}`).join("; ");
      failures.push(`FAIL  ${building.locationId}  ${task.taskId}  ${missed}`);
    }
    for (const cap of building.sharedCaps) {
      if (!cap.pass) failures.push(`FAIL  ${building.locationId}  ${cap.windowKey}  ${cap.detail}`);
    }
  }
  for (const item of report.negatives) {
    if (!item.pass) failures.push(`FAIL  ${item.locationId}  ${item.id}  ${item.detail}`);
  }
  if (failures.length > 0) {
    lines.push("");
    lines.push(...failures);
  }
  lines.push("");
  lines.push(report.pass ? "PASS" : "FAIL");
  return lines.join("\n");
}

export function spliceQcSummary(source: string, summary: string) {
  const block = `${QC_MARKER_START}\n${summary.trim()}\n${QC_MARKER_END}`;
  if (!source.includes(QC_MARKER_START) || !source.includes(QC_MARKER_END)) return source;
  return source.replace(new RegExp(`${QC_MARKER_START}[\\s\\S]*?${QC_MARKER_END}`), block);
}

export function assertionOrder() {
  return ASSERTION_ORDER;
}
