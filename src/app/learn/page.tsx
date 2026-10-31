import Link from "next/link";
import { saveSkillLessonAction } from "@/app/learn-actions";
import { PortalFrame } from "@/components/portal-frame";
import { creatorIsFree } from "@/lib/account-tier";
import { loadPortal } from "@/lib/current-user";
import { freeOnboardingState } from "@/lib/free-onboarding";
import { analyticsLevel, whereToStart } from "@/lib/where-to-start";
import { markWhereToStartSeen } from "@/lib/welcome-checklist";
import { roadmapPath } from "@/lib/program-roadmaps";
import { SKILL_TOPICS, listSkillLessons, type SkillLessonView } from "@/lib/skill-lessons";
import type { CreatorProfile } from "@/lib/types";

function lessonNote(code: string | undefined, saved: string | undefined) {
  if (saved === "1") return "Saved. It is on Learn now.";
  if (code === "forbidden") return "That lesson stays with Kamron or a manager. Nothing was changed.";
  if (code === "topic") return "Pick a topic. Nothing was saved.";
  if (code === "title") return "Add a short title. Nothing was saved.";
  if (code === "body") return "Write the lesson. Nothing was saved.";
  if (code === "creator") return "Pick a creator on your list, or everyone. Nothing was saved.";
  if (code === "private") return "Leave private rates off this lesson. Nothing was saved.";
  if (code === "missing") return "That lesson was not found.";
  return null;
}

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ creator?: string; error?: string; saved?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const free = portal.viewer.role === "creator" && portal.viewer.creatorId
    ? await creatorIsFree(portal.db, portal.viewer.creatorId)
    : false;
  const guide = free && portal.viewer.creatorId ? await (async () => {
    await markWhereToStartSeen(portal.db, portal.viewer);
    const state = await freeOnboardingState(portal.db, portal.viewer.creatorId!);
    const level = analyticsLevel({
      followers: state.handles.reduce<number | null>((max, row) => row.followers == null ? max : Math.max(max ?? 0, row.followers), null),
      views: state.handles.reduce<number | null>((max, row) => row.views == null ? max : Math.max(max ?? 0, row.views), null),
      uploads: state.uploadCount,
    });
    return whereToStart(state.niche.split(",")[0] || null, level);
  })() : null;
  const focus = portal.viewedId === "all" ? "all" : portal.viewedId;
  const library = await listSkillLessons(portal.db, portal.viewer, focus);
  const note = lessonNote(params.error, params.saved);
  const returnCreator = portal.viewer.role === "creator" ? "" : portal.viewedId;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="learn"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Learn</h1><p>Short lessons on the work itself: hooks, filming, editing, posting, growth, and UGC. A lesson for everyone shows for every creator. A lesson for one creator shows only on her sign-in.</p></div></div>}
    >
      {note ? <p className="note">{note}</p> : null}
      {guide ? (
        <section className="card" data-where-to-start="true">
          <div className="sec-title">Where to start</div>
          <h2>{guide.headline}</h2>
          <p>{guide.body}</p>
          <p><Link href={`#learn-${guide.topic}`}>Open the lesson</Link></p>
        </section>
      ) : null}
      <div className="stack">
        <section className="card">
          <div className="sec-title">Program roadmaps</div>
          <p>Planning guides for creators in any niche: beauty content, home projects, and retailer programs.</p>
          <p><Link href={roadmapPath(null, portal.viewer.role === "creator" ? null : portal.viewedId)}>Open program roadmaps</Link></p>
        </section>
        {SKILL_TOPICS.map((topic) => {
          const items = library.lessons.filter((lesson) => lesson.topic === topic.id);
          return (
            <section key={topic.id} className="card" id={`learn-${topic.id}`}>
              <div className="sec-title">{topic.label}</div>
              {items.length === 0 ? <p className="note empty">No lesson in this topic yet.</p> : null}
              {items.map((lesson) => (
                <article key={lesson.id} style={{ marginTop: 16 }}>
                  <h2>{lesson.title}</h2>
                  <p className="note">{lesson.audienceLabel}</p>
                  {lesson.paragraphs.map((paragraph, index) => <p key={`${lesson.id}-${index}`}>{paragraph}</p>)}
                  {library.canWrite ? (
                    <details>
                      <summary>Edit this lesson</summary>
                      <LessonForm lesson={lesson} creators={portal.creators} returnCreator={returnCreator} />
                    </details>
                  ) : null}
                </article>
              ))}
            </section>
          );
        })}
        {library.canWrite ? (
          <section className="card">
            <h2>Add a lesson</h2>
            <p className="note">Write it the way you would say it out loud. Leave private rates off the page.</p>
            <LessonForm
              lesson={null}
              creators={portal.creators}
              returnCreator={returnCreator}
              defaultAudience={portal.viewedId === "all" ? "" : portal.viewedId}
            />
          </section>
        ) : null}
      </div>
    </PortalFrame>
  );
}

function LessonForm({
  lesson,
  creators,
  returnCreator,
  defaultAudience = "",
}: {
  lesson: SkillLessonView | null;
  creators: CreatorProfile[];
  returnCreator: string;
  defaultAudience?: string;
}) {
  const label = lesson ? `Edit ${lesson.title}` : "New lesson";
  return (
    <form action={saveSkillLessonAction} className="stack" style={{ marginTop: 12 }}>
      <input type="hidden" name="lessonId" value={lesson?.id ?? ""} />
      <input type="hidden" name="returnCreator" value={returnCreator} />
      <label>
        Topic
        <select name="topic" defaultValue={lesson?.topic ?? "hooks"} aria-label={`${label} topic`} required>
          {SKILL_TOPICS.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
        </select>
      </label>
      <label>
        Title
        <input name="title" defaultValue={lesson?.title ?? ""} aria-label={`${label} title`} required maxLength={120} />
      </label>
      <label>
        Lesson
        <textarea name="body" defaultValue={lesson?.body ?? ""} aria-label={`${label} body`} required rows={6} maxLength={4000} />
      </label>
      <label>
        Who sees it
        <select name="audience" defaultValue={lesson?.creatorId ?? defaultAudience} aria-label={`${label} audience`}>
          <option value="">Everyone</option>
          {creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
        </select>
      </label>
      <button className="btn" type="submit">{lesson ? "Save changes" : "Save lesson"}</button>
    </form>
  );
}
