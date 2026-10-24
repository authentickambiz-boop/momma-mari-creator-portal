"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BackSide,
  CanvasTexture,
  DataTexture,
  NearestFilter,
  NoColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Texture,
} from "three";
import type { BuildingModel, Plot } from "@/lib/worlds/city/locations";
import { locationById } from "@/lib/worlds/city/locations";

const OUTLINE = "#1a1614";
const scratch = new Vector3();

let sharedGradient: Texture | null = null;

function toonGradient() {
  if (sharedGradient) return sharedGradient;
  const data = new Uint8Array([
    70, 70, 70, 255,
    150, 150, 150, 255,
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

function useLod(quality: "fine" | "fast", detailed: boolean) {
  const ref = useRef<Group>(null);
  const [lod, setLod] = useState(2);
  useFrame(({ camera }) => {
    const node = ref.current;
    if (!node) return;
    const dist = camera.position.distanceTo(node.getWorldPosition(scratch));
    const next = !detailed || quality === "fast"
      ? (dist > 110 ? 2 : 1)
      : (dist > 175 ? 2 : dist > 72 ? 1 : 0);
    setLod((current) => (current === next ? current : next));
  });
  return { ref, lod };
}

function signTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1c211e";
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = "#fbf8f3";
    ctx.font = "700 64px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 256, 80);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function Mass({
  position,
  args,
  color,
  outline,
}: {
  position: [number, number, number];
  args: [number, number, number];
  color: string;
  outline: boolean;
}) {
  const gradient = toonGradient();
  return (
    <group position={position}>
      <mesh castShadow={outline} receiveShadow>
        <boxGeometry args={args} />
        <meshToonMaterial color={color} emissive={color} emissiveIntensity={0.42} gradientMap={gradient} />
      </mesh>
      {outline ? (
        <mesh scale={1.045}>
          <boxGeometry args={args} />
          <meshBasicMaterial color={OUTLINE} side={BackSide} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function Windows({ w, h, d, accent }: { w: number; h: number; d: number; accent: string }) {
  const cols = Math.max(2, Math.floor(w / 1.7));
  const rows = Math.max(1, Math.floor(h / 1.8));
  const panes: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      panes.push({
        x: -w / 2 + ((col + 0.5) * w) / cols,
        y: 0.7 + ((row + 0.5) * (h - 0.8)) / rows,
      });
    }
  }
  return (
    <group>
      {panes.map((pane) => (
        <mesh key={`${pane.x}-${pane.y}`} position={[pane.x, pane.y, d / 2 + 0.03]}>
          <planeGeometry args={[0.46, 0.62]} />
          <meshStandardMaterial color="#d7e7f2" emissive={accent} emissiveIntensity={0.35} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function Sign({ label, y, z }: { label: string; y: number; z: number }) {
  const map = useMemo(() => signTexture(label), [label]);
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[Math.min(3.2, label.length * 0.28 + 1.2), 0.7]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

function Extras({ model, w, h, d, accent }: { model: BuildingModel; w: number; h: number; d: number; accent: string }) {
  const gradient = toonGradient();
  if (model === "lab") {
    return (
      <group>
        <mesh position={[-w * 0.22, h + 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.32, 0.7, 8]} />
          <meshToonMaterial color="#d9d3c8" gradientMap={gradient} />
        </mesh>
        <mesh position={[w * 0.2, h + 0.32, 0.2]}>
          <cylinderGeometry args={[0.18, 0.2, 0.46, 8]} />
          <meshToonMaterial color={accent} gradientMap={gradient} />
        </mesh>
      </group>
    );
  }
  if (model === "library" || model === "bank") {
    return (
      <group>
        {[-w * 0.32, w * 0.32].map((x) => (
          <mesh key={x} position={[x, 1.1, d / 2 + 0.2]} castShadow>
            <cylinderGeometry args={[0.16, 0.18, 2.2, 8]} />
            <meshToonMaterial color="#f7f1e4" gradientMap={gradient} />
          </mesh>
        ))}
      </group>
    );
  }
  if (model === "club" || model === "clothing" || model === "furniture") {
    return (
      <mesh position={[0, 1.35, d / 2 + 0.45]} castShadow>
        <boxGeometry args={[w * 0.72, 0.08, 0.9]} />
        <meshToonMaterial color={accent} gradientMap={gradient} />
      </mesh>
    );
  }
  if (model === "call-center") {
    return (
      <mesh position={[0, h + 0.9, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 1.6, 6]} />
        <meshToonMaterial color="#1c211e" gradientMap={gradient} />
      </mesh>
    );
  }
  if (model === "music") {
    return (
      <mesh position={[w * 0.28, h + 0.45, 0]}>
        <sphereGeometry args={[0.28, 10, 8]} />
        <meshToonMaterial color={accent} gradientMap={gradient} />
      </mesh>
    );
  }
  if (model === "art") {
    return (
      <mesh position={[0, h + 0.08, 0]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[w * 0.45, 0.08, d * 0.4]} />
        <meshStandardMaterial color="#d7e7f2" emissive={accent} emissiveIntensity={0.25} transparent opacity={0.85} />
      </mesh>
    );
  }
  if (model === "computers") {
    return (
      <mesh position={[0, h * 0.55, d / 2 + 0.04]}>
        <boxGeometry args={[w * 0.7, 0.18, 0.04]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} />
      </mesh>
    );
  }
  if (model === "learning") {
    return (
      <mesh position={[w * 0.42, h + 0.55, 0]}>
        <boxGeometry args={[0.08, 1.1, 0.08]} />
        <meshToonMaterial color="#1c211e" gradientMap={gradient} />
      </mesh>
    );
  }
  if (model === "home") {
    return (
      <mesh position={[w * 0.28, h + 0.55, -d * 0.2]}>
        <boxGeometry args={[0.4, 0.7, 0.4]} />
        <meshToonMaterial color="#6b3a28" gradientMap={gradient} />
      </mesh>
    );
  }
  return null;
}

export function CityBuilding({
  plot,
  quality,
  detailed,
  selected,
  canOpen,
  onEnter,
}: {
  plot: Plot;
  quality: "fine" | "fast";
  detailed: boolean;
  selected: boolean;
  canOpen: () => boolean;
  onEnter: () => void;
}) {
  const location = locationById(plot.id);
  const model = location?.buildingModel ?? "lab";
  const name = location?.name ?? plot.id;
  const { ref, lod } = useLod(quality, detailed);
  const marker = model === "hq-marker";
  const height = marker ? 1.7 : plot.floors * 2.15;
  const outline = lod === 0 && quality === "fine";
  return (
    <group ref={ref} position={[plot.x + plot.w / 2, 0, plot.z + plot.d / 2]} rotation={[0, plot.yaw, 0]}>
      {lod >= 2 ? (
        <Mass position={[0, height / 2, 0]} args={[plot.w, height, plot.d]} color={plot.wall} outline={false} />
      ) : (
        <>
          <Mass position={[0, height / 2, 0]} args={[plot.w, height, plot.d]} color={plot.wall} outline={outline} />
          <Mass position={[0, height + 0.18, 0]} args={[plot.w + 0.4, 0.36, plot.d + 0.4]} color={plot.roof} outline={false} />
          <mesh position={[0, 0.7, plot.d / 2 + 0.05]} castShadow>
            <boxGeometry args={[0.7, 1.3, 0.08]} />
            <meshToonMaterial color="#3a2a22" gradientMap={toonGradient()} />
          </mesh>
          {lod === 0 ? <Windows w={plot.w * 0.86} h={height} d={plot.d} accent={plot.accent} /> : null}
          {lod === 0 ? <Extras model={model} w={plot.w} h={height} d={plot.d} accent={plot.accent} /> : null}
          {lod < 2 ? <Sign label={name} y={height - 0.35} z={plot.d / 2 + 0.08} /> : null}
        </>
      )}
      {selected ? (
        <mesh position={[0, 0.04, plot.d / 2 + 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.5, 16]} />
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
        <boxGeometry args={[plot.w, Math.max(height, 1.4), plot.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
