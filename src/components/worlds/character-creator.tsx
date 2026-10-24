"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { withBasePath } from "@/lib/format";
import {
  applyPalette,
  BODY_SHAPES,
  BODY_SIZES,
  CHARACTER_PATH,
  CHARACTER_SWATCHES,
  characterSlotChoices,
  defaultCharacter,
  EXPRESSIONS,
  EYE_STYLES,
  INNER_TOPS,
  MOUTH_STYLES,
  NAME_TAG_STYLES,
  OUTERWEAR_ITEMS,
  randomCharacter,
  SHOP_CLOTHING,
  slotMeshReady,
  missingWornParts,
  type CharacterConfig,
  type CharacterSlotName,
  type CharacterSubjectKind,
} from "@/lib/worlds/character";
import { GAME_CATALOG } from "@/lib/worlds/game-wallet";
import { CharacterStage } from "./character-stage";
import { FashionDoll, type FashionView } from "./fashion-doll";
import "./character.css";

const CATEGORIES = [
  { id: "body", label: "Body" },
  { id: "face", label: "Face" },
  { id: "hair", label: "Hair" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "shoes", label: "Shoes" },
  { id: "outerwear", label: "Outerwear" },
  { id: "accessories", label: "Accessories" },
  { id: "colors", label: "Colors" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const SLOT_LABELS: Record<CharacterSlotName, string> = {
  hair: "Hair",
  headwear: "Headwear",
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
};

function label(value: string) {
  if (value === "tee") return "T-shirt";
  if (value === "none") return "None";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function wornWith(base: CharacterConfig, slot: CharacterSlotName, item: string): CharacterConfig {
  return {
    ...base,
    slots: { ...base.slots, [slot]: { ...base.slots[slot], item } },
  };
}

type Arm = {
  id: string;
  name: string;
  wearing: boolean;
  lock: ItemLock | null;
  look: CharacterConfig;
  onCharacter: CharacterConfig;
  pinned: boolean;
  apply: () => void;
};

function sameLook(left: CharacterConfig, right: CharacterConfig) {
  return JSON.stringify(left) === JSON.stringify(right);
}

type ItemLock = { price: number | null; reason: string };

function kashAmount(units: number) {
  const whole = Math.abs(units - Math.round(units)) < 0.001;
  return whole ? String(Math.round(units)) : units.toFixed(2);
}

function locksFor(slot: CharacterSlotName, values: readonly string[], unlocked: readonly string[]) {
  const locked: Record<string, ItemLock> = {};
  const shop = SHOP_CLOTHING[slot] as readonly string[];
  for (const item of values) {
    if (!shop.includes(item) || unlocked.includes(item)) continue;
    const product = GAME_CATALOG.find((row) => row.sku === item);
    locked[item] = product
      ? { price: product.priceCents / 100, reason: "Shop" }
      : { price: null, reason: "Locked" };
  }
  for (const item of values) {
    if (item !== "none" && !slotMeshReady(slot, item) && !locked[item]) locked[item] = { price: null, reason: "Missing mesh" };
  }
  return locked;
}

function meshedChoices(slot: CharacterSlotName, values: readonly string[]) {
  return values.some((item) => item !== "none" && slotMeshReady(slot, item));
}

function Choices({
  values,
  selected,
  onPick,
  labelText,
  locked,
  armed,
  onPreview,
  onCommit,
  onLeave,
}: {
  values: readonly string[];
  selected: string;
  onPick: (value: string) => void;
  labelText: string;
  locked?: Readonly<Record<string, ItemLock>>;
  armed?: string | null;
  onPreview?: (value: string, pinned: boolean) => void;
  onLeave?: (value: string) => void;
  onCommit?: (value: string) => void;
}) {
  if (values.length === 0) {
    return (
      <div className="character-empty" role="status">
        <p className="character-kicker">{labelText}</p>
        <p>No pieces in this category yet. The rest of the look still saves.</p>
      </div>
    );
  }
  return (
    <div className="character-group">
      <p className="character-kicker">{labelText}</p>
      <div className="character-choices" role="group" aria-label={labelText}>
        {values.map((value) => {
          const lock = locked?.[value];
          const name = label(value);
          const price = lock?.price;
          const previewing = armed === value;
          return (
            <span
              key={value}
              className="character-choice"
              onMouseEnter={() => onPreview?.(value, false)}
              onMouseLeave={() => onLeave?.(value)}
              onPointerDown={(event) => {
                event.currentTarget.dataset.ready = previewing && !lock ? "1" : "0";
              }}
              onClick={(event) => {
                if (!onPreview) {
                  onPick(value);
                  return;
                }
                if (event.currentTarget.dataset.ready === "1") onCommit?.(value);
                else onPreview(value, true);
              }}
            >
            <button
              type="button"
              className={lock ? "is-locked" : previewing ? "is-preview" : undefined}
              aria-pressed={selected === value}
              aria-label={lock ? `${name}, ${price != null ? `${kashAmount(price)} Kash` : lock.reason}, locked` : name}
              disabled={Boolean(lock)}
            >
              {lock ? (
                <>
                  <svg className="character-lock-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  <span>{name}</span>
                  {price != null ? (
                    <span className="character-price">
                      <span className="kash-mark" aria-hidden="true">K</span>
                      {kashAmount(price)}
                    </span>
                  ) : (
                    <span className="character-price">{lock.reason}</span>
                  )}
                </>
              ) : name}
            </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

const COMPLEXION = CHARACTER_SWATCHES.slice(0, 5);
const NEUTRALS = ["#f7f1e4", "#1c211e", "#ffffff"] as const;
const WARDROBE = CHARACTER_SWATCHES.filter((color) => !COMPLEXION.includes(color) && !(NEUTRALS as readonly string[]).includes(color));

function Swatches({
  selected,
  onPick,
  labelText,
}: {
  selected: string;
  onPick: (value: string) => void;
  labelText: string;
}) {
  const rows = [
    { id: "complexion", label: "Complexion", colors: COMPLEXION },
    { id: "wardrobe", label: "Wardrobe", colors: WARDROBE },
    { id: "neutral", label: "Neutral", colors: NEUTRALS },
  ];
  return (
    <div className="character-group">
      <p className="character-kicker">{labelText}</p>
      <div role="group" aria-label={labelText}>
        {rows.map((row) => (
          <div key={row.id} className="character-swatch-row">
            <span className="character-swatch-label">{row.label}</span>
            <div className="character-swatches">
              {row.colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="character-swatch"
                  aria-label={color}
                  aria-pressed={selected === color}
                  style={{ background: color }}
                  onClick={() => onPick(color)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Recolor({ labelText, before, after }: { labelText: string; before: string; after: string }) {
  const changed = before.toLowerCase() !== after.toLowerCase();
  if (!changed) return null;
  return (
    <p className="character-recolor">
      <span>{labelText}</span>
      <span className="character-recolor-chip" style={{ background: before }} aria-label={`${labelText} saved`} />
      <span className="character-recolor-chip" style={{ background: after }} aria-label={`${labelText} now`} />
      <span>Changed</span>
    </p>
  );
}

export function CharacterCreator({
  subjectKind,
  subjectId,
  initial,
  title,
  backHref,
  backLabel,
  unlocked = [],
}: {
  subjectKind: CharacterSubjectKind;
  subjectId: string;
  initial: CharacterConfig;
  title: string;
  backHref: string;
  backLabel: string;
  unlocked?: readonly string[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryId>("body");
  const [config, setConfig] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [compare, setCompare] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [arm, setArm] = useState<Arm | null>(null);
  const savingRef = useRef(false);
  const leaveRef = useRef(false);
  const studioRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const sheetCoverRef = useRef(0);
  const categoryLabel = CATEGORIES.find((item) => item.id === category)?.label ?? "Body";
  const dirty = !sameLook(config, baseline);
  const you = subjectKind === "user";

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!savingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const studio = studioRef.current;
    const panel = panelRef.current;
    if (!studio || !panel) return;
    const sync = () => {
      const studioBox = studio.getBoundingClientRect();
      const panelBox = panel.getBoundingClientRect();
      const narrow = window.matchMedia("(max-width: 800px)").matches;
      const lift = narrow ? Math.max(0, studioBox.bottom - panelBox.top) : 0;
      sheetCoverRef.current = narrow && studioBox.height > 0 ? Math.min(0.72, lift / studioBox.height) : 0;
      studio.style.setProperty("--sheet-lift", `${Math.ceil(lift)}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(panel);
    const media = window.matchMedia("(max-width: 800px)");
    media.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
    };
  }, []);

  function setSlot(name: CharacterSlotName, patch: Partial<CharacterConfig["slots"][CharacterSlotName]>) {
    setConfig((current) => ({
      ...current,
      slots: { ...current.slots, [name]: { ...current.slots[name], ...patch } },
    }));
    setMessage("");
  }

  function pickOuterwear(item: string) {
    setConfig((current) => {
      const worn = current.slots.top.item;
      if (item === "none" && !(OUTERWEAR_ITEMS as readonly string[]).includes(worn)) return current;
      return { ...current, slots: { ...current.slots, top: { ...current.slots.top, item } } };
    });
    setMessage("");
  }

  function paint(key: "primary" | "secondary" | "accent", color: string) {
    setConfig((current) => applyPalette({ ...current, palette: { ...current.palette, [key]: color } }));
    setMessage("");
  }

  async function save() {
    const snapshot = config;
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch(withBasePath(CHARACTER_PATH), {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectKind, subjectId, config: snapshot }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        leaveRef.current = false;
        setFailed(true);
        setMessage(body?.error || "The character did not save.");
        return;
      }
      setBaseline(snapshot);
      if (leaveRef.current) {
        leaveRef.current = false;
        router.push(backHref);
        return;
      }
      setMessage(you
        ? "Saved. The office You character wears this look."
        : "Saved. This bot wears the look in the office.");
    } catch {
      leaveRef.current = false;
      setFailed(true);
      setMessage("The character did not save.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function onBack(event: MouseEvent<HTMLAnchorElement>) {
    if (!savingRef.current) return;
    event.preventDefault();
    leaveRef.current = true;
    setFailed(false);
    setMessage("Saving… this page will leave when the save finishes.");
  }

  function openCategory(next: CategoryId) {
    setCategory(next);
    setSheetOpen(true);
    setArm(null);
  }

  function showPiece(id: string, name: string, wearing: boolean, lock: ItemLock | null, look: CharacterConfig, onCharacter: CharacterConfig, apply: () => void, pinned: boolean) {
    setArm((current) => ({
      id,
      name,
      wearing,
      lock,
      look,
      onCharacter,
      apply,
      pinned: pinned || Boolean(current?.id === id && current.pinned),
    }));
  }

  function leavePiece(id: string) {
    setArm((current) => (current && current.id === id && !current.pinned ? null : current));
  }

  function wearPiece(apply: () => void) {
    apply();
    setArm(null);
    setMessage("");
  }

  function choicesFor(
    id: string,
    labelText: string,
    values: readonly string[],
    selected: string,
    wear: (value: string) => void,
    preview: (value: string) => { mannequin: CharacterConfig; onCharacter: CharacterConfig },
    locked?: Readonly<Record<string, ItemLock>>,
  ) {
    const armed = arm?.id.startsWith(`${id}:`) ? arm.id.slice(id.length + 1) : null;
    return (
      <Choices
        labelText={labelText}
        values={values}
        selected={selected}
        locked={locked}
        armed={armed}
        onPick={wear}
        onPreview={(value, pinned) => {
          const next = preview(value);
          showPiece(`${id}:${value}`, label(value), selected === value, locked?.[value] ?? null, next.mannequin, next.onCharacter, () => wear(value), pinned);
        }}
        onLeave={(value) => leavePiece(`${id}:${value}`)}
        onCommit={(value) => {
          if (locked?.[value] || selected === value) return;
          wearPiece(() => wear(value));
        }}
      />
    );
  }

  const topItem = config.slots.top.item;
  const outerOn = topItem !== "none" && (OUTERWEAR_ITEMS as readonly string[]).includes(topItem);
  const innerOn = topItem !== "none" && (INNER_TOPS as readonly string[]).includes(topItem);
  const gaps = missingWornParts(config);

  function slotPreview(slot: CharacterSlotName, item: string) {
    const onCharacter = wornWith(config, slot, item);
    return { mannequin: onCharacter, onCharacter };
  }

  function outerPreview(item: string) {
    const keepsShirt = item === "none" && !(OUTERWEAR_ITEMS as readonly string[]).includes(config.slots.top.item);
    const onCharacter = keepsShirt ? config : wornWith(config, "top", item);
    return { mannequin: onCharacter, onCharacter };
  }

  function samePreview(onCharacter: CharacterConfig) {
    return { mannequin: onCharacter, onCharacter };
  }

  return (
    <div className="character-studio" ref={studioRef}>
      <div className="character-stage-wrap">
        <CharacterStage
          config={arm && !arm.wearing ? arm.onCharacter : config}
          baseline={baseline}
          compare={compare}
          sheetOpen={sheetOpen}
          name={title}
          previewName={arm && !arm.wearing ? arm.name : null}
          onCompare={() => setCompare((open) => !open)}
          onHideSheet={() => setSheetOpen(false)}
        />
      </div>
      <section ref={panelRef} className={sheetOpen ? "character-panel is-open" : "character-panel"} aria-label="Character creator">
        <button
          type="button"
          className="character-sheet-handle"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((open) => !open)}
        >
          <span />
          {sheetOpen ? "Hide options" : `${categoryLabel} options`}
        </button>
        <div className="character-bar">
          <div className="character-bar-title">
            <p className="character-kicker">Dresser</p>
            <h1>{title}</h1>
          </div>
          <Link href={backHref} onClick={onBack} aria-disabled={saving}>{saving ? "Saving…" : backLabel}</Link>
        </div>
        <div className="character-tabs" role="tablist" aria-label="Look categories">
          {CATEGORIES.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={category === item.id} onClick={() => openCategory(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="character-scroll" key={category}>
          {gaps.length ? (
            <div className="character-empty" role="alert">
              <p>Some pieces have no mesh yet.</p>
              <ul>
                {gaps.map((gap) => (
                  <li key={`${gap.slot}-${gap.item}`}>
                    {gap.slot === "top" && (OUTERWEAR_ITEMS as readonly string[]).includes(gap.item) ? "Outerwear" : SLOT_LABELS[gap.slot]}
                    {" · "}
                    {label(gap.item)} is missing. The office skips that piece.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {category === "body" ? (
            <>
              {choicesFor("shape", "Shape", BODY_SHAPES, config.body.shape, (shape) => { setConfig((current) => ({ ...current, body: { ...current.body, shape: shape as CharacterConfig["body"]["shape"] } })); setMessage(""); }, (shape) => samePreview({ ...config, body: { ...config.body, shape: shape as CharacterConfig["body"]["shape"] } }))}
              {choicesFor("size", "Size", BODY_SIZES, config.body.size, (size) => { setConfig((current) => ({ ...current, body: { ...current.body, size: size as CharacterConfig["body"]["size"] } })); setMessage(""); }, (size) => samePreview({ ...config, body: { ...config.body, size: size as CharacterConfig["body"]["size"] } }))}
              <Swatches labelText="Skin" selected={config.body.color} onPick={(color) => { setConfig((current) => ({ ...current, body: { ...current.body, color } })); setMessage(""); }} />
              <Recolor labelText="Skin" before={baseline.body.color} after={config.body.color} />
            </>
          ) : null}
          {category === "face" ? (
            <>
              {choicesFor("eyes", "Eyes", EYE_STYLES, config.face.eyes, (eyes) => { setConfig((current) => ({ ...current, face: { ...current.face, eyes: eyes as CharacterConfig["face"]["eyes"] } })); setMessage(""); }, (eyes) => samePreview({ ...config, face: { ...config.face, eyes: eyes as CharacterConfig["face"]["eyes"] } }))}
              {choicesFor("mouth", "Mouth", MOUTH_STYLES, config.face.mouth, (mouth) => { setConfig((current) => ({ ...current, face: { ...current.face, mouth: mouth as CharacterConfig["face"]["mouth"] } })); setMessage(""); }, (mouth) => samePreview({ ...config, face: { ...config.face, mouth: mouth as CharacterConfig["face"]["mouth"] } }))}
              {choicesFor("expression", "Expression", EXPRESSIONS, config.face.expression, (expression) => { setConfig((current) => ({ ...current, face: { ...current.face, expression: expression as CharacterConfig["face"]["expression"] } })); setMessage(""); }, (expression) => samePreview({ ...config, face: { ...config.face, expression: expression as CharacterConfig["face"]["expression"] } }))}
              <p className="character-note">Hair, eyes, and expression read in the profile headshot.</p>
            </>
          ) : null}
          {category === "hair" ? (
            meshedChoices("hair", characterSlotChoices("hair")) ? (
              <>
                {choicesFor("hair", "Style", characterSlotChoices("hair"), config.slots.hair.item, (item) => setSlot("hair", { item }), (item) => slotPreview("hair", item), locksFor("hair", characterSlotChoices("hair"), unlocked))}
                <Swatches labelText="Color" selected={config.slots.hair.color} onPick={(color) => setSlot("hair", { color })} />
                <Recolor labelText="Hair" before={baseline.slots.hair.color} after={config.slots.hair.color} />
              </>
            ) : (
              <div className="character-empty" role="status">
                <p>No hair pieces yet.</p>
                <p>This category stays empty until a mesh is added. The rest of the look still saves.</p>
              </div>
            )
          ) : null}
          {category === "top" ? (
            meshedChoices("top", INNER_TOPS) ? (
              <>
                <p className="character-note">Tops and outerwear share one piece. A shirt replaces a coat.</p>
                {outerOn ? <p className="character-note">Outerwear is on. Choosing a top replaces it.</p> : null}
                {choicesFor("top", "Style", INNER_TOPS, innerOn || topItem === "none" ? topItem : "", (item) => setSlot("top", { item }), (item) => slotPreview("top", item), locksFor("top", INNER_TOPS, unlocked))}
                <Swatches labelText="Color" selected={config.slots.top.color} onPick={(color) => setSlot("top", { color })} />
                <Recolor labelText="Top" before={baseline.slots.top.color} after={config.slots.top.color} />
              </>
            ) : (
              <div className="character-empty" role="status">
                <p>No tops yet.</p>
                <p>This category stays empty until a mesh is added. The rest of the look still saves.</p>
              </div>
            )
          ) : null}
          {category === "bottom" ? (
            meshedChoices("bottom", characterSlotChoices("bottom")) ? (
              <>
                {choicesFor("bottom", "Style", characterSlotChoices("bottom"), config.slots.bottom.item, (item) => setSlot("bottom", { item }), (item) => slotPreview("bottom", item), locksFor("bottom", characterSlotChoices("bottom"), unlocked))}
                <Swatches labelText="Color" selected={config.slots.bottom.color} onPick={(color) => setSlot("bottom", { color })} />
                <Recolor labelText="Bottom" before={baseline.slots.bottom.color} after={config.slots.bottom.color} />
              </>
            ) : (
              <div className="character-empty" role="status">
                <p>No bottoms yet.</p>
                <p>This category stays empty until a mesh is added. The rest of the look still saves.</p>
              </div>
            )
          ) : null}
          {category === "shoes" ? (
            meshedChoices("shoes", characterSlotChoices("shoes")) ? (
              <>
                {choicesFor("shoes", "Style", characterSlotChoices("shoes"), config.slots.shoes.item, (item) => setSlot("shoes", { item }), (item) => slotPreview("shoes", item), locksFor("shoes", characterSlotChoices("shoes"), unlocked))}
                <Swatches labelText="Color" selected={config.slots.shoes.color} onPick={(color) => setSlot("shoes", { color })} />
                <Recolor labelText="Shoes" before={baseline.slots.shoes.color} after={config.slots.shoes.color} />
              </>
            ) : (
              <div className="character-empty" role="status">
                <p>No shoes yet.</p>
                <p>This category stays empty until a mesh is added. The rest of the look still saves.</p>
              </div>
            )
          ) : null}
          {category === "outerwear" ? (
            meshedChoices("top", OUTERWEAR_ITEMS) ? (
              <>
                <p className="character-note">Outerwear uses the top slot. None keeps a shirt that is already on.</p>
                {innerOn ? <p className="character-note">A top is on. A coat replaces it.</p> : null}
                {choicesFor("outer", "Style", OUTERWEAR_ITEMS, outerOn ? topItem : "none", pickOuterwear, outerPreview, locksFor("top", OUTERWEAR_ITEMS, unlocked))}
                <Swatches labelText="Color" selected={config.slots.top.color} onPick={(color) => setSlot("top", { color })} />
                <Recolor labelText="Outerwear" before={baseline.slots.top.color} after={config.slots.top.color} />
              </>
            ) : (
              <div className="character-empty" role="status">
                <p>No outerwear yet.</p>
                <p>This category stays empty until a mesh is added. The rest of the look still saves.</p>
              </div>
            )
          ) : null}
          {category === "accessories" ? (
            <>
              {meshedChoices("headwear", characterSlotChoices("headwear")) ? (
                <>
                  {choicesFor("head", "Head", characterSlotChoices("headwear"), config.slots.headwear.item, (item) => setSlot("headwear", { item }), (item) => slotPreview("headwear", item), locksFor("headwear", characterSlotChoices("headwear"), unlocked))}
                  <Swatches labelText="Head color" selected={config.slots.headwear.color} onPick={(color) => setSlot("headwear", { color })} />
                </>
              ) : (
                <div className="character-empty" role="status">
                  <p>No head pieces yet.</p>
                </div>
              )}
              {meshedChoices("accessory", characterSlotChoices("accessory")) ? (
                <>
                  {choicesFor("worn", "Worn", characterSlotChoices("accessory"), config.slots.accessory.item, (item) => setSlot("accessory", { item }), (item) => slotPreview("accessory", item), locksFor("accessory", characterSlotChoices("accessory"), unlocked))}
                  <Swatches labelText="Worn color" selected={config.slots.accessory.color} onPick={(color) => setSlot("accessory", { color })} />
                  <Recolor labelText="Accessory" before={baseline.slots.accessory.color} after={config.slots.accessory.color} />
                </>
              ) : (
                <div className="character-empty" role="status">
                  <p>No worn accessories yet.</p>
                </div>
              )}
            </>
          ) : null}
          {category === "colors" ? (
            <>
              <p className="character-note">Palette picks recolor hair, the top or coat, bottom, shoes, and accessories immediately. Compare shows the saved look beside this one.</p>
              <Swatches labelText="Primary" selected={config.palette.primary} onPick={(primary) => paint("primary", primary)} />
              <Swatches labelText="Secondary" selected={config.palette.secondary} onPick={(secondary) => paint("secondary", secondary)} />
              <Swatches labelText="Accent" selected={config.palette.accent} onPick={(accent) => paint("accent", accent)} />
              <Recolor labelText="Primary" before={baseline.palette.primary} after={config.palette.primary} />
              <Recolor labelText="Hair" before={baseline.slots.hair.color} after={config.slots.hair.color} />
              <Recolor labelText="Outfit" before={baseline.slots.top.color} after={config.slots.top.color} />
              {choicesFor("tag", "Name tag", NAME_TAG_STYLES, config.nameTag.style, (style) => { setConfig((current) => ({ ...current, nameTag: { ...current.nameTag, style: style as CharacterConfig["nameTag"]["style"] } })); setMessage(""); }, (style) => samePreview({ ...config, nameTag: { ...config.nameTag, style: style as CharacterConfig["nameTag"]["style"] } }))}
              <Swatches labelText="Tag color" selected={config.nameTag.color} onPick={(color) => { setConfig((current) => ({ ...current, nameTag: { ...current.nameTag, color } })); setMessage(""); }} />
            </>
          ) : null}
        </div>
        {arm ? (
          <div className="character-preview" role="region" aria-label="Item preview">
            <div className="character-preview-stage">
              {(["front", "side", "back", "profile"] as FashionView[]).map((view) => (
                <FashionDoll key={view} config={arm.onCharacter} view={view} emote="idle" forceGlam />
              ))}
            </div>
            <div className="character-preview-copy">
              <p className="character-kicker">Preview</p>
              <p className="character-preview-name">{arm.name}</p>
              <p className="character-note">
                {arm.wearing ? "Already on the character." : arm.lock ? "On the character as a preview. Shop piece — Apply stays locked." : "On the character as a preview. Apply keeps it."}
              </p>
            </div>
            {arm.lock ? (
              <span className="character-price">
                {arm.lock.price != null ? (
                  <>
                    <span className="kash-mark" aria-hidden="true">K</span>
                    {kashAmount(arm.lock.price)}
                  </>
                ) : arm.lock.reason}
              </span>
            ) : null}
            <button type="button" className="character-quiet" onClick={() => setArm(null)}>Cancel</button>
            {!arm.lock && !arm.wearing ? (
              <button type="button" className="character-preview-apply" onClick={() => wearPiece(arm.apply)}>
                Apply
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="character-apply-bar">
          {message ? <p className={failed ? "character-note error" : "character-note"} role="status">{message}</p> : null}
          {!message && dirty ? (
            <p className="character-note is-dirty">{you ? "Unsaved. Save look updates the office You character." : "Unsaved. Save look updates this bot in the office."}</p>
          ) : null}
          {!message && !dirty ? <p className="character-note">Matches the saved look.</p> : null}
          <div className="character-footer-actions">
            <button type="button" className="character-quiet" onClick={() => { setArm(null); setConfig(randomCharacter()); setMessage(""); }}>Randomize</button>
            <button type="button" className="character-quiet" onClick={() => { setArm(null); setConfig(defaultCharacter(subjectId)); setMessage(""); }}>Reset</button>
            <button type="button" className="character-apply" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save look"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
