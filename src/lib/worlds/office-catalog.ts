/**
 * Bot office roster, verified wins, and the chat links that were in the
 * CSS-3D prototype. Private rate floors and private relationship details
 * are not stored here. Dollar amounts below are recorded brand-deal wins.
 */

export type BotStatus = "working" | "waiting" | "idle";

export type OfficeBot = {
  id: string;
  name: string;
  short: string;
  role: string;
  task: string;
  update: string;
  status: BotStatus;
  /** Prototype agent id. Null when the prototype had no id for this bot. */
  chatId: string | null;
};

export type OfficeAchievement = {
  icon: string;
  title: string;
  date: string;
  detail: string;
  source: string;
  xp: number;
  credit: string[];
};

export type LockedAchievement = {
  icon: string;
  title: string;
  goal: string;
};

export const BOT_STATUSES: BotStatus[] = ["working", "waiting", "idle"];

export const STATUS_LABEL: Record<BotStatus, string> = {
  working: "Working",
  waiting: "Waiting on Kamron",
  idle: "Idle",
};

export const OFFICE_BOTS: OfficeBot[] = [
  {
    id: "kash",
    name: "Kash Bot",
    short: "KB",
    role: "Hub and team manager. Runs the syncs and delivers messages between bots.",
    task: "Deliver the Oct 22 8 PM sync messages to each bot; watch the stalled deposit build.",
    update: "8 PM sync written (team-notes/2026-10-22-8pm-sync.md) for Kash Bot to deliver.",
    status: "working",
    chatId: "kash",
  },
  {
    id: "lifemgr",
    name: "Life Manager Bot",
    short: "LM",
    role: "Manager of the Personal wing.",
    task: "New bot. No tasks assigned yet.",
    update: "Just added by Kamron (Oct 22).",
    status: "idle",
    chatId: "lifemgr",
  },
  {
    id: "life",
    name: "Life Bot",
    short: "LB",
    role: "Personal logistics and planning.",
    task: "Not listed in the status files.",
    update: "No entry in team-status.md or the 8 PM sync.",
    status: "idle",
    chatId: "life",
  },
  {
    id: "travel",
    name: "Travel Bot",
    short: "TR",
    role: "Plans trips and keeps travel logistics moving.",
    task: "No tasks assigned yet.",
    update: "Added for the Personal wing. No status entry yet.",
    status: "idle",
    chatId: null,
  },
  {
    id: "finance",
    name: "Personal Finance Bot",
    short: "PF",
    role: "Personal finance admin. Dollar summaries only.",
    task: "No tasks assigned yet.",
    update: "Added for the Personal wing. No status entry yet.",
    status: "idle",
    chatId: null,
  },
  {
    id: "home",
    name: "Home & Errands Bot",
    short: "HE",
    role: "Home tasks and errands.",
    task: "No tasks assigned yet.",
    update: "Added for the Personal wing. No status entry yet.",
    status: "idle",
    chatId: null,
  },
  {
    id: "health",
    name: "Health Admin Bot",
    short: "HA",
    role: "Health admin and appointment reminders. Charts and diagnoses stay off this floor.",
    task: "No tasks assigned yet.",
    update: "Added for the Personal wing. No status entry yet.",
    status: "idle",
    chatId: null,
  },
  {
    id: "family",
    name: "Family & Relationships Bot",
    short: "FR",
    role: "Family plans and reminders. Private details stay off this floor.",
    task: "No tasks assigned yet.",
    update: "Added for the Personal wing. No status entry yet.",
    status: "idle",
    chatId: null,
  },
  {
    id: "bizmgr",
    name: "Business Manager Bot",
    short: "BM",
    role: "Manager of the Business wing.",
    task: "New bot. No tasks assigned yet.",
    update: "Just added by Kamron (Oct 22).",
    status: "idle",
    chatId: "bizmgr",
  },
  {
    id: "money",
    name: "Money Bot",
    short: "$",
    role: "Tracks payments, deposits and invoices.",
    task: "Persona accepted at $2,800 (50% upfront requested); Yohood $300, Faogo $400; Tailor $203 pending.",
    update: "Watching. Photon $400 waits on Kamron.",
    status: "working",
    chatId: "money",
  },
  {
    id: "growth",
    name: "Business Growth Bot",
    short: "BG",
    role: "Portal builds, growth sprints, decision queue.",
    task: "Unstick deposit build bc-da6edb4e (~6h40m, no PR); log PR #189.",
    update: "Deposit build stalled (7:30 PM sprint).",
    status: "working",
    chatId: "growth",
  },
  {
    id: "intake",
    name: "Brand Intake Bot",
    short: "BI",
    role: "Logs inbound brands and their stage.",
    task: "Update OLLY (passed), Persona (accepted $2,800), 4 awaiting; add gaming prospects.",
    update: "Assigned at the 8 PM sync.",
    status: "working",
    chatId: "intake",
  },
  {
    id: "outreach",
    name: "Brand Outreach Bot",
    short: "BO",
    role: "Pitches brands and sponsors.",
    task: "Gaming sponsor list done; nudge cards re-card Fri 9 AM; gift-guide wave 1.",
    update: "Cards blocked on Kamron.",
    status: "waiting",
    chatId: "outreach",
  },
  {
    id: "content",
    name: "Content Bot",
    short: "CT",
    role: "Content plans, guides and copy.",
    task: "Learn Track 2 Beauty; Guides #1-#3.",
    update: "Guides wait on Kamron.",
    status: "waiting",
    chatId: "content",
  },
  {
    id: "dm",
    name: "DM Manager Bot",
    short: "DM",
    role: "Handles creator DMs under standing rules.",
    task: "Standing DM rules (all creators).",
    update: "No change. Creator-facing quiet hours start 9 PM.",
    status: "idle",
    chatId: "dm",
  },
  {
    id: "ak",
    name: "AuthenticKam Email Bot",
    short: "AK",
    role: "Sorts the AuthenticKam inbox hourly.",
    task: "Hourly sort; Yohood waiting on Kamron.",
    update: "Quiet (7:13 PM run).",
    status: "waiting",
    chatId: "ak",
  },
  {
    id: "cremgr",
    name: "Creator Manager Bot",
    short: "CM",
    role: "Manager of the Creator wing.",
    task: "New bot. No tasks assigned yet.",
    update: "Just added by Kamron (Oct 22).",
    status: "idle",
    chatId: "cremgr",
  },
  {
    id: "mari",
    name: "Mariclare Bot",
    short: "MC",
    role: "Runs MariClare's brand inbox and replies.",
    task: "Delete stale Persona draft; watch 7 open threads; Fri 9 AM batch incl. 9 nudge re-cards.",
    update: "5 PM batch sent 5:09 PM; OLLY passed; Persona accepted at $2,800 (8:40 PM).",
    status: "working",
    chatId: "mari",
  },
  {
    id: "ops",
    name: "Creator Ops Bot",
    short: "CO",
    role: "Creator roster, intake and bench.",
    task: "Streamer intake on the PR #189 fields; free bench for all niches.",
    update: "Active (8 PM sync).",
    status: "working",
    chatId: "ops",
  },
];

