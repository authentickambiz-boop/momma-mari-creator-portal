"use client";

import { Component, Suspense, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Color, PerspectiveCamera, type Group, type Light } from "three";
import type { CharacterConfig, CharacterPose, CharacterSlot, CharacterSlotName } from "@/lib/worlds/character";
import { CharacterFigure } from "./character-figure";

export const STUDIO_EMOTES = ["idle", "walk", "wave", "sit"] as const;
export type StudioEmote = (typeof STUDIO_EMOTES)[number];

/** Office interior colors from Lights in office-canvas.tsx. Replace with a shared HUD light rig when that lands. */
const STUDIO_SKY = "#fff7ee";
const STUDIO_GROUND = "#6a5848";
const STUDIO_SUN = "#fff3dd";
const STUDIO_KEY = "#fff1d6";
const STUDIO_LAMP = "#f6e2b8";
const STUDIO_FILL = "#d5e4f4";
const SHEET_GRAY = "#e6e6e6";
const SHEET_CLEAR = new Color(SHEET_GRAY);

const BODY_FOV = 26;
const BODY_LOOK_Y = 1.0;
const BODY_SPAN = 2.42;
const HEAD_FOV = 24;
const HEAD_LOOK_Y = 1.52;
const HEAD_SPAN = 1.2;

const SLOT_ORDER: CharacterSlotName[] = ["hair", "headwear", "top", "bottom", "shoes", "accessory"];

/** Style and fabric names for the wardrobe that humanoid.glb actually draws. */
const GARMENT_DETAIL: Record<string, string> = {
  cap: "Cropped cut",
  bob: "Bob",
  spikes: "Spiked cut",
  bun: "Hair buns",
  long: "Long hair",
  waves: "Waved hair",
  beanie: "Knit beanie",
  bow: "Hair bow",
  headphones: "Headphones",
  crown: "Crown",
  tee: "Jersey tee",
  vest: "Jersey vest",
  collar: "Collared jersey",
  hoodie: "Wool sweater",
  jacket: "Wool coat",
  shorts: "Denim shorts",
  pants: "Wool trousers",
  skirt: "Tiered skirt",
  overalls: "Wool overalls",
  sneakers: "Canvas sneakers",
  boots: "Ankle boots",
  sandals: "Strap sandals",
  heels: "Heeled boots",
  glasses: "Glasses",
  scarf: "Scarf",
  bag: "Bag",
  badge: "Badge",
  watch: "Watch",
};

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

function frameDistance(fov: number, span: number) {
  return (span / 2) / Math.tan((fov * Math.PI) / 360);
}

class PreviewBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function PoseDriver({
  emote,
  poseRef,
}: {
  emote: StudioEmote;
  poseRef: RefObject<CharacterPose | null>;
}) {
  useFrame((_, dt) => {
    const pose = poseRef.current;
    if (!pose) return;
    const speed = emote === "walk" ? 7.5 : emote === "wave" ? 6.5 : 1.4;
    pose.phase += dt * speed;
    pose.moving = emote === "walk";
    pose.seated = emote === "sit";
    pose.wave = emote === "wave";
  });
  return null;
}

function FigureAnchor({
  config,
  poseRef,
  emote,
  layer,
}: {
  config: CharacterConfig;
  poseRef: RefObject<CharacterPose | null>;
  emote: StudioEmote;
  layer: number;
}) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    ref.current?.traverse((node) => {
      node.layers.set(layer);
    });
  });
  return (
    <group ref={ref}>
      <CharacterFigure config={config} poseRef={poseRef} emote={emote} studio />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.04]} frustumCulled={false}>
        <circleGeometry args={[0.46, 32]} />
        <meshBasicMaterial color="#c4c4c4" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

