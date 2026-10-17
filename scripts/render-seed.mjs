/**
 * Writes drizzle/0001_seed.sql from the mockup (Oct 17, 2026).
 * Run: node scripts/render-seed.mjs
 * The SQL file is what Webflow Cloud applies. Keep this script and that file together.
 */
import { writeFileSync } from "node:fs";

const T = "2026-10-17T18:00:00.000Z";

function q(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table, rows) {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const values = rows
    .map((row) => `  (${columns.map((column) => q(row[column])).join(", ")})`)
    .join(",\n");
  return `INSERT INTO ${table} (${columns.join(", ")})\nVALUES\n${values};\n`;
}

const creators = [
  {
    id: "mariclare",
    name: "MariClare",
    email: "mmaclamroc@gmail.com",
    handles: "@_mariclaremaclamroc_",
    kids_ages: null,
    payout_method: null,
    split_percent: null,
    monthly_goal_cents: 500000,
    drive_folder_id: "1Gmcgw_vSgxR07PTdHF--SN2k-2ZodEfE",
    initials: "MC",
    tiktok_status: "disconnected",
    instagram_status: "disconnected",
    facebook_status: "disconnected",
    youtube_status: "disconnected",
    email_status: "connected",
    tiktok_connect_url: null,
    instagram_connect_url: null,
    facebook_connect_url: null,
    youtube_connect_url: null,
    list_note:
      "Also quoted and waiting on brands: Momcozy, JuJuBit, Sandjest, Perking, MINISO. They show up here once they say yes.",
    is_seed: 1,
    created_at: T,
  },
  {
    id: "abby",
    name: "Abby Theriot",
    email: "abby.theriot@example.com",
    handles: null,
    kids_ages: null,
    payout_method: null,
    split_percent: null,
    monthly_goal_cents: null,
    drive_folder_id: null,
    initials: "AT",
    tiktok_status: "disconnected",
    instagram_status: "disconnected",
    facebook_status: "disconnected",
    youtube_status: "disconnected",
    email_status: "disconnected",
    tiktok_connect_url: null,
    instagram_connect_url: null,
    facebook_connect_url: null,
    youtube_connect_url: null,
    list_note: null,
    is_seed: 1,
    created_at: T,
  },
  {
    id: "authentickam",
    name: "AuthenticKam",
    email: "authentickam@example.com",
    handles: null,
    kids_ages: null,
    payout_method: null,
    split_percent: null,
    monthly_goal_cents: null,
    drive_folder_id: null,
    initials: "AK",
    tiktok_status: "disconnected",
    instagram_status: "disconnected",
    facebook_status: "disconnected",
    youtube_status: "disconnected",
    email_status: "disconnected",
    tiktok_connect_url: null,
    instagram_connect_url: null,
    facebook_connect_url: null,
    youtube_connect_url: null,
    list_note: null,
    is_seed: 1,
    created_at: T,
  },
];

function deal(row) {
  return {
    contact: null,
    rate_cents: null,
    pipeline_cents: null,
    pipeline_name: null,
    brief_url: null,
    kamron_notes: null,
    stage: null,
    upload_label: null,
    drive_folder_id: null,
    is_seed: 1,
    created_at: T,
    updated_at: T,
    ...row,
    deliverables_json: JSON.stringify(row.deliverables),
    chips_json: JSON.stringify(row.chips),
  };
}