export const OFFICE_TOPICS: Record<string, string[]> = {
  "Brand deal": ["mari", "intake", "money"],
  "Portal build": ["growth", "ops", "kash"],
  "Content": ["content", "dm"],
  "Outreach": ["outreach", "intake", "kash"],
};

export const UNLOCKED_ACHIEVEMENTS: OfficeAchievement[] = [
  { icon: "💵", title: "International Wire", date: "Oct 15", detail: "SUNGBOON Editor collab paid $2,500 and matched to the brand's remittance advice.", source: "team-notes/closed-items.md; money/build_ledger.py", xp: 250, credit: ["money", "mari"] },
  { icon: "🛡️", title: "Mail Armor I", date: "Oct 18", detail: "SPF and DKIM live on mommamari.com.", source: "knowledge/deliverability.md", xp: 100, credit: ["kash"] },
  { icon: "💍", title: "Big Ticket", date: "Oct 19", detail: "Darry Ring deal paid $3,200 (reconciled against the Wise transfer).", source: "team-notes/closed-items.md; money/build_ledger.py", xp: 320, credit: ["mari", "money"] },
  { icon: "🌬️", title: "Invoice Landed", date: "Oct 20", detail: "Levoit $2,500 landed (invoice MM-LEVOIT-2500).", source: "team-notes/closed-items.md; money/build_ledger.py", xp: 250, credit: ["money", "mari"] },
  { icon: "🛠️", title: "Ship It", date: "Oct 20–21", detail: "Portal PRs #144, #145 (166 tests) and #146 usage-rights tracker (171 tests) merged.", source: "overnight-results-2026-10-21.md", xp: 200, credit: ["growth", "kash"] },
  { icon: "🛡️", title: "Mail Armor II", date: "Oct 21", detail: "DMARC live for mommamari.com (p=none), confirmed by DNS Oct 22.", source: "knowledge/deliverability.md; closed-items.md", xp: 100, credit: ["kash"] },
  { icon: "📋", title: "Checklist Cleared", date: "Oct 22", detail: "Portal checklist PRs #173–#186 all merged by 7:37 AM ET.", source: "team-notes/closed-items.md", xp: 300, credit: ["growth", "kash"] },
  { icon: "📬", title: "Inbox Zero Sprint", date: "Oct 22", detail: "9 AM MariClare batch: 13 replies sent, 14 stale drafts cleared.", source: "team-notes/closed-items.md", xp: 130, credit: ["mari"] },
  { icon: "🌐", title: "Live on the Web", date: "Oct 22", detail: "mommamari.com published 3:21 PM ET with the new H1, title and meta description.", source: "Kash Bot session record (Webflow publish)", xp: 150, credit: ["kash"] },
  { icon: "🎮", title: "Level Up the Portal", date: "Oct 22", detail: "PR #189 merged 5:28 PM ET: niche multi-select, Kick/Twitch/X/Snapchat, streamer fields (248 tests).", source: "team-notes/2026-10-22-8pm-sync.md", xp: 200, credit: ["growth", "kash"] },
  { icon: "🎯", title: "Gaming Sponsor Scout", date: "Oct 22", detail: "Gaming sponsor prospect list finished.", source: "team-status.md; 8pm sync", xp: 80, credit: ["outreach"] },
  { icon: "🤝", title: "Deal Closed", date: "Oct 22", detail: "Persona accepted at $2,800 for 4 Reels (8:40 PM ET); 50% upfront requested.", source: "money/build_ledger.py (Persona row)", xp: 280, credit: ["mari", "money"] },
];

