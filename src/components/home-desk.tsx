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
  const kpis = [
    summary.activeCount > 0 ? { caption: "Active deals", value: String(summary.activeCount), detail: "In progress" } : null,
    summary.nextPost?.when ? { caption: "Next post", value: summary.nextPost.when, detail: summary.nextPost.brand } : null,
    summary.draftCount > 0 ? { caption: "Drafts in review", value: String(summary.draftCount), detail: "With the team or the brand" } : null,
    payoutPending > 0 ? { caption: "Next payout", value: String(payoutPending), detail: payoutPending === 1 ? "1 payout pending" : `${payoutPending} payouts pending` } : null,
  ].filter((card): card is { caption: string; value: string; detail: string } => card != null && card.value.trim() !== "" && card.detail.trim() !== "");
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
      {kpis.length > 0 ? (
        <div className="kpi-row">
          {kpis.map((card) => (
            <article key={card.caption} className="kpi">
              <p className="caption">{card.caption}</p>
              <b>{card.value}</b>
              <p className="caption">{card.detail}</p>
            </article>
          ))}
        </div>
      ) : null}
      <div className="desk-split">
        {rows.length > 0 ? (
        <section className="panel">
          <div className="panel-h">
            <h2>Your brand deals</h2>
            <a href="#deals">View all</a>
          </div>
          {rows.map((deal) => {
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
        ) : null}
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
