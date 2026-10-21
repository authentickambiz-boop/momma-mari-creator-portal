import { followUpAction, movePipelineAction } from "@/app/pipeline-actions";
import { PortalFrame } from "@/components/portal-frame";
import { PIPELINE_STAGES, listPipeline, seedBrandPipeline } from "@/lib/brand-pipeline";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";

function pipelineNote(code: string | undefined, saved: string | undefined) {
  if (saved === "1") return "Moved. Nothing was emailed.";
  if (saved === "follow") return "Follow-up date saved. Nothing was emailed.";
  if (code === "stage") return "That is not a pipeline stage. Nothing was changed.";
  if (code === "date") return "Use a YYYY-MM-DD date. Nothing was saved.";
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
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="pipeline"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Deal pipeline</h1><p>Lead through rebook. Cards start from the deal inbox and brand contacts. Nothing is emailed.</p></div></div>}
    >
      {note ? <p className="note">{note}</p> : null}
      {board.ok ? (
        <div className="pipeline-board">
          {board.columns.map((column) => (
            <section key={column.id} className="card pipeline-col">
              <div className="sec-title">{column.label}</div>
              {column.cards.length === 0 ? <p className="note empty">None</p> : null}
              {column.cards.map((card) => (
                <article key={card.id} className="stack" style={{ marginTop: 10 }}>
                  <b>{card.brand}</b>
                  <p className="note">{card.creatorName ?? "No creator yet"}{card.valueCents != null ? ` · ${formatMoney(card.valueCents)}` : ""}</p>
                  {card.note ? <p className="note">{card.note}</p> : null}
                  <form action={movePipelineAction}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <label>
                      Stage
                      <select name="stage" defaultValue={card.stage} aria-label={`Stage for ${card.brand}`}>
                        {PIPELINE_STAGES.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
                      </select>
                    </label>
                    <button className="btn ghost" type="submit">Move</button>
                  </form>
                  <form action={followUpAction}>
                    <input type="hidden" name="cardId" value={card.id} />
                    <label>
                      Follow up
                      <input name="nextFollowUp" defaultValue={card.nextFollowUp ?? ""} placeholder="YYYY-MM-DD" aria-label={`Follow up for ${card.brand}`} />
                    </label>
                    <button className="btn ghost" type="submit">Save date</button>
                  </form>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </PortalFrame>
  );
}
