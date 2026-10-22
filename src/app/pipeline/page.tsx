import { PipelineBoard } from "@/components/pipeline-board";
import { PortalFrame } from "@/components/portal-frame";
import {
  PIPELINE_STAGES,
  civilToday,
  filterPipelineColumns,
  followUpLabel,
  followUpStatus,
  listPipeline,
  pipelineCardNextLine,
  pipelineDollarsInput,
  pipelineSumLabel,
  seedBrandPipeline,
  summarizePipeline,
} from "@/lib/brand-pipeline";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";

function pipelineNote(code: string | undefined, saved: string | undefined) {
  if (saved === "1") return "Moved. Nothing was emailed.";
  if (saved === "follow") return "Follow-up date saved. Nothing was emailed.";
  if (saved === "card") return "Saved. Nothing was emailed.";
  if (code === "stage") return "That is not a pipeline stage. Nothing was changed.";
  if (code === "date") return "Use a YYYY-MM-DD date. Nothing was saved.";
  if (code === "value") return "Use a dollar amount, or leave the value blank for TBD. Nothing was saved.";
  if (code === "note") return "Keep the private note under 500 characters. Nothing was saved.";
  if (code === "missing") return "That card was not found.";
  if (code === "forbidden") return "The pipeline stays with the owner.";
  return null;
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ creator?: string; error?: string; saved?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const note = pipelineNote(params.error, params.saved);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="pipeline" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Deal pipeline</h1>}>
        <p className="note">The deal pipeline stays on the owner&apos;s sign-in.</p>
      </PortalFrame>
    );
  }
  await seedBrandPipeline(portal.db, portal.viewer);
  const board = await listPipeline(portal.db, portal.viewer);
  const today = civilToday();
  const filtered = board.ok ? filterPipelineColumns(board.columns, portal.viewedId) : [];
  const summary = summarizePipeline(filtered, today);
  const scopeName = portal.viewed?.name ?? null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="pipeline"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Deal pipeline</h1><p>Ten stages, from the first hello to asking the brand back. A card moves when that step is done. Nothing is emailed.</p></div></div>}
    >
      {note ? <p className="note">{note}</p> : null}
      {board.ok ? (
        <PipelineBoard
          creatorQuery={portal.viewedId}
          scopeNote={scopeName ? `Showing ${scopeName}. Cards with no creator yet stay on All creators.` : null}
          stages={PIPELINE_STAGES.map((stage) => ({ id: stage.id, label: stage.label }))}
          summary={[
            ...summary.stages.map((stage) => ({
              id: stage.id,
              label: stage.label,
              countLabel: String(stage.count),
              detail: pipelineSumLabel(stage.count, stage.valueCents, stage.unknownValues, formatMoney),
              tone: "" as const,
            })),
            {
              id: "followups",
              label: "Overdue",
              countLabel: String(summary.overdue),
              detail: summary.dueToday > 0 ? `${summary.dueToday} due today` : "Past the follow-up date",
              tone: summary.overdue > 0 ? "overdue" as const : summary.dueToday > 0 ? "today" as const : "" as const,
            },
          ]}
          columns={PIPELINE_STAGES.map((stage, index) => {
            const column = filtered.find((item) => item.id === stage.id);
            const cards = column?.cards ?? [];
            const stats = summary.stages.find((item) => item.id === stage.id);
            return {
              id: stage.id,
              label: stage.label,
              step: `Step ${index + 1} of ${PIPELINE_STAGES.length}`,
              blurb: stage.blurb,
              forward: stage.forward,
              countLabel: String(cards.length),
              sumLabel: pipelineSumLabel(stats?.count ?? 0, stats?.valueCents ?? 0, stats?.unknownValues ?? 0, formatMoney),
              cards: cards.map((card) => {
                const status = followUpStatus(card.nextFollowUp, today);
                return {
                  id: card.id,
                  brand: card.brand,
                  creatorName: card.creatorName ?? "No creator yet",
                  contactEmail: card.contactEmail,
                  stage: card.stage,
                  valueInput: pipelineDollarsInput(card.valueCents),
                  valueLabel: card.valueCents == null ? "TBD" : formatMoney(card.valueCents),
                  nextFollowUp: card.nextFollowUp ?? "",
                  followLabel: followUpLabel(status, card.nextFollowUp),
                  status,
                  note: card.note ?? "",
                  nextLine: pipelineCardNextLine(card.note, stage.nextAction),
                };
              }),
            };
          })}
        />
      ) : null}
    </PortalFrame>
  );
}
