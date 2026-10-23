"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OfficeLayout } from "@/lib/worlds/office-layout";
import { FOLIAGE_COLORS, type OfficeWeather } from "@/lib/worlds/office-weather";

const WALL_H = 2.55;

function canvasMap(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (ctx) draw(ctx, size);
  return tex;
}

function repeated(tex: THREE.Texture, x: number, y: number) {
  const clone = tex.clone();
  clone.repeat.set(x, y);
  clone.needsUpdate = true;
  return clone;
}

function useSiteMaterials(layout: OfficeLayout) {
  return useMemo(() => {
    const grassTex = canvasMap((ctx, size) => {
      ctx.fillStyle = "#5f8a46";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 2200; i += 1) {
        ctx.strokeStyle = i % 3 ? "rgba(30,70,24,0.35)" : "rgba(210,220,140,0.28)";
        ctx.beginPath();
        const x = (i * 47) % size;
        const y = (i * 83) % size;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y - 7);
        ctx.stroke();
      }
    });
    const asphaltTex = canvasMap((ctx, size) => {
      ctx.fillStyle = "#3a3d42";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 4000; i += 1) {
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.18)";
        ctx.fillRect((i * 29) % size, (i * 71) % size, 2, 2);
      }
    });
    const walkTex = canvasMap((ctx, size) => {
      ctx.fillStyle = "#c8c2b6";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 1600; i += 1) {
        ctx.fillStyle = `rgba(90,80,70,${0.04 + (i % 5) * 0.02})`;
        ctx.fillRect((i * 19) % size, (i * 43) % size, 3, 2);
      }
    });
    const span = Math.max(8, (layout.width + 70) / 8);
    return {
      grass: new THREE.MeshStandardMaterial({ map: repeated(grassTex, span, span), roughness: 0.96, metalness: 0 }),
      asphalt: new THREE.MeshStandardMaterial({ map: repeated(asphaltTex, 8, 6), roughness: 0.92, metalness: 0.04 }),
      walk: new THREE.MeshStandardMaterial({ map: repeated(walkTex, 6, 2), roughness: 0.88, metalness: 0.02 }),
      bark: new THREE.MeshStandardMaterial({ color: "#6b4a32", roughness: 0.92 }),
      trim: new THREE.MeshStandardMaterial({ color: "#d9d3c8", roughness: 0.7 }),
      sign: new THREE.MeshStandardMaterial({ color: "#1f3b2d", roughness: 0.55 }),
    };
  }, [layout.width]);
}

function Tree({
  x,
  z,
  variant,
  weather,
}: {
  x: number;
  z: number;
  variant: number;
  weather: OfficeWeather;
}) {
  const crown = useRef<THREE.Group>(null);
  const colors = FOLIAGE_COLORS[weather.foliage];
  const canopy = colors.canopy[variant % colors.canopy.length] ?? colors.canopy[0];
  const bare = weather.foliage === "winter" && variant % 2 === 0;
  useFrame((state) => {
    if (!crown.current) return;
    const bend = Math.min(0.16, 0.012 + weather.wind * 0.008);
    crown.current.rotation.z = Math.sin(state.clock.elapsedTime * (0.55 + weather.wind * 0.04) + x) * bend;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.22, 1.7, 7]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.92} />
      </mesh>
      <group ref={crown} position={[0, 1.7, 0]}>
        {bare ? (
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.08, 1.1, 5]} />
            <meshStandardMaterial color="#6b4a32" roughness={0.92} />
          </mesh>
        ) : (
          <>
            <mesh position={[0, 0.7, 0]} castShadow>
              <sphereGeometry args={[0.95, 14, 12]} />
              <meshStandardMaterial color={canopy} roughness={0.84} />
            </mesh>
            <mesh position={[0.4, 0.95, 0.12]} castShadow>
              <sphereGeometry args={[0.55, 12, 10]} />
              <meshStandardMaterial color={canopy} roughness={0.84} />
            </mesh>
            {colors.blossom ? (
              <mesh position={[-0.25, 1.15, 0.2]}>
                <sphereGeometry args={[0.16, 8, 8]} />
                <meshStandardMaterial color={colors.blossom} roughness={0.6} />
              </mesh>
            ) : null}
          </>
        )}
      </group>
    </group>
  );
}

