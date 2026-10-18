import Link from "next/link";
import { changeDealStageAction, creatorInterestAction, releaseOfferAction, reviewDraftAction } from "@/app/actions";
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
  stageError = false,
  interestError = false,
  releaseError = null,
  reviewError = null,
}: {
  deals: DealSummary[];
  selected: DealDetail | null;
  showDetail: boolean;
  listNote: string | null;
  creatorQuery: string;
  canChangeStage?: boolean;
  stageError?: boolean;
  interestError?: boolean;
  releaseError?: string | null;
  reviewError?: string | null;
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
            creatorQuery={creatorQuery}
            stageError={stageError}
            interestError={interestError}
            releaseError={releaseError}
            reviewError={reviewError}
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
  creatorQuery,
  stageError,
  interestError,
  releaseError,
  reviewError,
}: {
  deal: DealDetail;
  backHref: string;
  showOwner: boolean;
  canChangeStage: boolean;
  creatorQuery: string;
  stageError: boolean;
  interestError: boolean;
  releaseError: string | null;
  reviewError: string | null;
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
          <div className="sec-title">Only Kamron sees this</div>
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
                {draft.review?.decision === "changes" && draft.review.note ? (
                  <div className="note">What to fix: {draft.review.note}</div>
                ) : null}
                {draft.review?.decision === "approved" ? (
                  <div className="note">Approved by your manager, sending to {deal.brand}.</div>
                ) : null}
                {canChangeStage && !draft.isSeed && draft.status === "new" && !draft.review ? (
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
                    {reviewError && reviewError !== "note" && reviewError !== "email" ? <span className="note">That review was not saved.</span> : null}
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
