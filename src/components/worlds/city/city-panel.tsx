"use client";

import { useEffect, useState } from "react";
import { ASSET_OWNER, HOME_TIER_LABEL, HOME_TIER_PRICE_CENTS, HOME_TIERS, formatKash, shopItemsFor, type HomeTier } from "@/lib/worlds/economy";
import { CITY_LOCATIONS, SKILL_LABEL, locationById } from "@/lib/worlds/city/locations";
import type { CityInteractable } from "@/lib/worlds/city/interactables";
import {
  buyCityItem,
  emptyCitySession,
  homeItemsForTier,
  parseCitySession,
  submitCityTask,
  tasksForLocation,
  unlockHomeTier,
  type CitySession,
} from "@/lib/worlds/city/tasks";
import "./city.css";

const STORAGE_KEY = "mm-worlds-city";

export function CityChrome({
  locationId,
  officeTaps,
  lifted,
  onOpenLocation,
  onClose,
  onOpenBank,
  onTier,
}: {
  locationId: string | null;
  officeTaps: readonly CityInteractable[];
  lifted: boolean;
  onOpenLocation: (id: string) => void;
  onClose: () => void;
  onOpenBank: () => void;
  onTier: (tier: HomeTier) => void;
}) {
  const [session, setSession] = useState<CitySession>(() => {
    if (typeof window === "undefined") return emptyCitySession();
    return parseCitySession(window.localStorage.getItem(STORAGE_KEY) ?? "") ?? emptyCitySession();
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [optIns, setOptIns] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    onTier(session.homeTier);
  }, [session.homeTier, onTier]);

  const location = locationId ? locationById(locationId) : null;
  const tasks = location ? tasksForLocation(location.id) : [];
  const shop = location ? shopItemsFor(location.id) : [];

  function apply(result: { ok: true; session: CitySession; message: string } | { ok: false; error: string }) {
    if (!result.ok) {
      setError(result.error);
      setMessage("");
      return;
    }
    setSession(result.session);
    setMessage(result.message);
    setError("");
  }

  return (
    <>
      <nav className={lifted || location ? "city-places is-lifted" : "city-places"} aria-label="City places">
        {CITY_LOCATIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={locationId === item.id}
            onClick={() => onOpenLocation(item.id)}
          >
            {item.name}
          </button>
        ))}
      </nav>
      {location ? (
        <section className="office-panel office-sheet city-sheet" aria-label={`${location.name} interior`} data-location={location.id}>
          <button className="office-close" type="button" aria-label="Close" onClick={onClose}>×</button>
          <p className="office-kicker">{location.realWorldCategory}</p>
          <h2>{location.name}</h2>
          <p className="city-balance">{formatKash(session.kashCents)}</p>
          <p>{location.summary}</p>
          <p className="office-kicker">{ASSET_OWNER} owns the in-game assets. Kash is not a real payment.</p>
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
                  <b>{item.name}</b> · {formatKash(item.priceCents)}
                  <p className="office-kicker">{item.note}</p>
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
                apply(submitCityTask(session, item.id, { optIn: optIns[item.id] === true, note: notes[item.id] ?? "", now: Date.now() }));
              }}
            >
              <h3>{item.name}</h3>
              <p className="city-disclosure">{item.disclosure}</p>
              <p className="office-kicker">{item.prompt}</p>
              <label>
                <input
                  type="checkbox"
                  checked={optIns[item.id] === true}
                  onChange={(event) => setOptIns((current) => ({ ...current, [item.id]: event.target.checked }))}
                />
                <span>I choose to do this. It is optional.</span>
              </label>
              {item.realWork || item.kind === "lesson" ? (
                <textarea
                  aria-label={item.name}
                  value={notes[item.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                />
              ) : null}
              <button type="submit">Submit in the city</button>
            </form>
          ))}
          {message ? <p>{message}</p> : null}
          {error ? <p className="office-error">{error}</p> : null}
        </section>
      ) : null}
    </>
  );
}
