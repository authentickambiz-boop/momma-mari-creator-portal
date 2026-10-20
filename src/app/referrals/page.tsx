import { recordReferralAction, setReferralPerkAction } from "@/app/actions";
import { PortalFrame } from "@/components/portal-frame";
import { loadPortal } from "@/lib/current-user";
import { getReferralPerk, listReferrals, perkLabel, REFERRAL_LAWYER_NOTE, referralErrorNote } from "@/lib/referrals";
import { redirect } from "next/navigation";

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string; saved?: string; referralError?: string }>;
}) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role === "manager") redirect("/");
  const creator = portal.viewed ?? portal.creators[0];
  const perkCents = await getReferralPerk(portal.db);
  const rows = creator ? await listReferrals(portal.db, creator.id) : [];
  const dollars = perkCents == null ? "" : String(perkCents / 100);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="referrals"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={
        <div className="hello">
          <div>
            <h1>Referrals</h1>
            <p>{REFERRAL_LAWYER_NOTE}</p>
          </div>
        </div>
      }
    >
      {params.saved === "1" ? <div className="callout"><b>Saved. Nothing was paid.</b></div> : null}
      {params.referralError ? <p className="note">{referralErrorNote(params.referralError) ?? "That referral was not saved. Nothing was paid."}</p> : null}
      <div className="stack">
        <section className="card">
          <div className="sec-title">Perk</div>
          <p>{perkLabel(perkCents)}</p>
          <p className="note">This number is a placeholder. Nothing is paid automatically.</p>
          {portal.viewer.role === "admin" ? (
            <form action={setReferralPerkAction} className="stage-form">
              {creator ? <input type="hidden" name="creatorId" value={creator.id} /> : null}
              <label>
                Placeholder dollars
                <input type="text" name="dollars" defaultValue={dollars} placeholder="Leave blank" aria-label="Placeholder perk in dollars" />
              </label>
              <button className="btn" type="submit">Save perk</button>
            </form>
          ) : null}
        </section>
        <section className="card">
          <div className="sec-title">People she referred</div>
          {rows.length === 0 ? <p className="note">No referrals yet. Nothing is paid.</p> : null}
          <ul>
            {rows.map((row) => (
              <li key={row.id}>{row.referredName} · {row.referredEmail}</li>
            ))}
          </ul>
          {creator ? (
            <form action={recordReferralAction} className="stage-form">
              <input type="hidden" name="creatorId" value={creator.id} />
              <label>
                Name
                <input type="text" name="name" required aria-label="Referred person name" />
              </label>
              <label>
                Email
                <input type="email" name="email" required aria-label="Referred person email" />
              </label>
              <button className="btn" type="submit">Add referral</button>
            </form>
          ) : null}
        </section>
      </div>
    </PortalFrame>
  );
}
