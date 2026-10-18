import Link from "next/link";
import { changeDealStageAction, clearSafetyAction, confirmLivePostAction, confirmProductAction, contractReviewAction, creatorInterestAction, markPaymentAction, releaseOfferAction, reviewDraftAction, saveShipmentAction, setSignerMinorAction, submitLivePostsAction, uploadBrandSignedCopyAction, uploadContractAction } from "@/app/actions";
import { boldSignEnabled } from "@/lib/boldsign";
import { CONTRACT_CHECKS, contractStageOpen, contractStatusLabel } from "@/lib/contract-shared";
import { commissionLabel, creatorPayoutTracker, paymentStatusLabel, paymentStatusTone, withBasePath } from "@/lib/format";
import { safetyLabel } from "@/lib/safety-shared";
import { creatorStageMessage, sideStages, stageAdminLabel, stageShortLabel, trackStages } from "@/lib/stages";
import { Chips, MaybeTbd } from "./portal-frame";
import { UploadBox } from "./upload-box";
import type { DealDetail, DealSummary } from "@/lib/types";

const STEPS = [
  "1. You upload draft",
  "2. Kamron OKs email to brand",
  "3. Brand reviews",
  "4. Brand approves",
  "5. Post scheduled (Kamron OKs)",
];

const DRAFT_STATUS: Record<string, string> = {
  uploading: "Upload in progress",
  new: "Waiting for your manager",
  email_awaiting_ok: "Approved — email waiting for Kamron",
  sent: "Sent to the brand",
  approved: "Approved",
  revisions: "Changes requested",
};

export function DealBoard({
  deals,
  selected,
  showDetail,
  listNote,
  creatorQuery,
  canChangeStage = false,
  canApproveVideo = false,
  canReviewContract = false,
  canCountersign = false,
  isOwner = false,
  canSign = false,
  stageError = false,
  interestError = false,
  releaseError = null,
  reviewError = null,
  contractError = null,
  productError = null,
  postError = null,
  paymentError = null,
  safetyError = null,
}: {
  deals: DealSummary[];
  selected: DealDetail | null;
  showDetail: boolean;
  listNote: string | null;
  creatorQuery: string;
  canChangeStage?: boolean;
  canApproveVideo?: boolean;
  canReviewContract?: boolean;
  canCountersign?: boolean;
  isOwner?: boolean;
  canSign?: boolean;
  stageError?: boolean;
  interestError?: boolean;
  releaseError?: string | null;
  reviewError?: string | null;
  contractError?: string | null;
  productError?: string | null;
  postError?: string | null;
  paymentError?: string | null;
  safetyError?: string | null;
}) {
  return (
    <div className={showDetail ? "grid showdetail" : "grid"} id="dealGrid">
      <div className="list">
        <div className="sec-title">Your deals</div>
        {deals.length === 0 ? (
          <div className="card">
            <b>No deals on your list yet.</b>
            <p className="note">When a brand says yes, Kamron turns the deal on here. Negotiation notes stay off this page until then.</p>
          </div>
        ) : (
          deals.map((deal) => (
            <Link key={deal.id} href={`/deals/${deal.id}${creatorQuery}`} className={selected?.id === deal.id ? "deal on" : "deal"}>
              <div className="top">
                <span className="name">{deal.brand}</span>
                <span className="amt">{deal.amountDisplay}</span>
              </div>
              <div className="note">{creatorQuery.includes("all") ? `${deal.creatorName} · ` : ""}{deal.subtitle}</div>
              <Chips chips={deal.chips} />
              {deal.workflowStage ? <div className="note">{stageShortLabel(deal.workflowStage)}</div> : null}
              {deal.nextStep ? <div className="next">→ {deal.nextStep}</div> : null}
            </Link>
          ))
        )}
        {listNote ? <p className="note">{listNote}</p> : null}
        {deals.some((deal) => deal.isSeed) ? (
          <p className="note">Seed data. These deals were loaded from the Oct 17, 2026 mockup. Deals the bot adds later are not marked seed.</p>
        ) : null}
      </div>
      <div className="detail card">
        {selected ? (
          <DealDetailView
            deal={selected}
            backHref={`/${creatorQuery}`}
            showOwner={creatorQuery.includes("all")}
            canChangeStage={canChangeStage}
            canApproveVideo={canApproveVideo}
            canReviewContract={canReviewContract}
            canCountersign={canCountersign}
            isOwner={isOwner}
            canSign={canSign}
            creatorQuery={creatorQuery}
            stageError={stageError}
            interestError={interestError}
            releaseError={releaseError}
            reviewError={reviewError}
            contractError={contractError}
            productError={productError}
            postError={postError}
            paymentError={paymentError}
            safetyError={safetyError}
          />
        ) : (
          <p className="note">Pick a deal to see the brief, the feedback, and where to upload.</p>
        )}
      </div>
    </div>
  );
}

