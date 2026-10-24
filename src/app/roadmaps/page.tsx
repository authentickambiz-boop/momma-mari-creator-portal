import Link from "next/link";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { PROGRAM_DATES_LINE, PROGRAM_ROADMAPS, roadmapPath } from "@/lib/program-roadmaps";

export default async function ProgramRoadmapsPage({ searchParams }: { searchParams: Promise<{ creator?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const creatorQuery = portal.viewer.role === "creator" ? null : portal.viewedId;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="roadmaps"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Program roadmaps</h1><p>Planning guides for creators in any niche. Read a guide, then check the official page before you apply.</p></div></div>}
    >
      <p className="note">{PROGRAM_DATES_LINE}</p>
      <div className="stack">
        {PROGRAM_ROADMAPS.map((guide) => (
          <article key={guide.slug} className="card">
            <h2><Link href={roadmapPath(guide.slug, creatorQuery)}>{guide.title}</Link></h2>
            <p>{guide.lede}</p>
          </article>
        ))}
      </div>
    </PortalFrame>
  );
}