function Shrub({ x, z, weather, tint }: { x: number; z: number; weather: OfficeWeather; tint: number }) {
  const ref = useRef<THREE.Group>(null);
  const colors = FOLIAGE_COLORS[weather.foliage];
  const color = colors.canopy[tint % colors.canopy.length] ?? colors.canopy[0];
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.8 + z) * Math.min(0.05, weather.wind * 0.004);
  });
  return (
    <group ref={ref} position={[x, 0, z]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.32, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <mesh position={[0.18, 0.36, 0.05]} castShadow>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
    </group>
  );
}

function FlowerBed({ x, z, weather }: { x: number; z: number; weather: OfficeWeather }) {
  const colors = FOLIAGE_COLORS[weather.foliage].flower;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[2.2, 0.14, 0.9]} />
        <meshStandardMaterial color="#5c4030" roughness={0.95} />
      </mesh>
      {colors.map((color, index) => (
        <mesh key={color} position={[-0.6 + index * 0.55, 0.24, (index % 2) * 0.18 - 0.08]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function Car({ x, z, yaw, color }: { x: number; z: number; yaw: number; color: string }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.62, roughness: 0.32 }), [color]);
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: "#b7d0dc",
    transmission: 0.55,
    roughness: 0.12,
    thickness: 0.08,
    transparent: true,
    opacity: 0.9,
    metalness: 0,
  }), []);
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.92 }), []);
  return (
    <group position={[x, 0.06, z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.34, 0]} castShadow receiveShadow material={paint}>
        <boxGeometry args={[1.65, 0.4, 3.5]} />
      </mesh>
      <mesh position={[0, 0.66, -0.12]} castShadow material={glass}>
        <boxGeometry args={[1.42, 0.36, 1.65]} />
      </mesh>
      {[[-0.68, 1.1], [0.68, 1.1], [-0.68, -1.1], [0.68, -1.1]].map(([wx, wz]) => (
        <mesh key={`${wx}-${wz}`} position={[wx, 0.18, wz]} rotation={[0, 0, Math.PI / 2]} castShadow material={rubber}>
          <cylinderGeometry args={[0.18, 0.18, 0.16, 12]} />
        </mesh>
      ))}
    </group>
  );
}

