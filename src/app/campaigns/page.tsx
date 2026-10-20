import { filterCampaignsAction, saveCampaignAction } from "@/app/campaign-actions";
import { PortalFrame } from "@/components/portal-frame";
import Link from "next/link";
import { offerFlagLabel } from "@/lib/brand-offers";
import { TagPicker } from "@/components/tag-picker";
import { canSeeMoney, listCampaigns } from "@/lib/campaigns";
import { campaignErrorNote } from "@/lib/campaign-notes";
import { loadPortal } from "@/lib/current-user";
import { DELIVERABLES, dollarsToCents } from "@/lib/deal-rules";
import { formatMoney } from "@/lib/format";
import { NICHE_CATALOG, PLATFORM_OPTIONS } from "@/lib/niche-catalog";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ creator?: string; niche?: string; platform?: string; min?: string; max?: string; campaignError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  if (portal.viewer.role === "creator") {
    return (
      <PortalFrame viewer={portal.viewer} tab="campaigns" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Campaigns</h1>}>
        <p className="note">Campaigns stay with the owner and her managers.</p>
      </PortalFrame>
    );
  }
  const campaignError = campaignErrorNote(params.campaignError);
  const priced = canSeeMoney(portal.viewer);
  const board = await listCampaigns(portal.db, {
    niche: params.niche,
    platform: params.platform,
    minBudgetCents: params.min ? dollarsToCents(params.min) : null,
    maxBudgetCents: params.max ? dollarsToCents(params.max) : null,
  });
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="campaigns"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Campaigns</h1><p>Every brand can have more than one campaign. The best-paying fits are listed first.</p></div></div>}
    >
      {campaignError ? <p className="private-note">{campaignError}</p> : null}
      <form className="card stack" action={filterCampaignsAction}>
        <input type="hidden" name="creator" value={portal.viewedId} />
        <div className="sec-title">Filter the board</div>
        <label>Niche<input name="niche" defaultValue={params.niche ?? ""} /></label>
        <label>Platform<input name="platform" defaultValue={params.platform ?? ""} /></label>
        <label>Minimum budget<input name="min" defaultValue={params.min ?? ""} inputMode="decimal" /></label>
        <label>Maximum budget<input name="max" defaultValue={params.max ?? ""} inputMode="decimal" /></label>
        <button className="btn" type="submit">Show matches</button>
      </form>
      <div className="stack" style={{ marginTop: 14 }}>
        {board.length ? board.map((campaign) => (
          <Link className="card" key={campaign.id} href={`/campaigns/${campaign.id}?creator=${portal.viewedId}`}>
            <b>{campaign.brand}</b> · {campaign.name}
            <p>{campaign.niches.join(", ") || "Any niche"} · {campaign.platforms.join(", ") || "Any platform"} · {campaign.slots} slots · {campaign.status}{campaign.openOutside ? " · Open to outside creators" : ""}{campaign.kind === "offer" ? ` · Brand offer${offerFlagLabel(campaign.offerFlag) ? `: ${offerFlagLabel(campaign.offerFlag)}` : ""}` : ""}</p>
            {priced ? <p>{formatMoney(campaign.budgetCents)} budget</p> : <p className="note">Budget stays with the owner unless your pricing toggle is on.</p>}
          </Link>
        )) : <p className="note empty">No campaigns match that filter.</p>}
      </div>
      {portal.viewer.role === "admin" ? (
        <p className="note"><Link href="/offers">Save a brand offer</Link> when you have a budget for each creator. Nothing is emailed.</p>
      ) : null}
      {portal.viewer.role === "admin" ? (
        <form action={saveCampaignAction} className="card stack" style={{ marginTop: 14 }}>
          <div className="sec-title">Add a campaign</div>
          <label>Brand<input name="brand" required /></label>
          <label>Name<input name="name" required /></label>
          <label>Budget<input name="budget" inputMode="decimal" required /></label>
          <label>Creator slots<input name="slots" inputMode="numeric" defaultValue="1" required /></label>
          <label>Starts<input name="startsOn" placeholder="2026-11-01" /></label>
          <label>Ends<input name="endsOn" placeholder="2026-11-30" /></label>
          <TagPicker name="niches" label="Niches" options={NICHE_CATALOG} selected={[]} />
          <TagPicker name="platforms" label="Platforms" options={PLATFORM_OPTIONS} selected={[]} />
          <TagPicker name="deliverables" label="Deliverables" options={DELIVERABLES.map((item) => item.label)} selected={[]} />
          <button className="btn" type="submit">Save campaign</button>
        </form>
      ) : null}
    </PortalFrame>
  );
}
