"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { movePipelineAction, movePipelineToStage, savePipelineCardAction } from "@/app/pipeline-actions";
import type { PipelineStageId } from "@/lib/brand-pipeline";

export type PipelineBoardCard = {
  id: string;
  brand: string;
  creatorName: string;
  contactEmail: string | null;
  stage: PipelineStageId;
  valueInput: string;
  valueLabel: string;
  nextFollowUp: string;
  followLabel: string;
  status: "none" | "upcoming" | "today" | "overdue";
  note: string;
  nextLine: string;
};

export type PipelineBoardColumn = {
  id: PipelineStageId;
  label: string;
  step: string;
  blurb: string;
  forward: string;
  countLabel: string;
  sumLabel: string;
  cards: PipelineBoardCard[];
};

export type PipelineStageOption = { id: PipelineStageId; label: string };

export function PipelineBoard({
  columns,
  stages,
  summary,
  creatorQuery,
  scopeNote,
}: {
  columns: PipelineBoardColumn[];
  stages: PipelineStageOption[];
  summary: { id: string; label: string; countLabel: string; detail: string; tone: "overdue" | "today" | "" }[];
  creatorQuery: string;
  scopeNote: string | null;
}) {
  const router = useRouter();
  const dragging = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [moved, setMoved] = useState<Record<string, PipelineStageId>>({});
  const [over, setOver] = useState<PipelineStageId | null>(null);
  const [editing, setEditing] = useState<PipelineBoardCard | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editing && !dialog.open) dialog.showModal();
    if (!editing && dialog.open) dialog.close();
  }, [editing]);

  const cards = columns.flatMap((column) => column.cards);
  function stageOf(card: PipelineBoardCard) {
    return moved[card.id] ?? card.stage;
  }
  function nextStage(stage: PipelineStageId) {
    const index = stages.findIndex((item) => item.id === stage);
    return stages[index + 1] ?? null;
  }

  async function dropOn(stage: PipelineStageId) {
    setOver(null);
    const cardId = dragging.current;
    dragging.current = null;
    if (!cardId) return;
    const card = cards.find((item) => item.id === cardId);
    if (!card || stageOf(card) === stage) return;
    setMoved((current) => ({ ...current, [cardId]: stage }));
    setDragError(null);
    const result = await movePipelineToStage(cardId, stage);
    if (!result.ok) {
      setMoved((current) => {
        const next = { ...current };
        delete next[cardId];
        return next;
      });
      setDragError(result.error);
      return;
    }
    router.refresh();
  }

  const openCard = editing ? { ...editing, stage: stageOf(editing) } : null;

  return (
    <div className="pipeline-wrap">
      <div className="pipeline-summary" role="group" aria-label="Pipeline summary">
        {summary.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pipeline-sum${item.tone ? ` is-${item.tone}` : ""}`}
            onClick={() => {
              if (item.id === "followups") return;
              document.getElementById(`stage-${item.id}`)?.scrollIntoView({ inline: "start", block: "nearest" });
            }}
          >
            <span className="sec-title">{item.label}</span>
            <b>{item.countLabel}</b>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>
      <p className="note pipeline-hint">Drag a card into a column, or use Move to next stage. Click a card to change the amount, the follow-up date, or a private note. Nothing is emailed.</p>
      <p className="note pipeline-swipe">Swipe sideways for the next stage.</p>
      {scopeNote ? <p className="note">{scopeNote}</p> : null}
      {dragError ? <p className="note alert" role="alert">{dragError} Nothing was emailed.</p> : null}
      <div className="pipeline-board">
        {columns.map((column) => {
          const shown = cards.filter((card) => stageOf(card) === column.id);
          return (
            <section
              key={column.id}
              id={`stage-${column.id}`}
              className={`card pipeline-col${over === column.id ? " is-over" : ""}`}
              aria-label={`${column.label}, ${column.step}`}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(column.id);
              }}
              onDragLeave={() => setOver((current) => (current === column.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                void dropOn(column.id);
              }}
            >
              <header className="pipeline-col-head">
                <p className="sec-title">{column.step}</p>
                <h2>{column.label}</h2>
                <p className="pipeline-col-count">{shown.length === 0 ? "None yet" : `${shown.length} · ${column.sumLabel}`}</p>
                <p>{column.blurb}</p>
                <p className="note">{column.forward}</p>
              </header>
              {shown.length === 0 ? <p className="note empty">Nothing in this stage.</p> : null}
              {shown.map((card) => {
                const next = nextStage(stageOf(card));
                const tone = card.status === "overdue" ? " is-overdue" : card.status === "today" ? " is-today" : "";
                return (
                  <article key={card.id} className={`pipeline-card${tone}`}>
                    <div
                      className="pipeline-grip"
                      draggable
                      aria-hidden="true"
                      onDragStart={(event) => {
                        dragging.current = card.id;
                        event.dataTransfer.setData("text/plain", card.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        dragging.current = null;
                        setOver(null);
                      }}
                    >
                      <span /><span />
                    </div>
                    <button type="button" className="pipeline-open" onClick={() => setEditing(card)} aria-label={`Open ${card.brand}`}>
                      <span className="pipeline-open-top">
                        <b>{card.brand}</b>
                        <span className="pipeline-value">{card.valueLabel}</span>
                      </span>
                      <span className="note">{card.creatorName}</span>
                      <span className="pipeline-next">Next · {card.nextLine}</span>
                      <span className={`pipeline-flag${card.status === "overdue" ? " is-overdue" : ""}${card.status === "today" ? " is-today" : ""}`}>{card.followLabel}</span>
                    </button>
                    {next ? (
                      <form action={movePipelineAction}>
                        <input type="hidden" name="cardId" value={card.id} />
                        <input type="hidden" name="stage" value={next.id} />
                        <input type="hidden" name="creator" value={creatorQuery} />
                        <button className="btn ghost pipeline-move" type="submit">
                          Move to next stage
                          <span className="pipeline-move-where">{next.label}</span>
                        </button>
                      </form>
                    ) : <p className="note">Last stage. Open the card to move it back.</p>}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      <dialog
        ref={dialogRef}
        className="pipeline-dialog"
        aria-labelledby="pipeline-detail-title"
        onClose={() => setEditing(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setEditing(null);
        }}
      >
        {openCard ? (
          <form key={openCard.id} action={savePipelineCardAction} className="pipeline-detail">
            <div className="pipeline-detail-head">
              <h2 id="pipeline-detail-title">{openCard.brand}</h2>
              <button className="btn ghost" type="button" onClick={() => setEditing(null)}>Close</button>
            </div>
            <p className="note">{openCard.creatorName}{openCard.contactEmail ? ` · ${openCard.contactEmail}` : ""}</p>
            <p className="note">Private to the owner. Creators never see this card, a hidden deal, or this note.</p>
            <input type="hidden" name="cardId" value={openCard.id} />
            <input type="hidden" name="creator" value={creatorQuery} />
            <label>
              Stage
              <select name="stage" defaultValue={openCard.stage} aria-label={`Stage for ${openCard.brand}`}>
                {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
              </select>
            </label>
            <label>
              Value in dollars
              <input name="value" defaultValue={openCard.valueInput} inputMode="decimal" placeholder="TBD" aria-label={`Value for ${openCard.brand}`} />
            </label>
            <label>
              Follow up
              <input name="nextFollowUp" type="date" defaultValue={openCard.nextFollowUp} aria-label={`Follow up for ${openCard.brand}`} />
            </label>
            <label>
              Private note
              <textarea name="note" rows={3} maxLength={500} defaultValue={openCard.note} placeholder="What you will do next" aria-label={`Private note for ${openCard.brand}`} />
            </label>
            <button className="btn" type="submit">Save</button>
          </form>
        ) : null}
      </dialog>
    </div>
  );
}
