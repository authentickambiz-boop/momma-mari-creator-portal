import { submitCreatorApplicationAction } from "@/app/apply-actions";
import { PublicShell } from "@/components/public-shell";
import { applyFormNote, CREATOR_BENEFITS } from "@/lib/creator-apply";
import { PUBLIC_ROBOTS } from "@/lib/public-site";

export const metadata = {
  title: "Apply to join Momma Mari",
  description: "Apply to join the Momma Mari creator roster.",
  robots: PUBLIC_ROBOTS,
};

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const note = applyFormNote(params.error);
  return (
    <PublicShell title="Apply to join Momma Mari" lede="Tell Kamron who you are. He reviews each application. Nothing is emailed, and there is no fee.">
      <p className="sec-title">What you get</p>
      <div className="public-grid">
        {CREATOR_BENEFITS.map((benefit) => (
          <article key={benefit.title} className="card">
            <h2>{benefit.title}</h2>
            <p>{benefit.body}</p>
          </article>
        ))}
      </div>
      <p className="sec-title">Application</p>
      {note ? <p className="private-note">{note}</p> : null}
      <form action={submitCreatorApplicationAction} className="card stack public-form">
        <label>Name
          <input name="name" required autoComplete="name" />
        </label>
        <label>Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>Platform handles
          <input name="handles" required placeholder="@you on TikTok, Instagram" />
        </label>
        <label>Follower counts
          <input name="followers" required placeholder="TikTok 12k, Instagram 4k" />
        </label>
        <label>Niche
          <input name="niche" required placeholder="Mom life, home, beauty" />
        </label>
        <label>Rates (optional)
          <input name="rates" placeholder="Leave blank if you are still deciding" />
        </label>
        <label>Message
          <textarea name="message" rows={4} required />
        </label>
        <div className="leave-blank" aria-hidden="true">
          <label>Leave this blank
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button className="btn" type="submit">Submit application</button>
      </form>
    </PublicShell>
  );
}