type SheetView = {
  yaw: number;
  fov: number;
  lookY: number;
  span: number;
  before: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

function ConceptCameras({ compare }: { compare: boolean }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const lens = useRef(new PerspectiveCamera(BODY_FOV, 1, 0.05, 40));
  useFrame(() => {
    const width = gl.domElement.width;
    const height = gl.domElement.height;
    if (width < 2 || height < 2) return;
    const camera = lens.current;
    scene.traverse((node) => {
      if ((node as Light).isLight) node.layers.enable(1);
    });
    const col = Math.floor(width / 2);
    const row = Math.floor(height / 2);
    const views: SheetView[] = [
      { yaw: 0, fov: BODY_FOV, lookY: BODY_LOOK_Y, span: BODY_SPAN, before: false, x: 0, y: height - row, width: col, height: row },
      { yaw: Math.PI / 2, fov: BODY_FOV, lookY: BODY_LOOK_Y, span: BODY_SPAN, before: false, x: col, y: height - row, width: width - col, height: row },
      { yaw: Math.PI, fov: BODY_FOV, lookY: BODY_LOOK_Y, span: BODY_SPAN, before: false, x: 0, y: 0, width: col, height: height - row },
      { yaw: -Math.PI / 2, fov: HEAD_FOV, lookY: HEAD_LOOK_Y, span: HEAD_SPAN, before: true, x: col, y: 0, width: width - col, height: height - row },
    ];
    gl.setClearColor(SHEET_CLEAR, 1);
    gl.setScissorTest(true);
    for (const view of views) {
      gl.setViewport(view.x, view.y, view.width, view.height);
      gl.setScissor(view.x, view.y, view.width, view.height);
      const dist = frameDistance(view.fov, view.span);
      camera.fov = view.fov;
      camera.aspect = view.width / Math.max(1, view.height);
      camera.near = 0.05;
      camera.far = 40;
      camera.position.set(Math.sin(view.yaw) * dist, view.lookY + dist * 0.045, Math.cos(view.yaw) * dist);
      camera.lookAt(0, view.lookY, 0);
      camera.layers.set(compare && view.before ? 1 : 0);
      camera.updateProjectionMatrix();
      gl.render(scene, camera);
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, width, height);
    camera.layers.set(0);
  }, 1);
  return null;
}

function stopPointer(event: ReactPointerEvent) {
  event.stopPropagation();
}

function wornSlots(config: CharacterConfig) {
  const rows: { slot: CharacterSlotName; slotLabel: string; item: CharacterSlot }[] = [];
  const labels: Record<CharacterSlotName, string> = {
    hair: "Hair",
    headwear: "Headwear",
    top: "Top",
    bottom: "Bottom",
    shoes: "Shoes",
    accessory: "Accessory",
  };
  for (const slot of SLOT_ORDER) {
    const item = config.slots[slot];
    if (item.item === "none") continue;
    rows.push({ slot, slotLabel: labels[slot], item });
  }
  return rows;
}

/**
 * Concept sheet for the office humanoid. One humanoid.glb and one light rig,
 * drawn four times: front, side, back, and a profile headshot.
 * Compare keeps the current look on the body views and the saved look on the profile.
 */
export function CharacterStage({
  config,
  baseline,
  compare,
  sheetOpen,
  onCompare,
  onHideSheet,
}: {
  config: CharacterConfig;
  baseline: CharacterConfig;
  compare: boolean;
  sheetOpen: boolean;
  onCompare: () => void;
  onHideSheet: () => void;
}) {
  const poseRef = useRef<CharacterPose | null>({ phase: 0, moving: false, seated: false, wave: false });
  const [emote, setEmote] = useState<StudioEmote>("idle");
  const [preview, setPreview] = useState<"ready" | "missing">("ready");
  const build = `${titleCase(config.body.shape)} · ${titleCase(config.body.size)}`;
  const expression = `${titleCase(config.face.expression)} · ${titleCase(config.face.eyes)} eyes · ${titleCase(config.face.mouth)}`;
  const clothes = wornSlots(config);

  return (
    <div className="character-stage">
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
      {preview === "missing" ? (
        <div className="character-stage-fallback" role="alert">
          <p className="character-kicker">Preview unavailable</p>
          <p>This browser could not start the 3D view. Your choices still save, and the office You character uses that saved look.</p>
        </div>
      ) : (
        <div className="character-sheet-view">
          <PreviewBoundary onFail={() => setPreview("missing")}>
            <Canvas
              camera={{ fov: BODY_FOV, near: 0.05, far: 40, position: [0, 1.05, 4.4] }}
              dpr={[1, 2]}
              gl={{ alpha: false, antialias: true, powerPreference: "default", failIfMajorPerformanceCaveat: false }}
              onCreated={({ gl }) => {
                const fail = (event: Event) => {
                  event.preventDefault();
                  setPreview("missing");
                };
                gl.domElement.addEventListener("webglcontextlost", fail);
                gl.toneMappingExposure = 1.2;
                gl.setClearColor(SHEET_CLEAR, 1);
              }}
            >
              <color attach="background" args={[SHEET_GRAY]} />
              <ConceptCameras compare={compare} />
              <PoseDriver emote={emote} poseRef={poseRef} />
              <hemisphereLight args={[STUDIO_SKY, STUDIO_GROUND, 0.95]} />
              <ambientLight intensity={0.45} color={STUDIO_SUN} />
              <directionalLight position={[2.2, 4.4, 3.1]} intensity={1.85} color={STUDIO_KEY} />
              <directionalLight position={[-3.1, 2.1, 2.2]} intensity={0.7} color={STUDIO_FILL} />
              <directionalLight position={[0.6, 2.6, -3.4]} intensity={0.8} color={STUDIO_LAMP} />
              <Suspense fallback={null}>
                <FigureAnchor config={config} poseRef={poseRef} emote={emote} layer={0} />
                {compare ? <FigureAnchor config={baseline} poseRef={poseRef} emote={emote} layer={1} /> : null}
              </Suspense>
            </Canvas>
          </PreviewBoundary>
          {sheetOpen ? (
            <button type="button" className="character-scrim" aria-label="Hide options" onClick={onHideSheet} onPointerDown={stopPointer} />
          ) : null}
          <div className="character-sheet-grid" aria-hidden="true">
            <span>{compare ? "Front · After" : "Front"}</span>
            <span>Side</span>
            <span>Back</span>
            <span>{compare ? "Profile · Before" : "Profile"}</span>
          </div>
        </div>
      )}
      <dl className="character-sheet-legend">
        <div>
          <dt>Archetype</dt>
          <dd>Adult woman · content creator</dd>
        </div>
        <div>
          <dt>Build</dt>
          <dd>{build}</dd>
        </div>
        <div>
          <dt>Expression</dt>
          <dd>{expression}</dd>
        </div>
        {clothes.map((row) => (
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
