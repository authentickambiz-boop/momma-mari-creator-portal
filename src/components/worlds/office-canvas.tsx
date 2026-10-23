"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import type { BotStatus } from "@/lib/worlds/office-catalog";
import type { OfficeLayout, OfficeRoom, OfficeSection } from "@/lib/worlds/office-layout";
import { isSeated, type OfficeSimStore } from "@/lib/worlds/office-sim";
import { boardStations, type OfficeKey } from "@/lib/worlds/office-state";
import { formatWalletMoney, vaultPilePlan } from "@/lib/worlds/office-wallets";
import { fogDistances, skyColor, sunPosition, type OfficeWeather } from "@/lib/worlds/office-weather";
import { OfficeSite } from "./office-grounds";

export type BoardPanel = "calendar" | "todos" | "notes";
export type BoardOpen = { office: OfficeKey; panel: BoardPanel };

export type OfficeCameraApi = {
  reset: () => void;
  zoomBy: (factor: number) => void;
};

type BotCard = { id: string; name: string; short: string; status: BotStatus };

const EXTERIOR_H = 2.55;
const MAP_MIN_DISTANCE = 3.2;
const MAP_MAX_DISTANCE = 78;

function mapHome(layout: OfficeLayout) {
  const lookX = layout.width / 2;
  const lookZ = layout.depth * 0.42;
  return {
    position: new THREE.Vector3(lookX + 18, 28, layout.depth + 32),
    target: new THREE.Vector3(lookX, 1.2, lookZ),
  };
}

function clampMapTarget(orbit: OrbitControlsType, layout: OfficeLayout) {
  const minX = -14;
  const maxX = layout.width + 14;
  const minZ = -14;
  const maxZ = layout.depth + 28;
  const x = THREE.MathUtils.clamp(orbit.target.x, minX, maxX);
  const y = THREE.MathUtils.clamp(orbit.target.y, 0.4, 3.2);
  const z = THREE.MathUtils.clamp(orbit.target.z, minZ, maxZ);
  const dx = x - orbit.target.x;
  const dy = y - orbit.target.y;
  const dz = z - orbit.target.z;
  if (dx === 0 && dy === 0 && dz === 0) return;
  orbit.target.set(x, y, z);
  orbit.object.position.x += dx;
  orbit.object.position.y += dy;
  orbit.object.position.z += dz;
}
const INTERIOR_H = 1.22;
const SILL_H = 0.82;
const HEADER_Y = 2.12;
const ACCENTS = ["#2f6d4f", "#b4532f", "#2f6283", "#9a6514", "#6b4c7a", "#3d6b5a", "#8a4b3c", "#355e52"];
const STATUS_COLOR: Record<BotStatus, string> = {
  working: "#2f7d4a",
  waiting: "#c4841d",
  idle: "#8d8880",
};

function canvasTex(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (ctx) draw(ctx, size);
  tex.needsUpdate = true;
  return tex;
}

function heightNormal(height: (x: number, y: number) => number, size = 128) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  if (!ctx) return tex;
  const image = ctx.createImageData(size, size);
  const strength = 3.4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = height((x - 1 + size) % size, y);
      const right = height((x + 1) % size, y);
      const down = height(x, (y - 1 + size) % size);
      const up = height(x, (y + 1) % size);
      let nx = (left - right) * strength;
      let ny = (down - up) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const index = (y * size + x) * 4;
      image.data[index] = (nx * 0.5 + 0.5) * 255;
      image.data[index + 1] = (ny * 0.5 + 0.5) * 255;
      image.data[index + 2] = (nz / len) * 255;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  tex.needsUpdate = true;
  return tex;
}

function repeated(tex: THREE.Texture, x: number, y: number) {
  const clone = tex.clone();
  clone.repeat.set(x, y);
  clone.needsUpdate = true;
  return clone;
}

