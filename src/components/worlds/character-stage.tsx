"use client";

import { Component, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { Group } from "three";
import type { CharacterConfig, CharacterPose } from "@/lib/worlds/character";
import { CharacterFigure } from "./character-figure";

export const STUDIO_EMOTES = ["idle", "walk", "wave", "sit"] as const;
export type StudioEmote = (typeof STUDIO_EMOTES)[number];

type CameraFocus = "body" | "face";

/** Office interior colors from Lights in office-canvas.tsx. Replace with a shared HUD light rig when that lands. */
const STUDIO_SKY = "#fff7ee";
const STUDIO_GROUND = "#6a5848";
const STUDIO_SUN = "#fff3dd";
const STUDIO_KEY = "#fff1d6";
const STUDIO_LAMP = "#f6e2b8";
const STUDIO_FILL = "#d5e4f4";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function emoteLabel(emote: StudioEmote) {
  if (emote === "idle") return "Idle";
  if (emote === "walk") return "Walk";
  if (emote === "wave") return "Wave";
  return "Sit";
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

function OrbitRig({
  yawRef,
  pitchRef,
  distanceRef,
  draggingRef,
  focusRef,
  coverRef,
  compare,
}: {
  yawRef: RefObject<number>;
  pitchRef: RefObject<number>;
  distanceRef: RefObject<number>;
  draggingRef: RefObject<boolean>;
  focusRef: RefObject<CameraFocus>;
  coverRef: RefObject<number>;
  compare: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const height = useThree((state) => state.size.height);
  useFrame((_, dt) => {
    const face = focusRef.current === "face";
    if (!draggingRef.current && !compare && !face) yawRef.current += dt * 0.32;
    const short = height < 460;
    const comparing = compare;
    const cover = coverRef.current;
    let dist = distanceRef.current;
    let focusY = short ? 0.95 : 0.78;
    let pitch = pitchRef.current;
    if (face && !comparing) {
      dist = short ? 2.55 : 2.05;
      focusY = short ? 1.28 : 1.12;
      pitch = 0.08;
    } else if (face && comparing) {
      dist = short ? 3.5 : 2.9;
      focusY = 1.12;
      pitch = 0.08;
    } else {
      dist = Math.max(dist, comparing ? (short ? 7.2 : 5.1) : (short ? 6.1 : 3.7));
    }
    const topBand = cover > 0.02 ? Math.min(0.18, 72 / Math.max(height, 1)) : 0;
    if (cover > 0.05) {
      const band = Math.max(0.36, 1 - cover - topBand);
      dist = Math.min(7.2, dist * Math.min(1.65, 0.78 / band));
    }
    const visibleMid = (topBand + (1 - cover)) / 2;
    const shift = Math.max(0, 0.5 - visibleMid) * 2 * Math.tan((30 * Math.PI) / 360) * dist;
    const lookY = focusY - shift;
    const yaw = yawRef.current;
    const horizontal = Math.cos(pitch) * dist;
    camera.position.set(
      Math.sin(yaw) * horizontal,
      lookY + Math.sin(pitch) * dist * 0.45,
      Math.cos(yaw) * horizontal,
    );
    camera.lookAt(0, lookY, 0);
  });
  return null;
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
  x,
}: {
  config: CharacterConfig;
  poseRef: RefObject<CharacterPose | null>;
  x: number;
}) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const seated = poseRef.current?.seated ?? false;
    group.current.position.set(x, seated ? -0.16 : 0, 0);
  });
  return (
    <group ref={group}>
      <CharacterFigure config={config} poseRef={poseRef} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.04]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#1c211e" transparent opacity={0.16} />
      </mesh>
    </group>
  );
}

function stopPointer(event: ReactPointerEvent) {
  event.stopPropagation();
}

/**
 * Studio turntable for the office chibi. PR #210's GLB is a sphere and
 * cylinder export, not a finished humanoid mesh, so this preview keeps
 * CharacterFigure until a real GLB lands.
 */
