"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Texture,
} from "three";
import type { HomeTier } from "@/lib/worlds/economy";
import type { BuildingModel, Plot } from "@/lib/worlds/city/locations";
import { interiorLayout, type InteriorBox } from "@/lib/worlds/city/interiors";
import { HOUSE_ROW_GAP, ROW_ROOF_OVERHANG_X, ROW_ROOF_OVERHANG_Z, STUDIO_ROW_GAP, gableSlabs, shedSlab } from "@/lib/worlds/city/roofs";
import { locationById } from "@/lib/worlds/city/locations";

const scratch = new Vector3();
const finishCache = new Map<string, Texture>();

type Finish = "brick" | "wood" | "metal" | "stone" | "plaster" | "shingle" | "glass" | "paint";

function shade(hex: string, amount: number) {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return hex;
  const channel = (shift: number) => Math.min(255, Math.max(0, ((num >> shift) & 255) + amount));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function drawFinish(ctx: CanvasRenderingContext2D, finish: Finish, color: string) {
  ctx.fillStyle = shade(color, 18);
  ctx.fillRect(0, 0, 128, 128);
  if (finish === "brick") {
    const bw = 40;
    const bh = 18;
    ctx.fillStyle = "#c9bfb2";
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += bh) {
      const row = Math.floor(y / bh);
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < 300; x += bw) {
        const n = (row * 5 + Math.floor((x + 80) / bw)) % 7;
        const shift = n * 5 - 16;
        ctx.fillStyle = n === 0 ? shade(color, -36) : shade(color, shift);
        ctx.fillRect(x + offset + 1, y + 1, bw - 4, bh - 4);
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(x + offset + 2, y + 2, bw - 10, 2);
        ctx.fillStyle = "rgba(40, 16, 8, 0.18)";
        ctx.fillRect(x + offset + 1, y + bh - 5, bw - 4, 1);
      }
    }
    return;
  }
  if (finish === "wood") {
    for (let y = 0; y < 128; y += 10) {
      ctx.fillStyle = y % 20 ? shade(color, -28) : shade(color, 8);
      ctx.fillRect(0, y, 128, 8);
      ctx.fillStyle = "rgba(40, 24, 12, 0.18)";
      ctx.fillRect(0, y + 7, 128, 1);
    }
    ctx.fillStyle = shade(color, -40);
    for (let i = 0; i < 5; i += 1) {
      const x = 18 + i * 22;
      const y = 16 + (i % 3) * 28;
      ctx.beginPath();
      ctx.ellipse(x, y, 4, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (finish === "metal") {
    ctx.fillStyle = shade(color, -20);
    ctx.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 8) {
      ctx.fillStyle = x % 16 ? shade(color, 24) : shade(color, -8);
      ctx.fillRect(x, 0, 3, 128);
    }
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(0, 18, 128, 10);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(0, 96, 128, 8);
    return;
  }
  if (finish === "stone") {
    const bw = 34;
    const bh = 22;
    ctx.fillStyle = "#9a9186";
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += bh) {
      const row = Math.floor(y / bh);
      const offset = row % 2 ? 14 : 0;
      for (let x = -bw; x < 280; x += bw) {
        const n = (row + Math.floor(x / bw)) % 4;
        ctx.fillStyle = shade(color, n === 0 ? -22 : n * 8 - 8);
        ctx.fillRect(x + offset + 1, y + 1, bw - 5, bh - 5);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x + offset + 2, y + 2, 8, 3);
      }
    }
    return;
  }
  if (finish === "shingle") {
    const bw = 22;
    const bh = 12;
    ctx.fillStyle = shade(color, -12);
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += bh) {
      const row = Math.floor(y / bh);
      const offset = row % 2 ? bw / 2 : 0;
      ctx.strokeStyle = shade(color, -30);
      ctx.lineWidth = 1;
      for (let x = -bw; x < 280; x += bw) {
        ctx.fillStyle = row % 3 ? shade(color, 6) : shade(color, -8);
        ctx.fillRect(x + offset, y, bw - 2, bh - 2);
      }
    }
    return;
  }
  ctx.fillStyle = shade(color, -24);
  for (let y = 0; y < 128; y += 8) {
    ctx.fillRect(0, y + 5, 128, 3);
  }
}

function finishMap(finish: Finish, color: string) {
  if (finish === "plaster" || finish === "paint" || finish === "glass") return null;
  const key = `${finish}:${color}`;
  const hit = finishCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = finish === "brick" || finish === "stone" || finish === "shingle" ? 256 : 128;
  canvas.height = canvas.width;
  const ctx = canvas.getContext("2d");
  if (ctx) drawFinish(ctx, finish, color);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(finish === "shingle" ? 2 : 2.4, 2);
  finishCache.set(key, texture);
  return texture;
}

let sharedBrick: Texture | null = null;

function brickTexture() {
  if (sharedBrick) return sharedBrick;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const bw = 56;
    const bh = 24;
    for (let y = 0; y < canvas.height; y += bh) {
      const row = Math.floor(y / bh);
      const offset = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < canvas.width + bw; x += bw) {
        ctx.fillStyle = (row + x / bw) % 2 ? "#b56a52" : "#c4846a";
        ctx.fillRect(x + offset, y, bw - 3, bh - 3);
      }
      ctx.fillStyle = "#d9d0c4";
      ctx.fillRect(0, y + bh - 3, canvas.width, 3);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2.4, 1.6);
  sharedBrick = texture;
  return texture;
}

function useLod(quality: "fine" | "fast", detailed: boolean) {
  const ref = useRef<Group>(null);
  const [lod, setLod] = useState(1);
  useFrame(({ camera }) => {
    const node = ref.current;
    if (!node) return;
    const dist = camera.position.distanceTo(node.getWorldPosition(scratch));
    const next = !detailed || quality === "fast"
      ? (dist > 165 ? 2 : 1)
      : (dist > 210 ? 2 : dist > 86 ? 1 : 0);
    setLod((current) => (current === next ? current : next));
  });
  return { ref, lod };
}