function useOfficeMaterials(layout: OfficeLayout) {
  return useMemo(() => {
    const woodAlbedo = canvasTex((ctx, size) => {
      ctx.fillStyle = "#8d5a32";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 1) {
        const band = 118 + Math.sin(y * 0.17) * 28 + (y % 11 === 0 ? -18 : 0);
        ctx.fillStyle = `rgb(${band}, ${Math.round(band * 0.62)}, ${Math.round(band * 0.32)})`;
        ctx.fillRect(0, y, size, 1);
      }
      for (let x = 0; x < size; x += 17) {
        ctx.strokeStyle = "rgba(55,28,10,0.18)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= size; y += 8) ctx.lineTo(x + Math.sin(y * 0.08 + x) * 3, y);
        ctx.stroke();
      }
    });
    const woodRough = canvasTex((ctx, size) => {
      for (let y = 0; y < size; y += 1) {
        const shade = 150 + Math.round(Math.sin(y * 0.35) * 40);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(0, y, size, 1);
      }
    }, 128, THREE.NoColorSpace);
    const woodNormal = heightNormal((x, y) => 0.55 + Math.sin(y * 0.55) * 0.3 + Math.sin(x * 0.2 + y * 0.05) * 0.08);
    const carpetMap = (base: string) => canvasTex((ctx, size) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 5000; i += 1) {
        ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.16)";
        ctx.beginPath();
        const x = (i * 37) % size;
        const y = (i * 91) % size;
        ctx.moveTo(x, y);
        ctx.lineTo(x + ((i % 5) - 2), y + 5);
        ctx.stroke();
      }
    });
    const carpetNormal = heightNormal((x, y) => 0.5 + Math.sin(x * 1.7 + y) * 0.2 + Math.cos(y * 2.1) * 0.15);
    const carpetRough = canvasTex((ctx, size) => {
      ctx.fillStyle = "#e4e4e4";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 800; i += 1) {
        ctx.fillStyle = i % 2 ? "#ffffff" : "#bdbdbd";
        ctx.fillRect((i * 23) % size, (i * 41) % size, 2, 2);
      }
    }, 128, THREE.NoColorSpace);
    const tileAlbedo = canvasTex((ctx, size) => {
      const cell = 64;
      for (let y = 0; y < size; y += cell) {
        for (let x = 0; x < size; x += cell) {
          ctx.fillStyle = (x / cell + y / cell) % 2 ? "#d7d2c8" : "#cfc8bb";
          ctx.fillRect(x, y, cell - 3, cell - 3);
          ctx.fillStyle = "#8d8680";
          ctx.fillRect(x + cell - 3, y, 3, cell);
          ctx.fillRect(x, y + cell - 3, cell, 3);
        }
      }
    });
    const tileNormal = heightNormal((x, y) => {
      const cell = 32;
      return x % cell < 2 || y % cell < 2 ? 0.15 : 0.85;
    });
    const tileRough = canvasTex((ctx, size) => {
      const cell = 32;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const grout = x % cell < 2 || y % cell < 2;
          const shade = grout ? 210 : 90;
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }, 128, THREE.NoColorSpace);
    const panelAlbedo = canvasTex((ctx, size) => {
      ctx.fillStyle = "#efe6d6";
      ctx.fillRect(0, 0, size, size);
      const board = 36;
      for (let x = 0; x < size; x += board) {
        ctx.fillStyle = x % (board * 2) === 0 ? "#e4d8c4" : "#f4eee4";
        ctx.fillRect(x, 0, board - 2, size);
        ctx.fillStyle = "#b7a48c";
        ctx.fillRect(x + board - 2, 0, 2, size);
      }
    });
    const panelNormal = heightNormal((x) => (x % 18 < 2 ? 0.2 : 0.78));
    const brickAlbedo = canvasTex((ctx, size) => {
      const bw = 56;
      const bh = 24;
      for (let y = 0; y < size; y += bh) {
        const row = Math.floor(y / bh);
        const offset = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < size + bw; x += bw) {
          ctx.fillStyle = (row + x / bw) % 2 ? "#b56a52" : "#c4846a";
          ctx.fillRect(x + offset, y, bw - 3, bh - 3);
        }
        ctx.fillStyle = "#d9d0c4";
        ctx.fillRect(0, y + bh - 3, size, 3);
      }
    });
    const brickNormal = heightNormal((x, y) => {
      const bw = 28;
      const bh = 12;
      const row = Math.floor(y / bh);
      const localX = (x + (row % 2 ? bw / 2 : 0)) % bw;
      return localX < 2 || y % bh < 2 ? 0.15 : 0.82;
    });
    const brushAlbedo = canvasTex((ctx, size) => {
      ctx.fillStyle = "#d5dde3";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 1) {
        const shade = 190 + Math.round(Math.sin(y * 1.7) * 18);
        ctx.fillStyle = `rgba(${shade},${shade + 6},${shade + 10},0.45)`;
        ctx.fillRect(0, y, size, 1);
      }
    });
    const brushNormal = heightNormal((_, y) => 0.5 + Math.sin(y * 2.4) * 0.22);
    const brushRough = canvasTex((ctx, size) => {
      for (let y = 0; y < size; y += 1) {
        const shade = 70 + Math.round(Math.sin(y * 1.3) * 28);
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(0, y, size, 1);
      }
    }, 128, THREE.NoColorSpace);
    const wood = (repeatX: number, repeatY: number, tint = "#ffffff") => new THREE.MeshPhysicalMaterial({
      color: tint,
      map: repeated(woodAlbedo, repeatX, repeatY),
      normalMap: repeated(woodNormal, repeatX, repeatY),
      roughnessMap: repeated(woodRough, repeatX, repeatY),
      roughness: 0.72,
      metalness: 0.02,
      clearcoat: 0.14,
      clearcoatRoughness: 0.42,
      normalScale: new THREE.Vector2(0.55, 0.55),
    });
    const carpet = (base: string) => new THREE.MeshStandardMaterial({
      map: repeated(carpetMap(base), 7, 7),
      normalMap: repeated(carpetNormal, 7, 7),
      roughnessMap: repeated(carpetRough, 7, 7),
      roughness: 1,
      metalness: 0,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });
    const floorX = Math.max(4, layout.width / 6);
    const floorZ = Math.max(4, layout.depth / 6);
    return {
      wood: wood(2.2, 2.2),
      woodFloor: wood(floorX, floorZ, "#d7b08a"),
      carpets: [carpet("#6d7d62"), carpet("#7a6a52"), carpet("#6e5c62")],
      tile: new THREE.MeshStandardMaterial({
        map: repeated(tileAlbedo, 8, 4),
        normalMap: repeated(tileNormal, 8, 4),
        roughnessMap: repeated(tileRough, 8, 4),
        roughness: 0.72,
        metalness: 0.04,
        normalScale: new THREE.Vector2(0.45, 0.45),
      }),
      woodDark: wood(1.4, 1.4, "#c8a27a"),
      paneling: new THREE.MeshStandardMaterial({
        map: repeated(panelAlbedo, 1.2, 1.2),
        normalMap: repeated(panelNormal, 1.2, 1.2),
        roughness: 0.78,
        metalness: 0,
        normalScale: new THREE.Vector2(0.4, 0.4),
      }),
      brick: new THREE.MeshStandardMaterial({
        map: repeated(brickAlbedo, 3, 2),
        normalMap: repeated(brickNormal, 3, 2),
        roughness: 0.86,
        metalness: 0.02,
        normalScale: new THREE.Vector2(0.65, 0.65),
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: "#d5e7f0",
        roughness: 0.05,
        metalness: 0,
        transmission: 0.88,
        thickness: 0.12,
        ior: 1.5,
        transparent: true,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.15,
      }),
      metal: new THREE.MeshPhysicalMaterial({
        color: "#e7eef2",
        map: repeated(brushAlbedo, 1, 2),
        normalMap: repeated(brushNormal, 1, 3),
        roughnessMap: repeated(brushRough, 1, 3),
        metalness: 1,
        roughness: 0.38,
        anisotropy: 0.82,
        anisotropyRotation: Math.PI / 2,
        clearcoat: 0.22,
        clearcoatRoughness: 0.32,
        envMapIntensity: 1.2,
        normalScale: new THREE.Vector2(0.2, 0.45),
      }),
      joint: new THREE.MeshStandardMaterial({ color: "#4e575e", metalness: 0.72, roughness: 0.38 }),
      fabric: new THREE.MeshStandardMaterial({ color: "#8d4d3c", roughness: 0.9 }),
      fabricAlt: new THREE.MeshStandardMaterial({ color: "#3f5e4c", roughness: 0.9 }),
      plant: new THREE.MeshStandardMaterial({ color: "#2f6b3a", roughness: 0.72 }),
      plantLite: new THREE.MeshStandardMaterial({ color: "#4e8f52", roughness: 0.68 }),
      pot: new THREE.MeshStandardMaterial({ color: "#6b4428", roughness: 0.8 }),
      rug: new THREE.MeshStandardMaterial({ color: "#7a3040", roughness: 0.9 }),
      frame: new THREE.MeshStandardMaterial({ color: "#3d2a1c", roughness: 0.6 }),
      trim: new THREE.MeshStandardMaterial({ color: "#5c4632", roughness: 0.7 }),
      vaultFloor: new THREE.MeshStandardMaterial({ color: "#2c3238", roughness: 0.82, metalness: 0.22 }),
      steel: new THREE.MeshPhysicalMaterial({
        color: "#9aa3ab",
        map: repeated(brushAlbedo, 1, 2),
        normalMap: repeated(brushNormal, 1, 2),
        roughnessMap: repeated(brushRough, 1, 2),
        metalness: 1,
        roughness: 0.34,
        anisotropy: 0.74,
        clearcoat: 0.28,
        clearcoatRoughness: 0.3,
        envMapIntensity: 1.15,
        normalScale: new THREE.Vector2(0.18, 0.4),
      }),
      cash: new THREE.MeshStandardMaterial({ color: "#1f7a3c", roughness: 0.72 }),
      gold: new THREE.MeshStandardMaterial({ color: "#e2b227", metalness: 0.82, roughness: 0.28, emissive: "#8a6410", emissiveIntensity: 0.18 }),
    };
  }, [layout.width, layout.depth]);
}