function DealDetailView({
  deal,
  backHref,
  showOwner,
  canChangeStage,
  canApproveVideo,
  canReviewContract,
  canCountersign,
  isOwner,
  canSign,
  creatorQuery,
  stageError,
  interestError,
  releaseError,
  reviewError,
  contractError,
  productError,
  postError,
  paymentError,
  safetyError,
}: {
  deal: DealDetail;
  backHref: string;
  showOwner: boolean;
  canChangeStage: boolean;
  canApproveVideo: boolean;
  canReviewContract: boolean;
  canCountersign: boolean;
  isOwner: boolean;
  canSign: boolean;
  creatorQuery: string;
  stageError: boolean;
  interestError: boolean;
  releaseError: string | null;
  reviewError: string | null;
  contractError: string | null;
  productError: string | null;
  postError: string | null;
  paymentError: string | null;
  safetyError: string | null;
}) {
  const creatorId = creatorQuery.startsWith("?creator=") ? creatorQuery.slice("?creator=".length) : "";
  const current = deal.workflowStage;
  const latestDraft = deal.drafts.reduce<DealDetail["drafts"][number] | null>((latest, draft) => {
    if (!latest || draft.version > latest.version) return draft;
    return latest;
  }, null);
  const currentDef = trackStages().find((stage) => stage.id === current);
  const onTrack = Boolean(currentDef);
  return (
    <>
      <Link href={backHref} className="btn ghost back">← All deals</Link>
      <h2>{deal.brand}</h2>
      <div className="sub">{deal.subtitle}{showOwner ? ` · ${deal.creatorName}` : ""}</div>
      <Chips chips={deal.chips} />
      {deal.isSeed ? <p className="note">Seed data from the Oct 17, 2026 mockup.</p> : null}
      {current ? (
        <>
          <div className="sec-title" style={{ marginTop: 14 }}>Where this deal is</div>
          <p className="stage-note">{creatorStageMessage(current, deal.brand)}</p>
          {latestDraft?.review?.decision === "approved" ? (
            <p className="stage-note">Approved by your manager, sending to {deal.brand}.</p>
          ) : null}
          {latestDraft?.review?.decision === "changes" ? (
            <div className="callout">
              <b>Your manager asked for changes.</b>
              {latestDraft.review.note ? <div>{latestDraft.review.note}</div> : null}
            </div>
          ) : null}
          <div className="steps">
            {trackStages().map((stage) => {
              const state = !onTrack ? "" : stage.order! < currentDef!.order! ? "done" : stage.id === current ? "now" : "";
              return <div key={stage.id} className={state}>{stage.order}. {stage.shortLabel}</div>;
            })}
          </div>
          {!onTrack ? <p className="stage-note">Side step: {stageShortLabel(current)}. The main track is paused here.</p> : null}
        </>
      ) : deal.stage !== null ? (
        <>
          <div className="sec-title" style={{ marginTop: 14 }}>Where this deal is</div>
          <div className="steps">
            {STEPS.map((step, index) => (
              <div key={step} className={index < (deal.stage ?? 0) ? "done" : index === deal.stage ? "now" : ""}>{step}</div>
            ))}
          </div>
        </>
      ) : null}
      {deal.canRespondToOffer ? (
        <form action={creatorInterestAction} className="stage-form">
          <input type="hidden" name="dealId" value={deal.id} />
          <label>
            Optional note
            <input
              type="text"
              name="note"
              placeholder="I'd want $500, or I can't post until November"
              aria-label="Optional note"
            />
          </label>
          <button className="btn" type="submit" name="decision" value="interested">I&apos;m interested</button>
          <button className="btn ghost" type="submit" name="decision" value="declined">Not for me</button>
          <p className="note">If you pass, put the reason in the note if you want. Kamron sees it. The brand only gets a polite note after he approves it, and your reason is not included unless he writes it in.</p>
          {interestError ? <span className="note">That choice was not saved.</span> : null}
        </form>
      ) : null}
      {deal.interest && !canChangeStage ? (
        <p className="stage-note">
          You said {deal.interest.decision === "interested" ? "you're interested" : "this isn't for you"}.
          {deal.interest.note ? ` Note: ${deal.interest.note}` : ""}
        </p>
      ) : null}
      {deal.canReleaseOffer ? (
        <form action={releaseOfferAction} className="stage-form">
          <input type="hidden" name="dealId" value={deal.id} />
          {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
          <label>
            Brand email
            <input
              type="email"
              name="brandEmail"
              required
              defaultValue={deal.brandEmail ?? ""}
              placeholder="hello@brand.com"
              aria-label="Brand email"
            />
          </label>
          <button className="btn" type="submit">Screened and released to creator</button>
          {releaseError === "past" ? (
            <span className="note">This deal is already past the offer. Nothing was changed.</span>
          ) : releaseError ? (
            <span className="note">Add the brand&apos;s email, then release the offer.</span>
          ) : (
            <p className="note">Until you release it, the creator does not see this offer.</p>
          )}
        </form>
      ) : null}
      {canChangeStage ? (
        <form action={changeDealStageAction} className="stage-form">
          <input type="hidden" name="dealId" value={deal.id} />
          {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
          <label>
            Move this deal
            <select name="workflowStage" defaultValue={current ?? "offer_received"}>
              <optgroup label="Main track">
                {trackStages().map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.order}. {stage.adminLabel}</option>
                ))}
              </optgroup>
              <optgroup label="Passed or paused">
                {sideStages().map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.adminLabel}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <input type="text" name="note" placeholder="Note only you see" aria-label="Private note" />
          <button className="btn" type="submit">Update stage</button>
          {stageError ? <span className="note">That stage was not saved.</span> : null}
        </form>
      ) : null}
      {canChangeStage && deal.offerReleased ? (
        <p className="note">Screened and released to {deal.creatorName}.{deal.brandEmail ? ` Brand email: ${deal.brandEmail}.` : ""}</p>
      ) : null}
      {canChangeStage && deal.interest ? (
        <div className="private-note">
          <div className="sec-title">Creator&apos;s choice</div>
          <p>
            {deal.interest.decision === "interested" ? "I'm interested" : "Not for me"}
            {deal.interest.note ? ` · ${deal.interest.note}` : ""}
          </p>
        </div>
      ) : null}
      {canChangeStage && deal.stageEvents && deal.stageEvents.length > 0 ? (
        <div className="private-note">
          <div className="sec-title">Stage history</div>
          <ul className="timeline">
            {deal.stageEvents.map((event) => (
              <li key={event.id}>
                <div className="when">{event.createdAt.slice(0, 16).replace("T", " ")} · {event.actorEmail} ({event.actorRole})</div>
                {stageAdminLabel(event.fromStage)} → {stageAdminLabel(event.toStage)}
                {event.note ? ` · ${event.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ProductAndPosts
        deal={deal}
        canChangeStage={canChangeStage}
        isOwner={isOwner}
        creatorId={creatorId}
        productError={productError}
        postError={postError}
        paymentError={paymentError}
      />
      {deal.botMessage ? (
        <div className="bot">
          <div className="ic">✦</div>
          <div>
            <b>{deal.creatorName} Bot</b>
            <div>{deal.botMessage}</div>
          </div>
        </div>
      ) : null}
      <div className="kv">
        <div><b>Rate</b><MaybeTbd value={deal.rateLabel} /></div>
        <div><b>Draft due</b><MaybeTbd value={deal.draftDue} /></div>
        <div><b>Post date</b><MaybeTbd value={deal.postDate} /></div>
        <div><b>Payment</b><MaybeTbd value={deal.paymentTerms} /></div>
      </div>
      <div className="box">
        <div className="sec-title">Creator brief</div>
        {deal.briefUrl ? (
          <a href={deal.briefUrl} target="_blank" rel="noreferrer">{deal.brief}</a>
        ) : (
          <MaybeTbd value={deal.brief} />
        )}
      </div>
      <div className="box">
        <div className="sec-title">Deliverables</div>
        <ul>{deal.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      <div className="box">
        <div className="sec-title">Usage rights & exclusivity</div>
        <MaybeTbd value={deal.usageRights} />
      </div>
      <ContractSection
        deal={deal}
        canReviewContract={canReviewContract}
        canCountersign={canCountersign}
        isOwner={isOwner}
        canSign={canSign}
        creatorId={creatorId}
        contractError={contractError}
      />
      <div className="box">
        <div className="sec-title">Revisions & feedback history</div>
        <ul className="timeline">
          {deal.revisions.map((revision) => (
            <li key={revision.id} className={revision.source === "brand" || revision.source === "next" ? revision.source : ""}>
              <div className="when">
                {revision.occurredLabel}
                {revision.source === "brand" ? " · from brand" : revision.source === "next" ? " · up next" : ""}
              </div>
              {revision.summary}
              {revision.emailUrl ? <> · <a href={revision.emailUrl}>Email</a></> : null}
            </li>
          ))}
        </ul>
      </div>
      {deal.kamronNotes ? (
        <div className="private-note">
          <div className="sec-title">{isOwner ? "Only Kamron sees this" : "Private note"}</div>
          {deal.kamronNotes}
        </div>
      ) : null}
      {deal.drafts.length > 0 ? (
        <div className="box">
          <div className="sec-title">Drafts</div>
          <ul>
            {deal.drafts.map((draft) => (
              <li key={draft.id}>
                <div>
                  v{draft.version}
                  {draft.filename ? ` · ${draft.filename}` : ""}
                  {" · "}
                  {DRAFT_STATUS[draft.status] ?? draft.status}
                  {draft.driveFileUrl ? <> · <a href={draft.driveFileUrl}>Drive file</a></> : draft.isSeed ? " · no portal file" : ""}
                </div>
                {draft.safety.some((flag) => flag.held) ? (
                  <div className="note">
                    Held for Kamron: {draft.safety.filter((flag) => flag.held).map((flag) => safetyLabel(flag.kind)).join(", ")}. Nothing goes to the brand until he clears it.
                  </div>
                ) : null}
                {isOwner && draft.safety.some((flag) => flag.held) ? (
                  <form action={clearSafetyAction} className="stage-form">
                    <input type="hidden" name="draftId" value={draft.id} />
                    <input type="hidden" name="back" value={`/deals/${deal.id}${creatorQuery}`} />
                    <button className="btn" type="submit">Clear hold</button>
                  </form>
                ) : null}
                {draft.review?.decision === "changes" && draft.review.note ? (
                  <div className="note">What to fix: {draft.review.note}</div>
                ) : null}
                {draft.review?.decision === "approved" ? (
                  <div className="note">Approved by your manager, sending to {deal.brand}.</div>
                ) : null}
                {canApproveVideo && !draft.isSeed && draft.status === "new" && !draft.review ? (
                  <form action={reviewDraftAction} className="stage-form">
                    <input type="hidden" name="dealId" value={deal.id} />
                    <input type="hidden" name="draftId" value={draft.id} />
                    {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
                    <label>
                      Notes
                      <textarea name="note" placeholder="What should she fix?" aria-label="Review notes" />
                    </label>
                    <label>
                      Brand email
                      <input
                        type="email"
                        name="brandEmail"
                        defaultValue={deal.brandEmail ?? ""}
                        placeholder="hello@brand.com"
                        aria-label="Brand email for the video"
                      />
                    </label>
                    <button className="btn" type="submit" name="decision" value="approved">Approve</button>
                    <button className="btn ghost" type="submit" name="decision" value="changes">Request changes</button>
                    {reviewError === "note" ? <span className="note">Tell her what to fix before sending it back.</span> : null}
                    {reviewError === "email" ? <span className="note">Add the brand email before approving. The email stays in your queue.</span> : null}
                    {reviewError === "held" ? <span className="note">This draft is held for Kamron. Nothing was sent to the brand.</span> : null}
                    {reviewError && reviewError !== "note" && reviewError !== "email" && reviewError !== "held" ? <span className="note">That review was not saved.</span> : null}
                    {safetyError === "creator" ? <span className="note">You can&apos;t clear a safety hold.</span> : null}
                    {safetyError === "owner" ? <span className="note">Only Kamron can clear a safety hold.</span> : null}
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <UploadBox dealId={deal.id} brand={deal.brand} enabled={deal.uploadEnabled} label={deal.uploadLabel || "Upload your draft"} />
    </>
  );
}

function ProductAndPosts({
  deal,
  canChangeStage,
  isOwner,
  creatorId,
  productError,
  postError,
  paymentError,
}: {
  deal: DealDetail;
  canChangeStage: boolean;
  isOwner: boolean;
  creatorId: string;
  productError: string | null;
  postError: string | null;
  paymentError: string | null;
}) {
  const nextStatus = !deal.payment?.paymentStatus
    ? "brand_invoiced"
    : deal.payment.paymentStatus === "brand_invoiced"
      ? "brand_paid"
      : deal.payment.paymentStatus === "brand_paid"
        ? "creator_payout_pending"
        : deal.payment.paymentStatus === "creator_payout_pending"
          ? "creator_paid"
          : null;
  const nextLabel: Record<string, string> = {
    brand_invoiced: "Brand invoiced",
    brand_paid: "Brand paid",
    creator_payout_pending: "Payout pending",
    creator_paid: "Creator paid",
  };
  const basis = deal.payment?.landedAmountCents ?? deal.payment?.amountOwedCents ?? null;
  const tracker = creatorPayoutTracker(deal.payment ?? null);
  return (
    <div className="box" id="product">
      <div className="sec-title">Product</div>
      {deal.shipment ? (
        <p>
          {deal.shipment.statusLabel}
          {" · "}
          {deal.shipment.carrier}
          {" · "}
          {deal.shipment.trackingUrl ? (
            <a href={deal.shipment.trackingUrl} target="_blank" rel="noreferrer">{deal.shipment.trackingNumber}</a>
          ) : (
            deal.shipment.trackingNumber
          )}
        </p>
      ) : (
        <p className="note">No tracking yet.</p>
      )}
      {canChangeStage ? (
        <form action={saveShipmentAction} className="stage-form">
          <input type="hidden" name="dealId" value={deal.id} />
          {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
          <label>
            Carrier
            <input type="text" name="carrier" required placeholder="UPS" aria-label="Carrier" defaultValue={deal.shipment?.carrier ?? ""} />
          </label>
          <label>
            Tracking number
            <input type="text" name="trackingNumber" required placeholder="1Z..." aria-label="Tracking number" defaultValue={deal.shipment?.trackingNumber ?? ""} />
          </label>
          <button className="btn" type="submit">Save tracking</button>
        </form>
      ) : null}
      {deal.canConfirmProduct ? (
        <form action={confirmProductAction} className="stage-form">
          <input type="hidden" name="dealId" value={deal.id} />
          {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
          <button className="btn" type="submit">I got it</button>
        </form>
      ) : null}
      {productError === "past" ? <p className="note">This deal is already past the product. Nothing was changed.</p> : null}
      {productError === "1" ? <p className="note">That tracking was not saved.</p> : null}

      <div className="sec-title" style={{ marginTop: 14 }}>Live posts</div>
      {deal.livePosts.length === 0 ? <p className="note">No live links yet.</p> : null}
      <ul>
        {deal.livePosts.map((post) => (
          <li key={post.id}>
            {post.platform} · <a href={post.url}>{post.url}</a>
            {post.meetsBrief === true ? " · Matches the brief" : post.meetsBrief === false ? " · Does not match the brief" : " · Not confirmed"}
            {canChangeStage && post.meetsBrief === null ? (
              <form action={confirmLivePostAction} className="stage-form">
                <input type="hidden" name="dealId" value={deal.id} />
                <input type="hidden" name="postId" value={post.id} />
                {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
                <label className="contract-choices">
                  <input type="checkbox" name="queueEmail" value="1" defaultChecked /> Email the post link to the brand
                </label>
                <button className="btn" type="submit" name="meetsBrief" value="yes">Matches the brief</button>
                <button className="btn ghost" type="submit" name="meetsBrief" value="no">Does not match</button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {deal.canSubmitPosts ? (
        <form action={submitLivePostsAction} className="stage-form">
          <input type="hidden" name="dealId" value={deal.id} />
          {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
          <label>
            Platform
            <select name="platform" aria-label="Post platform" defaultValue="tiktok">
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>
          <label>
            Live link
            <input type="url" name="url" required placeholder="https://" aria-label="Live post link" />
          </label>
          <button className="btn" type="submit">Submit live post</button>
        </form>
      ) : null}
      {postError === "early" ? <p className="note">This video isn&apos;t approved for posting yet. Nothing was changed.</p> : null}
      {postError === "email" ? <p className="note">Add the brand email before the post links can be queued.</p> : null}
      {postError === "1" ? <p className="note">That post was not saved.</p> : null}

      {isOwner && deal.canMarkPayment ? (
        <>
          <div className="sec-title" style={{ marginTop: 14 }}>Payment</div>
          <p>
            <span className={`chip ${paymentStatusTone(deal.payment?.paymentStatus ?? null)}`}>{paymentStatusLabel(deal.payment?.paymentStatus ?? null, "owner")}</span>
            {" · Commission "}
            {commissionLabel(basis)}
          </p>
          <p className="note">Money stays put until you move it yourself. Nothing is charged or sent from here.</p>
          {nextStatus ? (
            <form action={markPaymentAction} className="stage-form">
              <input type="hidden" name="dealId" value={deal.id} />
              {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
              <button className="btn" type="submit" name="paymentStatus" value={nextStatus}>{nextLabel[nextStatus]}</button>
            </form>
          ) : null}
          {paymentError === "early" ? <p className="note">Post the video before invoicing the brand. Nothing was changed.</p> : null}
          {paymentError === "order" ? <p className="note">Mark the payment steps in order.</p> : null}
          {paymentError === "1" ? <p className="note">That payment step was not saved.</p> : null}
        </>
      ) : null}
      {!isOwner && !canChangeStage && deal.payment ? (
        <>
          <div className="sec-title" style={{ marginTop: 14 }}>Your payout</div>
          <p>Your payout: {tracker.payoutLabel} · {tracker.statusLabel}</p>
          <p>Momma Mari fee: {tracker.feeLabel}</p>
          <p>Brand paid: {tracker.brandPaidOn ?? "Not yet"}</p>
          <p>Your cut sent: {tracker.cutSentOn ?? "Not yet"}</p>
          <p className="note">Kamron marks each step. Nothing is sent from here.</p>
        </>
      ) : null}
    </div>
  );
}

function ContractSection({
  deal,
  canReviewContract,
  canCountersign,
  isOwner,
  canSign,
  creatorId,
  contractError,
}: {
  deal: DealDetail;
  canReviewContract: boolean;
  canCountersign: boolean;
  isOwner: boolean;
  canSign: boolean;
  creatorId: string;
  contractError: string | null;
}) {
  const open = contractStageOpen(deal.workflowStage);
  if (canReviewContract && !open && deal.contracts.length === 0) return null;
  if (!canReviewContract && deal.contracts.length === 0) return null;
  return (
    <div className="box" id="contract">
      <div className="sec-title">Contract</div>
      {canReviewContract ? (
        <>
          <p className="note">
            Upload the brand&apos;s contract. Each file is kept as the next version in the Contracts folder. Nothing is overwritten.
          </p>
          {isOwner ? (
            <p className="note">
              {boldSignEnabled()
                ? "BoldSign is on for this portal."
                : "BoldSign is off. Creators sign on this site, at no extra cost."}
            </p>
          ) : null}
          {isOwner ? (
          <form action={setSignerMinorAction} className="stage-form">
            <input type="hidden" name="dealId" value={deal.id} />
            <input type="hidden" name="creatorId" value={deal.creatorId} />
            {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
            <label className="contract-choices">
              <input type="checkbox" name="minor" value="1" defaultChecked={deal.signerIsMinor} /> The signer is a minor
            </label>
            <button className="btn ghost" type="submit">Save signer</button>
          </form>
          ) : null}
          {deal.signerIsMinor ? (
            <p className="note">A parent or guardian has to sign. Kamron is flagged when they do.</p>
          ) : null}
          {open ? (
            <form action={uploadContractAction} className="stage-form">
              <input type="hidden" name="dealId" value={deal.id} />
              {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
              <label>
                PDF or DOCX
                <input type="file" name="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required aria-label="Contract file" />
              </label>
              <label className="contract-choices">
                <input type="checkbox" name="docusign" value="1" /> DocuSign
              </label>
              <label className="contract-choices">
                <input type="checkbox" name="countersign" value="1" /> Momma Mari countersigns
              </label>
              <button className="btn" type="submit">Upload contract</button>
            </form>
          ) : null}
          {contractError === "type" ? <p className="note">Upload a PDF or DOCX under 20 MB.</p> : null}
          {contractError === "past" ? <p className="note">This deal is already past the contract. Nothing was changed.</p> : null}
          {contractError === "review" ? <p className="note">This file needs review before signing. Upload a PDF or mark it as DocuSign.</p> : null}
          {contractError === "changes" ? <p className="note">Mark at least one checklist item as an issue, or write the changes to request.</p> : null}
          {contractError === "email" ? <p className="note">Add the brand email before asking for changes. The email stays in your queue.</p> : null}
          {contractError === "signemail" ? <p className="note">Add the brand email before the signed contract can be queued.</p> : null}
          {contractError === "upload" ? <p className="note">Upload the completed signed PDF.</p> : null}
          {contractError === "signed" ? <p className="note">This version is already signed.</p> : null}
          {contractError === "1" ? <p className="note">That contract change was not saved.</p> : null}
          {deal.contracts.map((contract) => {
            const signWindow = deal.workflowStage === "approved_by_agency" || deal.workflowStage === "awaiting_signature";
            const copies = deal.signatures.filter((row) => row.contractId === contract.id);
            const openRequest = copies.some((row) => row.status === "requested");
            const waiting = copies.some((row) => row.status === "pending_countersign");
            const filed = copies.some((row) => row.status === "final" || row.status === "pending_countersign");
            const signQuery = creatorId ? `&creator=${encodeURIComponent(creatorId)}` : "";
            return (
            <div key={contract.id} className="contract-item">
            <form action={contractReviewAction}>
              <input type="hidden" name="dealId" value={deal.id} />
              <input type="hidden" name="contractId" value={contract.id} />
              {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
              <div>
                <b>v{contract.version}</b>
                {` · ${contract.filename} · ${contractStatusLabel(contract.status)} · ${contract.signingLabel}`}
                {contract.countersign ? " · Momma Mari will countersign" : ""}
                {contract.driveFileUrl ? <> · <a href={contract.driveFileUrl}>Drive file</a></> : null}
              </div>
              <div className="private-note">
                <div className="sec-title">{isOwner ? "Only Kamron sees this" : "Checklist"}</div>
                {(contract.checks ?? CONTRACT_CHECKS.map((item) => ({ ...item, item: item.id, status: "unchecked", note: null }))).map((check) => (
                  <div key={check.item} className="contract-item">
                    <b>{check.label}</b>
                    <div className="contract-choices">
                      <label><input type="radio" name={`status:${check.item}`} value="ok" defaultChecked={check.status === "ok"} /> OK</label>
                      <label><input type="radio" name={`status:${check.item}`} value="issue" defaultChecked={check.status === "issue"} /> Issue</label>
                      <label><input type="radio" name={`status:${check.item}`} value="unchecked" defaultChecked={check.status !== "ok" && check.status !== "issue"} /> Not checked</label>
                    </div>
                    <input type="text" name={`note:${check.item}`} defaultValue={check.note ?? ""} aria-label={`${check.label} note`} placeholder="Note, only you see this" />
                  </div>
                ))}
              </div>
              <div className="stage-form">
                <label>
                  Signing
                  <select name="signingFormat" defaultValue={contract.signingFormat} aria-label={`Signing format for v${contract.version}`}>
                    <option value="pdf">PDF, ready for signing later</option>
                    <option value="docusign">DocuSign, ready for signing later</option>
                    <option value="needs_review">needs review before signing</option>
                  </select>
                </label>
                <label className="contract-choices">
                  <input type="checkbox" name="countersign" value="1" defaultChecked={contract.countersign} /> Momma Mari countersigns
                </label>
                <label>
                  Brand email
                  <input type="email" name="brandEmail" defaultValue={deal.brandEmail ?? ""} placeholder="hello@brand.com" aria-label={`Brand email for v${contract.version}`} />
                </label>
                <label>
                  Changes for the brand
                  <textarea name="changes" aria-label={`Changes for v${contract.version}`} placeholder="Anything else they should fix" />
                </label>
                <button className="btn ghost" type="submit" name="intent" value="save">Save checklist</button>
                {contract.status === "approved" ? null : (
                  <>
                    <button className="btn ghost" type="submit" name="intent" value="revisions">Request revisions</button>
                    <button className="btn" type="submit" name="intent" value="approve">Approve contract</button>
                  </>
                )}
              </div>
            </form>
            {copies.filter((row) => row.status !== "void" || canReviewContract).map((row) => (
              <p key={row.id} className="note">
                {row.status === "requested" ? "Waiting for a signature" : row.status === "pending_countersign" ? "Waiting for Momma Mari to countersign" : row.status === "void" ? "Replaced" : "Signed"}
                {row.signerName ? ` · ${row.signerName}` : ""}
                {row.signedAt ? ` · ${row.signedAt}` : ""}
                {row.ip ? ` · ${row.ip}` : ""}
                {row.signedFilename ? <> · <a href={withBasePath(`/api/deals/${deal.id}/signatures/${row.id}/file`)}>{row.signedFilename}</a></> : null}
              </p>
            ))}
            {waiting && canCountersign ? <p><Link href={`/deals/${deal.id}/sign?contract=${contract.id}${signQuery}`}>Countersign</Link></p> : null}
            {signWindow && contract.status === "approved" && !filed ? (
              <form action={uploadBrandSignedCopyAction} className="stage-form">
                <input type="hidden" name="dealId" value={deal.id} />
                <input type="hidden" name="contractId" value={contract.id} />
                {creatorId ? <input type="hidden" name="creator" value={creatorId} /> : null}
                <label>
                  Brand sent their own DocuSign
                  <input type="file" name="file" accept="application/pdf,.pdf" required aria-label={`Completed signed PDF for v${contract.version}`} />
                </label>
                <button className="btn ghost" type="submit">Upload the completed copy</button>
              </form>
            ) : null}
            {openRequest ? <p className="note">The creator can sign v{contract.version} on the sign page.</p> : null}
            </div>
            );
          })}
        </>
      ) : (
        <ul>
          {deal.contracts.map((contract) => {
            const signWindow = deal.workflowStage === "approved_by_agency" || deal.workflowStage === "awaiting_signature";
            const requested = deal.signatures.some((row) => row.contractId === contract.id && row.status === "requested");
            const copies = deal.signatures.filter((row) => row.contractId === contract.id && row.signedFilename);
            const signable = contract.signingFormat === "pdf" || contract.signingFormat === "docusign";
            return (
              <li key={contract.id}>
                v{contract.version} · {contract.filename} · {contract.signingLabel}
                {contract.driveFileUrl ? <> · <a href={contract.driveFileUrl}>Open contract</a></> : null}
                {contract.countersign ? <div className="note">Momma Mari will countersign.</div> : null}
                {signWindow && requested && signable && canSign ? (
                  <div><Link href={`/deals/${deal.id}/sign?contract=${contract.id}`}>Sign this contract</Link></div>
                ) : null}
                {copies.map((row) => (
                  <div key={row.id}>
                    <a href={withBasePath(`/api/deals/${deal.id}/signatures/${row.id}/file`)}>{row.signedFilename}</a>
                    {row.status === "pending_countersign" ? <span className="note"> Waiting for Momma Mari to countersign.</span> : null}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