export const LOCKED_ACHIEVEMENTS: LockedAchievement[] = [
  { icon: "📺", title: "First Signed Streamer", goal: "Sign the first streamer through the new intake." },
  { icon: "💰", title: "Deposit Received", goal: "Persona's 50% upfront payment lands." },
  { icon: "🏦", title: "Business Bank Account", goal: "Open the Momma Mari LLC business account." },
  { icon: "📈", title: "$10K Month", goal: "$10,000 in brand-deal revenue in one calendar month." },
  { icon: "🔒", title: "Deposit Feature Shipped", goal: "Merge the 50% deposit (P-DEP1) portal build." },
  { icon: "📚", title: "Published Author", goal: "Publish creator Guides #1–#3 on mommamari.com." },
  { icon: "📨", title: "Mail Armor III", goal: "Set up Google Postmaster Tools." },
];

export const TEAM_LEVEL_XP = 500;
export const BOT_LEVEL_XP = 200;

export const OFFICE_SNAPSHOT = "Snapshot as of Oct 22, 2026, 8:02 PM ET. Persona accepted at $2,800. Walking between rooms is simulated.";

const PRIVATE_OFFICE_TEXT = [
  /minimum\s+rate/i,
  /creator minimum/i,
  /rate floor/i,
  /account number/i,
  /routing number/i,
  /\bgirlfriend\b/i,
  /\bboyfriend\b/i,
  /\bspouse\b/i,
  /\bhusband\b/i,
  /\bwife\b/i,
  /\bdiagnosis\b/i,
];

export function chatHrefFor(chatId: string | null) {
  if (!chatId) return null;
  return `grokbot://app/v1/agent?id=${encodeURIComponent(chatId)}`;
}

export function teamXp(achievements: OfficeAchievement[] = UNLOCKED_ACHIEVEMENTS) {
  return achievements.reduce((sum, achievement) => sum + achievement.xp, 0);
}

export function teamLevel(xp: number) {
  return Math.floor(xp / TEAM_LEVEL_XP) + 1;
}

/** XP is split evenly among the bots credited on each verified win. */
export function botXp(id: string, achievements: OfficeAchievement[] = UNLOCKED_ACHIEVEMENTS) {
  return achievements
    .filter((achievement) => achievement.credit.includes(id))
    .reduce((sum, achievement) => sum + Math.round(achievement.xp / achievement.credit.length), 0);
}

export function containsPrivateOfficeDetail(text: string) {
  return PRIVATE_OFFICE_TEXT.some((pattern) => pattern.test(text));
}

export function findOfficeBot(id: string) {
  return OFFICE_BOTS.find((bot) => bot.id === id) ?? null;
}
