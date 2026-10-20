import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const creators = sqliteTable("creators", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  handles: text("handles"),
  kidsAges: text("kids_ages"),
  payoutMethod: text("payout_method"),
  splitPercent: real("split_percent"),
  monthlyGoalCents: integer("monthly_goal_cents"),
  driveFolderId: text("drive_folder_id"),
  initials: text("initials").notNull(),
  tiktokStatus: text("tiktok_status").notNull(),
  instagramStatus: text("instagram_status").notNull(),
  facebookStatus: text("facebook_status").notNull(),
  youtubeStatus: text("youtube_status").notNull(),
  emailStatus: text("email_status").notNull(),
  tiktokConnectUrl: text("tiktok_connect_url"),
  instagramConnectUrl: text("instagram_connect_url"),
  facebookConnectUrl: text("facebook_connect_url"),
  youtubeConnectUrl: text("youtube_connect_url"),
  listNote: text("list_note"),
  gmailRefreshToken: text("gmail_refresh_token"),
  gmailEmail: text("gmail_email"),
  gmailConnectedAt: text("gmail_connected_at"),
  gmailReconnectReason: text("gmail_reconnect_reason"),
  driveRefreshToken: text("drive_refresh_token"),
  driveReconnectReason: text("drive_reconnect_reason"),
  emailSetup: text("email_setup"),
  hostedEmailAddress: text("hosted_email_address"),
  signerIsMinor: integer("signer_is_minor", { mode: "boolean" }).notNull().default(false),
  primaryManagerId: text("primary_manager_id"),
  backupManagerId: text("backup_manager_id"),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const creatorOnboarding = sqliteTable("creator_onboarding", {
  creatorId: text("creator_id").primaryKey(),
  botName: text("bot_name"),
  niche: text("niche"),
  kidsAges: text("kids_ages"),
  contentStyle: text("content_style"),
  rates: text("rates"),
  favoriteBrands: text("favorite_brands"),
  platformsJson: text("platforms_json").notNull(),
  finishedAt: text("finished_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const managers = sqliteTable("managers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  canApproveEmail: integer("can_approve_email", { mode: "boolean" }).notNull().default(true),
  canApproveVideo: integer("can_approve_video", { mode: "boolean" }).notNull().default(true),
  canApproveContract: integer("can_approve_contract", { mode: "boolean" }).notNull().default(false),
  canCountersign: integer("can_countersign", { mode: "boolean" }).notNull().default(false),
  canPriceDeals: integer("can_price_deals", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  deactivatedAt: text("deactivated_at"),
});

export const adminNotifications = sqliteTable("admin_notifications", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  creatorId: text("creator_id"),
  managerId: text("manager_id"),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
  readAt: text("read_at"),
});

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  brand: text("brand").notNull(),
  subtitle: text("subtitle"),
  contact: text("contact"),
  gmailThreadId: text("gmail_thread_id"),
  offerAllocationId: text("offer_allocation_id"),
  reviewStatus: text("review_status").notNull().default("pending"),
  productRequired: integer("product_required", { mode: "boolean" }).notNull().default(true),
  rateReady: integer("rate_ready", { mode: "boolean" }).notNull().default(false),
  rateConfirmedAt: text("rate_confirmed_at"),
  rushRevision: integer("rush_revision", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull(),
  amountDisplay: text("amount_display"),
  rateLabel: text("rate_label"),
  rateCents: integer("rate_cents"),
  pipelineCents: integer("pipeline_cents"),
  pipelineName: text("pipeline_name"),
  deliverablesJson: text("deliverables_json").notNull(),
  usageRights: text("usage_rights"),
  brief: text("brief"),
  briefUrl: text("brief_url"),
  draftDue: text("draft_due"),
  postDate: text("post_date"),
  paymentTerms: text("payment_terms"),
  visibleToCreator: integer("visible_to_creator", { mode: "boolean" }).notNull(),
  kamronNotes: text("kamron_notes"),
  nextStep: text("next_step"),
  botMessage: text("bot_message"),
  stage: integer("stage"),
  workflowStage: text("workflow_stage"),
  uploadEnabled: integer("upload_enabled", { mode: "boolean" }).notNull(),
  uploadLabel: text("upload_label"),
  chipsJson: text("chips_json").notNull(),
  earningsChipText: text("earnings_chip_text"),
  earningsChipTone: text("earnings_chip_tone"),
  needsCreator: integer("needs_creator", { mode: "boolean" }).notNull(),
  driveFolderId: text("drive_folder_id"),
  sortOrder: integer("sort_order").notNull(),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  version: integer("version").notNull(),
  filename: text("filename"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  bytesReceived: integer("bytes_received").notNull(),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  driveFolderId: text("drive_folder_id"),
  uploadSessionUrl: text("upload_session_url"),
  status: text("status").notNull(),
  gmailThreadId: text("gmail_thread_id"),
  uploadedAt: text("uploaded_at"),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const revisions = sqliteTable("revisions", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  draftId: text("draft_id"),
  occurredLabel: text("occurred_label").notNull(),
  occurredAt: text("occurred_at"),
  source: text("source").notNull(),
  summary: text("summary").notNull(),
  emailUrl: text("email_url"),
  sortOrder: integer("sort_order").notNull(),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  amountOwedCents: integer("amount_owed_cents"),
  amountLabel: text("amount_label"),
  dueDate: text("due_date"),
  dueLabel: text("due_label"),
  landedDate: text("landed_date"),
  landedAmountCents: integer("landed_amount_cents"),
  creatorSplitPercent: real("creator_split_percent"),
  agencySplitPercent: real("agency_split_percent"),
  creatorPayoutCents: integer("creator_payout_cents"),
  payoutApprovedOn: text("payout_approved_on"),
  paidOutDate: text("paid_out_date"),
  paymentStatus: text("payment_status"),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const inboxItems = sqliteTable("inbox_items", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  occurredOn: text("occurred_on").notNull(),
  source: text("source").notNull(),
  amountLabel: text("amount_label").notNull(),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull(),
});

export const analyticsDaily = sqliteTable(
  "analytics_daily",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").notNull(),
    platform: text("platform").notNull(),
    metricDate: text("metric_date").notNull(),
    followers: integer("followers"),
    newFollowers: integer("new_followers"),
    views: integer("views"),
    engagementRate: real("engagement_rate"),
    saves: integer("saves"),
    isExample: integer("is_example", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("analytics_daily_key").on(table.creatorId, table.platform, table.metricDate)],
);

export const analyticsPosts = sqliteTable("analytics_posts", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  title: text("title").notNull(),
  platform: text("platform").notNull(),
  views: integer("views"),
  saves: integer("saves"),
  isExample: integer("is_example", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const dealStageEvents = sqliteTable("deal_stage_events", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  actorEmail: text("actor_email").notNull(),
  actorRole: text("actor_role").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const approvalEmails = sqliteTable("approval_emails", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  gate: text("gate").notNull(),
  status: text("status").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  attachmentNote: text("attachment_note"),
  attachmentUrl: text("attachment_url"),
  fromEmail: text("from_email").notNull(),
  gmailThreadId: text("gmail_thread_id"),
  gmailMessageId: text("gmail_message_id"),
  sentAt: text("sent_at"),
  brandContactName: text("brand_contact_name"),
  brandContactEmail: text("brand_contact_email"),
  brandContactCompany: text("brand_contact_company"),
  suggestedCreatorId: text("suggested_creator_id"),
  suggestedPlan: text("suggested_plan"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const approvalEvents = sqliteTable("approval_events", {
  id: text("id").primaryKey(),
  approvalId: text("approval_id").notNull(),
  action: text("action").notNull(),
  actorEmail: text("actor_email").notNull(),
  actorRole: text("actor_role").notNull(),
  subject: text("subject"),
  body: text("body"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const brandContacts = sqliteTable("brand_contacts", {
  id: text("id").primaryKey(),
  dealId: text("deal_id"),
  approvalId: text("approval_id").notNull().unique(),
  company: text("company").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  note: text("note"),
  suggestedCreatorId: text("suggested_creator_id"),
  suggestedPlan: text("suggested_plan"),
  savedBy: text("saved_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const offerScreenings = sqliteTable("offer_screenings", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  decision: text("decision").notNull(),
  actorEmail: text("actor_email").notNull(),
  brandEmail: text("brand_email"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const creatorInterest = sqliteTable("creator_interest", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  creatorId: text("creator_id").notNull(),
  decision: text("decision").notNull(),
  note: text("note"),
  approvalId: text("approval_id"),
  createdAt: text("created_at").notNull(),
});

export const draftReviews = sqliteTable("draft_reviews", {
  id: text("id").primaryKey(),
  draftId: text("draft_id").notNull(),
  dealId: text("deal_id").notNull(),
  decision: text("decision").notNull(),
  note: text("note"),
  actorEmail: text("actor_email").notNull(),
  approvalId: text("approval_id"),
  createdAt: text("created_at").notNull(),
});

export const creatorNotifications = sqliteTable("creator_notifications", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  dealId: text("deal_id"),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull(),
  readAt: text("read_at"),
});

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  version: integer("version").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256"),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  driveFolderId: text("drive_folder_id"),
  source: text("source").notNull(),
  signingFormat: text("signing_format").notNull(),
  countersign: integer("countersign", { mode: "boolean" }).notNull(),
  status: text("status").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  approvalId: text("approval_id"),
  createdAt: text("created_at").notNull(),
});

export const contractChecks = sqliteTable("contract_checks", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull(),
  item: text("item").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const contractFiles = sqliteTable("contract_files", {
  contractId: text("contract_id").primaryKey(),
  bytesBase64: text("bytes_base64").notNull(),
});

export const contractSignatures = sqliteTable("contract_signatures", {
  id: text("id").primaryKey(),
  contractId: text("contract_id").notNull(),
  dealId: text("deal_id").notNull(),
  version: integer("version").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  signerName: text("signer_name"),
  signerEmail: text("signer_email"),
  signedAt: text("signed_at"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  documentSha256: text("document_sha256"),
  signatureKind: text("signature_kind"),
  consentEsign: integer("consent_esign", { mode: "boolean" }),
  consentRead: integer("consent_read", { mode: "boolean" }),
  guardian: integer("guardian", { mode: "boolean" }).notNull(),
  signedSha256: text("signed_sha256"),
  signedFilename: text("signed_filename"),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  approvalId: text("approval_id"),
  voidedAt: text("voided_at"),
  createdAt: text("created_at").notNull(),
});

export const signatureFiles = sqliteTable("signature_files", {
  signatureId: text("signature_id").primaryKey(),
  bytesBase64: text("bytes_base64").notNull(),
});

export const shipments = sqliteTable("shipments", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().unique(),
  carrier: text("carrier").notNull(),
  trackingNumber: text("tracking_number").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  receivedAt: text("received_at"),
});

export const livePosts = sqliteTable("live_posts", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  platform: text("platform").notNull(),
  url: text("url").notNull(),
  meetsBrief: integer("meets_brief", { mode: "boolean" }),
  confirmedAt: text("confirmed_at"),
  confirmedBy: text("confirmed_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const emailCopies = sqliteTable("email_copies", {
  id: text("id").primaryKey(),
  approvalId: text("approval_id").notNull(),
  dealId: text("deal_id").notNull(),
  kind: text("kind").notNull(),
  filename: text("filename").notNull(),
  sha256: text("sha256").notNull(),
  driveFileId: text("drive_file_id"),
  driveFileUrl: text("drive_file_url"),
  driveFolderId: text("drive_folder_id"),
  stored: text("stored").notNull(),
  createdAt: text("created_at").notNull(),
});

export const creatorReportDrafts = sqliteTable(
  "creator_report_drafts",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").notNull(),
    month: text("month").notNull(),
    approvalId: text("approval_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("creator_report_drafts_creator_month").on(table.creatorId, table.month)],
);

export const emailCopyFiles = sqliteTable("email_copy_files", {
  copyId: text("copy_id").primaryKey(),
  bytesBase64: text("bytes_base64").notNull(),
});

export const communityChannels = sqliteTable("community_channels", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull(),
});

export const communityMembers = sqliteTable("community_members", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  creatorId: text("creator_id"),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  mutedUntil: text("muted_until"),
  guidelinesAt: text("guidelines_at"),
  lastSeenAt: text("last_seen_at"),
  lastPostAt: text("last_post_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const communityMessages = sqliteTable("community_messages", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  authorMemberId: text("author_member_id").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body"),
  photoId: text("photo_id"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  held: integer("held", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const communityReactions = sqliteTable("community_reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  memberId: text("member_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: text("created_at").notNull(),
});

export const communityReports = sqliteTable("community_reports", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  reporterMemberId: text("reporter_member_id").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  resolvedAt: text("resolved_at"),
  resolvedBy: text("resolved_by"),
});

export const communityAudit = sqliteTable("community_audit", {
  id: text("id").primaryKey(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  targetName: text("target_name"),
  messageId: text("message_id"),
  createdAt: text("created_at").notNull(),
});

export const communityPhotos = sqliteTable("community_photos", {
  id: text("id").primaryKey(),
  sha256: text("sha256").notNull(),
  contentType: text("content_type").notNull(),
  bytesBase64: text("bytes_base64"),
  r2Key: text("r2_key"),
  held: integer("held", { mode: "boolean" }).notNull(),
  approved: integer("approved", { mode: "boolean" }),
  createdAt: text("created_at").notNull(),
});

export const communityFilterHits = sqliteTable("community_filter_hits", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull(),
});

export const communitySettings = sqliteTable("community_settings", {
  id: text("id").primaryKey(),
  readOnly: integer("read_only", { mode: "boolean" }).notNull(),
  slowSeconds: integer("slow_seconds").notNull(),
});

export const communityState = sqliteTable("community_state", {
  id: text("id").primaryKey(),
  cursor: text("cursor").notNull(),
});

export const creatorProfiles = sqliteTable("creator_profiles", {
  creatorId: text("creator_id").primaryKey(),
  profileOn: integer("profile_on", { mode: "boolean" }).notNull().default(false),
  displayName: text("display_name"),
  displayNameOn: integer("display_name_on", { mode: "boolean" }).notNull().default(false),
  avatarOn: integer("avatar_on", { mode: "boolean" }).notNull().default(false),
  bio: text("bio"),
  bioOn: integer("bio_on", { mode: "boolean" }).notNull().default(false),
  niches: text("niches"),
  nichesOn: integer("niches_on", { mode: "boolean" }).notNull().default(false),
  handles: text("handles"),
  handlesOn: integer("handles_on", { mode: "boolean" }).notNull().default(false),
  audience: text("audience"),
  audienceOn: integer("audience_on", { mode: "boolean" }).notNull().default(false),
  formats: text("formats"),
  formatsOn: integer("formats_on", { mode: "boolean" }).notNull().default(false),
  askMe: text("ask_me"),
  askMeOn: integer("ask_me_on", { mode: "boolean" }).notNull().default(false),
  collabs: integer("collabs", { mode: "boolean" }).notNull().default(false),
  collabsOn: integer("collabs_on", { mode: "boolean" }).notNull().default(false),
  state: text("state"),
  stateOn: integer("state_on", { mode: "boolean" }).notNull().default(false),
  brands: text("brands"),
  brandsOn: integer("brands_on", { mode: "boolean" }).notNull().default(false),
  childName: text("child_name"),
  childAge: text("child_age"),
  familyOn: integer("family_on", { mode: "boolean" }).notNull().default(false),
  joinedOn: integer("joined_on", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});

export const profileAdminLog = sqliteTable("profile_admin_log", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  field: text("field").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  actorName: text("actor_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const deliverableDates = sqliteTable("deliverable_dates", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  kind: text("kind").notNull(),
  dueOn: text("due_on").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const deliverableNudges = sqliteTable("deliverable_nudges", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  kind: text("kind").notNull(),
  dueOn: text("due_on").notNull(),
  channel: text("channel").notNull(),
  approvalId: text("approval_id"),
  createdAt: text("created_at").notNull(),
});

export const creatorCalendars = sqliteTable("creator_calendars", {
  creatorId: text("creator_id").primaryKey(),
  connected: integer("connected", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const brandCrmEntries = sqliteTable("brand_crm_entries", {
  id: text("id").primaryKey(),
  brandKey: text("brand_key").notNull(),
  kind: text("kind").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  response: text("response"),
  note: text("note"),
  actorName: text("actor_name").notNull(),
  createdAt: text("created_at").notNull(),
  ratePaidCents: integer("rate_paid_cents"),
  outcome: text("outcome"),
  nextFollowUp: text("next_follow_up"),
  creatorId: text("creator_id"),
  domain: text("domain"),
});

export const usageRights = sqliteTable("usage_rights", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull().unique(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const mediaKits = sqliteTable("media_kits", {
  creatorId: text("creator_id").primaryKey(),
  slug: text("slug").notNull().unique(),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  displayName: text("display_name"),
  bio: text("bio"),
  followers: integer("followers"),
  avgViews: integer("avg_views"),
  engagement: text("engagement"),
  niches: text("niches"),
  platformsJson: text("platforms_json"),
  updatedAt: text("updated_at").notNull(),
});

export const dealCategoryOverrides = sqliteTable("deal_category_overrides", {
  dealId: text("deal_id").primaryKey(),
  overridden: integer("overridden", { mode: "boolean" }).notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const draftSafetyFlags = sqliteTable(
  "draft_safety_flags",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id").notNull(),
    dealId: text("deal_id").notNull(),
    kind: text("kind").notNull(),
    held: integer("held", { mode: "boolean" }).notNull(),
    clearedBy: text("cleared_by"),
    clearedAt: text("cleared_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("draft_safety_flags_draft_kind").on(table.draftId, table.kind)],
);

export const referralSettings = sqliteTable("referral_settings", {
  id: text("id").primaryKey(),
  perkCents: integer("perk_cents"),
  updatedAt: text("updated_at").notNull(),
});

export const referrals = sqliteTable("referrals", {
  id: text("id").primaryKey(),
  referrerCreatorId: text("referrer_creator_id").notNull(),
  referredName: text("referred_name").notNull(),
  referredEmail: text("referred_email").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    endpoint: text("endpoint").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("push_subscriptions_endpoint").on(table.endpoint)],
);

export const pushNotices = sqliteTable("push_notices", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  creatorId: text("creator_id"),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const creatorDealRules = sqliteTable("creator_deal_rules", {
  creatorId: text("creator_id").primaryKey(),
  rulesJson: text("rules_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const pricingSettings = sqliteTable("pricing_settings", {
  id: text("id").primaryKey(),
  minAgencyProfitCents: integer("min_agency_profit_cents").notNull(),
  catalogJson: text("catalog_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  brand: text("brand").notNull(),
  name: text("name").notNull(),
  budgetCents: integer("budget_cents").notNull(),
  nichesJson: text("niches_json").notNull(),
  platformsJson: text("platforms_json").notNull(),
  deliverablesJson: text("deliverables_json").notNull(),
  slots: integer("slots").notNull(),
  startsOn: text("starts_on"),
  endsOn: text("ends_on"),
  status: text("status").notNull(),
  openOutside: integer("open_outside", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  offerFlag: text("offer_flag"),
  nextFollowUp: text("next_follow_up"),
  kind: text("kind").notNull().default("campaign"),
});

export const campaignAllocations = sqliteTable("campaign_allocations", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  creatorId: text("creator_id"),
  prospectId: text("prospect_id"),
  amountCents: integer("amount_cents").notNull(),
  createdAt: text("created_at").notNull(),
  response: text("response"),
  question: text("question"),
  respondedAt: text("responded_at"),
});

export const prospects = sqliteTable("prospects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  nichesJson: text("niches_json").notNull(),
  notes: text("notes"),
  convertedCreatorId: text("converted_creator_id"),
  createdAt: text("created_at").notNull(),
});

export const outsideOffers = sqliteTable("outside_offers", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  prospectId: text("prospect_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull(),
  approvalId: text("approval_id"),
  createdAt: text("created_at").notNull(),
});

export const creatorRankSettings = sqliteTable("creator_rank_settings", {
  id: text("id").primaryKey(),
  weightsJson: text("weights_json").notNull(),
  cadence: text("cadence").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const creatorRankInputs = sqliteTable("creator_rank_inputs", {
  creatorId: text("creator_id").primaryKey(),
  inputsJson: text("inputs_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const creatorRankHistory = sqliteTable("creator_rank_history", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  score: integer("score").notNull(),
  tier: text("tier").notNull(),
  rank: integer("rank").notNull(),
  recordedOn: text("recorded_on").notNull(),
  createdAt: text("created_at").notNull(),
});

export const rankReports = sqliteTable("rank_reports", {
  id: text("id").primaryKey(),
  level: text("level").notNull(),
  subjectId: text("subject_id"),
  title: text("title").notNull(),
  showRanks: integer("show_ranks", { mode: "boolean" }).notNull(),
  token: text("token").notNull().unique(),
  bodyJson: text("body_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const pods = sqliteTable("pods", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  managerId: text("manager_id").notNull(),
  niche: text("niche").notNull(),
  sizeBand: text("size_band").notNull(),
  channelId: text("channel_id"),
  createdAt: text("created_at").notNull(),
});

export const podMembers = sqliteTable("pod_members", {
  podId: text("pod_id").notNull(),
  creatorId: text("creator_id").notNull(),
});

export const podDates = sqliteTable("pod_dates", {
  id: text("id").primaryKey(),
  podId: text("pod_id").notNull(),
  creatorId: text("creator_id"),
  title: text("title").notNull(),
  onDate: text("on_date").notNull(),
  createdAt: text("created_at").notNull(),
});

export const collabIdeas = sqliteTable("collab_ideas", {
  id: text("id").primaryKey(),
  podId: text("pod_id").notNull(),
  creatorId: text("creator_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  partnerId: text("partner_id"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const podShoutouts = sqliteTable("pod_shoutouts", {
  id: text("id").primaryKey(),
  podId: text("pod_id").notNull(),
  authorEmail: text("author_email").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

export const podGoals = sqliteTable("pod_goals", {
  id: text("id").primaryKey(),
  podId: text("pod_id").notNull(),
  title: text("title").notNull(),
  target: integer("target").notNull(),
  progress: integer("progress").notNull(),
  createdAt: text("created_at").notNull(),
});

export const podMetrics = sqliteTable("pod_metrics", {
  id: text("id").primaryKey(),
  podId: text("pod_id").notNull(),
  month: text("month").notNull(),
  followers: integer("followers").notNull(),
  collabPosts: integer("collab_posts").notNull(),
  createdAt: text("created_at").notNull(),
});

export const reinvestmentSettings = sqliteTable("reinvestment_settings", {
  id: text("id").primaryKey(),
  targetPercent: integer("target_percent").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const reinvestmentEntries = sqliteTable("reinvestment_entries", {
  id: text("id").primaryKey(),
  month: text("month").notNull(),
  category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const benchCreators = sqliteTable("bench_creators", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  slug: text("slug").notNull().unique(),
  nichesJson: text("niches_json").notNull(),
  platformsJson: text("platforms_json").notNull(),
  portfolioJson: text("portfolio_json").notNull(),
  score: integer("score"),
  status: text("status").notNull(),
  creatorId: text("creator_id"),
  createdAt: text("created_at").notNull(),
  promotedAt: text("promoted_at"),
});

export const benchOffers = sqliteTable("bench_offers", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id").notNull(),
  benchId: text("bench_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull(),
  approvalId: text("approval_id"),
  feeCents: integer("fee_cents"),
  createdAt: text("created_at").notNull(),
});

export const creatorQuestionnaires = sqliteTable("creator_questionnaires", {
  creatorId: text("creator_id").primaryKey(),
  step: text("step").notNull(),
  answersJson: text("answers_json").notNull(),
  pausedAt: text("paused_at"),
  finishedAt: text("finished_at"),
  updatedAt: text("updated_at").notNull(),
});

export const creatorAccounts = sqliteTable("creator_accounts", {
  creatorId: text("creator_id").primaryKey(),
  plan: text("plan").notNull(),
  aiTier: text("ai_tier").notNull(),
  aiCreditsUsed: integer("ai_credits_used").notNull(),
  addOns: text("add_ons").notNull(),
  emailNotices: integer("email_notices", { mode: "boolean" }).notNull(),
  pushNotices: integer("push_notices", { mode: "boolean" }).notNull(),
  quietHours: integer("quiet_hours", { mode: "boolean" }).notNull(),
  communityVisible: integer("community_visible", { mode: "boolean" }).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  subscriptionPlan: text("subscription_plan"),
  subscriptionInterval: text("subscription_interval"),
  subscriptionEventAt: integer("subscription_event_at"),
  updatedAt: text("updated_at").notNull(),
});

export const stripeWebhookEvents = sqliteTable("stripe_webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: text("created_at").notNull(),
});

export const creatorPurchases = sqliteTable("creator_purchases", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  offerId: text("offer_id").notNull(),
  priceId: text("price_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: text("created_at").notNull(),
});

export const fulfillmentOrders = sqliteTable("fulfillment_orders", {
  id: text("id").primaryKey(),
  purchaseId: text("purchase_id").notNull().unique(),
  creatorId: text("creator_id").notNull(),
  product: text("product").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  dueOn: text("due_on").notNull(),
  claimedAt: text("claimed_at"),
  deliveredAt: text("delivered_at"),
  deliveryUrl: text("delivery_url"),
  deliveryFilename: text("delivery_filename"),
  deliveryBody: text("delivery_body"),
});

export const brandReplyDrafts = sqliteTable("brand_reply_drafts", {
  dealId: text("deal_id").primaryKey(),
  body: text("body").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const gmailWatches = sqliteTable("gmail_watches", {
  mailbox: text("mailbox").primaryKey(),
  creatorId: text("creator_id").notNull(),
  historyId: text("history_id"),
  expiration: text("expiration"),
  topic: text("topic"),
  updatedAt: text("updated_at").notNull(),
});

export const gmailSeenMessages = sqliteTable("gmail_seen_messages", {
  messageId: text("message_id").primaryKey(),
  mailbox: text("mailbox").notNull(),
  threadId: text("thread_id"),
  createdAt: text("created_at").notNull(),
});

export const platformInvites = sqliteTable("platform_invites", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").notNull(),
  brand: text("brand").notNull(),
  platform: text("platform").notNull(),
  accountHandle: text("account_handle"),
  actionNeeded: text("action_needed").notNull(),
  deadlineAt: text("deadline_at"),
  doneAt: text("done_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const inboxEvents = sqliteTable("inbox_events", {
  id: text("id").primaryKey(),
  mailbox: text("mailbox").notNull(),
  messageId: text("message_id").notNull().unique(),
  threadId: text("thread_id"),
  dealId: text("deal_id"),
  kind: text("kind").notNull(),
  createdAt: text("created_at").notNull(),
});

export const supportMessages = sqliteTable("support_messages", {
  id: text("id").primaryKey(),
  authorEmail: text("author_email").notNull(),
  authorName: text("author_name").notNull(),
  creatorId: text("creator_id"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

export const capabilityGrants = sqliteTable("capability_grants", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  capability: text("capability").notNull(),
  level: text("level").notNull(),
  trainingJson: text("training_json").notNull(),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const capabilityAudit = sqliteTable("capability_audit", {
  id: text("id").primaryKey(),
  actorEmail: text("actor_email").notNull(),
  actorRole: text("actor_role").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  capability: text("capability"),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});

export const capabilityDrafts = sqliteTable("capability_drafts", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  capability: text("capability").notNull(),
  level: text("level").notNull(),
  actorEmail: text("actor_email").notNull(),
  summary: text("summary").notNull(),
  effectJson: text("effect_json").notNull(),
  status: text("status").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").notNull(),
});

export const giftedOffers = sqliteTable("gifted_offers", {
  id: text("id").primaryKey(),
  brand: text("brand").notNull(),
  product: text("product").notNull(),
  photosJson: text("photos_json").notNull(),
  deliverable: text("deliverable").notNull(),
  dueOn: text("due_on").notNull(),
  retailValueCents: integer("retail_value_cents").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
});

export const giftedApplications = sqliteTable("gifted_applications", {
  id: text("id").primaryKey(),
  offerId: text("offer_id").notNull(),
  creatorId: text("creator_id"),
  benchId: text("bench_id"),
  status: text("status").notNull(),
  termsVersion: text("terms_version").notNull(),
  termsAcceptedAt: text("terms_accepted_at").notNull(),
  postUrl: text("post_url"),
  appliedAt: text("applied_at").notNull(),
  approvedAt: text("approved_at"),
  shippedAt: text("shipped_at"),
  deliveredAt: text("delivered_at"),
  postedAt: text("posted_at"),
  overdueAt: text("overdue_at"),
  chargedAt: text("charged_at"),
  amountOwedCents: integer("amount_owed_cents"),
  findersFeeCents: integer("finders_fee_cents"),
  updatedAt: text("updated_at").notNull(),
});

export const creatorApplicationAttempts = sqliteTable("creator_application_attempts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ip: text("ip").notNull(),
  createdAt: text("created_at").notNull(),
});

export const creatorApplications = sqliteTable("creator_applications", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  handles: text("handles").notNull(),
  followers: text("followers").notNull(),
  niche: text("niche").notNull(),
  rates: text("rates"),
  message: text("message").notNull(),
  status: text("status").notNull(),
  creatorId: text("creator_id"),
  invitedAt: text("invited_at"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
});

export const botTokens = sqliteTable("bot_tokens", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenHint: text("token_hint").notNull(),
  revealOnce: text("reveal_once"),
  active: integer("active", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const analyticsSnapshots = sqliteTable(
  "analytics_snapshots",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").notNull(),
    platform: text("platform").notNull(),
    capturedOn: text("captured_on").notNull(),
    source: text("source").notNull(),
    periodKey: text("period_key").notNull().default(""),
    period: text("period"),
    handle: text("handle"),
    benchmark: text("benchmark"),
    updatedLabel: text("updated_label"),
    channelName: text("channel_name"),
    totalAudience: text("total_audience"),
    largestPlatform: text("largest_platform"),
    location: text("location"),
    metricsJson: text("metrics_json").notNull(),
    audienceJson: text("audience_json"),
    clipsJson: text("clips_json"),
    revenueCents: integer("revenue_cents"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("analytics_snapshot_key").on(table.creatorId, table.platform, table.capturedOn, table.periodKey)],
);