export function CharacterStage({
  config,
  baseline,
  compare,
  sheetOpen,
  coverRef,
  onCompare,
  onHideSheet,
}: {
  config: CharacterConfig;
  baseline: CharacterConfig;
  compare: boolean;
  sheetOpen: boolean;
  coverRef: RefObject<number>;
  onCompare: () => void;
  onHideSheet: () => void;
}) {
  const yawRef = useRef(0.5);
  const pitchRef = useRef(0.24);
  const distanceRef = useRef(3.8);
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<number | null>(null);
  const poseRef = useRef<CharacterPose | null>({ phase: 0, moving: false, seated: false, wave: false });
  const focusRef = useRef<CameraFocus>("body");
  const stageRef = useRef<HTMLDivElement>(null);
  const [emote, setEmote] = useState<StudioEmote>("idle");
  const [focus, setFocus] = useState<CameraFocus>("body");
  const [preview, setPreview] = useState<"ready" | "missing">("ready");
  const spread = !compare ? 0 : focus === "face" ? 0.4 : 0.82;

  function showFocus(next: CameraFocus) {
    focusRef.current = next;
    if (next === "face") yawRef.current = 0.55;
    setFocus((current) => (current === next ? current : next));
  }

  useEffect(() => {
    const node = stageRef.current;
    if (!node || preview !== "ready") return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      distanceRef.current = clamp(distanceRef.current + event.deltaY * 0.0032, 2.4, 7.2);
      focusRef.current = "body";
      setFocus("body");
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [preview]);

  function pointSpan() {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return null;
    const first = points[0];
    const second = points[1];
    if (!first || !second) return null;
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      draggingRef.current = true;
      lastRef.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    pinchRef.current = pointSpan();
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const span = pointSpan();
    if (span && pinchRef.current) {
      const ratio = pinchRef.current / span;
      distanceRef.current = clamp(distanceRef.current * ratio, 2.4, 7.2);
      pinchRef.current = span;
      showFocus("body");
      return;
    }
    if (!draggingRef.current) return;
    const dx = event.clientX - lastRef.current.x;
    const dy = event.clientY - lastRef.current.y;
    lastRef.current = { x: event.clientX, y: event.clientY };
    yawRef.current += dx * 0.01;
    pitchRef.current = clamp(pitchRef.current + dy * 0.004, 0.02, 0.85);
    showFocus("body");
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = pointSpan();
    if (pointersRef.current.size === 0) draggingRef.current = false;
  }

  return (
    <div
      className="character-stage"
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
    >
      {preview === "missing" ? (
        <div className="character-stage-fallback" role="alert">
          <p className="character-kicker">Preview unavailable</p>
          <p>This browser could not start the 3D view. Your choices still save, and the office You character uses that saved look.</p>
        </div>
      ) : null}
      {preview === "ready" ? (
        <PreviewBoundary onFail={() => setPreview("missing")}>
          <Canvas
            camera={{ fov: 30, near: 0.05, far: 30, position: [1.4, 1.3, 2.8] }}
            dpr={[1, 1.5]}
            gl={{ alpha: false, antialias: true, powerPreference: "default", failIfMajorPerformanceCaveat: false }}
            onCreated={({ gl }) => {
              const fail = (event: Event) => {
                event.preventDefault();
                setPreview("missing");
              };
              gl.domElement.addEventListener("webglcontextlost", fail);
            }}
          >
            <color attach="background" args={["#d9d3cb"]} />
            <OrbitRig
              yawRef={yawRef}
              pitchRef={pitchRef}
              distanceRef={distanceRef}
              draggingRef={draggingRef}
              focusRef={focusRef}
              coverRef={coverRef}
              compare={compare}
            />
            <PoseDriver emote={emote} poseRef={poseRef} />
            <hemisphereLight args={[STUDIO_SKY, STUDIO_GROUND, 0.72]} />
            <ambientLight intensity={0.28} color={STUDIO_SUN} />
            <directionalLight position={[2.2, 4.4, 3.1]} intensity={1.35} color={STUDIO_KEY} />
            <directionalLight position={[-3.1, 2.1, 2.2]} intensity={0.42} color={STUDIO_FILL} />
            <directionalLight position={[0.6, 2.6, -3.4]} intensity={0.55} color={STUDIO_LAMP} />
            <mesh position={[0, 1.15, -1.7]}>
              <planeGeometry args={[8, 5]} />
              <meshStandardMaterial color="#e4ddd3" roughness={1} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
              <circleGeometry args={[1.7, 48]} />
              <meshStandardMaterial color="#cfc6ba" roughness={0.92} />
            </mesh>
            {compare ? <FigureAnchor config={baseline} poseRef={poseRef} x={-spread} /> : null}
            <FigureAnchor config={config} poseRef={poseRef} x={compare ? spread : 0} />
          </Canvas>
        </PreviewBoundary>
      ) : null}
      {preview === "ready" && sheetOpen ? (
        <button type="button" className="character-scrim" aria-label="Hide options" onClick={onHideSheet} onPointerDown={stopPointer} />
      ) : null}
      {preview === "ready" ? (
        <>
          <div className="character-emotes" role="group" aria-label="Emotes" onPointerDown={stopPointer}>
            {STUDIO_EMOTES.map((item) => (
              <button key={item} type="button" aria-pressed={emote === item} onClick={() => setEmote(item)}>
                {emoteLabel(item)}
              </button>
            ))}
          </div>
          <div className="character-stage-tools" role="group" aria-label="Camera" onPointerDown={stopPointer}>
            <button type="button" aria-pressed={focus === "body"} onClick={() => showFocus("body")}>Body</button>
            <button type="button" aria-pressed={focus === "face"} onClick={() => showFocus("face")}>Face</button>
            <button type="button" aria-pressed={compare} onClick={onCompare}>Compare</button>
          </div>
          {compare ? (
            <div className="character-compare-labels">
              <span>Before</span>
              <span>After</span>
            </div>
          ) : null}
          <p className="character-stage-note">Drag to orbit. Scroll or pinch to zoom.</p>
        </>
      ) : null}
    </div>
  );
}
