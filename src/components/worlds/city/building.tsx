"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  CanvasTexture,
  DataTexture,
  NearestFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Texture,
} from "three";
import type { HomeTier } from "@/lib/worlds/economy";
import type { BuildingModel, Plot } from "@/lib/worlds/city/locations";
import { locationById } from "@/lib/worlds/city/locations";

const OUTLINE = "#1a1614";
const scratch = new Vector3();

let sharedGradient: Texture | null = null;
let sharedBrick: Texture | null = null;

function toonGradient() {
  if (sharedGradient) return sharedGradient;
  const data = new Uint8Array([
    70, 70, 70, 255,
    160, 160, 160, 255,
    255, 255, 255, 255,
  ]);
  const texture = new DataTexture(data, 3, 1, RGBAFormat);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  sharedGradient = texture;
  return texture;
}

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

function buildingHeight(model: BuildingModel, floors: number, tier: HomeTier) {
  if (model === "hq") return 3.2;
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
  outline = false,
  cast = false,
}: {
  position?: Vec;
  rotation?: Vec;
  args: Vec;
  color: string;
  outline?: boolean;
  cast?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow={cast} receiveShadow>
        <boxGeometry args={args} />
        <meshToonMaterial color={color} emissive={color} emissiveIntensity={0.07} gradientMap={toonGradient()} />
      </mesh>
      {outline ? (
        <mesh scale={1.03}>
          <boxGeometry args={args} />
          <meshBasicMaterial color={OUTLINE} side={BackSide} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function ToonCylinder({ position, args, color, rotation }: { position: Vec; args: [number, number, number, number?]; color: string; rotation?: Vec }) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <cylinderGeometry args={args} />
      <meshToonMaterial color={color} emissive={color} emissiveIntensity={0.07} gradientMap={toonGradient()} />
    </mesh>
  );
}

function ToonSphere({ position, radius, color }: { position: Vec; radius: number; color: string }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[radius, 12, 10]} />
      <meshToonMaterial color={color} emissive={color} emissiveIntensity={0.08} gradientMap={toonGradient()} />
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
}: {
  w: number;
  h: number;
  d: number;
  color: string;
  yaw: number;
  open: boolean;
  outline: boolean;
  floor?: string;
}) {
  const skip = open ? southFace(yaw) : null;
  return (
    <group>
      <ToonBox position={[0, 0.05, 0]} args={[Math.max(0.4, w - 0.28), 0.1, Math.max(0.4, d - 0.28)]} color={floor} />
      {skip === "nz" ? null : <ToonBox position={[0, h / 2, -d / 2]} args={[w, h, 0.2]} color={color} outline={outline} cast />}
      {skip === "px" ? null : <ToonBox position={[w / 2, h / 2, 0]} args={[0.2, h, d]} color={color} outline={outline} cast />}
      {skip === "nx" ? null : <ToonBox position={[-w / 2, h / 2, 0]} args={[0.2, h, d]} color={color} outline={outline} cast />}
      {skip === "pz" ? (
        <DoorWall w={w} h={h} d={d} color={color} openDoor outline={false} />
      ) : (
        <DoorWall w={w} h={h} d={d} color={color} openDoor={open && southFace(yaw) === "pz"} outline={outline} />
      )}
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
        <mesh key={`${pane.x.toFixed(2)}-${pane.y.toFixed(2)}`} position={[pane.x, pane.y, d / 2 + 0.16]}>
          <planeGeometry args={[0.42, 0.56]} />
          <meshStandardMaterial color="#d7e7f2" emissive="#f4f8fb" emissiveIntensity={0.18} roughness={0.16} />
        </mesh>
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

function Gable({ w, h, d, color }: { w: number; h: number; d: number; color: string }) {
  return (
    <group>
      <ToonBox position={[0, h + 0.55, 0]} rotation={[0, 0, 0.46]} args={[w * 0.66, 0.16, d + 0.45]} color={color} cast />
      <ToonBox position={[0, h + 0.55, 0]} rotation={[0, 0, -0.46]} args={[w * 0.66, 0.16, d + 0.45]} color={color} cast />
    </group>
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

function FlatRoof({ w, h, d, color, lip = "#6a625a" }: { w: number; h: number; d: number; color: string; lip?: string }) {
  return (
    <group>
      <ToonBox position={[0, h + 0.12, 0]} args={[w + 0.45, 0.24, d + 0.45]} color={color} cast />
      <ToonBox position={[0, h + 0.28, 0]} args={[w + 0.15, 0.1, d + 0.15]} color={lip} />
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
  if (model === "lab") {
    return (
      <group>
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
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
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
        <Pediment w={w * 0.7} h={h} color={roof} />
        <Columns w={w * 0.8} h={h * 0.72} d={d} color="#f7f1e4" />
        <ToonBox position={[0, 0.18, d / 2 + 0.7]} args={[w * 0.55, 0.28, 0.8]} color="#d9d3c8" />
      </group>
    );
  }
  if (model === "learning") {
    return (
      <group>
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
        <ToonBox position={[0, h * 0.72, d / 2 + 0.7]} args={[w * 0.55, 0.1, 1.1]} color={accent} />
        <ToonCylinder position={[w * 0.42, h + 0.9, -d * 0.2]} args={[0.05, 0.06, 1.8, 6]} color="#1c211e" />
        <ToonBox position={[w * 0.42 + 0.28, h + 1.55, -d * 0.2]} args={[0.55, 0.32, 0.06]} color={accent} />
      </group>
    );
  }
  if (model === "call-center") {
    return (
      <group>
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} lip="#243044" />}
        <ToonCylinder position={[0, h + 1.35, 0]} args={[0.06, 0.08, 2.4, 6]} color="#1c211e" />
        <ToonBox position={[0.45, h + 2.15, 0]} args={[0.9, 0.08, 0.08]} color="#1c211e" />
        <mesh position={[0.7, h + 1.55, 0.2]} rotation={[0.4, 0, 0.6]}>
          <cylinderGeometry args={[0.28, 0.28, 0.08, 12]} />
          <meshToonMaterial color={accent} gradientMap={toonGradient()} />
        </mesh>
        {close ? <ToonBox position={[0, 1.15, d / 2 + 0.2]} args={[1.4, 0.7, 0.08]} color="#122033" /> : null}
      </group>
    );
  }
  if (model === "art") {
    return (
      <group>
        {open ? null : <ToonBox position={[0, h + 0.45, -d * 0.05]} rotation={[-0.55, 0, 0]} args={[w * 0.72, 0.12, d * 0.7]} color="#d7e7f2" />}
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
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
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
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
        <ToonBox position={[w * 0.28, h + 0.55, -d * 0.1]} args={[0.7, 0.7, 0.7]} color="#1c3330" />
        <ToonBox position={[w * 0.28, h + 1.15, -d * 0.1]} args={[0.48, 0.4, 0.48]} color="#243044" />
        <ToonBox position={[0, h * 0.48, d / 2 + 0.16]} args={[w * 0.62, 0.16, 0.06]} color={accent} />
      </group>
    );
  }
  if (model === "club") {
    return (
      <group>
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
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
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} lip="#c6a15a" />}
        <ToonSphere position={[0, h + 0.85, 0]} radius={0.7} color="#c6a15a" />
        <Pediment w={w * 0.62} h={h} color="#c6a15a" />
        <Columns w={w * 0.72} h={h * 0.7} d={d} color="#f7f1e4" />
      </group>
    );
  }
  if (model === "clothing") {
    return (
      <group>
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
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
        {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
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
          {open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />}
          <ToonBox position={[0, 1.7, d / 2 + 0.4]} args={[w * 0.42, 0.08, 0.7]} color="#d9d3c8" />
          <ToonBox position={[0, 1.95, d / 2 + 0.7]} args={[w * 0.42, 0.36, 0.06]} color="#f7f1e4" />
        </group>
      );
    }
    if (tier === "creator-loft") {
      return (
        <group>
          {open ? null : <ToonBox position={[0, h + 0.7, -0.2]} rotation={[-0.4, 0, 0]} args={[w * 0.9, 0.14, d * 0.85]} color="#d7e7f2" />}
          {chimney}
        </group>
      );
    }
    if (tier === "mansion") {
      return (
        <group>
          {open ? null : <Gable w={w * 0.72} h={h * 0.72} d={d} color={roof} />}
          <ToonBox position={[w * 0.34, (h + 1.4) / 2, -d * 0.2]} args={[1.5, h + 1.4, 1.5]} color="#e7d3b0" outline />
          {open ? null : <ToonCylinder position={[w * 0.34, h + 1.7, -d * 0.2]} args={[0.2, 0.85, 0.9, 4]} color={roof} />}
          <Columns w={w * 0.55} h={h * 0.45} d={d} color="#f7f1e4" />
        </group>
      );
    }
    return (
      <group>
        {open ? null : <Gable w={w} h={h} d={d} color={roof} />}
        {chimney}
        {tier === "house" ? <ToonBox position={[0, 1.15, d / 2 + 0.7]} args={[w * 0.46, 0.1, 1.05]} color={roof} /> : null}
      </group>
    );
  }
  return open ? null : <FlatRoof w={w} h={h} d={d} color={roof} />;
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
          <meshStandardMaterial color="#d5e7f0" roughness={0.08} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

export function CityBuilding({
  plot,
  tier,
  quality,
  detailed,
  selected,
  canOpen,
  onEnter,
}: {
  plot: Plot;
  tier: HomeTier;
  quality: "fine" | "fast";
  detailed: boolean;
  selected: boolean;
  canOpen: () => boolean;
  onEnter: () => void;
}) {
  const location = locationById(plot.id);
  const model = location?.buildingModel ?? "lab";
  const name = model === "hq" ? "Momma Mari" : location?.name ?? plot.id;
  const walkIn = location?.interior === "walk-in";
  const { ref, lod } = useLod(quality, detailed);
  const height = buildingHeight(model, plot.floors, tier);
  const open = selected && walkIn;
  const mid = lod < 2;
  const close = lod === 0 && quality === "fine";
  const rows = mid ? Math.max(1, Math.floor(height / (close ? 1.7 : 2.3))) : 0;
  const cols = mid ? Math.max(2, Math.floor(plot.w / (close ? 1.8 : 2.5))) : 0;
  return (
    <group ref={ref} position={[plot.x + plot.w / 2, 0, plot.z + plot.d / 2]} rotation={[0, plot.yaw, 0]}>
      {model === "hq" ? (
        <HqBody w={plot.w} h={height} d={plot.d} open={open} />
      ) : (
        <>
          <Envelope w={plot.w} h={height} d={plot.d} color={plot.wall} yaw={plot.yaw} open={open} outline={close} />
          <Extras model={model} tier={tier} w={plot.w} h={height} d={plot.d} roof={plot.roof} accent={plot.accent} open={open} close={close} />
          {mid && model !== "clothing" && model !== "furniture" ? <Windows w={plot.w * 0.78} h={height} d={plot.d} rows={rows} cols={cols} /> : null}
          {mid ? <Sign label={name} y={Math.max(1.7, height - 0.55)} z={plot.d / 2 + 0.22} /> : null}
          {mid ? <PorchLamp w={plot.w} d={plot.d} /> : null}
          {mid ? <YardTree w={plot.w} d={plot.d} canopy="#3e8a42" /> : null}
          {open && model === "learning" ? <LearningRoom w={plot.w} d={plot.d} /> : null}
          {open && model === "home" ? <HomeRoom w={plot.w} d={plot.d} tier={tier} /> : null}
          {open ? <pointLight position={[0, Math.min(2.4, height - 0.4), 0]} intensity={0.55} distance={14} decay={2} color="#fff1d6" /> : null}
        </>
      )}
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
