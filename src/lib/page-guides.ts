import { PORTAL_TABS, type PortalTab } from "@/lib/portal-tabs";

export type PageGuide = {
  id: PortalTab;
  who: string;
  purpose: string;
  principle: string;
  steps: readonly string[];
};

export const PAGE_GUIDE_STORAGE_PREFIX = "mm-page-guide:";

export function pageGuideStorageKey(id: string) {
  return `${PAGE_GUIDE_STORAGE_PREFIX}${id}`;
}

/** No saved choice means the first visit, so the guide starts open. Collapsing it is remembered. */
export function pageGuideStartsOpen(stored: string | null | undefined) {
  return stored !== "collapsed";
}

export const PAGE_GUIDES: { [K in PortalTab]: PageGuide } = {
  deals: {
    id: "deals",
    who: "Everyone signed in. Creators only see their own deals. Hidden deals and owner notes stay private.",
    purpose: "This is home for work already underway. An offer nobody has answered lives on Offers, not here.",
    principle: "You should always be able to see the next step. Nothing goes to a brand until it is approved.",
    steps: [
      "Read the line under the title. It says how many deals are moving and how many need you.",
      "Open a deal to see the brief, the dates, and what to upload.",
      "If a callout says an offer is waiting, open Offers and answer it there.",
      "Staff can switch creators at the top. All creators is the roster you are allowed to see.",
    ],
  },
  learn: {
    id: "learn",
    who: "Everyone signed in. A creator sees lessons for everyone, plus lessons written for her.",
    purpose: "Short how-to lessons on hooks, filming, editing, posting, growth, and UGC.",
    principle: "These are skills, not a contract. Private rates stay off this page.",
    steps: [
      "Open a topic and read the short lesson.",
      "A label says whether the lesson is for everyone or for one creator.",
      "Kamron or a manager can add a lesson, or edit one, and choose who sees it.",
      "Deal paperwork and the templates live on How Momma Mari works.",
    ],
  },
  how: {
    id: "how",
    who: "Everyone signed in.",
    purpose: "How a brand deal moves, how rates get talked through, and how usage works.",
    principle: "The downloads are templates. Have a lawyer review them. Nothing here is signed or sent.",
    steps: [
      "Read how a deal moves from an offer to a post.",
      "Read the notes on rates and usage before you talk numbers with a brand.",
      "Download a template only when you need that paper.",
      "Have a lawyer review anything you would sign. This page does not sign or send it.",
    ],
  },
  inbox: {
    id: "inbox",
    who: "Everyone signed in. You only see threads you are allowed to see. A creator can mark a thread private so a manager does not see it.",
    purpose: "Brand mail that looks like a deal, from a connected Gmail. Personal mail is not copied here.",
    principle: "Reading is fine. Sending is not. A reply stays a draft until the owner approves it.",
    steps: [
      "Connect Gmail from Connect accounts if the list is empty. The connection is read-only.",
      "Open a thread and read who wrote and what they want.",
      "Write a reply draft if you want something sent later. It does not go out from this page.",
      "Creators can keep a thread private. The owner can mark a thread as not a deal, and it leaves this list.",
    ],
  },
  earnings: {
    id: "earnings",
    who: "Creators and the owner. Managers do not use this page. A creator only sees their own amounts.",
    purpose: "What a deal is worth and when money is expected. No bank details live here.",
    principle: "You can see the numbers. This page does not pay anyone.",
    steps: [
      "The owner picks a creator at the top. A creator is already on their own page.",
      "Read each amount and status. TBD means the email did not say yet.",
      "Check what is still waiting on the brand before you expect a payout.",
      "If a number looks wrong, tell the owner. A transfer does not start here.",
    ],
  },
  report: {
    id: "report",
    who: "Creators and the owner. Managers do not use this page.",
    purpose: "A monthly look at earnings, deals, and growth for one creator.",
    principle: "The report can be drafted into the approval queue. It is not emailed on its own.",
    steps: [
      "Choose the creator, then the month.",
      "Read the earnings, the deals, and the growth.",
      "Draft the email only when you want it reviewed.",
      "It waits in Approvals. Nothing is sent until someone approves it there.",
    ],
  },
  analytics: {
    id: "analytics",
    who: "Everyone signed in. A creator sees their own numbers. Dollar figures stay with the owner.",
    purpose: "Weekly snapshots for each platform: this week, the change from last week, and the trend.",
    principle: "A blank means that number was not shown. The page does not invent a stat.",
    steps: [
      "Staff pick a creator at the top so the cards match the right person.",
      "Read one platform at a time and compare this week with last week.",
      "The owner can type a Monday snapshot when a number was missing.",
      "Leave a blank blank. Do not guess.",
    ],
  },
  "sponsored-posts": {
    id: "sponsored-posts",
    who: "The owner logs every sponsored post. A creator can read only her own posts.",
    purpose: "Log each sponsored post and the counts at 24 hours, 7 days, and 30 days.",
    principle: "These counts can be copied into a brand recap later. Nothing is emailed from this page.",
    steps: [
      "Add the brand, the creator, the platform, the live link, and what was promised.",
      "Enter 24 hours, 7 days, or 30 days when those counts are in. Leave a box empty when a count was not available.",
      "Read average 7-day views by brand and by creator. Open a brand recap to copy the summary.",
      "Archive hides a post from the list and the averages. The row stays in the log.",
    ],
  },
  connect: {
    id: "connect",
    who: "Everyone signed in. You connect your own accounts. A manager can see the status, not the login.",
    purpose: "Connect, reconnect, or disconnect Gmail, Google Drive, and each social account.",
    principle: "Connecting lets the portal read. It does not send mail, and you stay signed in if you disconnect.",
    steps: [
      "Read the status on the account before you click.",
      "Connect Gmail when you want brand threads in the deal inbox. Access is read-only.",
      "Connect Drive only for files you choose to share.",
      "Disconnect anything you want off. You stay signed in to the portal.",
    ],
  },
  calendar: {
    id: "calendar",
    who: "Everyone signed in. You see dates for the creators you are allowed to see.",
    purpose: "The week and month, with draft and post dates next to Google Calendar.",
    principle: "A reminder lands in the portal or in the approval queue. Nothing is emailed on its own. Google is read-only.",
    steps: [
      "Switch between week and month. Portal dates stay even if Google Calendar is quiet.",
      "Connect calendar only reads the calendar. It does not change events.",
      "Disconnect calendar revokes the connection and deletes the saved token.",
      "The owner picks a creator to see her schedule. The bot only receives busy blocks.",
    ],
  },
  kit: {
    id: "kit",
    who: "Creators. This is your kit, edited from your own sign-in.",
    purpose: "The stats and story a brand would see. Numbers are typed in by hand unless a stats connection is on.",
    principle: "You choose what is on the kit. Nothing is pulled in secret, and nothing is sent to a brand from here.",
    steps: [
      "Read the kit the way a brand would.",
      "Fix a stat that is wrong. Leave it blank if you do not know it.",
      "Turn on only the fields you want a brand to see.",
      "Copy the link when you want it shared. This page does not email it.",
    ],
  },
  approvals: {
    id: "approvals",
    who: "The owner, and a manager only when the owner has turned on email approval.",
    purpose: "The waiting list of emails that would go to a brand.",
    principle: "Nothing goes to a brand until someone with approval says yes.",
    steps: [
      "Read how many emails are waiting at the top.",
      "Open one and check the creator, the brand, and the exact words.",
      "Approve it only when it should go out. Reject it if it should not.",
      "Leave it pending if you are not sure. Pending mail is not sent.",
    ],
  },
  directory: {
    id: "directory",
    who: "Everyone signed in.",
    purpose: "The people in the portal, showing only what each creator chose to share.",
    principle: "If a creator did not check a field, it is not on the card. The owner can hide a profile that should not be up.",
    steps: [
      "Scroll the cards to see who is here.",
      "Read only the fields on the card. Missing fields were left private.",
      "Creators change what shows from My profile.",
      "The owner can moderate a profile that needs to come down. That save does not send email.",
    ],
  },
  profile: {
    id: "profile",
    who: "Your own account. Open it from the account menu.",
    purpose: "What other people in the portal can see, and the private fields behind it.",
    principle: "The profile stays hidden until you turn it on. Others only see the fields you check.",
    steps: [
      "Fill in the parts you are comfortable sharing.",
      "Check a field to show it. Leave it unchecked to keep it private.",
      "Turn the whole profile on only when you want members to see it.",
      "Use Complete your profile for the legal name and address a contract needs. That stays off the public card.",
    ],
  },
  brands: {
    id: "brands",
    who: "Owner and managers. Creators do not get this list.",
    purpose: "Contacts, past deals, and how a brand responded. Screening notes show up here.",
    principle: "The relationship lives here. Amounts stay with the owner, and a saved note is not an email.",
    steps: [
      "Find the brand and read the contact and the last response.",
      "Add a note about what happened and when to follow up.",
      "Leave dollar amounts to the owner.",
      "Save. The note stays in the portal.",
    ],
  },
  rules: {
    id: "rules",
    who: "Owner and managers. Pick one creator first. Creators do not edit these rules.",
    purpose: "What that creator will consider: niches, deliverables, and the prices they will not go under.",
    principle: "Rules come from the questionnaire and the deals they have accepted. They guide a yes. They do not email a brand.",
    steps: [
      "Choose one creator at the top. All creators is not a rules page.",
      "Read the niches and the deliverables they will do.",
      "The owner sets the price floor. That number stays off anything a brand sees.",
      "Save. The next offer can be checked against these rules.",
    ],
  },
  campaigns: {
    id: "campaigns",
    who: "Owner and managers.",
    purpose: "A brand can have more than one campaign. Each one lists the creators who fit, best pay and best fit first.",
    principle: "Rank the roster before you pitch. A rank is a suggestion, not a promise, and the list does not send email.",
    steps: [
      "Open a campaign and read the brand.",
      "Look at who is at the top and why before you offer it.",
      "Add a campaign when a brand comes back with a new brief.",
      "Skip a creator when the fit is wrong.",
    ],
  },
  commission: {
    id: "commission",
    who: "Creators use this page. The owner reads interest on the dashboard. Managers do not run it from here.",
    purpose: "Open commission and affiliate campaigns. The rate is often TBD until a deal is real.",
    principle: "Showing interest is not a contract, and it does not email the brand.",
    steps: [
      "Read the brand, the terms, and the rate. TBD means it is not set.",
      "Show interest only if you would actually do it.",
      "Wait. If it becomes your deal, it shows up on Brand deals.",
      "The owner watches the interest count on the dashboard.",
    ],
  },
  offers: {
    id: "offers",
    who: "Creators and the owner. Managers do not see brand offers.",
    purpose: "Offers that are still waiting for an answer. Brand deals is for the work after someone says yes.",
    principle: "A creator's minimum stays private. Saving or answering an offer does not send email.",
    steps: [
      "Creators read what the brand will pay, then say they are interested, suggest a counter, or pass.",
      "A pass stays in the portal. It does not email the brand by itself.",
      "The owner saves an offer for creators whose minimum and monthly cap fit. Lowest rank goes first.",
      "Leave someone off when the fit is wrong.",
    ],
  },
  gifts: {
    id: "gifts",
    who: "Creators and the owner. Managers do not use this page.",
    purpose: "Gifted products. Creators apply. The owner approves who receives one.",
    principle: "A gift is not a paid deal, and nothing is charged here. A video is still owed when you say yes.",
    steps: [
      "Creators read the product and apply only if they can post on time.",
      "The owner approves, marks it shipped, then marks it delivered when each step is true.",
      "Watch the overdue list so a promised video does not go quiet.",
      "When the video is up, save the link. Nothing is emailed for you.",
    ],
  },
  review: {
    id: "review",
    who: "Owner only.",
    purpose: "New deals stay hidden until you publish them to the creator.",
    principle: "If you have not published it, the creator cannot see it. Nothing here sends email.",
    steps: [
      "Read the new deal the way the creator would.",
      "Keep your private notes off anything they can see.",
      "Publish it when the next step is theirs.",
      "Leave it in review if the brand is not real yet.",
    ],
  },
  access: {
    id: "access",
    who: "Owner and managers. Creators do not grant access.",
    purpose: "What a manager or a bot is allowed to do.",
    principle: "People can only do what is turned on. A higher level waits until training is finished, and drafts still wait for the owner.",
    steps: [
      "The owner picks a manager or a bot and reads the level on each capability.",
      "Off means they cannot. Draft only means you still approve. Act with approval still waits.",
      "Raise a level only after the training for that level is done.",
      "Managers see their own access here. A change they request stays a draft until the owner approves it.",
    ],
  },
  prospects: {
    id: "prospects",
    who: "Owner only.",
    purpose: "A short list for offers the roster passed on. The working recruiting list stays in Kash Bot.",
    principle: "This is a reminder, not the whole pipeline. Adding a name does not send email.",
    steps: [
      "Add a prospect when the roster said no and the brand is still worth knowing.",
      "Note the niche and why they passed.",
      "Turn one into a real lead only when you mean to work it.",
      "Keep the long recruiting list in Kash Bot.",
    ],
  },
  dashboard: {
    id: "dashboard",
    who: "Owner only.",
    purpose: "What the roster is worth, which campaigns still need a creator, and the follow-ups that are due.",
    principle: "One desk for the owner. Creators do not see this rollup, and nothing here sends mail or money.",
    steps: [
      "Read the totals first so you know the week.",
      "Open follow-ups that are due. They link to the deal pipeline.",
      "Check applications, tasks, and campaigns that still need a person.",
      "Open a creator's own page when you need the detail.",
    ],
  },
  pipeline: {
    id: "pipeline",
    who: "Owner only. Creators never see these cards. Hidden deals and your notes stay private.",
    purpose: "Every brand relationship from the first hello through asking them back, on one board.",
    principle: "A card moves when that stage is done. Moving it does not email anyone, and it does not change the deal's own checklist.",
    steps: [
      "Read the strip first. It shows the count and the dollars in each stage, plus overdue follow-ups.",
      "Read the words under a column title. They say what that stage means and what moves a deal on.",
      "Use Move to next stage, or drag the card. Click a card to edit the amount, the follow-up date, or a private note.",
      "Switch creators at the top for one person. Cards with no creator yet stay on All creators.",
      "An overdue card is marked. Set a new date after you have actually followed up.",
    ],
  },
  ranking: {
    id: "ranking",
    who: "Owner only.",
    purpose: "A 0 to 100 score, shown as ten ranks, for who should see the best-fit deals first.",
    principle: "Fit still decides who can take a campaign. Rank only sorts the people who clear that gate. It does not email anyone.",
    steps: [
      "Read the board from the top. A higher rank gets first look at a deal they already fit.",
      "Open one creator and check the inputs if a score looks off.",
      "Change the weights only when you mean to change who goes first.",
      "Refresh ranks after you save. Nothing is emailed.",
    ],
  },
  reports: {
    id: "reports",
    who: "Owner only.",
    purpose: "Build a creator, team, or cross-team report and choose what is on the copy.",
    principle: "You pick the sections, including whether rank numbers show. Building a report does not send it.",
    steps: [
      "Choose who the report is about.",
      "Turn sections on or off. Leave rank numbers off if that copy will be shared.",
      "Save the report. It stays in the portal.",
      "Share a link only when you mean to. There is no automatic email.",
    ],
  },
  pods: {
    id: "pods",
    who: "Everyone signed in, but you only see the pods that belong to your sign-in.",
    purpose: "Creators grouped by niche and size, with a private room for that group.",
    principle: "A pod is a small room, not the whole roster. People outside it do not see it.",
    steps: [
      "Open a pod you belong to and read the niche, the size, and who manages it.",
      "Use the room for that group. It is private to those creators.",
      "The owner reviews suggested groups and saves only the ones they want.",
      "Rename a pod or change who is in it any time. Saving does not email the group.",
    ],
  },
  bench: {
    id: "bench",
    who: "Owner only.",
    purpose: "UGC and micro creators who join free and only see leftover jobs.",
    principle: "You approve each person. The 20% applies only when a job is paid. Nothing is charged from this list.",
    steps: [
      "Read who has joined and what they do.",
      "Approve a person before they can take a leftover job.",
      "Hand them work the roster did not take. They do not see the main deals.",
      "The fee comes off only after the brand pays. This page does not send money.",
    ],
  },
  rights: {
    id: "rights",
    who: "Everyone signed in, for the deals you are allowed to see. Renewal amounts stay with the owner.",
    purpose: "How long a brand can use a post, and which licenses are about to end.",
    principle: "A license should not expire in silence. A flag is a reminder. Saving one does not charge anyone.",
    steps: [
      "Read the end date and the flag. A close date means it is time to talk about a renewal.",
      "Check the channels and the exclusivity before you promise more.",
      "The owner can save a window or a suggested renewal. That suggestion is not a bill.",
      "Creators tell the owner when a date is close. Do not extend it from a brand email on your own.",
    ],
  },
  safety: {
    id: "safety",
    who: "Owner and managers. Creators do not clear a hold.",
    purpose: "Drafts that mention a school logo, a house number, a location tag, or a child's full name wait here.",
    principle: "The hold protects the family. The matched words are not saved, and clearing a hold does not send the draft to the brand.",
    steps: [
      "Read which draft is held and why. The matched words are not stored.",
      "Fix the draft on the deal, or decide it is safe.",
      "Clear the hold only after you have looked. The brand still waits for the normal approval.",
      "Leave it held if you are unsure.",
    ],
  },
  referrals: {
    id: "referrals",
    who: "Creators and the owner. Open it from the account menu. Managers do not use it.",
    purpose: "People you send to Momma Mari, and the placeholder perk for a referral that joins.",
    principle: "The perk number is a placeholder. Nothing is paid automatically, and a lawyer should review the terms.",
    steps: [
      "Read the perk and treat it as a note, not a payment.",
      "Record a referral when someone you sent actually applies.",
      "The owner can change the placeholder. Saving it does not pay anyone.",
      "Do not promise that the money has moved. It has not.",
    ],
  },
  support: {
    id: "support",
    who: "Everyone signed in. It lives in the account menu.",
    purpose: "A note to the team that stays inside the portal.",
    principle: "Writing here does not email anyone. Mail goes out only when a person sends it on purpose.",
    steps: [
      "Write a subject and a short message.",
      "Save the note. It stays on this page.",
      "The owner can read notes and reply on a ticket in the portal.",
      "Brand email belongs on the deal or in Approvals, not on this form.",
    ],
  },
  settings: {
    id: "settings",
    who: "Everyone signed in. Open it from the account menu.",
    purpose: "The notices you want, your connected accounts, and the seasonal theme.",
    principle: "Settings change your portal. They do not email a brand.",
    steps: [
      "Check connected accounts. Connect or disconnect Gmail and Drive here too.",
      "Choose the notices you actually want.",
      "Turn the seasonal theme off if you want the quiet look. It is the same portal either way.",
      "Save. You stay signed in.",
    ],
  },
  billing: {
    id: "billing",
    who: "Creators, from the account menu. This is your plan only.",
    purpose: "The plan you are on, and the buttons that will someday start checkout.",
    principle: "Checkout stays off until payments are turned on. Those buttons do not charge anyone today.",
    steps: [
      "Read your plan and whether a subscription is active.",
      "Look at one-time offers as a price list. The member note explains any discount.",
      "Do not expect a charge. If payments are off, the links are ready and do not run.",
      "Questions about a real invoice go to the owner, not to a button on this page.",
    ],
  },
  invoices: {
    id: "invoices",
    who: "Owner only.",
    purpose: "One invoice per deal. Reminder drafts are prepared at net due, 3 days later, and 7 days later.",
    principle: "An invoice can be drafted here. Nothing is emailed from this page, and saving one does not move money by itself.",
    steps: [
      "Find the deal and confirm the amount before you trust the invoice.",
      "Read the reminder dates so you know which draft would go next.",
      "Leave a draft in Approvals if a person still needs to send it.",
      "Mark what is true. This list is not a bank.",
    ],
  },
  payouts: {
    id: "payouts",
    who: "Creators and the owner. A creator only sees their own rows. Managers do not use this ledger.",
    purpose: "How a paid deal splits after fees and expenses.",
    principle: "Fees and expenses come off the gross first. The creator keeps 80% of what is left, and only after the brand pays. Nothing here sends money.",
    steps: [
      "Read the gross, then the fees, then what is left.",
      "Check that the brand payment is marked before you expect a creator payout.",
      "Download a blank W-9, or the W-9 stored for you. Only you and the owner can open a stored copy.",
      "The owner uploads a filed 1099-NEC. Download yearly summary for paid lines. It is not a tax form.",
    ],
  },
  team: {
    id: "team",
    who: "Owner only.",
    purpose: "Add a manager and choose which creators they can see.",
    principle: "A manager sees only the creators you assign. You can change that any time. Adding a person does not email the roster.",
    steps: [
      "Add a manager with the Google email they will use to sign in.",
      "Assign the creators they should see. Leave everyone else off.",
      "Turn permissions on one at a time. Email approval is separate and starts off.",
      "Set them inactive if they should lose access.",
    ],
  },
};

export function pageGuideFor(id: PortalTab) {
  return PAGE_GUIDES[id];
}

export function pageGuideIssues() {
  const issues: string[] = [];
  const ids = new Set(PORTAL_TABS.map((tab) => tab.id));
  for (const tab of PORTAL_TABS) {
    const guide = PAGE_GUIDES[tab.id];
    if (!guide) {
      issues.push(`missing ${tab.id}`);
      continue;
    }
    if (guide.id !== tab.id) issues.push(`id ${tab.id}`);
    if (guide.who.trim().length < 8) issues.push(`who ${tab.id}`);
    if (guide.purpose.trim().length < 20) issues.push(`purpose ${tab.id}`);
    if (guide.principle.trim().length < 20) issues.push(`principle ${tab.id}`);
    if (guide.steps.length < 3 || guide.steps.length > 5) issues.push(`steps ${tab.id} ${guide.steps.length}`);
    if (guide.steps.some((step) => step.trim().length < 12)) issues.push(`short step ${tab.id}`);
  }
  for (const id of Object.keys(PAGE_GUIDES)) {
    if (!ids.has(id as PortalTab)) issues.push(`extra ${id}`);
  }
  return issues;
}
