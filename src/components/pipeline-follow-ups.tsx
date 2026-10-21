import Link from "next/link";

export function PipelineFollowUps({ reminders }: { reminders: { id: string; brand: string; stageLabel: string; nextFollowUp: string | null; reason: string }[] }) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="sec-title">Follow-ups</div>
      <p className="note">Cards that need a nudge. Nothing is emailed from here.</p>
      {reminders.length === 0 ? <p className="note empty">No follow-ups due.</p> : reminders.map((reminder) => (
        <p key={reminder.id}><b>{reminder.brand}</b> · {reminder.stageLabel} · {reminder.reason}{reminder.nextFollowUp ? ` · ${reminder.nextFollowUp}` : ""}</p>
      ))}
      <p><Link href="/pipeline">Open the deal pipeline</Link></p>
    </div>
  );
}
