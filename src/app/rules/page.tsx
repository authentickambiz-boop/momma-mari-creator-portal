import { saveDealRulesAction, savePricingFloorAction } from "@/app/rules-actions";
import { PortalFrame } from "@/components/portal-frame";
import { TagPicker } from "@/components/tag-picker";
import { loadPortal } from "@/lib/current-user";
import { BRAND_OPTIONS, NICHE_CATALOG } from "@/lib/niche-catalog";
import { canEditRules, canViewRules, DELIVERABLES, pricingFloor, rulesFor, savedRules } from "@/lib/deal-rules";
import { formatMoney } from "@/lib/format";

function dollars(cents: number | undefined) {
  if (!cents) return "";
  return String(cents / 100);
}

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; rulesError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const creator = portal.viewed;
  if (!creator || portal.viewer.role === "creator") {
    return (
      <PortalFrame viewer={portal.viewer} tab="rules" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Deal rules</h1>}>
        <p className="note">Pick a creator. Deal rules stay with the owner and her managers.</p>
      </PortalFrame>
    );
  }
  const allowed = await canViewRules(portal.db, portal.viewer, creator.id);
  if (!allowed) {
    return (
      <PortalFrame viewer={portal.viewer} tab="rules" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Deal rules</h1>}>
        <p className="note">These rules are for the manager assigned to {creator.name}.</p>
      </PortalFrame>
    );
  }
  const rules = await rulesFor(portal.db, creator.id);
  const stored = await savedRules(portal.db, creator.id);
  const edit = canEditRules(portal.viewer);
  const priced = portal.viewer.role === "admin" || Boolean(portal.viewer.permissions?.canPriceDeals);
  const floor = await pricingFloor(portal.db);
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="rules"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Deal rules</h1><p>What {creator.name} will consider. Filled in from her questionnaire and past accepted deals.</p></div></div>}
    >
      {params.saved ? <p className="note">Saved.</p> : null}
      {params.rulesError ? <p className="private-note">{params.rulesError}</p> : null}
      {!stored ? <p className="callout">These numbers are a starting point from her questionnaire and past deals. Save them to lock them in.</p> : null}
      <form action={saveDealRulesAction} className="card stack">
        <input type="hidden" name="creatorId" value={creator.id} />
        {priced ? (
          <>
            <div className="sec-title">Rates</div>
            <p className="note">Floors cover every platform, and the agency commission stays a flat 20%. Gambling, crypto, and investment-advice sponsors are blocked unless you override that one deal.</p>
            {DELIVERABLES.map((item) => (
              <div key={item.id} className="stage-form">
                <label>{item.label} minimum<input name={`min-${item.id}`} defaultValue={dollars(rules.minRates[item.id])} inputMode="decimal" disabled={!edit} /></label>
                <label>{item.label} target<input name={`target-${item.id}`} defaultValue={dollars(rules.targetRates[item.id])} inputMode="decimal" disabled={!edit} /></label>
              </div>
            ))}
            <label>Minimum deal she'll consider<input name="minDeal" defaultValue={dollars(rules.minDealCents ?? undefined)} inputMode="decimal" disabled={!edit} /></label>
          </>
        ) : (
          <p className="note">Dollar amounts stay with the owner unless your pricing toggle is on.</p>
        )}
        {edit ? (
          <>
            <TagPicker name="blockedCategories" label="Categories she won't work with" options={NICHE_CATALOG} selected={rules.blockedCategories} />
            <TagPicker name="blockedBrands" label="Brands she won't work with" options={BRAND_OPTIONS} selected={rules.blockedBrands} />
          </>
        ) : (
          <>
            <p>Won't work with: {rules.blockedCategories.concat(rules.blockedBrands).join(", ") || "None listed"}</p>
          </>
        )}
        <label>Max deals per month<input name="maxDeals" defaultValue={rules.maxDealsPerMonth ?? ""} inputMode="numeric" disabled={!edit} /></label>
        <label>Turnaround<input name="turnaround" defaultValue={rules.turnaround} disabled={!edit} /></label>
        <label>Longest exclusivity, in days<input name="exclusivityDays" defaultValue={rules.exclusivityMaxDays ?? ""} inputMode="numeric" disabled={!edit} /></label>
        <label>Usage she expects to be paid for, in days<input name="usageDays" defaultValue={rules.usageMinDays ?? ""} inputMode="numeric" disabled={!edit} /></label>
        <label>
          Kids on camera
          <select name="kidsOnCamera" defaultValue={rules.kidsOnCamera} disabled={!edit}>
            <option value="">Not set</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="limits">With limits</option>
          </select>
        </label>
        <label>Kids on camera limits<input name="kidsLimits" defaultValue={rules.kidsLimits} disabled={!edit} /></label>
        {edit ? <button className="btn" type="submit">Save rules</button> : <p className="note">You can view these rules. Editing is off for your sign-in.</p>}
      </form>
      {portal.viewer.role === "admin" ? (
        <form action={savePricingFloorAction} className="card stack">
          <input type="hidden" name="creatorId" value={creator.id} />
          <div className="sec-title">Agency profit floor</div>
          <p className="note">Our 20% has to clear {formatMoney(floor)} on a deal. This number is only on your sign-in.</p>
          <label>Minimum agency profit<input name="minProfit" defaultValue={dollars(floor)} inputMode="decimal" /></label>
          <button className="btn" type="submit">Save floor</button>
        </form>
      ) : null}
    </PortalFrame>
  );
}