const dealRows = [
  deal({
    id: "kosbling",
    creator_id: "mariclare",
    brand: "KOSBLING",
    subtitle: "Doll-craft kits",
    gmail_thread_id: "seed-thread-kosbling",
    status: "active",
    amount_display: "Commission only",
    rate_label:
      "No fixed fee: 15% commission on net sales + gifted product (10% discount for your followers)",
    deliverables: [
      "1 TikTok, at least 30 seconds",
      "Tag @kosblingcraft and #kosbling",
      "Send the live link within 24 hours",
      "Post stays up at least 90 days",
      "KOSBLING referral link in your bio for the whole collab (Oct 14, 2026 to Oct 14, 2027)",
    ],
    usage_rights:
      "You own the content. Reposts/clips for 90 days only with our written OK. Paid/Spark ads need separate terms. No exclusivity.",
    brief: "Collaboration agreement (IO No. KOS-2026-10-14)",
    draft_due: "None (no pre-approval)",
    post_date: "Late October or November",
    payment_terms: "Paid through their ordinary payment process once sales are verified (no schedule)",
    visible_to_creator: 1,
    next_step: 'Contract signature promised by about Sun Oct 18, 2:45 PM',
    bot_message:
      "Kamron is deciding whether to sign as is or ask for a shorter bio-link term and a flat fee. No draft upload needed for this deal.",
    upload_enabled: 0,
    chips: [
      ["Sign contract by Oct 18", "c-red"],
      ["No pre-approval needed", "c-gray"],
    ],
    earnings_chip_text: "Sign by Oct 18",
    earnings_chip_tone: "c-red",
    needs_creator: 1,
    sort_order: 1,
    earnings_amount_label: "No fee: 15% commission + gifted product",
    earnings_due_label: '"Ordinary payment process" once sales are verified (no schedule)',
  }),
  deal({
    id: "vev",
    creator_id: "mariclare",
    brand: "VEV Gummies",
    subtitle: "Wellness gummies · via Haima Social",
    gmail_thread_id: "seed-thread-vev",
    status: "active",
    amount_display: "$1,200",
    rate_label: "$1,200 + free product",
    rate_cents: 120000,
    pipeline_cents: 120000,
    pipeline_name: "VEV",
    deliverables: ["1 TikTok", "60-day Spark code"],
    usage_rights: "60-day Spark code. Exclusivity TBD. No contract seen yet.",
    brief: "Updated brief (Canva) sent Sat Oct 17, 12:00 AM",
    brief_url: "https://www.canva.com/design/DAHTM5Yj-XQ/kX5plW6oPekkTDkc2DN2DA/edit",
    draft_due: "TBD (promised within a few days of Oct 16)",
    post_date: "Sep–Oct 2026 per brand",
    payment_terms: "TBD",
    visible_to_creator: 1,
    next_step: 'Draft promised "within the next few days" (Oct 16)',
    bot_message:
      "New brief arrived overnight. When you upload your draft here, I'll write the email to VEV for Kamron to approve, then post their feedback back on this card.",
    stage: 0,
    upload_enabled: 1,
    chips: [
      ["Draft due", "c-sun"],
      ["Brand approval before posting", "c-gray"],
    ],
    earnings_chip_text: "Draft in progress",
    earnings_chip_tone: "c-sun",
    needs_creator: 1,
    sort_order: 2,
    earnings_amount_label: "$1,200 + free product",
    earnings_due_label: "TBD",
  }),
  deal({
    id: "waterh",
    creator_id: "mariclare",
    brand: "WaterH",
    subtitle: "Smart water bottle · repeat brand",
    gmail_thread_id: "seed-thread-waterh",
    status: "active",
    amount_display: "Up to $3,000",
    rate_label: "Brand's stated max: $3,000 for 3 videos (final figure TBD)",
    rate_cents: 300000,
    pipeline_cents: 300000,
    pipeline_name: "WaterH (max)",
    deliverables: ["3 videos", "Later videos: add a spoken intro"],
    usage_rights: "TBD",
    brief: "Revision notes from the brand (below)",
    draft_due: "Draft 1 sent Oct 13. Revision deadline TBD",
    post_date: "TBD",
    payment_terms: "Payment starts only after the videos are published",
    visible_to_creator: 1,
    next_step: "Brand's Oct 13–14 revision notes need a reply",
    bot_message:
      "WaterH asked for changes on Oct 13 and offered to do the extra edit themselves on Oct 14. Kamron is deciding: let them edit, or re-shoot the requested shots. Upload a new version here if you re-shoot.",
    stage: 2,
    upload_enabled: 1,
    upload_label: "Upload revised draft (v2)",
    chips: [
      ["Revisions requested", "c-red"],
      ["3 videos", "c-gray"],
    ],
    earnings_chip_text: "Revisions requested",
    earnings_chip_tone: "c-red",
    needs_creator: 1,
    sort_order: 3,
    earnings_amount_label: "Up to $3,000 (3 videos)",
    earnings_due_label: "After the videos are published (date TBD)",
  }),
  deal({
    id: "persona",
    creator_id: "mariclare",
    brand: "Persona",
    subtitle: "Organic integration",
    gmail_thread_id: "seed-thread-persona",
    status: "negotiating",
    amount_display: "$1,800",
    rate_label: "$450 per post, $1,800 for 4 posts (earlier talks: $1,200, then $1,000 per post)",
    rate_cents: 180000,
    pipeline_cents: 180000,
    pipeline_name: "Persona",
    deliverables: ["4 posts, worked into your normal content (originally IG + TikTok crosspost)"],
    usage_rights: "No paid media / no usage rights. Exclusivity TBD.",
    brief: "TBD",
    draft_due: "TBD",
    post_date: "TBD (we asked)",
    payment_terms: "Fully up front (date TBD)",
    visible_to_creator: 1,
    next_step: "Kamron to send a clear yes or no on $450/post",
    bot_message: "Not confirmed yet. Don't film until this card turns green.",
    upload_enabled: 0,
    chips: [
      ["Negotiating", "c-blue"],
      ["Paid up front", "c-sage"],
    ],
    earnings_chip_text: "Negotiating",
    earnings_chip_tone: "c-blue",
    needs_creator: 0,
    sort_order: 4,
    earnings_amount_label: "$1,800 (4 posts at $450)",
    earnings_due_label: "Up front (date TBD)",
  }),
  deal({
    id: "sanvive",
    creator_id: "mariclare",
    brand: "Sanvive",
    subtitle: "Smart towel warmer · Kickstarter launch",
    gmail_thread_id: "seed-thread-sanvive",
    status: "negotiating",
    amount_display: "$2,500",
    rate_label: "$2,500 for TikTok only",
    rate_cents: 250000,
    deliverables: [
      "1 TikTok, 20–60 seconds",
      "Script, then a 4K draft",
      "Up to 2 revisions",
      "sanvive.com + Kickstarter link in bio",
      "Post stays up 60 days",
    ],
    usage_rights: "60-day worldwide license incl. paid ads + 60-day ad codes. 30-day exclusivity on towel warmers.",
    brief: "Contract (MSA + SOW) received Oct 14",
    draft_due: "4 days after samples arrive (samples ship ~Oct 25, tentative)",
    post_date: "~Nov 15 (tentative)",
    payment_terms: "50% on draft approval, 50% on publication, each within 5 business days",
    visible_to_creator: 1,
    next_step: "Waiting on the brand's reply to our contract changes",
    bot_message:
      "Heads up: under their contract, posting 4+ days late, or posting early, loses the final 50%. I'll remind you as soon as samples arrive.",
    upload_enabled: 0,
    chips: [
      ["Contract in review", "c-blue"],
      ["2 revisions included", "c-gray"],
    ],
    earnings_chip_text: "Contract in review",
    earnings_chip_tone: "c-blue",
    needs_creator: 0,
    sort_order: 5,
    earnings_amount_label: "$2,500",
    earnings_due_label: "50% on draft approval, 50% on publication, each within 5 business days",
  }),
  deal({
    id: "halara",
    creator_id: "mariclare",
    brand: "Halara",
    subtitle: "Fall & Winter collection",
    gmail_thread_id: "seed-thread-halara",
    status: "negotiating",
    amount_display: "$1,000 + $500 GC",
    rate_label: "$1,000 flat + $500 gift card",
    rate_cents: 100000,
    deliverables: ["1 TikTok on @_mariclaremaclamroc_ (fall decor / SAHM concept)", "No view requirement"],
    usage_rights: "TBD (terms are in the contract, not received yet)",
    brief: "Updated brief (Google Doc)",
    brief_url: "https://docs.google.com/document/d/1bmlcofp_ureXxIqXL5KKGfdw-_yjNgy4E_NVJ6q7Jck/edit",
    draft_due: "TBD",
    post_date: "Nov 15 (moved from Oct 15)",
    payment_terms: "TBD",
    visible_to_creator: 1,
    next_step: "Brand asked us to confirm and answer their questions (Oct 14)",
    bot_message: "Posting date is now Nov 15. Once Kamron confirms, I'll ask Halara for the contract.",
    upload_enabled: 1,
    chips: [
      ["Post Nov 15", "c-sage"],
      ["Waiting on our confirmation", "c-blue"],
    ],
    earnings_chip_text: "Waiting on our confirmation",
    earnings_chip_tone: "c-blue",
    needs_creator: 0,
    sort_order: 6,
    earnings_amount_label: "$1,000 + $500 gift card",
    earnings_due_label: "TBD",
  }),
  deal({
    id: "grail",
    creator_id: "mariclare",
    brand: "Grail",
    subtitle: "Grail-sourced deals",
    gmail_thread_id: "seed-thread-grail",
    status: "negotiating",
    amount_display: "Via Grail",
    rate_label: "Payment on Grail-sourced deals routes to Grail first",
    deliverables: ["Hidden until Kamron decides what MariClare should see"],
    usage_rights: "TBD",
    brief: "Oct 16 Grail agreement",
    draft_due: "TBD",
    post_date: "TBD",
    payment_terms: "Brand payment on Grail-sourced deals goes to Grail first",
    visible_to_creator: 0,
    kamron_notes:
      "Oct 16 agreement: payment on Grail-sourced deals routes to Grail first. Hidden from MariClare on purpose. Do not copy personal inbox items into this deal.",
    next_step: "Hidden from MariClare until you decide what she should see",
    bot_message: "This card is only on your admin view. MariClare cannot open it.",
    upload_enabled: 0,
    chips: [["Hidden from creator", "c-gray"]],
    earnings_chip_text: "Hidden from creator",
    earnings_chip_tone: "c-gray",
    needs_creator: 0,
    sort_order: 7,
    earnings_amount_label: "Via Grail",
    earnings_due_label: "Routes to Grail first",
  }),
].map((row) => {
  const { deliverables, chips, earnings_amount_label, earnings_due_label, ...rest } = row;
  return { rest, earnings_amount_label, earnings_due_label };
});

