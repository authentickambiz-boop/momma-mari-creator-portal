import Link from "next/link";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { EDUCATION_TEMPLATES, LESSONS } from "@/lib/education";

export default async function HowMommaMariWorksPage({ searchParams }: { searchParams: Promise<{ creator?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="how"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>How Momma Mari works</h1><p>How a brand deal moves, how rates get talked through, and how usage works. The downloads are templates. Have a lawyer review them. Nothing here is signed or sent.</p></div></div>}
    >
      <div className="stack">
        {LESSONS.map((lesson) => (
          <article key={lesson.id} className="card">
            <h2>{lesson.title}</h2>
            {lesson.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </article>
        ))}
        <article className="card">
          <h2>Templates</h2>
          <p className="note">template, have a lawyer review</p>
          <ul>
            {EDUCATION_TEMPLATES.map((item) => (
              <li key={item.slug}><Link href={`/how/templates/${item.slug}`}>{item.title}</Link></li>
            ))}
          </ul>
        </article>
      </div>
    </PortalFrame>
  );
}