function FloorLabel({ text, x, z }: { text: string; x: number; z: number }) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 1024, 128);
      ctx.fillStyle = "rgba(28, 33, 30, 0.55)";
      ctx.font = "700 64px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 512, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text]);
  const width = Math.min(4.2, Math.max(1.8, text.length * 0.16));
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.045, z]}>
      <planeGeometry args={[width, width * 0.16]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  );
}

function Plant({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const mats = useMats();
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.16, 0]} castShadow material={mats.pot}>
        <cylinderGeometry args={[0.16, 0.12, 0.28, 12]} />
      </mesh>
      <mesh position={[0, 0.46, 0]} castShadow material={mats.plant}>
        <sphereGeometry args={[0.26, 14, 12]} />
      </mesh>
      <mesh position={[0.12, 0.58, 0.04]} castShadow material={mats.plantLite}>
        <sphereGeometry args={[0.15, 12, 10]} />
      </mesh>
    </group>
  );
}

const MatsContext = createContext<ReturnType<typeof useOfficeMaterials> | null>(null);
const TapContext = createContext<() => boolean>(() => true);
function useMats() {
  const mats = useContext(MatsContext);
  if (!mats) throw new Error("Office materials are not ready.");
  return mats;
}

function Shell({ layout }: { layout: OfficeLayout }) {
  const mats = useMats();
  return (
    <group>
      {layout.rooms.map((room) => {
        const carpet = room.kind === "vault"
          ? mats.vaultFloor
          : room.kind === "office"
          ? mats.carpets[Math.max(0, room.tint) % mats.carpets.length]
          : room.kind === "hall" || room.kind === "break"
            ? mats.tile
            : mats.woodFloor;
        return (
          <mesh key={room.id} rotation={[-Math.PI / 2, 0, 0]} position={[room.x + room.w / 2, 0.02, room.z + room.d / 2]} receiveShadow material={carpet}>
            <planeGeometry args={[room.w, room.d]} />
          </mesh>
        );
      })}
      {layout.rooms.map((room) => (
        <FloorLabel key={`label-${room.id}`} text={room.label} x={room.x + 1.7} z={room.z + (room.id === "hall" ? room.d / 2 : 0.7)} />
      ))}
      {layout.walls.map((wall, index) => {
        const height = wall.exterior || wall.full ? EXTERIOR_H : INTERIOR_H;
        return (
          <mesh
            key={`wall-${index}`}
            position={[wall.x + wall.w / 2, height / 2, wall.z + wall.d / 2]}
            castShadow
            receiveShadow
            material={wall.exterior ? mats.brick : wall.full ? mats.steel : mats.paneling}
          >
            <boxGeometry args={[wall.w, height, wall.d]} />
          </mesh>
        );
      })}
      {layout.windows.map((opening, index) => {
        const alongX = opening.axis === "x";
        const glassW = alongX ? opening.width : 0.06;
        const glassD = alongX ? 0.06 : opening.width;
        const y = (SILL_H + HEADER_Y) / 2;
        const h = HEADER_Y - SILL_H;
        return (
          <group key={`win-${index}`}>
            <mesh position={[opening.x, SILL_H / 2, opening.z]} castShadow receiveShadow material={mats.brick}>
              <boxGeometry args={[alongX ? opening.width : 0.2, SILL_H, alongX ? 0.2 : opening.width]} />
            </mesh>
            <mesh position={[opening.x, (EXTERIOR_H + HEADER_Y) / 2, opening.z]} material={mats.brick}>
              <boxGeometry args={[alongX ? opening.width : 0.2, EXTERIOR_H - HEADER_Y, alongX ? 0.2 : opening.width]} />
            </mesh>
            <mesh position={[opening.x, y, opening.z]} material={mats.glass}>
              <boxGeometry args={[glassW, h, glassD]} />
            </mesh>
            <mesh position={[opening.x, y, opening.z]} material={mats.trim}>
              <boxGeometry args={[alongX ? 0.05 : 0.1, h, alongX ? 0.1 : 0.05]} />
            </mesh>
          </group>
        );
      })}
      {layout.doors.filter((door) => door.b !== "vault").map((door) => {
        const alongX = door.axis === "x";
        return (
          <group key={door.id}>
            <mesh position={[door.x, 0.03, door.z]} receiveShadow material={mats.trim}>
              <boxGeometry args={[alongX ? door.width : 0.7, 0.02, alongX ? 0.7 : door.width]} />
            </mesh>
            <mesh position={[door.x, 1.05, door.z]} material={mats.trim}>
              <boxGeometry args={[alongX ? door.width + 0.12 : 0.1, 0.08, alongX ? 0.1 : door.width + 0.12]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Desk({ x, z, accent }: { x: number; z: number; accent: string }) {
  const mats = useMats();
  const deskZ = z - 0.82;
  const screen = useMemo(() => new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  }), [accent]);
  return (
    <group>
      <mesh position={[x, 0.74, deskZ]} castShadow receiveShadow material={mats.woodDark}>
        <boxGeometry args={[1.28, 0.06, 0.66]} />
      </mesh>
      {[[-0.54, -0.24], [0.54, -0.24], [-0.54, 0.24], [0.54, 0.24]].map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[x + lx, 0.36, deskZ + lz]} castShadow material={mats.trim}>
          <boxGeometry args={[0.06, 0.7, 0.06]} />
        </mesh>
      ))}
      <mesh position={[x, 0.46, z]} castShadow receiveShadow material={mats.wood}>
        <boxGeometry args={[0.48, 0.07, 0.46]} />
      </mesh>
      <mesh position={[x, 0.78, z + 0.2]} castShadow material={mats.woodDark}>
        <boxGeometry args={[0.48, 0.5, 0.07]} />
      </mesh>
      <mesh position={[x, 1.02, deskZ - 0.22]} castShadow material={mats.joint}>
        <boxGeometry args={[0.62, 0.38, 0.045]} />
      </mesh>
      <mesh position={[x, 1.02, deskZ - 0.195]} material={screen}>
        <planeGeometry args={[0.52, 0.28]} />
      </mesh>
      <mesh position={[x - 0.05, 0.79, deskZ + 0.12]} material={mats.joint}>
        <boxGeometry args={[0.32, 0.02, 0.12]} />
      </mesh>
      <mesh position={[x + 0.42, 0.8, deskZ + 0.08]} material={mats.fabricAlt}>
        <cylinderGeometry args={[0.05, 0.045, 0.08, 10]} />
      </mesh>
    </group>
  );
}

function Shelf({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  const mats = useMats();
  const books = useMemo(() => Array.from({ length: Math.max(6, Math.floor(w / 0.16)) }, (_, index) => ({
    color: ACCENTS[index % ACCENTS.length],
    h: 0.28 + (index % 4) * 0.04,
  })), [w]);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow material={mats.woodDark}>
        <boxGeometry args={[w, 1.7, d]} />
      </mesh>
      {books.map((book, index) => (
        <mesh key={index} position={[-w / 2 + 0.12 + index * ((w - 0.2) / books.length), 1.15, d * 0.15]} castShadow>
          <boxGeometry args={[0.08, book.h, d * 0.55]} />
          <meshStandardMaterial color={book.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function HitPad({ args, position }: { args: [number, number, number]; position?: [number, number, number] }) {
  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function WingStations({
  layout,
  sections,
  onOpen,
}: {
  layout: OfficeLayout;
  sections: OfficeSection[];
  onOpen: (board: BoardOpen) => void;
}) {
  const mats = useMats();
  const canOpen = useContext(TapContext);
  const stations = useMemo(() => boardStations(layout, sections), [layout, sections]);
  return (
    <group>
      {stations.map((station) => (
        <group key={station.office}>
          <group
            position={[station.calendar.x, 1.45, station.calendar.z]}
            onClick={(event) => { event.stopPropagation(); if (canOpen()) onOpen({ office: station.office, panel: "calendar" }); }}
          >
            <mesh castShadow material={mats.frame}>
              <boxGeometry args={[0.72, 0.92, 0.04]} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[0.6, 0.78]} />
              <meshStandardMaterial color="#f7f1e4" />
            </mesh>
            <mesh position={[0, 0.34, 0.04]}>
              <boxGeometry args={[0.6, 0.12, 0.01]} />
              <meshStandardMaterial color="#1f3b2d" />
            </mesh>
            <HitPad args={[1.25, 1.35, 0.45]} position={[0, 0, 0.06]} />
          </group>
          <group
            position={[station.whiteboard.x, 1.4, station.whiteboard.z]}
            onClick={(event) => { event.stopPropagation(); if (canOpen()) onOpen({ office: station.office, panel: "todos" }); }}
          >
            <mesh castShadow material={mats.trim}>
              <boxGeometry args={[1.15, 0.78, 0.04]} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[1.02, 0.64]} />
              <meshStandardMaterial color="#f4f7f2" />
            </mesh>
            <HitPad args={[1.6, 1.15, 0.45]} position={[0, 0, 0.06]} />
          </group>
          <group
            position={[station.inbox.x, 0, station.inbox.z]}
            onClick={(event) => { event.stopPropagation(); if (canOpen()) onOpen({ office: station.office, panel: "notes" }); }}
          >
            <mesh position={[0, 0.42, 0]} castShadow receiveShadow material={mats.woodDark}>
              <boxGeometry args={[0.7, 0.5, 0.46]} />
            </mesh>
            <mesh position={[0, 0.7, 0]} castShadow material={mats.frame}>
              <boxGeometry args={[0.52, 0.08, 0.34]} />
            </mesh>
            <mesh position={[0, 0.78, 0]} rotation={[-0.4, 0, 0.1]}>
              <boxGeometry args={[0.28, 0.02, 0.2]} />
              <meshStandardMaterial color="#f7f1e4" />
            </mesh>
            <HitPad args={[1.15, 1.05, 0.8]} position={[0, 0.5, 0]} />
          </group>
        </group>
      ))}
    </group>
  );
}

function BalanceGlow({ text, x, y, z, onOpen }: { text: string; x: number; y: number; z: number; onOpen: () => void }) {
  const canOpen = useContext(TapContext);
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#121812";
      ctx.fillRect(0, 0, 768, 192);
      ctx.strokeStyle = "#b6ff6a";
      ctx.lineWidth = 10;
      ctx.strokeRect(12, 12, 744, 168);
      ctx.fillStyle = "#e7ffc4";
      ctx.font = `700 ${text.length > 12 ? 64 : 84}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#9dff6a";
      ctx.shadowBlur = 18;
      ctx.fillText(text, 384, 100);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text]);
  return (
    <group position={[x, y, z]}>
      <mesh onClick={(event) => { event.stopPropagation(); if (canOpen()) onOpen(); }}>
        <planeGeometry args={[1.7, 0.42]} />
        <meshStandardMaterial map={map} emissive="#b6ff6a" emissiveMap={map} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <pointLight color="#c6ff7a" intensity={0.7} distance={3.4} />
    </group>
  );
}

function CashStack() {
  const mats = useMats();
  return (
    <group>
      {[0, 1, 2, 3].map((layer) => (
        <mesh key={layer} position={[0, 0.12 + layer * 0.22, (layer % 2) * 0.01]} castShadow receiveShadow material={mats.cash}>
          <boxGeometry args={[0.5, 0.2, 0.26]} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]} material={mats.gold}>
        <boxGeometry args={[0.52, 0.035, 0.28]} />
      </mesh>
    </group>
  );
}

function GoldPile() {
  const mats = useMats();
  return (
    <group>
      {[0, 1].map((layer) => (
        <mesh key={layer} position={[0, 0.08 + layer * 0.16, 0]} castShadow receiveShadow material={mats.gold}>
          <boxGeometry args={[0.42, 0.12, 0.2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Round steel door on the vault's hall wall. Click swings it open and the piles track the balance. */
function VaultDoor({ layout, total, onOpen }: { layout: OfficeLayout; total: number; onOpen: () => void }) {
  const mats = useMats();
  const hinge = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const [open, setOpen] = useState(false);
  const room = layout.rooms.find((item) => item.id === "vault");
  const plan = vaultPilePlan(total);
  const label = formatWalletMoney(total);
  const canOpen = useContext(TapContext);
  useFrame((_, dt) => {
    const node = hinge.current;
    if (!node) return;
    const target = open ? -1.25 : 0;
    angle.current = THREE.MathUtils.damp(angle.current, target, 5, dt);
    node.rotation.y = angle.current;
  });
  if (!room) return null;
  const radius = 0.72;
  const centerY = 1.22;
  const half = 0.78;
  const jamb = Math.max(0.06, half - radius);
  const top = Math.max(0.08, EXTERIOR_H - (centerY + radius));
  const sill = Math.max(0.08, centerY - radius);
  const doorX = room.x + room.w / 2;
  const doorZ = room.z + room.d;
  const cx = doorX;
  const cz = room.z + room.d - 1.7;
  const openDoor = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    if (!canOpen()) return;
    setOpen((current) => !current);
    onOpen();
  };
  return (
    <group>
      <mesh position={[doorX - half + jamb / 2, EXTERIOR_H / 2, doorZ]} castShadow material={mats.steel}>
        <boxGeometry args={[jamb, EXTERIOR_H, 0.28]} />
      </mesh>
      <mesh position={[doorX + half - jamb / 2, EXTERIOR_H / 2, doorZ]} castShadow material={mats.steel}>
        <boxGeometry args={[jamb, EXTERIOR_H, 0.28]} />
      </mesh>
      <mesh position={[doorX, centerY + radius + top / 2, doorZ]} castShadow material={mats.steel}>
        <boxGeometry args={[radius * 2, top, 0.28]} />
      </mesh>
      <mesh position={[doorX, sill / 2, doorZ]} castShadow material={mats.steel}>
        <boxGeometry args={[radius * 2, sill, 0.28]} />
      </mesh>
      <BalanceGlow text={label} x={doorX} y={centerY + radius + Math.min(top * 0.45, 0.28)} z={doorZ + 0.22} onOpen={onOpen} />
      <group ref={hinge} position={[doorX - radius, 0, doorZ]}>
        <mesh
          position={[radius, centerY, 0.12]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
          material={mats.steel}
          onClick={openDoor}
        >
          <cylinderGeometry args={[radius, radius, 0.16, 40]} />
        </mesh>
        <mesh position={[radius, centerY, 0.24]} material={mats.metal} onClick={openDoor}>
          <torusGeometry args={[0.22, 0.035, 10, 28]} />
        </mesh>
        {[0, 1, 2].map((spoke) => (
          <mesh key={spoke} position={[radius, centerY, 0.24]} rotation={[0, 0, spoke * (Math.PI / 3)]} material={mats.metal} onClick={openDoor}>
            <boxGeometry args={[0.38, 0.05, 0.04]} />
          </mesh>
        ))}
      </group>
      {Array.from({ length: plan.count }, (_, index) => {
        const x = cx - ((plan.count - 1) * 0.62) / 2 + index * 0.62;
        return (
          <group key={`cash-${index}`} position={[x - 0.35, 0, cz]} scale={[1, plan.cashHeight, 1]}>
            <CashStack />
          </group>
        );
      })}
      {Array.from({ length: plan.count }, (_, index) => {
        const x = cx - ((plan.count - 1) * 0.5) / 2 + index * 0.5;
        return (
          <group key={`gold-${index}`} position={[x + 0.45, 0, cz + 0.85]} scale={[1, plan.goldHeight, 1]}>
            <GoldPile />
          </group>
        );
      })}
      <pointLight position={[cx, 1.7, cz]} color="#ffe1a8" intensity={total > 0 ? 1.1 : 0.25} distance={room.d} decay={2} />
    </group>
  );
}

function Furniture({ layout, onOpenMeet }: { layout: OfficeLayout; onOpenMeet: () => void }) {
  const mats = useMats();
  const canOpen = useContext(TapContext);
  const rooms = Object.fromEntries(layout.rooms.map((room) => [room.id, room])) as Record<string, OfficeRoom>;
  const brk = rooms.break;
  const library = rooms.library;
  const hq = rooms.hq;
  const table = layout.conferenceTable;
  return (
    <group>
      {Object.entries(layout.homes).map(([id, home], index) => (
        <Desk key={id} x={home.x} z={home.z} accent={ACCENTS[index % ACCENTS.length] ?? "#2f6d4f"} />
      ))}
      {table ? (
        <group onClick={(event) => { event.stopPropagation(); if (canOpen()) onOpenMeet(); }}>
          <mesh position={[table.x, 0.74, table.z]} castShadow receiveShadow material={mats.woodDark}>
            <boxGeometry args={[table.w, 0.08, table.d]} />
          </mesh>
          <HitPad args={[Math.max(table.w, 1.8), 1.3, Math.max(table.d, 1.4)]} position={[table.x, 0.85, table.z]} />
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], index) => (
            <mesh key={index} position={[table.x + sx * (table.w / 2 - 0.4), 0.36, table.z + sz * (table.d / 2 - 0.35)]} castShadow material={mats.trim}>
              <boxGeometry args={[0.1, 0.7, 0.1]} />
            </mesh>
          ))}
        </group>
      ) : null}
      {layout.seats.map((seat, index) => (
        <mesh key={`seat-${index}`} position={[seat.x, 0.42, seat.z]} castShadow material={mats.fabricAlt}>
          <boxGeometry args={[0.42, 0.08, 0.42]} />
        </mesh>
      ))}
      {library ? (
        <group>
          <Shelf x={library.x + 0.45} z={library.z + library.d * 0.55} w={0.4} d={library.d * 0.62} />
          <Shelf x={library.x + library.w / 2} z={library.z + library.d - 0.45} w={library.w - 1.4} d={0.4} />
          <mesh position={[library.x + library.w * 0.55, 0.74, library.z + library.d * 0.48]} castShadow receiveShadow material={mats.wood}>
            <boxGeometry args={[2.4, 0.08, 1.1]} />
          </mesh>
          <Plant x={library.x + library.w - 0.7} z={library.z + 0.8} />
        </group>
      ) : null}
      {brk ? (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[brk.x + 2.3, 0.04, brk.z + brk.d * 0.62]} receiveShadow material={mats.rug}>
            <planeGeometry args={[3.1, 2.1]} />
          </mesh>
          <mesh position={[brk.x + 2.2, 0.38, brk.z + brk.d - 1.15]} castShadow receiveShadow material={mats.fabric}>
            <boxGeometry args={[2.6, 0.42, 0.8]} />
          </mesh>
          <mesh position={[brk.x + 2.2, 0.72, brk.z + brk.d - 0.82]} castShadow material={mats.fabric}>
            <boxGeometry args={[2.6, 0.55, 0.16]} />
          </mesh>
          <mesh position={[brk.x + 2.2, 0.36, brk.z + brk.d - 2.15]} castShadow receiveShadow material={mats.woodDark}>
            <boxGeometry args={[1.1, 0.32, 0.6]} />
          </mesh>
          {[0, 1].map((index) => (
            <mesh key={`arm-${index}`} position={[brk.x + 1.15 + index * 2.1, 0.4, brk.z + brk.d - 2.7]} castShadow material={mats.fabricAlt}>
              <boxGeometry args={[0.7, 0.42, 0.7]} />
            </mesh>
          ))}
          {[0, 1].map((index) => {
            const tx = brk.x + brk.w * 0.62 + index * 1.7;
            const tz = brk.z + 2.5;
            return (
              <group key={`cafe-${index}`}>
                <mesh position={[tx, 0.72, tz]} castShadow receiveShadow material={mats.woodDark}>
                  <cylinderGeometry args={[0.42, 0.42, 0.06, 16]} />
                </mesh>
                <mesh position={[tx, 0.36, tz]} castShadow material={mats.trim}>
                  <cylinderGeometry args={[0.06, 0.08, 0.7, 8]} />
                </mesh>
                <mesh position={[tx - 0.55, 0.42, tz]} castShadow material={mats.fabricAlt}>
                  <boxGeometry args={[0.38, 0.08, 0.38]} />
                </mesh>
                <mesh position={[tx + 0.55, 0.42, tz]} castShadow material={mats.fabric}>
                  <boxGeometry args={[0.38, 0.08, 0.38]} />
                </mesh>
              </group>
            );
          })}
          <mesh position={[brk.x + brk.w - 0.55, 0.55, brk.z + brk.d * 0.5]} castShadow receiveShadow material={mats.wood}>
            <boxGeometry args={[0.7, 1.05, 2.2]} />
          </mesh>
          <mesh position={[brk.x + brk.w - 0.55, 1.15, brk.z + brk.d * 0.35]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshStandardMaterial color="#2f7d4a" emissive="#2f7d4a" emissiveIntensity={0.8} />
          </mesh>
          <Plant x={brk.x + brk.w - 1.3} z={brk.z + brk.d - 0.8} scale={1.15} />
          <Plant x={brk.x + 0.7} z={brk.z + 1.3} />
        </group>
      ) : null}
      {hq ? <Plant x={hq.x + 0.7} z={hq.z + 0.8} /> : null}
      {layout.rooms.filter((room) => room.kind === "manager" || room.kind === "conference").map((room) => (
        <Plant key={`plant-${room.id}`} x={room.x + room.w - 0.7} z={room.z + 0.8} />
      ))}
      {layout.rooms.filter((room) => room.kind === "hq" || room.kind === "conference" || room.kind === "break").map((room, index) => (
        <mesh key={`art-${room.id}`} position={[room.x + room.w * 0.5, 1.7, room.z + 0.12]} material={mats.frame}>
          <boxGeometry args={[0.9, 0.6, 0.04]} />
          <meshStandardMaterial color={ACCENTS[index % ACCENTS.length]} />
        </mesh>
      ))}
    </group>
  );
}

function SpeechBubble({ text }: { text: string }) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    const shown = text.length > 72 ? `${text.slice(0, 69)}…` : text;
    if (ctx) {
      ctx.fillStyle = "rgba(255, 252, 246, 0.96)";
      ctx.beginPath();
      ctx.roundRect(12, 16, 744, 140, 22);
      ctx.fill();
      ctx.fillStyle = "#1c211e";
      ctx.font = "600 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(shown, 384, 86);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text]);
  if (!text) return null;
  return (
    <sprite position={[0, 2.55, 0]} scale={[2.15, 0.54, 1]}>
      <spriteMaterial map={map} transparent depthTest={false} />
    </sprite>
  );
}

function NameTag({ name, status }: { name: string; status: BotStatus }) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(251,248,243,0.92)";
      ctx.beginPath();
      ctx.roundRect(8, 16, 496, 96, 18);
      ctx.fill();
      ctx.fillStyle = STATUS_COLOR[status];
      ctx.beginPath();
      ctx.arc(48, 64, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1c211e";
      ctx.font = "700 42px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(name, 76, 66);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [name, status]);
  return (
    <sprite position={[0, 2.05, 0]} scale={[1.7, 0.42, 1]}>
      <spriteMaterial map={map} transparent depthTest={false} />
    </sprite>
  );
}

function Robot({
  id,
  name,
  short,
  status,
  accent,
  selected,
  line,
  onSelect,
  layout,
  sim,
}: {
  id: string;
  name: string;
  short: string;
  status: BotStatus;
  accent: string;
  selected: boolean;
  line: string;
  onSelect: (id: string) => void;
  layout: OfficeLayout;
  sim: OfficeSimStore;
}) {
  const mats = useMats();
  const canOpen = useContext(TapContext);
  const root = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const chest = useMemo(() => new THREE.MeshStandardMaterial({
    color: accent,
    metalness: 0.35,
    roughness: 0.4,
    emissive: accent,
    emissiveIntensity: 0.12,
  }), [accent]);
  const visor = useMemo(() => new THREE.MeshStandardMaterial({
    color: STATUS_COLOR[status],
    emissive: STATUS_COLOR[status],
    emissiveIntensity: 0.7,
    roughness: 0.25,
  }), [status]);
  useFrame(() => {
    const bot = sim.state.bots[id];
    if (!bot || !root.current) return;
    root.current.position.set(bot.x, 0, bot.z);
    root.current.rotation.y = bot.yaw;
    const seated = isSeated(bot, layout.homes[id]);
    const moving = bot.path.length > 0;
    const swing = moving ? Math.sin(bot.phase) * 0.65 : 0;
    if (bob.current) bob.current.position.y = seated ? -0.32 : 0;
    if (armL.current) armL.current.rotation.x = seated ? 0.4 : -swing;
    if (armR.current) armR.current.rotation.x = seated ? 0.25 : swing;
    if (legL.current) legL.current.rotation.x = seated ? -1.15 : swing;
    if (legR.current) legR.current.rotation.x = seated ? -1.15 : -swing;
    if (shinL.current) shinL.current.rotation.x = seated ? 1.2 : Math.max(0, -swing) * 0.55;
    if (shinR.current) shinR.current.rotation.x = seated ? 1.2 : Math.max(0, swing) * 0.55;
    if (ring.current) ring.current.visible = selected;
  });
  return (
    <group ref={root} userData={{ short }}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.42, 0.52, 28]} />
        <meshBasicMaterial color="#1f3b2d" />
      </mesh>
      <group ref={bob} onClick={(event) => { event.stopPropagation(); if (canOpen()) onSelect(id); }}>
        <HitPad args={[0.95, 1.9, 0.95]} position={[0, 1, 0]} />
        <mesh position={[0, 1.05, 0]} castShadow material={mats.metal}>
          <capsuleGeometry args={[0.2, 0.42, 6, 12]} />
        </mesh>
        <mesh position={[0, 1.12, 0.16]} material={chest}>
          <boxGeometry args={[0.28, 0.22, 0.04]} />
        </mesh>
        <mesh position={[0, 1.52, 0]} castShadow material={mats.metal}>
          <sphereGeometry args={[0.16, 16, 14]} />
        </mesh>
        <mesh position={[0, 1.52, 0.12]} material={visor}>
          <boxGeometry args={[0.2, 0.06, 0.04]} />
        </mesh>
        <mesh position={[0, 1.74, 0]} material={mats.joint}>
          <cylinderGeometry args={[0.015, 0.015, 0.16, 6]} />
        </mesh>
        <mesh position={[0, 1.84, 0]} material={visor}>
          <sphereGeometry args={[0.035, 8, 8]} />
        </mesh>
        <group ref={armL} position={[-0.28, 1.28, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow material={mats.metal}>
            <capsuleGeometry args={[0.045, 0.28, 4, 8]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.28, 1.28, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow material={mats.metal}>
            <capsuleGeometry args={[0.045, 0.28, 4, 8]} />
          </mesh>
        </group>
        <group ref={legL} position={[-0.1, 0.72, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow material={mats.joint}>
            <capsuleGeometry args={[0.05, 0.22, 4, 8]} />
          </mesh>
          <group ref={shinL} position={[0, -0.36, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow material={mats.metal}>
              <capsuleGeometry args={[0.045, 0.2, 4, 8]} />
            </mesh>
          </group>
        </group>
        <group ref={legR} position={[0.1, 0.72, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow material={mats.joint}>
            <capsuleGeometry args={[0.05, 0.22, 4, 8]} />
          </mesh>
          <group ref={shinR} position={[0, -0.36, 0]}>
            <mesh position={[0, -0.16, 0]} castShadow material={mats.metal}>
              <capsuleGeometry args={[0.045, 0.2, 4, 8]} />
            </mesh>
          </group>
        </group>
        <NameTag name={`${name}`} status={status} />
        <SpeechBubble text={line} />
        <mesh position={[0, 1.55, 0]} visible={false}>
          <boxGeometry args={[0.5, 1.6, 0.4]} />
        </mesh>
      </group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.22, 16]} />
        <meshBasicMaterial color="#1c211e" transparent opacity={0.22} />
      </mesh>
      <sprite position={[0, 1.12, 0.2]} scale={[0.28, 0.14, 1]}>
        <spriteMaterial color="#fbf8f3" />
      </sprite>
    </group>
  );
}

function Lights({ layout, weather, phone }: { layout: OfficeLayout; weather: OfficeWeather; phone: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const sun = sunPosition(weather.hour, layout);
  const day = THREE.MathUtils.clamp((weather.sunElevation + 0.08) / 1.05, 0, 1);
  const overcast = weather.kind === "fog" ? 0.35 : weather.kind === "rain" || weather.kind === "snow" ? 0.55 : 1;
  const color = weather.sunElevation < 0.16 && weather.sunElevation > -0.02 ? "#ffb36b" : weather.sunElevation <= 0 ? "#8eadd4" : "#fff3dd";
  useLayoutEffect(() => {
    const lamp = light.current;
    if (!lamp) return;
    lamp.target.position.set(layout.width / 2, 0, layout.depth / 2);
    lamp.parent?.add(lamp.target);
    lamp.target.updateMatrixWorld();
  }, [layout]);
  return (
    <>
      <hemisphereLight args={[skyColor(weather), "#6a5848", 0.22 + day * 0.5]} />
      <ambientLight intensity={0.08 + day * 0.16} />
      <directionalLight
        ref={light}
        position={[sun.x, Math.max(sun.y, 6), sun.z]}
        intensity={(0.12 + day * 1.65) * overcast}
        color={color}
        castShadow
        shadow-mapSize-width={phone ? 1024 : 2048}
        shadow-mapSize-height={phone ? 1024 : 2048}
        shadow-bias={-0.0004}
        shadow-camera-near={2}
        shadow-camera-far={140}
        shadow-camera-left={-(layout.width + 24)}
        shadow-camera-right={layout.width + 24}
        shadow-camera-top={layout.depth + 30}
        shadow-camera-bottom={-(layout.depth + 20)}
      />
      {weather.sunElevation > 0.05 && weather.kind === "clear" ? (
        <mesh position={[sun.x, sun.y, sun.z]}>
          <sphereGeometry args={[1.6, 16, 12]} />
          <meshBasicMaterial color="#ffe7a3" />
        </mesh>
      ) : null}
      {layout.rooms.map((room) => (
        <group key={`light-${room.id}`}>
          <mesh position={[room.x + room.w / 2, 2.35, room.z + room.d / 2]}>
            <boxGeometry args={[0.7, 0.05, 0.28]} />
            <meshStandardMaterial color="#f6e2b8" emissive="#f3d48a" emissiveIntensity={0.9} />
          </mesh>
          <pointLight
            position={[room.x + room.w / 2, 2.2, room.z + room.d / 2]}
            intensity={0.45 + (weather.sunElevation < 0.05 ? 0.85 : 0.1)}
            distance={Math.max(room.w, room.d) * 1.4}
            decay={2}
            color="#fff1d6"
          />
        </group>
      ))}
    </>
  );
}

function SimDriver({
  sim,
  meetingRef,
  botsRef,
}: {
  sim: OfficeSimStore;
  meetingRef: React.MutableRefObject<string[]>;
  botsRef: React.MutableRefObject<BotCard[]>;
}) {
  useFrame((_, dt) => {
    const statuses: Record<string, string> = {};
    const names: Record<string, string> = {};
    for (const bot of botsRef.current) {
      statuses[bot.id] = bot.status;
      names[bot.id] = bot.name;
    }
    sim.step(dt, { meeting: meetingRef.current, statuses, names });
  }, -1);
  return null;
}

function StudioEnv() {
  const gl = useThree((state) => state.gl);
  const texture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#b7d4e8", side: THREE.BackSide }),
    );
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(12, 16),
      new THREE.MeshBasicMaterial({ color: "#6d7a62" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    env.add(sky, ground);
    const tex = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
    sky.geometry.dispose();
    (sky.material as THREE.Material).dispose();
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    return tex;
  }, [gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <primitive object={texture} attach="environment" />;
}

function Scene({
  layout,
  sections,
  bots,
  selected,
  onSelect,
  onOpenBoard,
  sim,
  meetingRef,
  botsRef,
  cameraApiRef,
  weather,
  speech,
  vaultTotal,
  onOpenVault,
  onOpenMeet,
  onClear,
  canOpen,
  phone,
}: {
  layout: OfficeLayout;
  sections: OfficeSection[];
  bots: BotCard[];
  selected: string;
  onSelect: (id: string) => void;
  onOpenBoard: (board: BoardOpen) => void;
  sim: OfficeSimStore;
  meetingRef: React.MutableRefObject<string[]>;
  botsRef: React.MutableRefObject<BotCard[]>;
  cameraApiRef: React.MutableRefObject<OfficeCameraApi | null>;
  weather: OfficeWeather;
  speech: Record<string, string>;
  vaultTotal: number;
  onOpenVault: () => void;
  onOpenMeet: () => void;
  onClear: () => void;
  canOpen: () => boolean;
  phone: boolean;
}) {
  const mats = useOfficeMaterials(layout);
  const controls = useRef<OrbitControlsType>(null);
  const sky = skyColor(weather);
  const fog = fogDistances(weather);
  const home = useMemo(() => mapHome(layout), [layout]);
  useLayoutEffect(() => {
    cameraApiRef.current = {
      reset() {
        const orbit = controls.current;
        if (!orbit) return;
        orbit.object.position.copy(home.position);
        orbit.target.copy(home.target);
        orbit.update();
      },
      zoomBy(factor) {
        const orbit = controls.current;
        if (!orbit) return;
        const offset = orbit.object.position.clone().sub(orbit.target);
        const next = THREE.MathUtils.clamp(offset.length() * factor, MAP_MIN_DISTANCE, MAP_MAX_DISTANCE);
        offset.setLength(next);
        orbit.object.position.copy(orbit.target).add(offset);
        orbit.update();
      },
    };
    return () => {
      cameraApiRef.current = null;
    };
  }, [cameraApiRef, home]);
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, fog.near, fog.far]} />
      <StudioEnv />
      <Lights layout={layout} weather={weather} phone={phone} />
      <group onClick={(event) => { event.stopPropagation(); onClear(); }}>
      <OfficeSite layout={layout} weather={weather} />
      <TapContext.Provider value={canOpen}>
      <MatsContext.Provider value={mats}>
      <Shell layout={layout} />
      <Furniture layout={layout} onOpenMeet={onOpenMeet} />
      <VaultDoor layout={layout} total={vaultTotal} onOpen={onOpenVault} />
      <WingStations layout={layout} sections={sections} onOpen={onOpenBoard} />
      <SimDriver sim={sim} meetingRef={meetingRef} botsRef={botsRef} />
      {bots.map((bot, index) => (
        <Robot
          key={bot.id}
          id={bot.id}
          name={bot.name}
          short={bot.short}
          status={bot.status}
          accent={ACCENTS[index % ACCENTS.length] ?? "#2f6d4f"}
          selected={selected === bot.id}
          line={speech[bot.id] ?? ""}
          onSelect={onSelect}
          layout={layout}
          sim={sim}
        />
      ))}
      </MatsContext.Provider>
      </TapContext.Provider>
      </group>
      <MapControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        screenSpacePanning={false}
        zoomToCursor
        zoomSpeed={0.9}
        panSpeed={1.05}
        rotateSpeed={0.55}
        target={home.target}
        minDistance={MAP_MIN_DISTANCE}
        maxDistance={MAP_MAX_DISTANCE}
        minPolarAngle={0.42}
        maxPolarAngle={Math.PI / 2.2}
        mouseButtons={{
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{
          ONE: THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_ROTATE,
        }}
        onChange={() => {
          const orbit = controls.current;
          if (orbit) clampMapTarget(orbit, layout);
        }}
      />
    </>
  );
}

export default function OfficeCanvas({
  layout,
  sections,
  bots,
  selected,
  onSelect,
  onOpenBoard,
  meeting,
  sim,
  cameraApiRef,
  weather,
  speech,
  vaultTotal,
  onOpenVault,
  onOpenMeet,
  onClear,
}: {
  layout: OfficeLayout;
  sections: OfficeSection[];
  bots: BotCard[];
  selected: string;
  onSelect: (id: string) => void;
  onOpenBoard: (board: BoardOpen) => void;
  meeting: string[];
  sim: OfficeSimStore;
  cameraApiRef: React.MutableRefObject<OfficeCameraApi | null>;
  weather: OfficeWeather;
  speech: Record<string, string>;
  vaultTotal: number;
  onOpenVault: () => void;
  onOpenMeet: () => void;
  onClear: () => void;
}) {
  const meetingRef = useRef(meeting);
  const botsRef = useRef(bots);
  const gesture = useRef({ x: 0, y: 0, dragged: false, active: false });
  const canOpen = useRef(() => !gesture.current.dragged).current;
  const phone = useMemo(() => window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 800, []);
  useEffect(() => {
    meetingRef.current = meeting;
    botsRef.current = bots;
  }, [meeting, bots]);
  const camera = useMemo(() => {
    const home = mapHome(layout);
    return {
      position: home.position.toArray() as [number, number, number],
      fov: 38,
      near: 0.1,
      far: 400,
    };
  }, [layout]);
  return (
    <Canvas
      shadows
      camera={camera}
      dpr={phone ? [1, 1.15] : [1, 1.75]}
      gl={{ antialias: !phone, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerDown={(event) => {
        gesture.current = { x: event.clientX, y: event.clientY, dragged: false, active: true };
      }}
      onPointerMove={(event) => {
        if (!gesture.current.active) return;
        if (event.pointerType === "mouse" && !event.buttons) return;
        const moved = Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y);
        if (moved > 10) gesture.current.dragged = true;
      }}
      onPointerUp={() => {
        gesture.current.active = false;
      }}
      onPointerMissed={() => {
        if (!gesture.current.dragged) onClear();
      }}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(skyColor(weather));
      }}
    >
      <Scene
        layout={layout}
        sections={sections}
        bots={bots}
        selected={selected}
        onSelect={onSelect}
        onOpenBoard={onOpenBoard}
        sim={sim}
        meetingRef={meetingRef}
        botsRef={botsRef}
        cameraApiRef={cameraApiRef}
        weather={weather}
        speech={speech}
        vaultTotal={vaultTotal}
        onOpenVault={onOpenVault}
        onOpenMeet={onOpenMeet}
        onClear={() => {
          if (!gesture.current.dragged) onClear();
        }}
        canOpen={canOpen}
        phone={phone}
      />
    </Canvas>
  );
}