const deals = dealRows.map((row) => row.rest);

const payments = dealRows.map((row) => ({
  id: `pay-${row.rest.id}`,
  deal_id: row.rest.id,
  amount_owed_cents: row.rest.rate_cents,
  amount_label: row.earnings_amount_label,
  due_date: null,
  due_label: row.earnings_due_label,
  landed_date: null,
  landed_amount_cents: null,
  creator_split_percent: null,
  agency_split_percent: null,
  creator_payout_cents: null,
  payout_approved_on: null,
  paid_out_date: null,
  is_seed: 1,
  created_at: T,
  updated_at: T,
}));

const revisions = [
  ["kosbling", "Oct 14", null, "brand", "Agreement (IO) received", 1],
  ["kosbling", "Oct 16, 2:45 PM", "2026-10-16T14:45:00.000Z", "us", "We promised a signed copy within 48 hours", 2],
  ["kosbling", "Oct 16, 10:23 PM", "2026-10-16T22:23:00.000Z", "brand", "Brand acknowledged", 3],
  ["kosbling", "~Oct 18, 2:45 PM", null, "next", "Signature due", 4],
  ["vev", "Oct 7–8", null, "us", "Deal agreed: 1 TikTok + 60-day Spark code", 1],
  ["vev", "This week", null, "us", "Product received", 2],
  ["vev", "Oct 16", "2026-10-16T12:00:00.000Z", "us", "We promised a draft within a few days", 3],
  ["vev", "Oct 17, 12:00 AM", "2026-10-17T05:00:00.000Z", "brand", "Brand sent an updated brief", 4],
  ["vev", "Next", null, "next", "Upload your draft", 5],
  ["waterh", "Oct 13, 7:44 PM", "2026-10-13T19:44:00.000Z", "us", "Draft 1 sent to WaterH", 1],
  [
    "waterh",
    "Oct 13, 9:55 PM",
    "2026-10-13T21:55:00.000Z",
    "brand",
    "Revisions: show the light-ring reminder while playing with your daughter, show synchronized drinking, add a spoken intro on later videos",
    2,
  ],
  ["waterh", "Oct 14, 9:32 PM", "2026-10-14T21:32:00.000Z", "brand", "Brand offered to do the extra edit themselves", 3],
  ["waterh", "Next", null, "next", "Our reply: edit vs. re-shoot", 4],
  ["persona", "Earlier", null, "brand", "Talks started at $1,200/post, then $1,000/post", 1],
  ["persona", "Before Oct 16", null, "brand", "Brand came back at $450/post, $1,800 for 4, fully up front", 2],
  ["persona", "Oct 16, 3:14 PM", "2026-10-16T15:14:00.000Z", "us", "Our reply was unclear and needs a clear yes or no", 3],
  ["persona", "Next", null, "next", "Kamron decides", 4],
  ["sanvive", "Oct 14", "2026-10-14T12:00:00.000Z", "brand", "Contract (MSA + SOW) received", 1],
  ["sanvive", "Oct 14, 9:12 PM", "2026-10-14T21:12:00.000Z", "us", "We sent contract changes", 2],
  ["sanvive", "~Oct 25", null, "next", "Samples ship (tentative)", 3],
  ["sanvive", "~Nov 15", null, "next", "Video goes live (tentative)", 4],
  ["halara", "Before Oct 14", null, "brand", "Post date moved from Oct 15 to Nov 15", 1],
  ["halara", "Oct 14, 4:00 AM", "2026-10-14T04:00:00.000Z", "brand", "Brand asked for confirmation and answers to their questions", 2],
  ["halara", "Next", null, "next", "Our confirmation", 3],
  ["grail", "Oct 16", "2026-10-16T12:00:00.000Z", "us", "Agreement noted. Kept off MariClare's view.", 1],
].map(([dealId, label, at, source, summary, sort], index) => ({
  id: `rev-${dealId}-${index + 1}`,
  deal_id: dealId,
  draft_id: dealId === "waterh" && sort === 1 ? "draft-waterh-v1" : null,
  occurred_label: label,
  occurred_at: at,
  source,
  summary,
  email_url: null,
  sort_order: sort,
  is_seed: 1,
  created_at: T,
}));

