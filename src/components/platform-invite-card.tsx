import { togglePlatformInviteAction } from "@/app/invite-actions";
import type { PlatformInviteView } from "@/lib/platform-invites";

export function PlatformInviteCard({ invite, showCreator = false }: { invite: PlatformInviteView; showCreator?: boolean }) {
  return (
    <article className="callout">
      <div className="sec-title">Platform invite</div>
      <b>{invite.brand}</b>
      {showCreator ? <span className="note"> · {invite.creatorName}</span> : null}
      <p style={{ margin: "6px 0 0" }}>
        {invite.platform}
        {invite.accountHandle ? ` · ${invite.accountHandle}` : ""}
      </p>
      <p style={{ margin: "4px 0 0" }}>{invite.actionNeeded}</p>
      <p style={{ margin: "4px 0 0" }}>
        {invite.deadlineLabel}
        {invite.countdown ? ` · ${invite.countdown}` : ""}
        {invite.done ? " · Done" : ""}
      </p>
      <form action={togglePlatformInviteAction} style={{ marginTop: 8 }}>
        <input type="hidden" name="id" value={invite.id} />
        <input type="hidden" name="done" value={invite.done ? "0" : "1"} />
        <button className="btn ghost" type="submit">{invite.done ? "Mark not done" : "Done"}</button>
      </form>
    </article>
  );
}
