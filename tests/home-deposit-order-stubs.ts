/** Stand-ins for home page imports. gather() is bundled from src/lib/parallel.ts. */

function fn(name: string, returns: string) {
  return `export function ${name}(){ return ${returns}; }`;
}

function asyncFn(name: string, returns: string) {
  return `export async function ${name}(){ return ${returns}; }`;
}

function overlap(name: string, returns: string) {
  return `export async function ${name}(){
    const state = globalThis.__homeDepositOrder;
    state.inflight += 1;
    state.max = Math.max(state.max, state.inflight);
    await Promise.resolve();
    state.inflight -= 1;
    return ${returns};
  }`;
}

function moduleFrom(lines: string[]) {
  return lines.join("\n");
}

export const homeDepositStubs: Record<string, string> = {
  "next/link": "export default function Link(){ return null; }\n",
  "next/navigation": "export function redirect(path){ throw new Error('redirect ' + String(path)); }\n",
  "@/app/actions": moduleFrom([
    fn("dismissCreatorNoticeAction", "null"),
    fn("dismissNotificationAction", "null"),
  ]),
  "@/app/free-actions": fn("dismissChecklistAction", "null"),
  "@/components/checkout-success-note": fn("CheckoutSuccessNote", "null"),
  "@/components/deal-board": fn("DealBoard", "null"),
  "@/components/home-desk": fn("HomeDesk", "null"),
  "@/components/platform-invite-card": fn("PlatformInviteCard", "null"),
  "@/components/portal-frame": fn("PortalFrame", "null"),
  "@/components/creator-todos": fn("CreatorTodos", "null"),
  "@/components/seasonal-greeting": fn("SeasonalGreeting", "null"),
  "@/lib/authz": fn("dealPowers", "{}"),
  "@/lib/format": fn("longDate", '"November 1, 2026"'),
  "@/lib/current-user": `export async function currentViewer(){ return globalThis.__homeDepositPortal.viewer; }
export async function loadPortal(){ return globalThis.__homeDepositPortal; }
`,
  "@/lib/welcome-checklist": asyncFn("welcomeChecklist", "null"),
  "@/lib/signup-codes": asyncFn("ensureInviteCode", "null"),
  "@/lib/analytics-snapshots": moduleFrom([
    asyncFn("analyticsBoard", "({ creators: [] })"),
    fn("withJulyHeadline", "({ cards: [] })"),
  ]),
  "@/lib/creator-home": moduleFrom([
    asyncFn("countOwnPayouts", "0"),
    fn("creatorBrandDealNeedsAction", "false"),
    fn("creatorHomeCards", "[]"),
    fn("creatorNeedsYou", "[]"),
    "export function firstName(name){ return String(name ?? \"\").split(\" \")[0]; }",
  ]),
  "@/lib/managers": moduleFrom([
    asyncFn("listManagerNotices", "[]"),
    overlap("needsYou", "[]"),
  ]),
  "@/lib/onboarding": overlap("listUnreadNotices", "[]"),
  "@/lib/video-review": asyncFn("listUnreadCreatorNotices", "[]"),
  "@/lib/queries": `export async function listDealsForViewer(...args){
  const state = globalThis.__homeDepositOrder;
  state.events.push(state.depositsDone ? "listDeals-after" : "listDeals-before");
  state.inflight += 1;
  state.max = Math.max(state.max, state.inflight);
  try {
    const run = globalThis.__homeDepositRun?.listDealsForViewer;
    return run ? await run(...args) : [];
  } finally {
    state.inflight -= 1;
  }
}
export async function getDealForViewer(...args){
  const run = globalThis.__homeDepositRun?.getDealForViewer;
  return run ? run(...args) : null;
}
`,
  "@/lib/brand-offers": overlap("listCreatorOffers", "[]"),
  "@/lib/creator-deal-review": moduleFrom([
    "export const CREATOR_REVIEW_EMPTY = \"Nothing to accept.\";",
    fn("creatorReviewNeedsAction", "false"),
    asyncFn("listCreatorDealReviews", "[]"),
  ]),
  "@/lib/creator-tasks": `export async function listCreatorOpenTasks(...args){
  const state = globalThis.__homeDepositOrder;
  state.events.push(state.depositsDone ? "tasks-after" : "tasks-before");
  const run = globalThis.__homeDepositRun?.listCreatorOpenTasks;
  return run ? run(...args) : [];
}
`,
  "@/lib/brand-deposits": `async function finishDeposit(name, args, key){
  await Promise.resolve();
  const run = globalThis.__homeDepositRun?.[key];
  if (run) await run(...args);
  const state = globalThis.__homeDepositOrder;
  state.depositsDone = true;
  state.events.push(name);
}
export function ensureOpenDeposits(...args){ return finishDeposit("ensureOpenDeposits", args, "ensureOpenDeposits"); }
export function ensureCreatorDeposits(...args){ return finishDeposit("ensureCreatorDeposits", args, "ensureCreatorDeposits"); }
`,
  "@/lib/questionnaire": asyncFn("questionnaireFor", "({ finished: true, paused: false })"),
  "@/lib/invite-notes": fn("inviteErrorNote", "null"),
  "@/lib/notice-notes": fn("noticeErrorNote", "null"),
  "@/lib/gmail-bridge": asyncFn("countDealInbox", "0"),
  "@/lib/platform-invites": asyncFn("listPlatformInvites", "[]"),
  "@/lib/promo-visuals": asyncFn("promoViewsForDeals", "[]"),
  "@/lib/free-deal-slot": asyncFn("freeDealSlot", "({ allowed: true, reason: null, blockingDealId: null })"),
};