const drafts = [
  {
    id: "draft-waterh-v1",
    deal_id: "waterh",
    version: 1,
    filename: "Draft 1 (sent by email before the portal)",
    mime_type: null,
    size_bytes: null,
    bytes_received: 0,
    drive_file_id: null,
    drive_file_url: null,
    drive_folder_id: null,
    upload_session_url: null,
    status: "revisions",
    gmail_thread_id: "seed-thread-waterh",
    uploaded_at: "2026-10-13T19:44:00.000Z",
    is_seed: 1,
    created_at: "2026-10-13T19:44:00.000Z",
  },
];

const inbox = [
  ["in-tt-1015", "Oct 15", "TikTok", "$819.37"],
  ["in-tts-1014", "Oct 14", "TikTok Shop", "$12.04"],
  ["in-fenix-1008", "Oct 8", "Fenix Internet (direct deposit)", "TBD"],
  ["in-tts-1007", "Oct 7", "TikTok Shop", "$17.43"],
  ["in-hoop-1004", "Oct 4", "Infinity Hoop", "$46.05"],
].map(([id, occurred_on, source, amount_label]) => ({
  id,
  creator_id: "mariclare",
  occurred_on,
  source,
  amount_label,
  is_seed: 1,
}));

const heights = [38, 52, 44, 61, 47, 90, 72, 55, 49, 66, 58, 80, 63, 70];
const averageHeight = heights.reduce((sum, value) => sum + value, 0) / heights.length;
const views = heights.map((height) => Math.round((height / averageHeight) * 412000));
const newFollowers = [180, 210, 240, 260, 300, 340, 360, 400, 420, 380, 510, 470, 490, 510];
const analytics = views.map((viewCount, index) => {
  const day = String(index + 4).padStart(2, "0");
  const last = index === views.length - 1;
  return {
    id: `ad-mariclare-tiktok-2026-10-${day}`,
    creator_id: "mariclare",
    platform: "tiktok",
    metric_date: `2026-10-${day}`,
    followers: last ? 1240000 : null,
    new_followers: newFollowers[index],
    views: viewCount,
    engagement_rate: last ? 6.8 : null,
    saves: null,
    is_example: 1,
    created_at: T,
  };
});

const posts = [
  ["post-example-a", "Example post A", "TikTok", 1900000, 21000],
  ["post-example-b", "Example post B", "Instagram Reels", 640000, 8200],
  ["post-example-c", "Example post C", "TikTok", 510000, 4400],
].map(([id, title, platform, viewCount, saves]) => ({
  id,
  creator_id: "mariclare",
  title,
  platform,
  views: viewCount,
  saves,
  is_example: 1,
  created_at: T,
}));

const sql = `-- Seed data for the MariClare pilot. Every row is marked is_seed = 1 or is_example = 1.
-- Facts match the Oct 17, 2026 mockup. Gmail thread ids are placeholders (seed-thread-*), not real threads.
-- Abby and AuthenticKam use example.com addresses until Kamron replaces them.
-- Generated by scripts/render-seed.mjs

${insert("creators", creators)}
${insert("deals", deals)}
${insert("payments", payments)}
${insert("drafts", drafts)}
${insert("revisions", revisions)}
${insert("inbox_items", inbox)}
${insert("analytics_daily", analytics)}
${insert("analytics_posts", posts)}
`;

writeFileSync(new URL("../drizzle/0001_seed.sql", import.meta.url), sql);
console.log(`Wrote seed SQL (${sql.length} bytes)`);
