"use client";

import { useEffect, useState } from "react";
import { APARTMENT_UNIT_PRICE_CENTS, ASSET_OWNER, HOME_TIER_LABEL, HOME_TIER_PRICE_CENTS, HOME_TIERS, apartmentFloors, formatKash, shopItemsFor, type HomeTier } from "@/lib/worlds/economy";
import { ACCESS_ROLES, decideEnter, type AccessRole } from "@/lib/worlds/city/access";
import { CITY_LOCATIONS, SKILL_LABEL, locationById, type CityLot } from "@/lib/worlds/city/locations";
import type { CityInteractable } from "@/lib/worlds/city/interactables";
import {
  buyCityItem,
  claimApartmentUnit,
  claimCityLot,
  emptyCitySession,
  homeItemsForTier,
  LIBRARY_TIPS,
  parseCitySession,
  pipelineLabel,
  submitCityTask,
  tasksForLocation,
  unlockHomeTier,
  type CitySession,
} from "@/lib/worlds/city/tasks";
import "./city.css";

const STORAGE_KEY = "mm-worlds-city";

const ROLE_LABEL: Record<AccessRole, string> = {
  owner: "Owner",
  officeBot: "Office bot",
  creatorBot: "Creator bot",
  user: "User",
};

export function CityChrome({
  locationId,
  officeTaps,
  onOpenLocation,
  onClose,
  onOpenBank,
  onTier,
  onSession,
  propertyTier,
  viewerRole,
  onViewerRole,
  lot,
}: {
  locationId: string | null;
  officeTaps: readonly CityInteractable[];
  onOpenLocation: (id: string) => void;
  onClose: () => void;
  onOpenBank: () => void;
  onTier: (tier: HomeTier) => void;
  onSession: (session: CitySession) => void;
  propertyTier?: HomeTier;
  viewerRole: AccessRole;
  onViewerRole: (role: AccessRole) => void;
  lot?: CityLot | null;
}) {
  const [session, setSession] = useState<CitySession>(() => {
    if (typeof window === "undefined") return emptyCitySession();
    return parseCitySession(window.localStorage.getItem(STORAGE_KEY) ?? "") ?? emptyCitySession();
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [optIns, setOptIns] = useState<Record<string, boolean>>({});
  const [banner, setBanner] = useState<{ at: string | null; message: string; error: string }>({ at: null, message: "", error: "" });
  const sheetKey = lot?.id ?? locationId;
  const message = banner.at === sheetKey ? banner.message : "";
  const error = banner.at === sheetKey ? banner.error : "";
  const [placesOpen, setPlacesOpen] = useState(false);
  const [qc, setQc] = useState<Record<string, { auto: string; peer: string; owner: string; delivery: string }>>({});

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    onTier(session.homeTier);
  }, [session.homeTier, onTier]);

  useEffect(() => {
    onSession(session);
  }, [session, onSession]);

  const location = locationId ? locationById(locationId) : null;
  const decision = location ? decideEnter(location, viewerRole, session, propertyTier) : null;
  const tasks = location && decision?.open
    ? tasksForLocation(location.id).filter((item) => (decision.mode === "check-in" ? item.id === "office-check-in" : item.id !== "office-check-in"))
    : [];
  const shop = location ? shopItemsFor(location.id) : [];

  function apply(result: { ok: true; session: CitySession; message: string; score?: number | null; sent?: false } | { ok: false; error: string }, taskId?: string) {
    if (!result.ok) {
      if (taskId) {
        setQc((current) => ({
          ...current,
          [taskId]: { auto: "Failed", peer: "Waiting", owner: "Waiting", delivery: "Not sent" },
        }));
      }
      setBanner({ at: sheetKey, message: "", error: result.error });
      return;
    }
    if (taskId) {
      const held = /Held for Kamron/.test(result.message);
      const posted = /Nothing was posted/.test(result.message);
      const stayed = /Nothing was sent/.test(result.message);
      setQc((current) => ({
        ...current,
        [taskId]: {
          auto: "Passed",
          peer: typeof result.score === "number" ? `Score ${result.score}` : "Not used",
          owner: held ? "Held for Kamron" : posted ? "Practice only" : "Not used",
          delivery: posted ? "Nothing posted" : stayed || held ? "Nothing sent" : "Stays in the city",
        },
      }));
    }
    setSession(result.session);
    setBanner({ at: sheetKey, message: result.message, error: "" });
  }

  return (
    <>
      <div className="city-map-anchor">
        <button
          type="button"
          className="city-map-button"
          aria-label="Places"
          aria-expanded={placesOpen}
          onClick={() => setPlacesOpen((open) => !open)}
        >
          Places
        </button>
        {placesOpen ? (
          <nav className="city-map" aria-label="City places">
            <div role="group" aria-label="Preview access">
              {ACCESS_ROLES.map((role) => (
                <button key={role} type="button" aria-pressed={viewerRole === role} onClick={() => onViewerRole(role)}>
                  {ROLE_LABEL[role]}
                </button>
              ))}
            </div>
            {CITY_LOCATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={locationId === item.id}
                onClick={() => {
                  setPlacesOpen(false);
                  onOpenLocation(item.id);
                }}
              >
                {item.name}
              </button>
            ))}
          </nav>
        ) : null}
      </div>
      {location ? (
        <section className="office-panel office-sheet city-sheet" aria-label={`${location.name} interior`} data-location={location.id}>
          <button className="office-close" type="button" aria-label="Close" onClick={onClose}>×</button>
          <p className="office-kicker">{location.realWorldCategory}</p>
          <h2>{location.name}</h2>
          <p className="city-balance">{formatKash(session.kashCents)}</p>
          <p>{location.summary}</p>
          {decision && !decision.open ? <p className="office-error">{decision.reason}</p> : null}
          {propertyTier === "apartment" ? (
            <div className="city-task">
              <h3>Add a floor</h3>
              <p>The complex grows taller as more people move in. There is no side yard. It is {apartmentFloors(session.apartmentUnits)} floors now.</p>
              <p>{formatKash(APARTMENT_UNIT_PRICE_CENTS)}. Practice Kash. {ASSET_OWNER} still owns the building. No real payment.</p>
              {viewerRole !== "owner" ? <p className="office-error">Only the owner can claim a unit in this practice build.</p> : null}
              <button type="button" onClick={() => apply(claimApartmentUnit(session, viewerRole, Date.now()))}>Claim a unit</button>
            </div>
          ) : null}
          {decision?.open && decision.mode === "check-in" ? <p>{decision.reason}</p> : null}
          <p className="office-kicker">{ASSET_OWNER} owns the in-game assets. Kash is not a real payment.</p>
          {decision?.open ? (
          <>
          <div className="city-room" aria-label={`${location.name} room`}>
            {(location.id === "home" ? homeItemsForTier(session.homeTier) : location.interiorProps).map((prop) => (
              <span key={prop} className="city-prop">{prop}</span>
            ))}
          </div>
          {location.skills.length ? (
            <div className="city-badges" aria-label="Skills">
              {location.skills.map((skill) => (
                <span key={skill}>{session.skills.includes(skill) ? `${SKILL_LABEL[skill]} badge` : SKILL_LABEL[skill]}</span>
              ))}
            </div>
          ) : null}
          {location.id === "office" ? (
            <ul className="city-shop">
              {officeTaps.filter((tap) => tap.kind !== "bot").slice(0, 8).map((tap) => (
                <li key={tap.id}><b>{tap.label}</b> · still in the office scene</li>
              ))}
              <li>{officeTaps.filter((tap) => tap.kind === "bot").length} bots on the roster. Tap them in the office.</li>
            </ul>
          ) : null}
          {location.id === "bank" ? (
            <div className="office-actions">
              <button type="button" onClick={onOpenBank}>Open the vault bank</button>
            </div>
          ) : null}
          {location.id === "home" ? (
            <div className="city-task">
              <p>Home is a {HOME_TIER_LABEL[session.homeTier]}. Bigger tiers unlock more activities and items.</p>
              <div className="office-actions">
                {HOME_TIERS.filter((tier) => tier !== "studio").map((tier) => (
                  <button key={tier} type="button" onClick={() => apply(unlockHomeTier(session, tier, Date.now()))}>
                    {HOME_TIER_LABEL[tier]} · {formatKash(HOME_TIER_PRICE_CENTS[tier])}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {shop.length ? (
            <ul className="city-shop">
              {shop.map((item) => (
                <li key={item.sku}>
                  <b>{item.name}</b> · {formatKash(item.priceCents)} · from {HOME_TIER_LABEL[item.minTier]}
                  <p className="office-kicker">{item.note}</p>
                  {item.kind === "outdoor" || item.kind === "oversized" ? (
                    <p className="office-kicker">Yard, outdoor, and oversized pieces stay locked until {HOME_TIER_LABEL[item.minTier]}.</p>
                  ) : null}
                  <button type="button" onClick={() => apply(buyCityItem(session, item.sku, Date.now()))}>
                    {session.ownedSkus.includes(item.sku) ? "Yours to use" : "Buy with Kash"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {tasks.map((item) => (
            <form
              key={item.id}
              className="city-task"
              onSubmit={(event) => {
                event.preventDefault();
                apply(submitCityTask(session, item.id, { optIn: optIns[item.id] === true, note: notes[item.id] ?? "", now: Date.now() }), item.id);
              }}
            >
              <h3>{item.name}</h3>
              <p className="city-disclosure">{item.disclosure}</p>
              <ol className="city-qc" aria-label={`${item.name} quality checks`}>
                <li data-state={qc[item.id]?.auto === "Passed" ? "pass" : qc[item.id]?.auto === "Failed" ? "fail" : "waiting"}>Auto check: {qc[item.id]?.auto ?? "Waiting"}</li>
                <li data-state={qc[item.id]?.peer?.startsWith("Score") ? "pass" : "waiting"}>{item.pipeline.peerScore ? "Peer score" : "Peer score not used"}: {qc[item.id]?.peer ?? (item.pipeline.peerScore ? "Waiting" : "Not used")}</li>
                <li data-state={qc[item.id]?.owner === "Held for Kamron" ? "held" : qc[item.id]?.owner === "Practice only" ? "pass" : qc[item.id] ? "clear" : "waiting"}>{item.pipeline.ownerGate ? "Owner gate" : "Owner gate not used"}: {qc[item.id]?.owner ?? (item.pipeline.ownerGate ? "Waiting for Kamron" : "Not used")}</li>
                <li data-state={qc[item.id]?.delivery === "Nothing posted" || qc[item.id]?.delivery === "Nothing sent" ? "held" : qc[item.id] ? "clear" : "waiting"}>Delivery: {qc[item.id]?.delivery ?? (item.external === "social" ? "Practice only" : item.external === "email" ? "Draft only" : "Stays in the city")}</li>
              </ol>
              <p className="office-kicker">{pipelineLabel(item)}. {item.pipeline.autoChecks.join(" ")}</p>
              <p className="office-kicker">{item.prompt}</p>
              {session.libraryTips.includes(item.id) ? (
                <p>Library tip: {LIBRARY_TIPS.find((tip) => tip.taskId === item.id)?.text}</p>
              ) : null}
              <label>
                <input
                  type="checkbox"
                  checked={optIns[item.id] === true}
                  onChange={(event) => setOptIns((current) => ({ ...current, [item.id]: event.target.checked }))}
                />
                <span>I choose to do this. It is optional.</span>
              </label>
              {item.realWork || item.kind === "lesson" || item.practice || item.external !== "none" ? (
                <textarea
                  aria-label={item.name}
                  value={notes[item.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                />
              ) : null}
              <button type="submit">Submit in the city</button>
            </form>
          ))}
          </>
          ) : null}
          {message ? <p>{message}</p> : null}
          {error ? <p className="office-error">{error}</p> : null}
        </section>
      ) : null}
      {lot ? (
        <section className="office-panel office-sheet city-sheet" aria-label={`Lot ${lot.number}`} data-location={lot.id}>
          <button className="office-close" type="button" aria-label="Close" onClick={onClose}>×</button>
          <p className="office-kicker">{HOME_TIER_LABEL[lot.tier]} footprint</p>
          <h2>Lot {lot.number}</h2>
          <p className="city-balance">{formatKash(session.kashCents)}</p>
          <p>Build here. This lot is empty and waiting. The footprint matches a {HOME_TIER_LABEL[lot.tier].toLowerCase()}.</p>
          <p>{formatKash(lot.priceCents)}. Practice Kash. {ASSET_OWNER} keeps the lot. No real payment.</p>
          {viewerRole !== "owner" ? <p className="office-error">Only the owner can claim a lot in this practice build.</p> : null}
          {session.claimedLotIds.includes(lot.id) ? (
            <p>This lot is claimed. The foundation and shell are on the lot. The finished building comes later.</p>
          ) : (
            <button type="button" onClick={() => apply(claimCityLot(session, lot, viewerRole, Date.now()))}>Claim lot {lot.number}</button>
          )}
          {message ? <p>{message}</p> : null}
          {error ? <p className="office-error">{error}</p> : null}
        </section>
      ) : null}
    </>
  );
}