function signTexture(label: string, fill = "#1c211e") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = "#fbf8f3";
    const size = label.length > 14 ? 40 : label.length > 10 ? 52 : 64;
    ctx.font = `700 ${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 256, 84);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const APARTMENT_STORY = 1.86;

function buildingHeight(model: BuildingModel, floors: number, tier: HomeTier) {
  if (model === "hq") return 3.2;
  if (model === "studio") return 2.7;
  if (model === "apartment") return Math.max(3, floors) * APARTMENT_STORY + 0.35;
  if (model === "houses") return 3.6;
  if (model === "loft") return 4.4;
  if (model === "mansion") return 6.2;
  if (model === "home") {
    if (tier === "studio") return 2.9;
    if (tier === "apartment") return 4.5;
    if (tier === "house") return 4.7;
    if (tier === "creator-loft") return 5;
    return 6.5;
  }
  if (model === "call-center") return 5.8;
  if (model === "bank") return 5.1;
  if (model === "library") return 4.7;
  if (model === "lab") return 4.3;
  if (model === "learning") return 3.5;
  if (model === "computers") return 4.1;
  if (model === "music") return 3.7;
  return 3.35;
}

type Vec = [number, number, number];

function ToonBox({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  args,
  color,
  cast = false,
  finish = "plaster",
}: {
  position?: Vec;
  rotation?: Vec;
  args: Vec;
  color: string;
  outline?: boolean;
  cast?: boolean;
  finish?: Finish;
}) {
  const map = finishMap(finish, color);
  return (
    <mesh position={position} rotation={rotation} castShadow={cast} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        map={map ?? undefined}
        color={map ? "#ffffff" : color}
        roughness={finish === "metal" ? 0.28 : finish === "glass" ? 0.04 : finish === "brick" ? 0.74 : 0.82}
        metalness={finish === "metal" ? 0.74 : finish === "glass" ? 0.78 : 0.03}
        envMapIntensity={finish === "glass" ? 1.4 : finish === "metal" ? 0.55 : 0.18}
        emissive={finish === "glass" ? "#b7d4e6" : "#000000"}
        emissiveIntensity={finish === "glass" ? 0.06 : 0}
      />
    </mesh>
  );
}

function ToonCylinder({ position, args, color, rotation }: { position: Vec; args: [number, number, number, number?]; color: string; rotation?: Vec }) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.62} metalness={0.08} />
    </mesh>
  );
}

function ToonSphere({ position, radius, color }: { position: Vec; radius: number; color: string }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[radius, 12, 10]} />
      <meshStandardMaterial color={color} roughness={0.74} />
    </mesh>
  );
}

function southFace(yaw: number): "pz" | "nz" | "px" | "nx" {
  const faces: { id: "pz" | "nz" | "px" | "nx"; z: number }[] = [
    { id: "pz", z: Math.cos(yaw) },
    { id: "nz", z: -Math.cos(yaw) },
    { id: "px", z: Math.sin(yaw) },
    { id: "nx", z: -Math.sin(yaw) },
  ];
  return faces.reduce((best, face) => (face.z > best.z ? face : best)).id;
}

function DoorWall({
  w,
  h,
  d,
  color,
  openDoor,
  outline,
}: {
  w: number;
  h: number;
  d: number;
  color: string;
  openDoor: boolean;
  outline: boolean;
}) {
  const doorW = Math.min(1.2, w * 0.28);
  const side = Math.max(0.4, (w - doorW) / 2);
  const z = d / 2;
  return (
    <group>
      <ToonBox position={[-w / 2 + side / 2, h / 2, z]} args={[side, h, 0.2]} color={color} outline={outline} cast />
      <ToonBox position={[w / 2 - side / 2, h / 2, z]} args={[side, h, 0.2]} color={color} outline={outline} cast />
      <ToonBox position={[0, h - 0.22, z]} args={[doorW, 0.44, 0.2]} color={color} cast />
      {openDoor ? null : <ToonBox position={[0, 0.72, z + 0.08]} args={[doorW * 0.82, 1.28, 0.08]} color="#3a2a22" />}
    </group>
  );
}

function Envelope({
  w,
  h,
  d,
  color,
  yaw,
  open,
  outline,
  floor = "#d7c4a3",
  finish = "brick",
}: {
  w: number;
  h: number;
  d: number;
  color: string;
  yaw: number;
  open: boolean;
  outline: boolean;
  floor?: string;
  finish?: Finish;
}) {
  const skip = open ? southFace(yaw) : null;
  return (
    <group>
      <ToonBox position={[0, 0.05, 0]} args={[Math.max(0.4, w - 0.28), 0.1, Math.max(0.4, d - 0.28)]} color={floor} finish="wood" />
      {skip === "nz" ? null : <ToonBox position={[0, h / 2, -d / 2]} args={[w, h, 0.2]} color={color} outline={outline} finish={finish} cast />}
      {skip === "px" ? null : <ToonBox position={[w / 2, h / 2, 0]} args={[0.2, h, d]} color={color} outline={outline} finish={finish} cast />}
      {skip === "nx" ? null : <ToonBox position={[-w / 2, h / 2, 0]} args={[0.2, h, d]} color={color} outline={outline} finish={finish} cast />}
      {skip === "pz" ? (
        <DoorWall w={w} h={h} d={d} color={color} openDoor outline={false} />
      ) : (
        <DoorWall w={w} h={h} d={d} color={color} openDoor={open && southFace(yaw) === "pz"} outline={outline} />
      )}
      <ToonBox position={[0, 0.18, 0]} args={[w + 0.16, 0.12, d + 0.16]} color="#f4efe4" finish="paint" />
      <ToonBox position={[0, h - 0.08, 0]} args={[Math.max(0.4, w - 0.08), 0.14, Math.max(0.4, d - 0.08)]} color="#f7f1e4" finish="paint" />
      <ToonBox position={[0, h * 0.58, d / 2 + 0.02]} args={[w + 0.08, 0.14, 0.1]} color="#f7f1e4" finish="paint" />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <ToonBox key={`${sx}-${sz}`} position={[(w / 2) * sx, h / 2, (d / 2) * sz]} args={[0.16, h, 0.16]} color="#f4efe4" finish="paint" />
      ))}
    </group>
  );
}

function Windows({ w, h, d, rows, cols }: { w: number; h: number; d: number; rows: number; cols: number }) {
  const panes: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = -w / 2 + ((col + 0.5) * w) / cols;
      const y = 0.85 + ((row + 0.35) * Math.max(0.8, h - 1.3)) / rows;
      if (Math.abs(x) < 0.7 && y < 1.65) continue;
      panes.push({ x, y });
    }
  }
  return (
    <group>
      {panes.map((pane) => (
        <group key={`${pane.x.toFixed(2)}-${pane.y.toFixed(2)}`} position={[pane.x, pane.y, d / 2 + 0.16]}>
          <mesh>
            <boxGeometry args={[0.56, 0.7, 0.06]} />
            <meshStandardMaterial color="#2a2e33" metalness={0.62} roughness={0.32} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[0.42, 0.56]} />
            <meshStandardMaterial color="#d7eef6" roughness={0.05} metalness={0.45} transparent opacity={0.42} side={DoubleSide} envMapIntensity={1.2} emissive="#c5dce8" emissiveIntensity={0.08} depthWrite={false} />
          </mesh>
          <mesh position={[0.08, 0.1, 0.055]}>
            <planeGeometry args={[0.08, 0.28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.62} />
          </mesh>
          <mesh position={[-0.1, -0.12, 0.056]} rotation={[0, 0, 0.7]}>
            <planeGeometry args={[0.05, 0.22]} />
            <meshBasicMaterial color="#f7fbff" transparent opacity={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.03, 0.56, 0.02]} />
            <meshStandardMaterial color="#1c211e" metalness={0.4} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Sign({ label, y, z, fill, wide = 3.1 }: { label: string; y: number; z: number; fill?: string; wide?: number }) {
  const map = useMemo(() => signTexture(label, fill), [label, fill]);
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[Math.min(wide, label.length * 0.22 + 1.4), 0.62]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

function PorchLamp({ w, d }: { w: number; d: number }) {
  return (
    <group position={[w * 0.28, 0, d / 2 + 0.35]}>
      <ToonCylinder position={[0, 1.15, 0]} args={[0.05, 0.07, 2.3, 6]} color="#2a2926" />
      <ToonSphere position={[0, 2.35, 0]} radius={0.16} color="#f6e2a8" />
    </group>
  );
}

function YardTree({ w, d, canopy }: { w: number; d: number; canopy: string }) {
  return (
    <group position={[-w / 2 - 1.15, 0, d * 0.15]}>
      <ToonCylinder position={[0, 0.7, 0]} args={[0.12, 0.16, 1.4, 6]} color="#6b4a32" />
      <ToonSphere position={[0, 1.7, 0]} radius={0.62} color={canopy} />
    </group>
  );
}

export function Gable({
  w,
  h,
  d,
  color,
  overhangX = 0.16,
  overhangZ = 0.26,
  pitch = 0.42,
  ends = true,
  endColor = "#efe6d6",
}: {
  w: number;
  h: number;
  d: number;
  color: string;
  overhangX?: number;
  overhangZ?: number;
  pitch?: number;
  ends?: boolean;
  endColor?: string;
}) {
  const pose = gableSlabs(w, h, pitch, overhangX);
  const depth = d + overhangZ * 2;
  const shape = useMemo(() => {
    const next = new Shape();
    const rise = (w / 2) * Math.tan(pitch);
    next.moveTo(-w / 2, 0);
    next.lineTo(w / 2, 0);
    next.lineTo(0, rise);
    next.closePath();
    return next;
  }, [w, pitch]);
  return (
    <group>
      {pose.slabs.map((slab) => (
        <ToonBox
          key={slab.rotZ}
          position={[slab.x, slab.y, slab.z]}
          rotation={[0, 0, slab.rotZ]}
          args={[slab.length, slab.thickness, depth]}
          color={color}
          finish="shingle"
          cast
        />
      ))}
      <ToonBox position={[0, pose.ridge + 0.05, 0]} args={[0.18, 0.07, Math.max(0.4, d - 0.2)]} color={color} finish="shingle" cast />
      {ends ? [-1, 1].map((side) => (
        <mesh key={side} position={[0, h + 0.02, side * (d / 2 - 0.02)]} castShadow>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial color={endColor} roughness={0.86} side={DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      )) : null}
    </group>
  );
}

function ShedRoof({
  w,
  h,
  d,
  color,
  finish = "glass",
  pitch = 0.32,
}: {
  w: number;
  h: number;
  d: number;
  color: string;
  finish?: Finish;
  pitch?: number;
}) {
  const slab = shedSlab(d, h, pitch, 0.22);
  return (
    <ToonBox
      position={[slab.x, slab.y, slab.z]}
      rotation={[slab.rotX, 0, 0]}
      args={[w + 0.24, slab.thickness, slab.length]}
      color={color}
      finish={finish}
      cast
    />
  );
}

function Pediment({ w, h, color }: { w: number; h: number; color: string }) {
  return (
    <group position={[0, h + 0.05, 0]}>
      <ToonBox position={[-w * 0.14, 0.42, 0]} rotation={[0, 0, 0.55]} args={[w * 0.4, 0.14, 1.1]} color={color} cast />
      <ToonBox position={[w * 0.14, 0.42, 0]} rotation={[0, 0, -0.55]} args={[w * 0.4, 0.14, 1.1]} color={color} cast />
    </group>
  );
}

function Columns({ w, h, d, color }: { w: number; h: number; d: number; color: string }) {
  const posts = [-w * 0.34, -w * 0.12, w * 0.12, w * 0.34];
  return (
    <group>
      {posts.map((x) => (
        <ToonCylinder key={x} position={[x, h * 0.42, d / 2 + 0.45]} args={[0.16, 0.2, h * 0.84, 8]} color={color} />
      ))}
    </group>
  );
}

function StoryBox({
  w,
  h,
  d,
  color,
  door,
}: {
  w: number;
  h: number;
  d: number;
  color: string;
  door: boolean;
}) {
  return (
    <group>
      <ToonBox position={[0, h / 2, -d / 2]} args={[w, h, 0.22]} color={color} finish="brick" cast />
      <ToonBox position={[w / 2, h / 2, 0]} args={[0.22, h, d]} color={color} finish="brick" cast />
      <ToonBox position={[-w / 2, h / 2, 0]} args={[0.22, h, d]} color={color} finish="brick" cast />
      {door ? (
        <DoorWall w={w} h={h} d={d} color={color} openDoor={false} outline={false} />
      ) : (
        <ToonBox position={[0, h / 2, d / 2]} args={[w, h, 0.22]} color={color} finish="brick" cast />
      )}
      <ToonBox position={[0, 0.1, 0]} args={[w + 0.28, 0.18, d + 0.28]} color="#cfc8bb" finish="stone" />
      <ToonBox position={[0, h - 0.06, 0]} args={[Math.max(0.4, w - 0.06), 0.12, Math.max(0.4, d - 0.06)]} color="#f7f1e4" finish="paint" />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <ToonBox key={`${sx}-${sz}`} position={[(w / 2) * sx, h / 2, (d / 2) * sz]} args={[0.18, h, 0.18]} color="#f4efe4" finish="paint" />
      ))}
    </group>
  );
}

function RisingStory({
  grow,
  children,
}: {
  grow: boolean;
  children: ReactNode;
}) {
  const ref = useRef<Group>(null);
  const rise = useRef(grow ? 0.08 : 1);
  useLayoutEffect(() => {
    if (ref.current) ref.current.scale.y = grow ? 0.08 : 1;
  }, [grow]);
  useFrame((_, delta) => {
    const node = ref.current;
    if (!node || !grow || rise.current >= 1) return;
    rise.current = Math.min(1, rise.current + delta * 1.2);
    node.scale.y = rise.current;
  });
  return <group ref={ref}>{children}</group>;
}

function FlatRoof({ w, h, d, color, finish = "shingle" }: { w: number; h: number; d: number; color: string; finish?: Finish }) {
  const thickness = 0.2;
  const seat = h + 0.18;
  return (
    <group>
      <ToonBox position={[0, seat + thickness / 2, 0]} args={[w + 0.36, thickness, d + 0.36]} color={color} finish={finish} cast />
    </group>
  );
}

function LearningRoom({ w, d }: { w: number; d: number }) {
  const desks = [-w * 0.24, 0, w * 0.24];
  const badges = ["#f2c14e", "#8ec4ea", "#e07a5f", "#9dff6a"];
  return (
    <group>
      {desks.map((x) => (
        <group key={x} position={[x, 0, 0.15]}>
          <ToonBox position={[0, 0.46, 0]} args={[1.15, 0.08, 0.62]} color="#f7f1e4" />
          <ToonBox position={[-0.45, 0.24, -0.22]} args={[0.08, 0.42, 0.08]} color="#6b4a32" />
          <ToonBox position={[0.45, 0.24, -0.22]} args={[0.08, 0.42, 0.08]} color="#6b4a32" />
          <ToonBox position={[0, 0.78, -0.02]} args={[0.5, 0.32, 0.04]} color="#8ec4ea" />
          <ToonBox position={[0.28, 0.22, 0.42]} args={[0.32, 0.36, 0.32]} color="#6b4c7a" />
        </group>
      ))}
      <ToonBox position={[0, 1.35, -d / 2 + 0.28]} args={[Math.min(w * 0.72, 4.2), 1.15, 0.08]} color="#1f3b2d" />
      {badges.map((color, index) => (
        <ToonBox key={color} position={[-1.15 + index * 0.76, 1.4, -d / 2 + 0.38]} args={[0.4, 0.4, 0.06]} color={color} />
      ))}
      <ToonBox position={[w * 0.28, 0.55, -d * 0.22]} args={[0.7, 1.05, 0.7]} color="#efe6d6" />
    </group>
  );
}

function LibraryRoom({ w, d }: { w: number; d: number }) {
  const stacks = [-w * 0.28, -w * 0.1, w * 0.1];
  return (
    <group>
      {stacks.map((x) => (
        <group key={x} position={[x, 0, -d * 0.22]}>
          <ToonBox position={[0, 0.7, 0]} args={[0.55, 1.35, 1.4]} color="#8d5524" finish="wood" />
          <ToonBox position={[0, 1.15, 0.72]} args={[0.42, 0.28, 0.06]} color="#f2c14e" finish="paint" />
        </group>
      ))}
      <ToonBox position={[w * 0.22, 0.42, d * 0.08]} args={[1.3, 0.08, 0.7]} color="#f7f1e4" finish="wood" />
      <ToonBox position={[w * 0.22, 0.72, d * 0.08]} args={[0.16, 0.5, 0.16]} color="#6b4a32" finish="wood" />
      <ToonSphere position={[w * 0.22, 1.05, d * 0.08]} radius={0.14} color="#f6e2a8" />
    </group>
  );
}

function CallRoom({ w, d }: { w: number; d: number }) {
  const booths = [-w * 0.26, 0, w * 0.26];
  return (
    <group>
      {booths.map((x) => (
        <group key={x} position={[x, 0, -0.15]}>
          <ToonBox position={[0, 0.46, 0]} args={[1.05, 0.08, 0.62]} color="#d7e7f2" finish="paint" />
          <ToonBox position={[0, 0.22, -0.22]} args={[0.08, 0.4, 0.08]} color="#2a2e33" finish="metal" />
          <ToonBox position={[0, 0.78, -0.04]} args={[0.62, 0.38, 0.05]} color="#8ec4ea" finish="glass" />
          <ToonBox position={[0.38, 0.62, 0.12]} args={[0.1, 0.22, 0.1]} color="#243044" finish="metal" />
        </group>
      ))}
      <ToonBox position={[0, 1.45, -d / 2 + 0.28]} args={[Math.min(w * 0.7, 4.2), 0.95, 0.08]} color="#1f3b2d" finish="paint" />
      <ToonBox position={[w * 0.32, 0.4, d * 0.18]} args={[0.42, 0.5, 0.42]} color="#6b4a32" finish="wood" />
    </group>
  );
}

function ArtRoom({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <ToonBox position={[-w * 0.22, 0.7, -0.1]} args={[0.08, 1.35, 0.08]} color="#6b3a28" finish="wood" />
      <ToonBox position={[-w * 0.22 + 0.22, 1.2, -0.1]} args={[0.72, 0.9, 0.06]} color="#f2b4c4" finish="paint" />
      <ToonBox position={[w * 0.16, 0.46, 0.15]} args={[1.35, 0.08, 0.72]} color="#f7f1e4" finish="wood" />
      <ToonBox position={[w * 0.16, 0.22, -0.12]} args={[0.08, 0.4, 0.08]} color="#6b4a32" finish="wood" />
      {[-0.85, 0, 0.85].map((x, index) => (
        <ToonBox key={x} position={[x, 1.4, -d / 2 + 0.28]} args={[0.55, 0.42, 0.05]} color={["#e07a5f", "#f2c14e", "#8ec4ea"][index] ?? "#f2c14e"} finish="paint" />
      ))}
    </group>
  );
}

function InnerGlass({ x, y, z, wide = 0.7, tall = 0.8, rotY = 0 }: { x: number; y: number; z: number; wide?: number; tall?: number; rotY?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[wide + 0.1, tall + 0.1, 0.05]} />
        <meshStandardMaterial color="#2a2e33" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[wide, tall]} />
        <meshStandardMaterial color="#d7eef6" roughness={0.05} metalness={0.35} transparent opacity={0.45} side={DoubleSide} emissive="#d5eaf2" emissiveIntensity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}

function InteriorPiece({ piece }: { piece: InteriorBox }) {
  if (piece.marker) {
    return (
      <group name="interior-objective" position={[piece.x, 0, piece.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
          <ringGeometry args={[0.16, 0.3, 22]} />
          <meshBasicMaterial color={piece.color} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 0.78, 8]} />
          <meshStandardMaterial color={piece.color} emissive={piece.color} emissiveIntensity={0.4} />
        </mesh>
      </group>
    );
  }
  if (piece.unlit) {
    return (
      <mesh position={[piece.x, piece.y, piece.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[piece.w, piece.d]} />
        <meshBasicMaterial color={piece.color} />
      </mesh>
    );
  }
  if (piece.glass) {
    const side = piece.w < piece.d;
    return (
      <InnerGlass
        x={piece.x}
        y={piece.y}
        z={piece.z}
        wide={side ? piece.d : piece.w}
        tall={piece.h}
        rotY={side ? Math.PI / 2 : 0}
      />
    );
  }
  return (
    <ToonBox
      position={[piece.x, piece.y, piece.z]}
      args={[piece.w, piece.h, piece.d]}
      color={piece.color}
      finish={piece.finish}
    />
  );
}

function CityInterior({
  model,
  w,
  d,
}: {
  model: BuildingModel;
  w: number;
  d: number;
  tier: HomeTier;
}) {
  const pieces = useMemo(() => interiorLayout(model, w, d), [model, w, d]);
  return (
    <group name="city-interior">
      {pieces.map((piece) => <InteriorPiece key={piece.id} piece={piece} />)}
      <pointLight position={[0, 1.85, 0]} intensity={1.45} distance={14} decay={2} color="#fff1d6" />
    </group>
  );
}


function HomeRoom({ w, d, tier }: { w: number; d: number; tier: HomeTier }) {
  const cook = tier !== "studio";
  const host = tier === "house" || tier === "creator-loft" || tier === "mansion";
  const idea = tier === "creator-loft" || tier === "mansion";
  const gallery = tier === "mansion";
  return (
    <group>
      <ToonBox position={[-w * 0.22, 0.28, -d * 0.16]} args={[1.15, 0.32, 1.7]} color="#f4efe4" />
      <ToonBox position={[-w * 0.22, 0.52, -d * 0.16 - 0.7]} args={[1.15, 0.28, 0.12]} color="#f7f1e4" />
      <ToonBox position={[w * 0.2, 0.46, d * 0.12]} args={[1.05, 0.08, 0.55]} color="#c4a574" />
      <ToonBox position={[w * 0.2, 0.72, d * 0.12]} args={[0.42, 0.28, 0.04]} color="#d7e7f2" />
      {cook ? <ToonBox position={[w * 0.22, 0.5, -d * 0.28]} args={[1.2, 0.7, 0.45]} color="#efe6d6" /> : null}
      {cook ? <ToonBox position={[-w * 0.05, 0.32, d * 0.22]} args={[1.1, 0.4, 0.55]} color="#6b4c7a" /> : null}
      {host ? <ToonBox position={[0, 0.42, 0.2]} args={[1.2, 0.08, 0.7]} color="#8d5524" /> : null}
      {idea ? <ToonBox position={[0, 1.35, -d / 2 + 0.28]} args={[1.1, 0.8, 0.06]} color="#f7f1e4" /> : null}
      {gallery ? (
        <group>
          {[-0.7, 0, 0.7].map((x, index) => (
            <ToonBox key={x} position={[x, 1.5, -d / 2 + 0.3]} args={[0.42, 0.5, 0.05]} color={["#e07a5f", "#f2c14e", "#8ec4ea"][index] ?? "#f2c14e"} />
          ))}
        </group>
      ) : null}
    </group>
  );
}

function Extras({
  model,
  tier,
  w,
  h,
  d,
  roof,
  accent,
  open,
  close,
}: {
  model: BuildingModel;
  tier: HomeTier;
  w: number;
  h: number;
  d: number;
  roof: string;
  accent: string;
  open: boolean;
  close: boolean;
}) {
  void open;
  if (model === "lab") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonCylinder position={[-w * 0.22, h + 0.7, -0.2]} args={[0.38, 0.42, 1.15, 10]} color="#d9d3c8" />
        <ToonCylinder position={[w * 0.18, h + 0.5, 0.3]} args={[0.24, 0.28, 0.8, 8]} color={accent} />
        <ToonBox position={[0, h + 0.85, 0]} args={[w * 0.42, 0.1, 0.12]} color="#c5ccd1" />
        {close ? <ToonBox position={[w * 0.3, 0.45, d / 2 + 0.4]} args={[0.35, 0.7, 0.35]} color="#8ec4ea" /> : null}
      </group>
    );
  }
  if (model === "library") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <Pediment w={w * 0.7} h={h} color={roof} />
        <Columns w={w * 0.8} h={h * 0.72} d={d} color="#f7f1e4" />
        <ToonBox position={[0, 0.18, d / 2 + 0.7]} args={[w * 0.55, 0.28, 0.8]} color="#d9d3c8" />
      </group>
    );
  }
  if (model === "learning") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonBox position={[0, h * 0.72, d / 2 + 0.7]} args={[w * 0.55, 0.1, 1.1]} color={accent} />
        <ToonCylinder position={[w * 0.42, h + 0.9, -d * 0.2]} args={[0.05, 0.06, 1.8, 6]} color="#1c211e" />
        <ToonBox position={[w * 0.42 + 0.28, h + 1.55, -d * 0.2]} args={[0.55, 0.32, 0.06]} color={accent} />
      </group>
    );
  }
  if (model === "call-center") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonCylinder position={[0, h + 1.35, 0]} args={[0.06, 0.08, 2.4, 6]} color="#1c211e" />
        <ToonBox position={[0.45, h + 2.15, 0]} args={[0.9, 0.08, 0.08]} color="#1c211e" />
        <mesh position={[0.7, h + 1.55, 0.2]} rotation={[0.4, 0, 0.6]}>
          <cylinderGeometry args={[0.28, 0.28, 0.08, 12]} />
          <meshStandardMaterial color={accent} metalness={0.45} roughness={0.28} />
        </mesh>
        {close ? <ToonBox position={[0, 1.15, d / 2 + 0.2]} args={[1.4, 0.7, 0.08]} color="#122033" /> : null}
      </group>
    );
  }
  if (model === "art") {
    return (
      <group>
        <ShedRoof w={w} h={h} d={d} color="#d7e7f2" finish="glass" pitch={0.2} />
        <ToonBox position={[0, h * 0.55, d / 2 + 0.14]} args={[w * 0.55, 0.16, 0.06]} color={accent} />
        {close ? (
          <group position={[w * 0.36, 0, d / 2 + 0.7]}>
            <ToonBox position={[0, 0.7, 0]} args={[0.08, 1.3, 0.08]} color="#6b3a28" />
            <ToonBox position={[0.15, 1.15, 0]} args={[0.45, 0.55, 0.05]} color="#f2b4c4" />
          </group>
        ) : null}
      </group>
    );
  }
  if (model === "music") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonSphere position={[0, h + 0.7, 0]} radius={0.55} color={accent} />
        <ToonBox position={[-w * 0.22, h * 0.62, d / 2 + 0.16]} args={[0.12, 0.7, 0.2]} color="#1c211e" />
        <ToonBox position={[w * 0.22, h * 0.5, d / 2 + 0.16]} args={[0.12, 0.45, 0.2]} color="#1c211e" />
        {close ? <ToonBox position={[w * 0.32, 0.35, d / 2 + 0.55]} args={[0.55, 0.4, 0.35]} color="#1c211e" /> : null}
      </group>
    );
  }
  if (model === "computers") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonBox position={[w * 0.28, h + 0.55, -d * 0.1]} args={[0.7, 0.7, 0.7]} color="#1c3330" />
        <ToonBox position={[w * 0.28, h + 1.15, -d * 0.1]} args={[0.48, 0.4, 0.48]} color="#243044" />
        <ToonBox position={[0, h * 0.48, d / 2 + 0.16]} args={[w * 0.62, 0.16, 0.06]} color={accent} />
      </group>
    );
  }
  if (model === "club") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonBox position={[0, 2.15, d / 2 + 0.55]} args={[w * 0.7, 0.1, 1.05]} color={accent} />
        <mesh position={[0, h * 0.62, d / 2 + 0.16]}>
          <circleGeometry args={[0.38, 16]} />
          <meshStandardMaterial color="#f6e2a8" emissive="#f2c14e" emissiveIntensity={0.25} />
        </mesh>
        {close ? [-w * 0.22, 0, w * 0.22].map((x) => (
          <ToonSphere key={x} position={[x, 2.35, d / 2 + 0.7]} radius={0.1} color="#fff6df" />
        )) : null}
      </group>
    );
  }
  if (model === "bank") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonSphere position={[0, h + 0.85, 0]} radius={0.7} color="#c6a15a" />
        <Pediment w={w * 0.62} h={h} color="#c6a15a" />
        <Columns w={w * 0.72} h={h * 0.7} d={d} color="#f7f1e4" />
      </group>
    );
  }
  if (model === "clothing") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <ToonBox position={[0, 2.05, d / 2 + 0.62]} args={[w * 0.78, 0.12, 1.15]} color="#d4567a" />
        <ToonBox position={[0, 2.05, d / 2 + 0.62]} args={[w * 0.78, 0.12, 0.18]} color="#f7f1e4" />
        <ToonBox position={[0, 1.15, d / 2 + 0.18]} args={[w * 0.46, 1.15, 0.08]} color="#f7e7ee" />
        {close ? (
          <group position={[w * 0.32, 0, d / 2 + 0.85]}>
            <ToonBox position={[0, 0.85, 0]} args={[0.32, 1.1, 0.22]} color="#f4efe4" />
            <ToonSphere position={[0, 1.5, 0]} radius={0.16} color="#f4efe4" />
          </group>
        ) : null}
      </group>
    );
  }
  if (model === "furniture") {
    return (
      <group>
        <FlatRoof w={w} h={h} d={d} color={roof} />
        <group position={[w * 0.38, 0, d / 2 + 0.9]}>
          <ToonCylinder position={[0, 0.9, 0]} args={[0.06, 0.08, 1.8, 6]} color="#5c3c0c" />
          <ToonCylinder position={[0, 1.85, 0]} args={[0.38, 0.22, 0.28, 10]} color={accent} />
        </group>
        <ToonBox position={[0, 1.2, d / 2 + 0.16]} args={[w * 0.5, 1.2, 0.08]} color="#f3e6c8" />
      </group>
    );
  }
  if (model === "home") {
    const chimney = <ToonBox position={[-w * 0.28, h + 0.7, -d * 0.28]} args={[0.42, 1.05, 0.42]} color="#6b3a28" />;
    if (tier === "apartment") {
      return (
        <group>
          <FlatRoof w={w} h={h} d={d} color={roof} />
          <ToonBox position={[0, 1.7, d / 2 + 0.4]} args={[w * 0.42, 0.08, 0.7]} color="#d9d3c8" />
          <ToonBox position={[0, 1.95, d / 2 + 0.7]} args={[w * 0.42, 0.36, 0.06]} color="#f7f1e4" />
        </group>
      );
    }
    if (tier === "creator-loft") {
      return (
        <group>
          <ShedRoof w={w * 0.9} h={h} d={d * 0.86} color="#d7e7f2" finish="glass" pitch={0.28} />
          {chimney}
        </group>
      );
    }
    if (tier === "mansion") {
      return (
        <group>
          <Gable w={w * 0.86} h={h} d={d} color={roof} pitch={0.26} overhangX={0.12} />
          <ToonBox position={[w * 0.34, (h + 1.4) / 2, -d * 0.2]} args={[1.5, h + 1.4, 1.5]} color="#e7d3b0" outline />
          <ToonCylinder position={[w * 0.34, h + 1.7, -d * 0.2]} args={[0.2, 0.85, 0.9, 4]} color={roof} />
          <Columns w={w * 0.55} h={h * 0.45} d={d} color="#f7f1e4" />
        </group>
      );
    }
    return (
      <group>
        <Gable w={w} h={h} d={d} color={roof} />
        {chimney}
        {tier === "house" ? <ToonBox position={[0, 1.15, d / 2 + 0.7]} args={[w * 0.46, 0.1, 1.05]} color={roof} /> : null}
      </group>
    );
  }
  return <FlatRoof w={w} h={h} d={d} color={roof} />;
}

function HqBody({ w, h, d, open }: { w: number; h: number; d: number; open: boolean }) {
  const brick = brickTexture();
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={brick} color="#ffffff" roughness={0.86} metalness={0.02} />
      </mesh>
      {open ? null : (
        <group>
          <mesh position={[0, h + 0.16, 0]} castShadow>
            <boxGeometry args={[w + 0.7, 0.22, d + 0.7]} />
            <meshStandardMaterial color="#4e463f" roughness={0.78} />
          </mesh>
          <mesh position={[0, h + 0.32, 0]}>
            <boxGeometry args={[w + 0.2, 0.1, d + 0.2]} />
            <meshStandardMaterial color="#6a625a" roughness={0.8} />
          </mesh>
        </group>
      )}
      <Sign label="Momma Mari" y={h * 0.72} z={d / 2 + 0.08} fill="#1f3b2d" wide={4.2} />
      <mesh position={[0, 0.75, d / 2 + 0.06]}>
        <boxGeometry args={[1.3, 1.45, 0.08]} />
        <meshStandardMaterial color="#1f3b2d" roughness={0.6} />
      </mesh>
      {[-w * 0.28, w * 0.28].map((x) => (
        <mesh key={x} position={[x, h * 0.55, d / 2 + 0.06]}>
          <boxGeometry args={[1.5, 0.85, 0.06]} />
          <meshStandardMaterial color="#d7eef6" roughness={0.04} metalness={0.8} envMapIntensity={1.35} />
        </mesh>
      ))}
    </group>
  );
}

const WALL_FINISH: Partial<Record<BuildingModel, Finish>> = {
  lab: "metal",
  library: "stone",
  learning: "brick",
  computers: "metal",
  "call-center": "metal",
  art: "wood",
  music: "wood",
  club: "brick",
  bank: "stone",
  clothing: "plaster",
  furniture: "wood",
  home: "wood",
  studio: "wood",
  apartment: "brick",
  houses: "brick",
  loft: "brick",
  mansion: "stone",
};

function Flowers({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <ToonBox position={[0, 0.08, 0]} args={[0.9, 0.14, 0.42]} color="#5c3c2e" finish="wood" />
      <ToonSphere position={[-0.18, 0.24, 0]} radius={0.1} color="#d4567a" />
      <ToonSphere position={[0.16, 0.24, 0]} radius={0.1} color="#f2c14e" />
      <ToonSphere position={[0, 0.28, 0.08]} radius={0.08} color="#f7f1e4" />
    </group>
  );
}

function PicketRun({ w, z, color = "#f4efe4" }: { w: number; z: number; color?: string }) {
  const count = Math.max(3, Math.floor(w / 0.7));
  return (
    <group position={[0, 0, z]}>
      <ToonBox position={[0, 0.42, 0]} args={[w, 0.08, 0.06]} color={color} finish="wood" />
      {Array.from({ length: count }, (_, index) => {
        const x = -w / 2 + (index * w) / (count - 1);
        return <ToonBox key={x} position={[x, 0.32, 0]} args={[0.06, 0.64, 0.06]} color={color} finish="wood" />;
      })}
    </group>
  );
}

function ApartmentStack({
  plot,
  w,
  d,
  open,
  mid,
  furnish,
}: {
  plot: Plot;
  w: number;
  d: number;
  open: boolean;
  mid: boolean;
  furnish: boolean;
}) {
  const floors = Math.max(3, plot.floors);
  const bw = w * 0.86;
  const bd = d * 0.78;
  const seen = useRef(floors);
  const [growIndex, setGrowIndex] = useState<number | null>(null);
  useEffect(() => {
    if (floors > seen.current) setGrowIndex(floors - 1);
    seen.current = floors;
  }, [floors]);
  return (
    <group name="apartment-stack">
      {Array.from({ length: floors }, (_, index) => (
        <group key={index} position={[0, index * APARTMENT_STORY, 0]}>
          <RisingStory grow={growIndex === index}>
            <StoryBox w={bw} h={APARTMENT_STORY} d={bd} color={plot.wall} door={index === 0} />
            {mid ? <Windows w={bw * 0.72} h={APARTMENT_STORY} d={bd} rows={1} cols={4} /> : null}
            {index === floors - 1 ? (
              <>
                <FlatRoof w={bw} h={APARTMENT_STORY} d={bd} color={plot.roof} finish="metal" />
                {mid ? <Sign label={`${floors} floors · 1 bed`} y={APARTMENT_STORY + 0.55} z={bd / 2 + 0.35} fill="#1f3b2d" wide={5.4} /> : null}
              </>
            ) : null}
          </RisingStory>
        </group>
      ))}
      <ToonBox position={[0, 0.05, d * 0.42]} args={[w * 0.7, 0.08, d * 0.28]} color="#c8c2b6" finish="stone" />
      {furnish ? <CityInterior model="apartment" w={bw - 0.7} d={bd - 0.7} tier="apartment" /> : null}
    </group>
  );
}

function Neighborhood({
  model,
  plot,
  tier,
  open,
  mid,
  furnish,
}: {
  model: BuildingModel;
  plot: Plot;
  tier: HomeTier;
  open: boolean;
  mid: boolean;
  furnish: boolean;
}) {
  const w = plot.w * 0.92;
  const d = plot.d * 0.72;
  if (model === "studio") {
    const count = 4;
    const unit = w / count - STUDIO_ROW_GAP;
    return (
      <group>
        {Array.from({ length: count }, (_, index) => {
          const step = w / count;
          const x = -w / 2 + step * index + step / 2;
          return (
            <group key={x} position={[x, 0, 0]}>
              <Envelope w={unit} h={2.55} d={d * 0.7} color={index % 2 ? "#d7b07a" : plot.wall} yaw={0} open={open && index === 1} outline={false} finish="wood" />
              <Gable w={unit} h={2.55} d={d * 0.7} color={plot.roof} overhangX={ROW_ROOF_OVERHANG_X} overhangZ={ROW_ROOF_OVERHANG_Z} endColor={index % 2 ? "#d7b07a" : plot.wall} />
              {furnish && index === 1 ? <CityInterior model="studio" w={Math.max(2.1, unit - 0.45)} d={Math.max(2.2, d * 0.7 - 0.45)} tier="studio" /> : null}
              {mid ? <Windows w={unit * 0.8} h={2.4} d={d * 0.7} rows={1} cols={2} /> : null}
              <ToonBox position={[0, 0.12, d * 0.35 + 0.45]} args={[unit * 0.55, 0.16, 0.7]} color="#cfc8bb" finish="stone" />
            </group>
          );
        })}
      </group>
    );
  }
  if (model === "apartment") {
    return (
      <ApartmentStack plot={plot} w={w} d={d} open={open} mid={mid} furnish={furnish} />
    );
  }
  if (model === "houses") {
    const count = 3;
    const unit = w / count - HOUSE_ROW_GAP;
    return (
      <group>
        {Array.from({ length: count }, (_, index) => {
          const step = w / count;
          const x = -w / 2 + step * index + step / 2;
          return (
            <group key={x} position={[x, 0, -0.4]}>
              <Envelope w={unit} h={3.3} d={d * 0.62} color={index === 1 ? "#efe6d6" : plot.wall} yaw={0} open={open && index === 1} outline={false} finish={index === 1 ? "plaster" : "brick"} />
              <Gable w={unit} h={3.3} d={d * 0.62} color={plot.roof} overhangX={ROW_ROOF_OVERHANG_X} overhangZ={ROW_ROOF_OVERHANG_Z} endColor={index === 1 ? "#efe6d6" : plot.wall} />
              {furnish && index === 1 ? <CityInterior model="houses" w={unit - 0.55} d={d * 0.62 - 0.55} tier="house" /> : null}
              {mid ? <Windows w={unit * 0.75} h={3} d={d * 0.62} rows={1} cols={2} /> : null}
              <ToonBox position={[0, 1.05, d * 0.31 + 0.45]} args={[unit * 0.55, 0.1, 0.9]} color={plot.roof} finish="wood" />
              {mid ? <PicketRun w={unit + 0.4} z={d * 0.31 + 1.15} /> : null}
              {mid ? [-unit * 0.32, 0, unit * 0.32].map((bed) => <Flowers key={bed} x={bed} z={d * 0.31 + 1.65} />) : null}
              {mid ? <YardTree w={unit * 0.2} d={-d * 0.2} canopy="#3e8a42" /> : null}
            </group>
          );
        })}
      </group>
    );
  }
  if (model === "loft") {
    return (
      <group>
        {[-w * 0.24, w * 0.24].map((x, index) => (
          <group key={x} position={[x, 0, 0]}>
            <Envelope w={w * 0.4} h={4.2} d={d * 0.7} color={plot.wall} yaw={0} open={open && index === 0} outline={false} finish="brick" />
            <ShedRoof w={w * 0.4} h={4.2} d={d * 0.7} color="#d5e7f0" finish="glass" />
            {furnish && index === 0 ? <CityInterior model="loft" w={w * 0.4 - 0.6} d={d * 0.7 - 0.6} tier="creator-loft" /> : null}
            {mid ? <Windows w={w * 0.28} h={3.6} d={d * 0.7} rows={2} cols={3} /> : null}
            {mid ? <ToonBox position={[w * 0.12, 2.2, d * 0.35 + 0.2]} args={[w * 0.16, 2.2, 0.16]} color="#d5e7f0" finish="glass" /> : null}
          </group>
        ))}
        {mid ? <PicketRun w={w * 0.9} z={d * 0.42} color="#8a4b3c" /> : null}
      </group>
    );
  }
  return (
    <group>
      <Envelope w={w * 0.72} h={5.6} d={d * 0.62} color={plot.wall} yaw={0} open={open} outline={false} finish="stone" />
      <Gable w={w * 0.72} h={5.6} d={d * 0.62} color={plot.roof} pitch={0.26} overhangX={0.14} endColor={plot.wall} />
      <ToonBox position={[w * 0.36 + 1.5, 3.7, 0]} args={[2.15, 7.4, 2.15]} color="#efe6d6" finish="stone" cast />
      <ToonCylinder position={[w * 0.36 + 1.5, 7.9, 0]} args={[0.12, 1.12, 1.05, 6]} color={plot.roof} />
      <Columns w={w * 0.4} h={3.2} d={d * 0.62} color="#f7f1e4" />
      {mid ? <Windows w={w * 0.4} h={4.4} d={d * 0.62} rows={2} cols={3} /> : null}
      {mid ? (
        <group>
          <PicketRun w={w * 0.8} z={d * 0.38 + 0.4} color="#2a2e33" />
          <Flowers x={-w * 0.28} z={d * 0.2} />
          <Flowers x={w * 0.18} z={d * 0.28} />
          <YardTree w={w * 0.2} d={d * 0.1} canopy="#2f6d4f" />
        </group>
      ) : null}
      {furnish ? <CityInterior model="mansion" w={w * 0.72 - 0.7} d={d * 0.62 - 0.7} tier="mansion" /> : null}
    </group>
  );
}

export function CityBuilding({
  plot,
  tier,
  quality,
  detailed,
  selected,
  interiorOpen,
  locked,
  canOpen,
  onEnter,
}: {
  plot: Plot;
  tier: HomeTier;
  quality: "fine" | "fast";
  detailed: boolean;
  selected: boolean;
  interiorOpen: boolean;
  locked: boolean;
  canOpen: () => boolean;
  onEnter: () => void;
}) {
  const location = locationById(plot.locationId);
  const model = plot.model ?? location?.buildingModel ?? "lab";
  const placeTier = plot.propertyTier ?? tier;
  const name = model === "hq" ? "Momma Mari" : plot.district ?? location?.name ?? plot.id;
  const walkIn = location?.interior === "walk-in";
  const { ref, lod } = useLod(quality, detailed);
  const height = buildingHeight(model, plot.floors, placeTier);
  const open = selected && interiorOpen && walkIn;
  const mid = lod < 2;
  const close = lod === 0 && quality === "fine";
  const rows = mid ? Math.max(1, Math.floor(height / (close ? 1.7 : 2.3))) : 0;
  const cols = mid ? Math.max(2, Math.floor(Math.min(plot.w, 14) / (close ? 1.8 : 2.5))) : 0;
  const neighborhood = model === "studio" || model === "apartment" || model === "houses" || model === "loft" || model === "mansion";
  const yard = plot.yard ?? "stoop";
  return (
    <group name={plot.id} ref={ref} position={[plot.x + plot.w / 2, 0, plot.z + plot.d / 2]} rotation={[0, plot.yaw, 0]}>
      {model === "hq" ? (
        <HqBody w={plot.w} h={height} d={plot.d} open={open} />
      ) : neighborhood ? (
        <Neighborhood model={model} plot={plot} tier={placeTier} open={open} mid={mid} furnish={open || (mid && !locked)} />
      ) : (
        <>
          <Envelope w={plot.w} h={height} d={plot.d} color={plot.wall} yaw={plot.yaw} open={open} outline={close} finish={WALL_FINISH[model] ?? "brick"} />
          <Extras model={model} tier={placeTier} w={plot.w} h={height} d={plot.d} roof={plot.roof} accent={plot.accent} open={open} close={close} />
          {mid && model !== "clothing" && model !== "furniture" ? <Windows w={plot.w * 0.78} h={height} d={plot.d} rows={rows} cols={cols} /> : null}
          {mid ? <Sign label={name} y={Math.max(1.7, height - 0.55)} z={plot.d / 2 + 0.22} /> : null}
          {mid ? <PorchLamp w={plot.w} d={plot.d} /> : null}
          {mid && yard !== "none" ? <YardTree w={plot.w} d={plot.d} canopy="#3e8a42" /> : null}
          {open || (mid && !locked) ? <CityInterior model={model} w={plot.w - 0.75} d={plot.d - 0.75} tier={placeTier} /> : null}
          {open ? <pointLight position={[0, Math.min(2.4, height - 0.4), 0]} intensity={0.55} distance={14} decay={2} color="#fff1d6" /> : null}
        </>
      )}
      {locked ? (
        <group>
          <ToonBox position={[0, 1.15, plot.d / 2 + 0.35]} args={[1.6, 0.12, 0.08]} color="#2a2e33" finish="metal" />
          <Sign label="Locked" y={2.35} z={plot.d / 2 + 0.4} fill="#6a243c" wide={2.4} />
        </group>
      ) : null}
      {selected ? (
        <mesh position={[0, 0.06, plot.d / 2 + 1.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.58, 20]} />
          <meshBasicMaterial color={plot.accent} />
        </mesh>
      ) : null}
      <mesh
        position={[0, height / 2, 0]}
        onClick={(event) => {
          event.stopPropagation();
          if (canOpen()) onEnter();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          const node = event.nativeEvent.target;
          if (node instanceof HTMLCanvasElement) node.style.cursor = "pointer";
        }}
        onPointerOut={(event) => {
          const node = event.nativeEvent.target;
          if (node instanceof HTMLCanvasElement) node.style.cursor = "";
        }}
      >
        <boxGeometry args={[plot.w, Math.max(height, 1.6), plot.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
