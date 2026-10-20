import Link from "next/link";
import { brandInitials, homeSummary, progressMarks, taskCopy } from "@/lib/home-desk";
import { shortDate } from "@/lib/format";
import { stageShortLabel } from "@/lib/stages";
import type { DealSummary } from "@/lib/types";

export function HomeDesk({
  deals,
  needs,
  payoutPending,
  assistant,
}: {
  deals: DealSummary[];
  needs: DealSummary[];
  payoutPending: number;
  assistant: string | null;
}) {
  const summary = homeSummary(deals);
  const rows = deals.filter((deal) => deal.visibleToCreator).slice(0, 6);
  const payout = payoutPending === 0 ? summary.payoutLabel : payoutPending === 1 ? "1 payout pending" : `${payoutPending} payouts pending`;
  return (
    <div className="home-desk">
      <div className="desk-head">
        <p className="eyebrow">Needs you</p>
        <div className="desk-actions">
          <Link className="btn ghost" href="/calendar">View calendar</Link>
          <Link className="btn" href={needs[0] ? `/deals/${needs[0].id}` : "/"}>Upload a draft</Link>
        </div>
      </div>
      {needs.length > 0 ? (
        <div className="need-row">
          {needs.slice(0, 3).map((deal) => {
            const task = taskCopy(deal);
            const hot = deal.workflowStage === "draft_due" || deal.deadlineFlag === "overdue";
            return (
              <article key={deal.id} className={hot ? "need-card hot" : "need-card"}>
                <p className="caption">{deal.uploadDue ? `Due ${shortDate(deal.uploadDue) || deal.uploadDue}` : stageShortLabel(deal.workflowStage)}</p>
                <p className="caption">{deal.brand}</p>
                <h2>{task.title}</h2>
                <Link className={hot ? "btn accent" : "btn ghost"} href={`/deals/${deal.id}`}>{task.action}</Link>
              </article>
            );
          })}
        </div>
      ) : null}
      <div className="kpi-row">
        <article className="kpi">
          <p className="caption">Active deals</p>
          <b>{summary.activeCount}</b>
          <p className="caption">In progress</p>
        </article>
        <article className="kpi">
          <p className="caption">Next post</p>
          <b>{summary.nextPost?.when || "None"}</b>
          <p className="caption">{summary.nextPost?.brand || "No date on the list"}</p>
        </article>
        <article className="kpi">
          <p className="caption">Drafts in review</p>
          <b>{summary.draftCount}</b>
          <p className="caption">{summary.draftCount === 1 ? "With the team or the brand" : "With the team or the brand"}</p>
        </article>
        <article className="kpi">
          <p className="caption">Next payout</p>
          <b>{payoutPending > 0 ? payoutPending : "None"}</b>
          <p className="caption">{payout}</p>
        </article>
      </div>
      <div className="desk-split">
        <section className="panel">
          <div className="panel-h">
            <h2>Your brand deals</h2>
            <a href="#deals">View all</a>
          </div>
          {rows.length === 0 ? <p className="note empty">No deals on this list yet.</p> : rows.map((deal) => {
            const marks = progressMarks(deal.workflowStage);
            return (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="progress-row">
                <span className="brand-tile">{brandInitials(deal.brand)}</span>
                <span>
                  <strong>{deal.brand}</strong>
                  <span className="caption">{deal.subtitle}</span>
                </span>
                <span className="stages" aria-hidden="true">
                  {marks.map((on, index) => <i key={index} className={on ? "on" : ""} />)}
                </span>
                <span className="caption">{deal.postDate ? shortDate(deal.postDate) || deal.postDate : "No date"}</span>
                <span className="chip c-gray">{stageShortLabel(deal.workflowStage)}</span>
              </Link>
            );
          })}
        </section>
        <aside className="desk-side">
          {rows[0] ? (
            <section className="panel">
              <div className="panel-h">
                <h2>{rows[0].brand}</h2>
                <span className="chip c-sun">{stageShortLabel(rows[0].workflowStage)}</span>
              </div>
              <p className="note">{rows[0].nextStep || "The next step shows on the deal."}</p>
            </section>
          ) : null}
          <section className="assistant">
            <span className="brand-m" aria-hidden="true">M</span>
            <div>
              <strong>Your assistant</strong>
              <p>{assistant || "Kamron approves anything that would go to a brand. Nothing is emailed from this page."}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
