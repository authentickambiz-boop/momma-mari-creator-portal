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
  updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  creatorId: text("creator_id"),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});
