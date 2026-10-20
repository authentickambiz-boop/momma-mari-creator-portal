import Link from "next/link";
import { approveBenchOfferAction, promoteBenchAction, queueBenchOfferAction, recordBenchPaidAction, setBenchScoreAction } from "@/app/bench-actions";
import { PortalFrame } from "@/components/portal-frame";
import { leftoverCampaigns, listBench, listBenchOffers } from "@/lib/bench";
import { benchErrorNote } from "@/lib/bench-notes";
import { listFlaggedOffers } from "@/lib/brand-offers";
import { loadPortal } from "@/lib/current-user";
import { formatMoney } from "@/lib/format";

export default async function BenchPage({ searchParams }: { searchParams: Promise<{ saved?: string; benchError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(null);
  if (portal.viewer.role !== "admin") {
    return (
      <PortalFrame viewer={portal.viewer} tab="bench" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Bench</h1>}>
        <p className="note">The bench stays on the owner's sign-in.</p>
      </PortalFrame>
    );
  }
  const people = await listBench(portal.db, portal.viewer);
  const waiting = people.filter((person) => person.status === "bench");
  const leftover = await leftoverCampaigns(portal.db);
  const offers = await listBenchOffers(portal.db, portal.viewer);
  const flagged = await listFlaggedOffers(portal.db);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="bench"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Bench</h1><p>UGC and micro creators join free. They only see leftover jobs, and you approve each one. The 20% applies only when a job is paid.</p></div></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was sent or charged.</p> : null}
      {benchErrorNote(params.benchError) ? <p className="private-note">{benchErrorNote(params.benchError)}</p> : null}
      <p className="note">Share <Link href="/bench/join">the free join page</Link>. There is no fee and no subscription.</p>
      <div className="stack">
        {people.map((person) => (
          <div className="card" key={person.id}>
            <b>{person.name}</b>
            <p>{person.niches.join(", ") || "Niche not set"} · {person.platforms.join(", ") || "Platform not set"}</p>
            <p>{person.status === "promoted" ? `On the roster${person.promotedAt ? ` since ${person.promotedAt.slice(0, 10)}` : ""}` : person.suggestPromote ? `Score ${person.score} · ${person.tier}. Suggested for the roster.` : `Score ${person.score ?? "not set"}`}</p>
            <p><Link href={`/bench/${person.slug}`}>Portfolio</Link></p>
            {person.status === "bench" ? (
              <>
                <form action={setBenchScoreAction} className="stage-form">
                  <input type="hidden" name="benchId" value={person.id} />
                  <label>Score<input name="score" defaultValue={person.score ?? ""} inputMode="numeric" /></label>
                  <button className="btn ghost" type="submit">Save score</button>
                </form>
                <form action={promoteBenchAction} className="stage-form">
                  <input type="hidden" name="benchId" value={person.id} />
                  <select name="creatorId">
                    {portal.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
                  </select>
                  <button className="btn ghost" type="submit">Move to roster</button>
                </form>
              </>
            ) : null}
          </div>
        ))}
        {people.length ? null : <p className="note">Nobody is on the bench yet.</p>}
      </div>
      {flagged.length > 0 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">Offers under every minimum</div>
          <p className="note">Nothing was sent. Pitch the retainer, or keep it for a commission-only trainee.</p>
          <ul>
            {flagged.map((offer) => (
              <li key={offer.id}>{offer.brand}: {offer.flagLabel}{offer.flag === "pitch_retainer" ? " (Momma Mari marketing services)" : ""}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <form action={queueBenchOfferAction} className="card stack" style={{ marginTop: 14 }}>
        <div className="sec-title">Leftover job</div>
        <p className="note">A job shows up here only when nobody on the roster meets the rules. Approving it does not send the note.</p>
        {leftover.length ? (
          <>
            <label>
              Campaign
              <select name="campaignId">
                {leftover.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.brand}: {campaign.name}</option>)}
              </select>
            </label>
            <label>
              Bench creator
              <select name="benchId">
                {waiting.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label>Offer amount<input name="amount" inputMode="decimal" /></label>
            <button className="btn" type="submit" disabled={!waiting.length}>Queue offer</button>
          </>
        ) : <p>The roster still fits every open campaign.</p>}
      </form>
      <div className="stack" style={{ marginTop: 14 }}>
        {offers.map((offer) => (
          <div className="card" key={offer.id}>
            <p>{offer.status} · {formatMoney(offer.amountCents)}{offer.feeCents != null ? ` · commission ${formatMoney(offer.feeCents)} (20%)` : ""}</p>
            {offer.status === "pending" ? (
              <form action={approveBenchOfferAction}>
                <input type="hidden" name="offerId" value={offer.id} />
                <button className="btn ghost" type="submit">Approve offer</button>
              </form>
            ) : null}
            {offer.status === "approved" ? (
              <form action={recordBenchPaidAction}>
                <input type="hidden" name="offerId" value={offer.id} />
                <button className="btn ghost" type="submit">Mark paid</button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </PortalFrame>
  );
}
