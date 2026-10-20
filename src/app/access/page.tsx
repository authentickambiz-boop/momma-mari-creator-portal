import {
  createBotAction,
  reviewCapabilityAction,
  revokeBotAction,
  saveCapabilityAction,
  submitCapabilityAction,
} from "@/app/capability-actions";
import { PortalFrame } from "@/components/portal-frame";
import {
  CAPABILITY_LABELS,
  LEVEL_LABELS,
  clearBotReveal,
  listCapabilityAudit,
  listCapabilityGrants,
  listPendingCapabilityDrafts,
  listScopedBots,
  type Capability,
  type CapabilityLevel,
} from "@/lib/capabilities";
import { loadPortal } from "@/lib/current-user";
import { lastUpdatedLabel, shortDate } from "@/lib/format";
import { listManagers } from "@/lib/managers";

export const dynamic = "force-dynamic";

const LEVELS: CapabilityLevel[] = ["off", "draft", "approval", "full"];

const ACTION_LABELS: Record<string, string> = {
  level_set: "Set the level",
  training_updated: "Updated training",
  drafted: "Saved a draft",
  awaiting_approval: "Asked for approval",
  acted: "Did it",
  denied: "Blocked",
  approved: "Approved",
  rejected: "Rejected",
  token_created: "Created a bot token",
  token_revoked: "Revoked a bot token",
};

function when(iso: string) {
  return `${shortDate(iso)} · ${lastUpdatedLabel(iso).replace("Last updated ", "")}`;
}

function GrantForm({
  subjectType,
  subjectId,
  grant,
}: {
  subjectType: "manager" | "bot";
  subjectId: string;
  grant: Awaited<ReturnType<typeof listCapabilityGrants>>[number];
}) {
  return (
    <form action={saveCapabilityAction} className="choice stack">
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input type="hidden" name="capability" value={grant.capability} />
      <b>{grant.label}</b>
      <p className="note">{grant.complete ? "Training complete." : "Training is still open. Finish it before raising the level."}</p>
      {grant.training.map((item) => (
        <label className="contract-choices" key={item.id}>
          <input type="checkbox" name="training" value={item.id} defaultChecked={item.done} />
          {item.label}
        </label>
      ))}
      <label>
        Level
        <select name="level" defaultValue={grant.level} aria-label={`${grant.label} level`}>
          {LEVELS.map((level) => (
            <option key={level} value={level}>{LEVEL_LABELS[level]}</option>
          ))}
        </select>
      </label>
      <button className="btn ghost" type="submit">Save {grant.label.toLowerCase()}</button>
    </form>
  );
}

