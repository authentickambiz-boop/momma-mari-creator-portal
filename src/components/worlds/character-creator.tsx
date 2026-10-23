"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import { withBasePath } from "@/lib/format";
import {
  applyPalette,
  BODY_SHAPES,
  BODY_SIZES,
  CHARACTER_PATH,
  CHARACTER_SLOTS,
  CHARACTER_SWATCHES,
  characterSlotChoices,
  defaultCharacter,
  EXPRESSIONS,
  EYE_STYLES,
  MOUTH_STYLES,
  NAME_TAG_STYLES,
  randomCharacter,
  type CharacterConfig,
  SHOP_CLOTHING,
  type CharacterSlotName,
  type CharacterSubjectKind,
} from "@/lib/worlds/character";
import { formatGameUnits, GAME_CATALOG } from "@/lib/worlds/game-wallet";
import { CharacterFigure } from "./character-figure";
import "./character.css";

const TABS = [
  { id: "body", label: "Body" },
  { id: "face", label: "Face" },
  { id: "hair", label: "Hair" },
  { id: "headwear", label: "Hat" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
  { id: "shoes", label: "Shoes" },
  { id: "accessory", label: "Extra" },
  { id: "colors", label: "Colors" },
  { id: "tag", label: "Tag" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function label(value: string) {
  if (value === "tee") return "T-shirt";
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function Aim() {
  const camera = useThree((state) => state.camera);
  useLayoutEffect(() => {
    camera.position.set(1.7, 1.2, 2.55);
    camera.lookAt(0, 0.85, 0);
  }, [camera]);
  return null;
}

function Turntable({
  spinRef,
  draggingRef,
  children,
}: {
  spinRef: RefObject<number>;
  draggingRef: RefObject<boolean>;
  children: ReactNode;
}) {
  const groupRef = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (!draggingRef.current) spinRef.current += dt * 0.45;
    groupRef.current.rotation.y = spinRef.current;
  });
  return <group ref={groupRef}>{children}</group>;
}

function Preview({ config }: { config: CharacterConfig }) {
  const spinRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  return (
    <div
      className="character-stage"
      onPointerDown={(event) => {
        draggingRef.current = true;
        lastXRef.current = event.clientX;
        if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!draggingRef.current) return;
        spinRef.current += (event.clientX - lastXRef.current) * 0.01;
        lastXRef.current = event.clientX;
      }}
      onPointerUp={() => { draggingRef.current = false; }}
      onPointerCancel={() => { draggingRef.current = false; }}
    >
      <Canvas
        camera={{ fov: 32, near: 0.1, far: 20 }}
        dpr={[1, 1.5]}
        gl={{ alpha: false, antialias: true, powerPreference: "default", failIfMajorPerformanceCaveat: false }}
      >
        <color attach="background" args={["#8ec4ea"]} />
        <Aim />
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 5, 2]} intensity={1.15} />
        <Turntable spinRef={spinRef} draggingRef={draggingRef}>
          <group position={[0, -0.15, 0]}>
            <CharacterFigure config={config} />
          </group>
        </Turntable>
      </Canvas>
      <p className="character-stage-note">Drag to turn</p>
    </div>
  );
}