function Clouds({ layout, weather }: { layout: OfficeLayout; weather: OfficeWeather }) {
  const group = useRef<THREE.Group>(null);
  const show = weather.cloud > 0.2 || weather.kind === "rain" || weather.kind === "snow" || weather.kind === "fog";
  const puffs = useMemo(() => {
    const count = weather.kind === "clear" ? 3 : 7;
    return Array.from({ length: count }, (_, index) => ({
      x: (index - count / 2) * 9,
      y: 16 + (index % 3) * 1.4,
      z: -8 + (index % 4) * 6,
      s: 2.2 + (index % 3) * 0.7,
    }));
  }, [weather.kind]);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.x += dt * (0.25 + weather.wind * 0.06);
    if (group.current.position.x > layout.width + 24) group.current.position.x = -18;
  });
  if (!show) return null;
  const tint = weather.kind === "rain" || weather.kind === "snow" ? "#d5dde3" : "#f7f8f6";
  return (
    <group ref={group} position={[layout.width / 2, 0, layout.depth / 2]}>
      {puffs.map((puff) => (
        <mesh key={`${puff.x}-${puff.z}`} position={[puff.x, puff.y, puff.z]}>
          <sphereGeometry args={[puff.s, 12, 10]} />
          <meshStandardMaterial color={tint} transparent opacity={weather.kind === "fog" ? 0.45 : 0.82} roughness={1} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function unit(index: number) {
  const value = Math.sin(index * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function Precipitation({ layout, weather }: { layout: OfficeLayout; weather: OfficeWeather }) {
  const kind = weather.kind === "snow" ? "snow" : weather.kind === "rain" ? "rain" : "none";
  const count = kind === "none" ? 0 : 650;
  const geo = useMemo(() => {
    const positions = new Float32Array(Math.max(1, count) * 3);
    const spanX = layout.width + 36;
    const spanZ = layout.depth + 48;
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = unit(i + 1) * spanX - 12;
      positions[i * 3 + 1] = unit(i + 3) * 22;
      positions[i * 3 + 2] = unit(i + 5) * spanZ - 10;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [count, layout.width, layout.depth]);
  const points = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    const attr = points.current?.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!attr || kind === "none") return;
    const speed = kind === "snow" ? 1.5 : 14;
    const drift = weather.wind * (kind === "snow" ? 0.12 : 0.28);
    const spanX = layout.width + 36;
    for (let i = 0; i < attr.count; i += 1) {
      let y = attr.getY(i) - speed * dt;
      let x = attr.getX(i) + drift * dt;
      if (y < 0) y = 20 + unit(i + 9);
      if (x > spanX) x = -12;
      if (x < -14) x = spanX;
      attr.setX(i, x);
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });
  if (kind === "none") return null;
  return (
    <points ref={points} geometry={geo}>
      <pointsMaterial
        color={kind === "snow" ? "#f7fbff" : "#d5e6f2"}
        size={kind === "snow" ? 0.14 : 0.045}
        transparent
        opacity={0.8}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function Roof({ layout }: { layout: OfficeLayout }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const capRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ camera }) => {
    const over = camera.position.x > -8
      && camera.position.x < layout.width + 8
      && camera.position.z > -8
      && camera.position.z < layout.depth + 10;
    const open = over ? 1 - THREE.MathUtils.smoothstep(camera.position.y, 8, 20) : 0;
    for (const material of [materialRef.current, capRef.current]) {
      if (!material) continue;
      material.opacity = 1 - open;
      material.depthWrite = material.opacity > 0.85;
    }
  });
  return (
    <group>
      <mesh position={[layout.width / 2, WALL_H + 0.16, layout.depth / 2]} castShadow>
        <boxGeometry args={[layout.width + 1.1, 0.22, layout.depth + 1.1]} />
        <meshStandardMaterial ref={materialRef} color="#4e463f" roughness={0.78} metalness={0.08} transparent opacity={1} />
      </mesh>
      <mesh position={[layout.width / 2, WALL_H + 0.34, layout.depth / 2]}>
        <boxGeometry args={[layout.width + 0.4, 0.12, layout.depth + 0.4]} />
        <meshStandardMaterial ref={capRef} color="#6a625a" roughness={0.8} transparent opacity={1} />
      </mesh>
    </group>
  );
}

function EntranceSign() {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1f3b2d";
      ctx.fillRect(0, 0, 1024, 256);
      ctx.fillStyle = "#fbf8f3";
      ctx.font = "700 132px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Momma Mari", 512, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  return (
    <mesh position={[0, 0, 0.08]}>
      <planeGeometry args={[2.5, 0.62]} />
      <meshBasicMaterial map={map} toneMapped={false} />
    </mesh>
  );
}

export function OfficeSite({ layout, weather }: { layout: OfficeLayout; weather: OfficeWeather }) {
  const mats = useSiteMaterials(layout);
  const pad = 2.15;
  const lotW = 22;
  const lotD = 13;
  const lotX = layout.width / 2 - lotW / 2;
  const lotZ = layout.depth + 7.4;
  const doorX = layout.width / 2;
  const trees = [
    { x: -6.5, z: -4, variant: 0 },
    { x: layout.width + 6.5, z: -3.2, variant: 1 },
    { x: -7, z: layout.depth * 0.45, variant: 2 },
    { x: layout.width + 7, z: layout.depth * 0.5, variant: 3 },
    { x: -5.5, z: layout.depth + 6, variant: 1 },
    { x: layout.width + 5.5, z: layout.depth + 8, variant: 0 },
    { x: lotX - 3, z: lotZ + lotD + 1.5, variant: 2 },
    { x: lotX + lotW + 3, z: lotZ + 2, variant: 3 },
  ];
  const shrubs = [
    { x: 2.2, z: layout.depth + 1.15 },
    { x: layout.width - 2.2, z: layout.depth + 1.15 },
    { x: 1.4, z: -1.2 },
    { x: layout.width - 1.5, z: -1.15 },
    { x: -1.3, z: 4 },
    { x: layout.width + 1.3, z: 6 },
  ];
  const cars = [
    { x: lotX + 3.2, z: lotZ + 3.1, yaw: 0, color: "#1f3b2d" },
    { x: lotX + 7.4, z: lotZ + 3.1, yaw: 0, color: "#8a3b32" },
    { x: lotX + 11.6, z: lotZ + 3.1, yaw: 0, color: "#e4e0d8" },
    { x: lotX + 15.8, z: lotZ + 3.1, yaw: 0, color: "#243044" },
    { x: lotX + 5.2, z: lotZ + lotD - 3.1, yaw: Math.PI, color: "#6e5834" },
    { x: lotX + 13.4, z: lotZ + lotD - 3.1, yaw: Math.PI, color: "#2c3f55" },
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[layout.width / 2, -0.02, layout.depth / 2]} receiveShadow material={mats.grass}>
        <planeGeometry args={[layout.width + 72, layout.depth + 78]} />
      </mesh>
      <mesh position={[layout.width / 2, 0.045, -pad / 2]} receiveShadow material={mats.walk}>
        <boxGeometry args={[layout.width + pad * 2, 0.08, pad]} />
      </mesh>
      <mesh position={[layout.width / 2, 0.045, layout.depth + pad / 2]} receiveShadow material={mats.walk}>
        <boxGeometry args={[layout.width + pad * 2, 0.08, pad]} />
      </mesh>
      <mesh position={[-pad / 2, 0.045, layout.depth / 2]} receiveShadow material={mats.walk}>
        <boxGeometry args={[pad, 0.08, layout.depth]} />
      </mesh>
      <mesh position={[layout.width + pad / 2, 0.045, layout.depth / 2]} receiveShadow material={mats.walk}>
        <boxGeometry args={[pad, 0.08, layout.depth]} />
      </mesh>
      <mesh position={[doorX, 0.05, layout.depth + pad + 2.5]} receiveShadow material={mats.walk}>
        <boxGeometry args={[2.3, 0.08, 5.2]} />
      </mesh>
      <mesh position={[lotX + lotW / 2, 0.04, lotZ + lotD / 2]} receiveShadow material={mats.asphalt}>
        <boxGeometry args={[lotW, 0.06, lotD]} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={`stall-${index}`} position={[lotX + 1.2 + index * 4, 0.09, lotZ + lotD / 2]}>
          <boxGeometry args={[0.08, 0.01, lotD - 1.4]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.55} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      <mesh position={[lotX + lotW / 2, 0.09, lotZ + 0.35]}>
        <boxGeometry args={[lotW - 0.6, 0.01, 0.1]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.55} />
      </mesh>
      {cars.map((car) => (
        <Car key={`${car.x}-${car.z}`} {...car} />
      ))}
      {trees.map((tree) => (
        <Tree key={`${tree.x}-${tree.z}`} {...tree} weather={weather} />
      ))}
      {shrubs.map((shrub, index) => (
        <Shrub key={`${shrub.x}-${shrub.z}`} {...shrub} weather={weather} tint={index} />
      ))}
      <FlowerBed x={doorX - 3.5} z={layout.depth + 3.3} weather={weather} />
      <FlowerBed x={doorX + 3.4} z={layout.depth + 3.3} weather={weather} />
      <group position={[doorX, 0, layout.depth]}>
        <mesh position={[0, 1.15, 0.16]} castShadow material={mats.trim}>
          <boxGeometry args={[1.7, 2.2, 0.08]} />
        </mesh>
        <mesh position={[-0.38, 1.05, 0.22]}>
          <boxGeometry args={[0.72, 1.9, 0.04]} />
          <meshPhysicalMaterial color="#c5dce8" transmission={0.72} roughness={0.08} thickness={0.06} transparent />
        </mesh>
        <mesh position={[0.38, 1.05, 0.22]}>
          <boxGeometry args={[0.72, 1.9, 0.04]} />
          <meshPhysicalMaterial color="#c5dce8" transmission={0.72} roughness={0.08} thickness={0.06} transparent />
        </mesh>
        <mesh position={[0, 2.35, 0.85]} castShadow material={mats.trim}>
          <boxGeometry args={[2.6, 0.08, 1.5]} />
        </mesh>
      </group>
      <group position={[doorX + 6.4, 0, layout.depth + 4.4]}>
        <mesh position={[-1.2, 0.75, 0]} castShadow material={mats.bark}>
          <boxGeometry args={[0.12, 1.5, 0.12]} />
        </mesh>
        <mesh position={[1.2, 0.75, 0]} castShadow material={mats.bark}>
          <boxGeometry args={[0.12, 1.5, 0.12]} />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow material={mats.sign}>
          <boxGeometry args={[2.9, 0.95, 0.12]} />
        </mesh>
        <group position={[0, 1.4, 0]}>
          <EntranceSign />
        </group>
      </group>
      <Roof layout={layout} />
      <Clouds layout={layout} weather={weather} />
      <Precipitation layout={layout} weather={weather} />
    </group>
  );
}