function ManagerSubmit({ capability, level }: { capability: Capability; level: CapabilityLevel }) {
  if (level === "off") return null;
  const needsNote = capability === "negotiate" || capability === "review_contracts";
  const needsMail = capability === "outreach";
  const needsBody = capability === "draft_replies" || capability === "outreach";
  return (
    <form action={submitCapabilityAction} className="choice stack">
      <input type="hidden" name="capability" value={capability} />
      <b>{CAPABILITY_LABELS[capability]} · {LEVEL_LABELS[level]}</b>
      <p className="note">
        {level === "full"
          ? "This happens now. Outreach still waits in Approvals and is not sent."
          : "Kamron approves this before anything changes."}
      </p>
      <label>
        Deal id
        <input name="dealId" required aria-label={`${CAPABILITY_LABELS[capability]} deal id`} />
      </label>
      <label>
        Summary
        <input name="summary" required aria-label={`${CAPABILITY_LABELS[capability]} summary`} />
      </label>
      {needsNote ? (
        <label>
          Note
          <textarea name="note" rows={3} required />
        </label>
      ) : null}
      {needsMail ? (
        <>
          <label>To<input type="email" name="to" required /></label>
          <label>Subject<input name="subject" required /></label>
        </>
      ) : null}
      {needsBody ? (
        <label>
          Body
          <textarea name="body" rows={4} required />
        </label>
      ) : null}
      <button className="btn" type="submit">Submit {CAPABILITY_LABELS[capability].toLowerCase()}</button>
    </form>
  );
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; accessError?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  if (portal.viewer.role === "creator") {
    return (
      <PortalFrame viewer={portal.viewer} tab="access" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Access</h1>}>
        <p className="note">Only Kamron sets who can act.</p>
      </PortalFrame>
    );
  }

  if (portal.viewer.role === "manager" && portal.viewer.managerId) {
    const grants = await listCapabilityGrants(portal.db, "manager", portal.viewer.managerId);
    const pending = (await listPendingCapabilityDrafts(portal.db)).filter((row) => row.subjectId === portal.viewer.managerId);
    return (
      <PortalFrame
        viewer={portal.viewer}
        tab="access"
        creators={portal.creators}
        viewedId={portal.viewedId}
        hello={<div className="hello"><div><h1>Your access</h1><p>You can only do what Kamron has turned on. Drafts wait for him.</p></div></div>}
      >
        {params.accessError ? <p className="private-note">{params.accessError}</p> : null}
        {params.saved === "draft" || params.saved === "pending" ? <p className="note">Saved. Kamron still has to approve it.</p> : null}
        {params.saved === "applied" ? <p className="note">Done. Outreach, if you sent one, is still waiting in Approvals.</p> : null}
        <div className="stack">
          {grants.map((grant) => (
            <ManagerSubmit key={grant.capability} capability={grant.capability} level={grant.level} />
          ))}
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Waiting for Kamron</div>
          {pending.length === 0 ? <p className="note">Nothing is waiting.</p> : null}
          {pending.map((row) => (
            <p key={row.id} className="note">{CAPABILITY_LABELS[row.capability as Capability] ?? row.capability}: {row.summary}</p>
          ))}
        </div>
      </PortalFrame>
    );
  }

  const managers = await listManagers(portal.db);
  const managerGrants = await Promise.all(managers.map(async (manager) => ({
    manager,
    grants: await listCapabilityGrants(portal.db, "manager", manager.id),
  })));
  const bots = await listScopedBots(portal.db);
  for (const bot of bots) {
    if (bot.reveal) await clearBotReveal(portal.db, bot.id);
  }
  const botGrants = await Promise.all(bots.map(async (bot) => ({
    bot,
    grants: await listCapabilityGrants(portal.db, "bot", bot.id),
  })));
  const pending = await listPendingCapabilityDrafts(portal.db);
  const audit = await listCapabilityAudit(portal.db);
  const names = new Map<string, string>([
    ...managers.map((manager) => [manager.id, manager.name] as const),
    ...bots.map((bot) => [bot.id, bot.name] as const),
  ]);

  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="access"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>Access</h1>
            <p>Grant a capability to a manager or a bot. Training has to be finished before the level goes up.</p>
          </div>
        </div>
      }
    >
      {params.accessError ? <p className="private-note">{params.accessError}</p> : null}
      {params.saved === "level" ? <p className="note">Saved.</p> : null}
      {params.saved === "approved" ? <p className="note">Approved. The change is in.</p> : null}
      {params.saved === "rejected" ? <p className="note">Rejected. Nothing was changed.</p> : null}
      {params.saved === "revoked" ? <p className="note">That bot token no longer works.</p> : null}

      <div className="card stack" style={{ marginBottom: 14 }}>
        <div className="sec-title">Levels</div>
        <p><b>Off.</b> They cannot do this.</p>
        <p><b>Draft only.</b> They write it, and you approve before anything changes.</p>
        <p><b>Act with approval.</b> They prepare the action, and it still waits for you.</p>
        <p><b>Full.</b> It happens immediately. Outreach still lands in Approvals and is never sent from here.</p>
        <p className="note">Managers never get creator account credentials. Connect links, passwords, and mail tokens stay with you.</p>
      </div>

      <div className="card stack" id="access-queue" style={{ marginBottom: 14 }}>
        <div className="sec-title">Waiting for you</div>
        {pending.length === 0 ? <p className="note">Nothing is waiting for approval.</p> : null}
        {pending.map((row) => (
          <article key={row.id} className="choice stack">
            <b>{CAPABILITY_LABELS[row.capability as Capability] ?? row.capability}</b>
            <p className="note">{names.get(row.subjectId) ?? row.actorEmail} · {LEVEL_LABELS[row.level as CapabilityLevel] ?? row.level} · {when(row.createdAt)}</p>
            <p>{row.summary}</p>
            <form action={reviewCapabilityAction}>
              <input type="hidden" name="draftId" value={row.id} />
              <input type="hidden" name="intent" value="approve" />
              <button className="btn" type="submit">Approve</button>
            </form>
            <form action={reviewCapabilityAction}>
              <input type="hidden" name="draftId" value={row.id} />
              <input type="hidden" name="intent" value="reject" />
              <button className="btn ghost" type="submit">Reject</button>
            </form>
          </article>
        ))}
      </div>

      {managerGrants.map(({ manager, grants }) => (
        <div className="card stack" key={manager.id} style={{ marginBottom: 14 }} id={`access-${manager.id}`}>
          <div className="sec-title">{manager.name}</div>
          <p className="note">{manager.email} · {manager.active ? "Active" : "Deactivated"}</p>
          {grants.map((grant) => (
            <GrantForm key={grant.capability} subjectType="manager" subjectId={manager.id} grant={grant} />
          ))}
        </div>
      ))}
      {managers.length === 0 ? <p className="note">Add a manager on Team, then set their capabilities here.</p> : null}

      <div className="card stack" id="access-bots" style={{ marginBottom: 14 }}>
        <div className="sec-title">Bots</div>
        <p className="note">A token created here can only call Act, and only for the capabilities you turn on. The main bot token is unchanged. Copy a new token on this visit. It is not shown again.</p>
        <form action={createBotAction} className="stage-form">
          <label>
            Bot name
            <input name="name" required placeholder="Inbox helper" aria-label="Bot name" />
          </label>
          <button className="btn" type="submit">Create bot token</button>
        </form>
        {botGrants.map(({ bot, grants }) => (
          <article key={bot.id} className="choice stack" id={`bot-${bot.id}`}>
            <b>{bot.name}</b>
            <p className="note">{bot.active ? "Active" : "Revoked"} · ends in {bot.hint}</p>
            {bot.reveal ? <p className="private-note">Copy this token now. It is shown once: {bot.reveal}</p> : null}
            {bot.active ? grants.map((grant) => (
              <GrantForm key={grant.capability} subjectType="bot" subjectId={bot.id} grant={grant} />
            )) : null}
            {bot.active ? (
              <form action={revokeBotAction}>
                <input type="hidden" name="botId" value={bot.id} />
                <button className="btn ghost" type="submit">Revoke token</button>
              </form>
            ) : null}
          </article>
        ))}
      </div>

      <div className="card" id="access-audit">
        <div className="sec-title">Audit log</div>
        {audit.length === 0 ? <p className="note">Nothing has been recorded yet.</p> : null}
        {audit.length > 0 ? (
          <table>
            <thead>
              <tr><th>When</th><th>Who</th><th>What</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id}>
                  <td>{when(row.createdAt)}</td>
                  <td>{row.actorEmail}</td>
                  <td>{ACTION_LABELS[row.action] ?? row.action}{row.capability ? ` · ${CAPABILITY_LABELS[row.capability as Capability] ?? row.capability}` : ""}</td>
                  <td>{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </PortalFrame>
  );
}
