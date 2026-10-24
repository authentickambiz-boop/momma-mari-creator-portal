import Link from "next/link";
import { notFound } from "next/navigation";
import { RoadmapBody } from "@/components/roadmap-body";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { programRoadmap, roadmapPath } from "@/lib/program-roadmaps";

export default async function ProgramRoadmapPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ creator?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const portal = await loadPortal(query.creator ?? null);
  const guide = programRoadmap(slug);
  if (!guide) notFound();
  const creatorQuery = portal.viewer.role === "creator" ? null : portal.viewedId;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="roadmaps"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>{guide.title}</h1><p>{guide.lede}</p></div></div>}
    >
      <p><Link href={roadmapPath(null, creatorQuery)}>All program roadmaps</Link></p>
      <RoadmapBody guide={guide} />
    </PortalFrame>
  );
}