function Choices({
  values,
  selected,
  onPick,
  labelText,
  locked,
}: {
  values: readonly string[];
  selected: string;
  onPick: (value: string) => void;
  labelText: string;
  locked?: Readonly<Record<string, string>>;
}) {
  return (
    <div>
      <p className="character-kicker">{labelText}</p>
      <div className="character-choices" role="group" aria-label={labelText}>
        {values.map((value) => {
          const lock = locked?.[value];
          return (
            <button key={value} type="button" aria-pressed={selected === value} disabled={Boolean(lock)} onClick={() => onPick(value)}>
              {lock ? `${label(value)} · ${lock}` : label(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Swatches({
  selected,
  onPick,
  labelText,
}: {
  selected: string;
  onPick: (value: string) => void;
  labelText: string;
}) {
  return (
    <div>
      <p className="character-kicker">{labelText}</p>
      <div className="character-swatches" role="group" aria-label={labelText}>
        {CHARACTER_SWATCHES.map((color) => (
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
  const [tab, setTab] = useState<TabId>("body");
  const [config, setConfig] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const savingRef = useRef(false);
  const leaveRef = useRef(false);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!savingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function setSlot(name: CharacterSlotName, patch: Partial<CharacterConfig["slots"][CharacterSlotName]>) {
    setConfig((current) => ({
      ...current,
      slots: { ...current.slots, [name]: { ...current.slots[name], ...patch } },
    }));
  }

  async function save() {
    savingRef.current = true;
    setSaving(true);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch(withBasePath(CHARACTER_PATH), {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectKind, subjectId, config }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        leaveRef.current = false;
        setFailed(true);
        setMessage(body?.error || "The character did not save.");
        return;
      }
      if (leaveRef.current) {
        leaveRef.current = false;
        router.push(backHref);
        return;
      }
      setMessage("Saved. Other signed-in people can see this look.");
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

  const slot = (CHARACTER_SLOTS as readonly string[]).includes(tab) ? tab as CharacterSlotName : null;
  const slotChoices = slot ? characterSlotChoices(slot) : [];
  const locked: Record<string, string> = {};
  if (slot) {
    for (const item of SHOP_CLOTHING[slot]) {
      if (!unlocked.includes(item)) {
        const product = GAME_CATALOG.find((row) => row.sku === item);
        locked[item] = product ? formatGameUnits(product.priceCents / 100) : "Locked";
      }
    }
  }

  return (
    <div className="character-studio">
      <Preview config={config} />
      <section className="character-panel" aria-label="Character creator">
        <div className="character-bar">
          <h1>{title}</h1>
          <Link href={backHref} onClick={onBack} aria-disabled={saving}>{saving ? "Saving…" : backLabel}</Link>
        </div>
        <div className="character-tabs" role="tablist" aria-label="Look categories">
          {TABS.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>
          ))}
        </div>
        <div className="character-scroll">
          {tab === "body" ? (
            <>
              <Choices labelText="Shape" values={BODY_SHAPES} selected={config.body.shape} onPick={(shape) => setConfig((current) => ({ ...current, body: { ...current.body, shape: shape as CharacterConfig["body"]["shape"] } }))} />
              <Choices labelText="Size" values={BODY_SIZES} selected={config.body.size} onPick={(size) => setConfig((current) => ({ ...current, body: { ...current.body, size: size as CharacterConfig["body"]["size"] } }))} />
              <Swatches labelText="Skin" selected={config.body.color} onPick={(color) => setConfig((current) => ({ ...current, body: { ...current.body, color } }))} />
            </>
          ) : null}
          {tab === "face" ? (
            <>
              <Choices labelText="Eyes" values={EYE_STYLES} selected={config.face.eyes} onPick={(eyes) => setConfig((current) => ({ ...current, face: { ...current.face, eyes: eyes as CharacterConfig["face"]["eyes"] } }))} />
              <Choices labelText="Mouth" values={MOUTH_STYLES} selected={config.face.mouth} onPick={(mouth) => setConfig((current) => ({ ...current, face: { ...current.face, mouth: mouth as CharacterConfig["face"]["mouth"] } }))} />
              <Choices labelText="Expression" values={EXPRESSIONS} selected={config.face.expression} onPick={(expression) => setConfig((current) => ({ ...current, face: { ...current.face, expression: expression as CharacterConfig["face"]["expression"] } }))} />
            </>
          ) : null}
          {slot ? (
            <>
              <Choices labelText="Style" values={slotChoices} selected={config.slots[slot].item} locked={locked} onPick={(item) => setSlot(slot, { item })} />
              <Swatches labelText="Color" selected={config.slots[slot].color} onPick={(color) => setSlot(slot, { color })} />
            </>
          ) : null}
          {tab === "colors" ? (
            <>
              <Swatches labelText="Primary" selected={config.palette.primary} onPick={(primary) => setConfig((current) => ({ ...current, palette: { ...current.palette, primary } }))} />
              <Swatches labelText="Secondary" selected={config.palette.secondary} onPick={(secondary) => setConfig((current) => ({ ...current, palette: { ...current.palette, secondary } }))} />
              <Swatches labelText="Accent" selected={config.palette.accent} onPick={(accent) => setConfig((current) => ({ ...current, palette: { ...current.palette, accent } }))} />
              <div className="character-actions">
                <button type="button" className="ghost" onClick={() => setConfig((current) => applyPalette(current))}>Apply palette to hair and outfit</button>
              </div>
            </>
          ) : null}
          {tab === "tag" ? (
            <>
              <Choices labelText="Name tag" values={NAME_TAG_STYLES} selected={config.nameTag.style} onPick={(style) => setConfig((current) => ({ ...current, nameTag: { ...current.nameTag, style: style as CharacterConfig["nameTag"]["style"] } }))} />
              <Swatches labelText="Tag color" selected={config.nameTag.color} onPick={(color) => setConfig((current) => ({ ...current, nameTag: { ...current.nameTag, color } }))} />
            </>
          ) : null}
          {message ? <p className={failed ? "character-note error" : "character-note"} role="status">{message}</p> : null}
          <div className="character-actions">
            <button type="button" className="ghost" onClick={() => { setConfig(randomCharacter()); setMessage(""); }}>Randomize</button>
            <button type="button" className="ghost" onClick={() => { setConfig(defaultCharacter(subjectId)); setMessage(""); }}>Reset</button>
            <button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
