"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CharacterConfig, CharacterSlot, CharacterSlotName } from "@/lib/worlds/character";
import { FashionDoll, type FashionEmote, type FashionView } from "./fashion-doll";

export const STUDIO_EMOTES = ["idle", "walk", "wave", "sit"] as const;
export type StudioEmote = (typeof STUDIO_EMOTES)[number];

const SHEET_GRAY = "#e6e6e6";

const SLOT_ORDER: CharacterSlotName[] = ["hair", "headwear", "top", "bottom", "shoes", "accessory"];

const GARMENT_DETAIL: Record<string, string> = {
  cap: "Cropped cut",
  bob: "Bob",
  spikes: "Pixie spikes",
  bun: "Top bun",
  long: "Long hair",
  waves: "Waves",
  beanie: "Knit beanie",
  bow: "Satin bow",
  headphones: "Studio headphones",
  crown: "Tiara",
  tee: "Fitted tee",
  vest: "Cropped vest",
  collar: "Collared blouse",
  hoodie: "Oversized hoodie",
  jacket: "Tailored jacket",
  shorts: "Tailored shorts",
  pants: "Slim trousers",
  skirt: "A-line skirt",
  overalls: "Denim overalls",
  sneakers: "Chunky sneakers",
  boots: "Ankle boots",
  sandals: "Strappy sandals",
  heels: "Heels",
  glasses: "Oversized glasses",
  scarf: "Neck scarf",
  bag: "Shoulder bag",
  badge: "Creator badge",
  watch: "Wrist watch",
};

const VIEWS: { id: FashionView; label: string }[] = [
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "back", label: "Back" },
  { id: "profile", label: "Profile" },
];

function emoteLabel(emote: StudioEmote) {
  if (emote === "idle") return "Idle";
  if (emote === "walk") return "Walk";
  if (emote === "wave") return "Wave";
  return "Sit";
}

function titleCase(value: string) {
  if (value === "tee") return "T-shirt";
  if (value === "none") return "None";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function garmentDetail(item: string) {
  return GARMENT_DETAIL[item] ?? titleCase(item);
}

function stopPointer(event: ReactPointerEvent) {
  event.stopPropagation();
}

function wornSlots(config: CharacterConfig) {
  const labels: Record<CharacterSlotName, string> = {
    hair: "Hair",
    headwear: "Headwear",
    top: "Top",
    bottom: "Bottom",
    shoes: "Shoes",
    accessory: "Accessory",
  };
  const rows: { slot: CharacterSlotName; slotLabel: string; item: CharacterSlot }[] = [];
  for (const slot of SLOT_ORDER) {
    const item = config.slots[slot];
    if (item.item === "none") continue;
    rows.push({ slot, slotLabel: labels[slot], item });
  }
  return rows;
}

/**
 * Paper-doll concept sheet. Front, side, back, and the profile headshot
 * share one version 1 look on light gray. The 3D humanoid is not the preview.
 */
export function CharacterStage({
  config,
  baseline,
  compare,
  sheetOpen,
  name,
  onCompare,
  onHideSheet,
}: {
  config: CharacterConfig;
  baseline: CharacterConfig;
  compare: boolean;
  sheetOpen: boolean;
  name: string;
  onCompare: () => void;
  onHideSheet: () => void;
}) {
  const [emote, setEmote] = useState<StudioEmote>("idle");
  const pose: FashionEmote = emote;
  const build = `${titleCase(config.body.shape)} · ${titleCase(config.body.size)}`;
  const expression = `${titleCase(config.face.expression)} · ${titleCase(config.face.eyes)} eyes · ${titleCase(config.face.mouth)}`;

  return (
    <div className="character-stage" style={{ background: SHEET_GRAY }}>
      <div className="character-sheet-bar">
        <div className="character-emotes" role="group" aria-label="Emotes" onPointerDown={stopPointer}>
          {STUDIO_EMOTES.map((item) => (
            <button key={item} type="button" aria-pressed={emote === item} onClick={() => setEmote(item)}>
              {emoteLabel(item)}
            </button>
          ))}
        </div>
        <div className="character-stage-tools" role="group" aria-label="Concept sheet" onPointerDown={stopPointer}>
          <button type="button" aria-pressed={compare} onClick={onCompare}>Compare</button>
        </div>
      </div>
      <header className="character-sheet-name">
        <p><span>Name</span> {name}</p>
        <p><span>Archetype</span> Content creator</p>
      </header>
      <div className="character-sheet-view">
        {sheetOpen ? (
          <button type="button" className="character-scrim" aria-label="Hide options" onClick={onHideSheet} onPointerDown={stopPointer} />
        ) : null}
        <div className="character-sheet-grid">
          {VIEWS.map((item) => {
            const before = compare && item.id === "profile";
            return (
              <figure key={item.id} data-view={item.id}>
                <FashionDoll config={before ? baseline : config} view={item.id} emote={pose} />
                <figcaption>{before ? "Profile · Before" : compare && item.id === "front" ? "Front · After" : item.label}</figcaption>
              </figure>
            );
          })}
        </div>
      </div>
      <dl className="character-sheet-legend">
        <div>
          <dt>Archetype</dt>
          <dd>Content creator</dd>
        </div>
        <div>
          <dt>Build</dt>
          <dd>{build}</dd>
        </div>
        <div>
          <dt>Expression</dt>
          <dd>{expression}</dd>
        </div>
        {wornSlots(config).map((row) => (
          <div key={row.slot}>
            <dt>{row.slotLabel}</dt>
            <dd>
              <i className="character-sheet-dot" style={{ background: row.item.color }} />
              {garmentDetail(row.item.item)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
