export const DEAL_STATUSES = ["pitch", "negotiating", "active", "delivered", "paid"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DRAFT_STATUSES = ["uploading", "new", "email_awaiting_ok", "sent", "approved", "revisions"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export type Viewer = {
  email: string;
  role: "admin" | "creator";
  creatorId: string | null;
  name: string;
  initials?: string;
};

export type Chip = { text: string; tone: string };

export type CreatorProfile = {
  id: string;
  name: string;
  email: string;
  handles: string | null;
  kidsAges: string | null;
  payoutMethod: string | null;
  splitPercent: number | null;
  monthlyGoalCents: number | null;
  driveFolderId: string | null;
  initials: string;
  listNote: string | null;
  isSeed: boolean;
  accounts: {
    tiktok: AccountLink;
    instagram: AccountLink;
    facebook: AccountLink;
    youtube: AccountLink;
    email: AccountLink;
  };
};

export type AccountLink = { status: string; connectUrl: string | null };

export type DealSummary = {
  id: string;
  creatorId: string;
  creatorName: string;
  brand: string;
  subtitle: string | null;
  status: string;
  amountDisplay: string | null;
  chips: Chip[];
  nextStep: string | null;
  visibleToCreator: boolean;
  needsCreator: boolean;
  isSeed: boolean;
  uploadEnabled: boolean;
  earningsChipText: string | null;
  earningsChipTone: string | null;
  pipelineCents: number | null;
  pipelineName: string | null;
  sortOrder: number;
  workflowStage: string | null;
};

export type StageEventView = {
  id: string;
  fromStage: string | null;
  toStage: string;
  actorEmail: string;
  actorRole: string;
  note: string | null;
  createdAt: string;
};

export type RevisionView = {
  id: string;
  occurredLabel: string;
  occurredAt: string | null;
  source: string;
  summary: string;
  emailUrl: string | null;
  isSeed: boolean;
};

export type DraftView = {
  id: string;
  version: number;
  filename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  bytesReceived: number;
  driveFileId: string | null;
  driveFileUrl: string | null;
  status: string;
  gmailThreadId: string | null;
  uploadedAt: string | null;
  isSeed: boolean;
};

export type PaymentView = {
  id: string;
  dealId: string;
  amountOwedCents: number | null;
  amountLabel: string | null;
  dueDate: string | null;
  dueLabel: string | null;
  landedDate: string | null;
  landedAmountCents: number | null;
  creatorSplitPercent: number | null;
  agencySplitPercent: number | null;
  creatorPayoutCents: number | null;
  payoutApprovedOn: string | null;
  paidOutDate: string | null;
  isSeed: boolean;
};

export type InterestView = {
  decision: string;
  note: string | null;
  createdAt: string;
  approvalId: string | null;
};

export type DealDetail = DealSummary & {
  contact: string | null;
  gmailThreadId: string | null;
  rateLabel: string | null;
  rateCents: number | null;
  deliverables: string[];
  usageRights: string | null;
  brief: string | null;
  briefUrl: string | null;
  draftDue: string | null;
  postDate: string | null;
  paymentTerms: string | null;
  kamronNotes: string | null;
  botMessage: string | null;
  stage: number | null;
  stageEvents: StageEventView[] | null;
  uploadLabel: string | null;
  driveFolderId: string | null;
  revisions: RevisionView[];
  drafts: DraftView[];
  payment: PaymentView | null;
  interest: InterestView | null;
  offerReleased: boolean;
  brandEmail: string | null;
  canRespondToOffer: boolean;
  canReleaseOffer: boolean;
};

export type InboxItem = {
  id: string;
  occurredOn: string;
  source: string;
  amountLabel: string;
  isSeed: boolean;
};

export type DailyMetric = {
  id: string;
  creatorId: string;
  platform: string;
  metricDate: string;
  followers: number | null;
  newFollowers: number | null;
  views: number | null;
  engagementRate: number | null;
  saves: number | null;
  isExample: boolean;
};

export type PostMetric = {
  id: string;
  title: string;
  platform: string;
  views: number | null;
  saves: number | null;
  isExample: boolean;
};
