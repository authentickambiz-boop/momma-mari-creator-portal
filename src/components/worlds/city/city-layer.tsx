"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, SRGBColorSpace, Vector3, type Group, type Mesh } from "three";
import type { CityDistrict, CityLot, Plot, Street } from "@/lib/worlds/city/locations";
import { boxesOverlap } from "@/lib/worlds/city/locations";
import type { HomeTier } from "@/lib/worlds/economy";
import { districtBillboard } from "@/lib/worlds/city/scene-shell";
import { CITY_PARK, MANSION_FOUNTAIN, WALK_WIDTH, curbOuterRadius, paveCity, type CurbReturn, type RoadCap, type RoadRect } from "@/lib/worlds/city/streets";
import { FOLIAGE_COLORS, type OfficeWeather } from "@/lib/worlds/office-weather";
import { CityBuilding, Gable } from "./building";
import type { DecorMode, DecorPlacement, HousingModel } from "@/lib/worlds/city/decorate";

/** Sector in the same space as CylinderGeometry: angle 0 is +Z, opening toward +X. */
function sectorGeometry(outer: number, length: number, segments: number, inner = 0) {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const theta = (index / segments) * length;
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    positions.push(inner * sin, 0, inner * cos, outer * sin, 0, outer * cos);
  }
  for (let index = 0; index < segments; index += 1) {
    const base = index * 2;
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Asphalt({ rect }: { rect: RoadRect }) {
  return (
    <mesh position={[rect.x + rect.w / 2, 0.03, rect.z + rect.d / 2]} receiveShadow>
      <boxGeometry args={[rect.w, 0.04, rect.d]} />
      <meshStandardMaterial color="#3a3d42" roughness={0.92} />
    </mesh>
  );
}

function Walk({ rect }: { rect: RoadRect }) {
  return (
    <mesh position={[rect.x + rect.w / 2, 0.055, rect.z + rect.d / 2]} receiveShadow>
      <boxGeometry args={[rect.w, 0.028, rect.d]} />
      <meshStandardMaterial color="#cfc8bb" roughness={0.86} />
    </mesh>
  );
}

function Streets({ district }: { district: CityDistrict }) {
  const roads = useMemo(
    () => district.streets.filter((street) => street.kind === "road"),
    [district.streets],
  );
  const paved = useMemo(() => paveCity(roads), [roads]);
  const capAsphalt = useMemo(() => sectorGeometry(1, Math.PI, 20), []);
  return (
    <group>
      {paved.asphalt.map((road) => <Asphalt key={road.id} rect={road} />)}
      {paved.caps.map((cap) => (
        <mesh key={cap.id} position={[cap.x, 0.05, cap.z]} rotation={[0, cap.theta, 0]} scale={cap.radius} receiveShadow geometry={capAsphalt}>
          <meshStandardMaterial color="#3a3d42" roughness={0.92} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      ))}
      {paved.walks.map((walk) => <Walk key={walk.id} rect={walk} />)}
      {paved.rounds.map((turn) => (
        <CurbRing key={turn.id} turn={turn} />
      ))}
      {paved.caps.map((cap) => (
        <CapWalk key={`${cap.id}-walk`} cap={cap} />
      ))}
    </group>
  );
}

/** Sidewalk ring outside the curb arc. The square asphalt tip stays underneath. */
function CurbRing({ turn }: { turn: CurbReturn }) {
  const outer = curbOuterRadius(turn.radius);
  const geometry = useMemo(
    () => sectorGeometry(outer, Math.PI / 2, 18, turn.radius),
    [outer, turn.radius],
  );
  return (
    <mesh position={[turn.x, 0.09, turn.z]} rotation={[0, turn.theta, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial color="#cfc8bb" roughness={0.86} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

function CapWalk({ cap }: { cap: RoadCap }) {
  const geometry = useMemo(
    () => sectorGeometry(cap.radius + WALK_WIDTH, Math.PI, 20, cap.radius),
    [cap.radius],
  );
  return (
    <mesh position={[cap.x, 0.09, cap.z]} rotation={[0, cap.theta, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial color="#cfc8bb" roughness={0.86} />
    </mesh>
  );
}

function lampSpots(streets: readonly Street[]) {
  return streets.filter((street) => street.kind === "road").flatMap((street) => {
    const alongX = street.w >= street.d;
    const count = alongX ? 5 : 3;
    return Array.from({ length: count }, (_, index) => {
      const t = (index + 1) / (count + 1);
      return {
        id: `${street.id}-${index}`,
        x: street.x + (alongX ? street.w * t : street.w - 0.55),
        z: street.z + (alongX ? street.d - 0.55 : street.d * t),
      };
    });
  });
}

function Lamps({ district, dark }: { district: CityDistrict; dark: boolean }) {
  const spots = useMemo(() => lampSpots(district.streets), [district.streets]);
  return (
    <group>
      {spots.map((spot) => (
        <group key={spot.id} name={`lamp-${spot.id}`} position={[spot.x, 0, spot.z]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.1, 3.1, 8]} />
            <meshStandardMaterial color="#2a2926" roughness={0.7} />
          </mesh>
          <mesh position={[0.42, 3.12, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.9, 6]} />
            <meshStandardMaterial color="#2a2926" roughness={0.6} />
          </mesh>
          <mesh position={[0.86, 3.05, 0]} renderOrder={3}>
            <sphereGeometry args={[dark ? 0.72 : 0.18, 16, 12]} />
            {dark
              ? <meshBasicMaterial color="#fff4b0" toneMapped={false} />
              : <meshStandardMaterial color="#d9d3c7" />}
          </mesh>
          {dark ? (
            <>
              <mesh position={[0.86, 3.05, 0]} renderOrder={2}>
                <sphereGeometry args={[2.15, 14, 10]} />
                <meshBasicMaterial color="#ffe08a" transparent opacity={0.62} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[0.86, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
                <circleGeometry args={[6.4, 28]} />
                <meshBasicMaterial color="#ffb020" transparent opacity={0.9} depthWrite={false} side={DoubleSide} toneMapped={false} />
              </mesh>
              <pointLight position={[0.86, 2.7, 0]} intensity={3.2} distance={18} decay={2} color="#ffc56a" />
            </>
          ) : null}
        </group>
      ))}
    </group>
  );
}

function Tree({ x, z, canopy, scale = 1 }: { x: number; z: number; canopy: string; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.16, 1.4, 6]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <sphereGeometry args={[0.62, 10, 8]} />
        <meshStandardMaterial color={canopy} roughness={0.82} />
      </mesh>
    </group>
  );
}

function Bush({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.28, z]} castShadow>
      <sphereGeometry args={[0.32, 8, 6]} />
      <meshStandardMaterial color="#2f6d4f" roughness={0.86} />
    </mesh>
  );
}

function FlowerBed({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.1, 0.12, 0.55]} />
        <meshStandardMaterial color="#5c3c2e" roughness={0.9} />
      </mesh>
      {[[-0.28, 0], [0, 0.08], [0.28, -0.04]].map(([px, pz], index) => (
        <mesh key={px} position={[px, 0.24, pz]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color={["#d4567a", "#f2c14e", "#f7f1e4"][index] ?? "#f2c14e"} />
        </mesh>
      ))}
    </group>
  );
}

function StreetLife({ district, canopy }: { district: CityDistrict; canopy: string }) {
  const pieces = useMemo(() => {
    const roads = district.streets.filter((street) => street.kind === "road");
    const blocked = [...district.plots, ...district.lots, ...district.streets, CITY_PARK, MANSION_FOUNTAIN];
    const trees: { id: string; x: number; z: number }[] = [];
    const bushes: { id: string; x: number; z: number }[] = [];
    const flowers: { id: string; x: number; z: number }[] = [];
    const fits = (x: number, z: number, w = 1.2, d = 1.2) => !blocked.some((box) => boxesOverlap({ x: x - w / 2, z: z - d / 2, w, d }, box, 0.3));
    for (const road of roads) {
      const alongX = road.w >= road.d;
      const span = alongX ? road.w : road.d;
      const count = Math.max(1, Math.floor(span / 18));
      for (let index = 0; index < count && trees.length < 36; index += 1) {
        const t = (index + 0.5) / count;
        const x = alongX ? road.x + road.w * t : road.x - 3.1;
        const z = alongX ? road.z - 3.1 : road.z + road.d * t;
        if (fits(x, z)) trees.push({ id: `${road.id}-tree-${index}`, x, z });
        const bx = alongX ? x + 2.2 : road.x + road.w + 3.1;
        const bz = alongX ? road.z + road.d + 3.1 : z + 1.4;
        if (bushes.length < 24 && fits(bx, bz, 0.8, 0.8)) bushes.push({ id: `${road.id}-bush-${index}`, x: bx, z: bz });
      }
    }
    for (const lot of district.lots) {
      const x = lot.x + lot.w + 1.3;
      const z = lot.z + 1.1;
      if (flowers.length < 12 && fits(x, z, 1.3, 0.8)) flowers.push({ id: `${lot.id}-flowers`, x, z });
    }
    return { trees, bushes, flowers };
  }, [district]);
  return (
    <group>
      {pieces.trees.map((tree) => <Tree key={tree.id} x={tree.x} z={tree.z} canopy={canopy} />)}
      {pieces.bushes.map((bush) => <Bush key={bush.id} x={bush.x} z={bush.z} />)}
      {pieces.flowers.map((bed) => <FlowerBed key={bed.id} x={bed.x} z={bed.z} />)}
    </group>
  );
}

function CityPark({ canopy }: { canopy: string }) {
  const { x, z, w, d } = CITY_PARK;
  return (
    <group name="city-park" position={[x + w / 2, 0, z + d / 2]}>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 20]} />
        <meshStandardMaterial color="#6ea356" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.1, 3.55, 20]} />
        <meshStandardMaterial color="#cfc8bb" roughness={0.88} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[1.15, 1.25, 0.12, 16]} />
        <meshStandardMaterial color="#7eb0c8" roughness={0.25} metalness={0.15} />
      </mesh>
      <Tree x={-3.4} z={-2.2} canopy={canopy} scale={1.15} />
      <Tree x={3.2} z={-1.6} canopy={canopy} />
      <Tree x={-2.6} z={3.1} canopy="#2f6d4f" scale={0.9} />
      <Bush x={2.4} z={2.6} />
      <Bush x={-1.2} z={3.6} />
      <FlowerBed x={3.6} z={0.4} />
      <FlowerBed x={-3.8} z={0.8} />
      <mesh position={[1.6, 0.28, -3.2]}>
        <boxGeometry args={[1.1, 0.12, 0.36]} />
        <meshStandardMaterial color="#6b4a32" roughness={0.8} />
      </mesh>
    </group>
  );
}

function MansionFountain() {
  const { x, z, w, d } = MANSION_FOUNTAIN;
  return (
    <group name="mansion-fountain" position={[x + w / 2, 0, z + d / 2]}>
      <mesh position={[0, 0.28, 0]} receiveShadow>
        <cylinderGeometry args={[1.7, 1.85, 0.45, 16]} />
        <meshStandardMaterial color="#d9d3c8" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.08, 16]} />
        <meshStandardMaterial color="#8ec4ea" roughness={0.12} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, 0.9, 8]} />
        <meshStandardMaterial color="#c6a15a" metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <sphereGeometry args={[0.18, 10, 8]} />
        <meshStandardMaterial color="#d7eef6" roughness={0.08} metalness={0.3} emissive="#c5dce8" emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function doorBasis(plot: Plot) {
  const ox = -Math.sin(plot.yaw);
  const oz = Math.cos(plot.yaw);
  const cx = plot.x + plot.w / 2;
  const cz = plot.z + plot.d / 2;
  return {
    ox,
    oz,
    px: oz,
    pz: -ox,
    doorX: cx + ox * (plot.d / 2),
    doorZ: cz + oz * (plot.d / 2),
  };
}

function Verges({ district, canopy }: { district: CityDistrict; canopy: string }) {
  const trees = useMemo(() => district.plots.map((plot) => {
    const basis = doorBasis(plot);
    return {
      id: plot.id,
      x: basis.doorX + basis.px * (plot.w / 2 + 0.15),
      z: basis.doorZ + basis.pz * 0.15,
    };
  }), [district.plots]);
  return (
    <group>
      {trees.map((tree) => (
        <group key={tree.id} position={[tree.x, 0, tree.z]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.16, 1.5, 6]} />
            <meshStandardMaterial color="#6b4a32" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.85, 0]} castShadow>
            <sphereGeometry args={[0.7, 10, 8]} />
            <meshStandardMaterial color={canopy} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function paintSign(label: string, sub: string, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1f3b2d";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#c6a15a";
    ctx.lineWidth = Math.max(12, Math.round(width / 70));
    ctx.strokeRect(18, 18, width - 36, height - 36);
    ctx.fillStyle = "#fbf8f3";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.max(72, Math.min(sub ? 148 : 200, Math.floor((width - 80) / (label.length * 0.62))));
    ctx.font = `700 ${size}px sans-serif`;
    ctx.fillText(label, width / 2, sub ? height * 0.38 : height / 2);
    if (sub) {
      ctx.font = "700 120px sans-serif";
      ctx.fillStyle = "#f2c14e";
      ctx.fillText(sub, width / 2, height * 0.72);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function DistrictLabels({ plots }: { plots: readonly Plot[] }) {
  const signs = useMemo(() => plots.filter((plot) => plot.district).map((plot, index) => {
    const size = districtBillboard(plot.district ?? "");
    return {
      id: plot.id,
      map: paintSign(plot.district ?? "", "", 2048, 420),
      x: plot.x + plot.w / 2,
      y: 12.5 + (index % 3) * 2.4,
      z: plot.z + plot.d / 2,
      wide: size.wide,
      tall: size.tall,
    };
  }), [plots]);
  return (
    <group>
      {signs.map((sign) => (
        <DistrictBillboard key={sign.id} sign={sign} />
      ))}
    </group>
  );
}

const boardPoint = new Vector3();

function faceBoard(mesh: Mesh, camera: { position: Vector3 }, parentYaw = 0) {
  mesh.getWorldPosition(boardPoint);
  const yaw = Math.atan2(camera.position.x - boardPoint.x, camera.position.z - boardPoint.z);
  mesh.rotation.y = yaw - parentYaw;
}

function DistrictBillboard({ sign }: { sign: { id: string; map: CanvasTexture; x: number; y: number; z: number; wide: number; tall: number } }) {
  const board = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    const mesh = board.current;
    if (!mesh) return;
    faceBoard(mesh, camera);
  });
  return (
    <group position={[sign.x, 0, sign.z]}>
      <mesh position={[-sign.wide * 0.36, sign.y * 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, sign.y * 0.92, 6]} />
        <meshStandardMaterial color="#4e463f" roughness={0.8} />
      </mesh>
      <mesh position={[sign.wide * 0.36, sign.y * 0.46, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.22, sign.y * 0.92, 6]} />
        <meshStandardMaterial color="#4e463f" roughness={0.8} />
      </mesh>
      <mesh ref={board} position={[0, sign.y, 0]}>
        <planeGeometry args={[sign.wide, sign.tall]} />
        <meshBasicMaterial map={sign.map} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function lotBoard(number: string, claimed: boolean) {
  return paintSign(claimed ? "CLAIMED" : "BUILD HERE", number, 1024, 512);
}

const SHELL_HEIGHT = {
  studio: 1.85,
  house: 2.45,
  "creator-loft": 2.9,
  mansion: 3.6,
} as const;

function LotShell({ w, d, tier }: { w: number; d: number; tier: keyof typeof SHELL_HEIGHT }) {
  const ref = useRef<Group>(null);
  const rise = useRef(0.05);
  const sw = Math.max(2.2, w * 0.74);
  const sd = Math.max(2.2, d * 0.66);
  const h = SHELL_HEIGHT[tier];
  useLayoutEffect(() => {
    if (ref.current) ref.current.scale.y = 0.05;
  }, []);
  useFrame((_, delta) => {
    const node = ref.current;
    if (!node || rise.current >= 1) return;
    rise.current = Math.min(1, rise.current + delta * 1.35);
    node.scale.y = rise.current;
  });
  const studs = Math.max(3, Math.min(7, Math.round(sw / 1.8)));
  return (
    <group ref={ref} name="lot-shell">
      <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
        <boxGeometry args={[sw + 0.55, 0.4, sd + 0.55]} />
        <meshStandardMaterial color="#b7b1a6" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.46, 0]} receiveShadow>
        <boxGeometry args={[sw + 0.2, 0.12, sd + 0.2]} />
        <meshStandardMaterial color="#8d8378" roughness={0.84} />
      </mesh>
      {[-sd / 2, sd / 2].map((z) => (
        <mesh key={`sill-${z}`} position={[0, 0.62, z]}>
          <boxGeometry args={[sw, 0.12, 0.12]} />
          <meshStandardMaterial color="#6b3a28" roughness={0.78} />
        </mesh>
      ))}
      {[-sw / 2, sw / 2].map((x) => (
        <mesh key={`sill-${x}`} position={[x, 0.62, 0]}>
          <boxGeometry args={[0.12, 0.12, sd]} />
          <meshStandardMaterial color="#6b3a28" roughness={0.78} />
        </mesh>
      ))}
      {Array.from({ length: studs }, (_, index) => {
        const x = -sw / 2 + (index * sw) / (studs - 1);
        if (Math.abs(x) < sw * 0.18) return null;
        return (
          <mesh key={`front-${x}`} position={[x, 0.62 + h / 2, sd / 2]} castShadow>
            <boxGeometry args={[0.1, h, 0.1]} />
            <meshStandardMaterial color={index % 2 ? "#c68642" : "#a56b32"} roughness={0.8} />
          </mesh>
        );
      })}
      {Array.from({ length: studs }, (_, index) => {
        const x = -sw / 2 + (index * sw) / (studs - 1);
        if (Math.abs(x) < sw * 0.16) return null;
        return (
          <mesh key={`back-${x}`} position={[x, 0.62 + h / 2, -sd / 2]} castShadow>
            <boxGeometry args={[0.1, h, 0.1]} />
            <meshStandardMaterial color="#c68642" roughness={0.8} />
          </mesh>
        );
      })}
      {[-sw / 2, sw / 2].map((x) => (
        <mesh key={`side-${x}`} position={[x, 0.62 + h / 2, 0]} castShadow>
          <boxGeometry args={[0.14, h, sd]} />
          <meshStandardMaterial color="#d7b07a" roughness={0.82} />
        </mesh>
      ))}
      <mesh position={[0, 0.62 + h * 0.45, -sd / 2 - 0.02]} castShadow>
        <boxGeometry args={[sw * 0.7, h * 0.55, 0.08]} />
        <meshStandardMaterial color="#e7d3b0" roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.62 + h, 0]} castShadow>
        <boxGeometry args={[sw + 0.2, 0.14, sd + 0.2]} />
        <meshStandardMaterial color="#4e463f" roughness={0.74} />
      </mesh>
      <Gable w={sw * 0.92} h={0.74 + h} d={sd * 0.88} color="#6b3a28" overhangX={0.1} overhangZ={0.16} pitch={0.38} ends={false} />
      {[-1, 1].map((side) => (
        <mesh key={`jamb-${side}`} position={[side * sw * 0.16, 0.62 + h * 0.36, sd / 2 + 0.04]} castShadow>
          <boxGeometry args={[0.1, h * 0.72, 0.1]} />
          <meshStandardMaterial color="#2a2926" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.62 + h * 0.74, sd / 2 + 0.04]} castShadow>
        <boxGeometry args={[sw * 0.36, 0.1, 0.1]} />
        <meshStandardMaterial color="#2a2926" roughness={0.7} />
      </mesh>
    </group>
  );
}

function EmptyLotMarker({
  lot,
  claimed,
  selected,
  onEnter,
}: {
  lot: CityLot;
  claimed: boolean;
  selected: boolean;
  onEnter: () => void;
}) {
  const map = useMemo(() => lotBoard(lot.number, claimed), [lot.number, claimed]);
  const board = useRef<Mesh>(null);
  useFrame(({ camera }) => {
    const mesh = board.current;
    if (!mesh) return;
    faceBoard(mesh, camera, lot.yaw);
  });
  const inset = 0.45;
  const w = Math.max(2.4, lot.w - inset);
  const d = Math.max(2.4, lot.d - inset);
  const posts: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ];
  return (
    <group name={lot.id} position={[lot.x + lot.w / 2, 0, lot.z + lot.d / 2]} rotation={[0, lot.yaw, 0]}>
      <mesh position={[0, 0.045, 0]} receiveShadow>
        <boxGeometry args={[w, 0.07, d]} />
        <meshStandardMaterial color={claimed ? "#d7c4a3" : "#c6b48a"} roughness={0.95} />
      </mesh>
      {claimed ? <LotShell w={w} d={d} tier={lot.tier} /> : null}
      {posts.map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.55, z]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 1.1, 5]} />
          <meshStandardMaterial color="#6b3a28" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.42, -d / 2]}>
        <boxGeometry args={[w, 0.08, 0.08]} />
        <meshStandardMaterial color="#f4efe4" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.42, d / 2]}>
        <boxGeometry args={[w, 0.08, 0.08]} />
        <meshStandardMaterial color="#f4efe4" roughness={0.7} />
      </mesh>
      <mesh position={[-w / 2, 0.42, 0]}>
        <boxGeometry args={[0.08, 0.08, d]} />
        <meshStandardMaterial color="#f4efe4" roughness={0.7} />
      </mesh>
      <mesh position={[w / 2, 0.42, 0]}>
        <boxGeometry args={[0.08, 0.08, d]} />
        <meshStandardMaterial color="#f4efe4" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 2.3, 6]} />
        <meshStandardMaterial color="#2a2926" roughness={0.7} />
      </mesh>
      <mesh ref={board} position={[0, claimed ? SHELL_HEIGHT[lot.tier] + 3.1 : 2.15, 0]}>
        <planeGeometry args={[Math.min(6.2, Math.max(3.4, w * 0.82)), 2.15]} />
        <meshBasicMaterial map={map} toneMapped={false} side={DoubleSide} />
      </mesh>
      {selected ? (
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.min(w, d) * 0.28, Math.min(w, d) * 0.34, 24]} />
          <meshBasicMaterial color="#f2c14e" />
        </mesh>
      ) : null}
      <mesh
        position={[0, 1.1, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onEnter();
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
        <boxGeometry args={[w, 2.2, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ParkedCars({ streets }: { streets: readonly Street[] }) {
  const cars = useMemo(() => {
    const colors = ["#c4564a", "#2f4f6f", "#e6d7b0", "#3d6b4f", "#6b4c7a", "#b4532f"];
    return streets.filter((street) => street.kind === "road").flatMap((street, roadIndex) => {
      const alongX = street.w >= street.d;
      return [0.28, 0.62].map((t, index) => ({
        id: `${street.id}-car-${index}`,
        x: street.x + (alongX ? street.w * t : 1.15),
        z: street.z + (alongX ? 1.15 : street.d * t),
        yaw: alongX ? Math.PI / 2 : 0,
        color: colors[(roadIndex + index) % colors.length] ?? "#c4564a",
      }));
    });
  }, [streets]);
  return (
    <group>
      {cars.map((car) => (
        <group key={car.id} position={[car.x, 0.28, car.z]} rotation={[0, car.yaw, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.55, 0.42, 0.74]} />
            <meshStandardMaterial color={car.color} roughness={0.42} metalness={0.4} />
          </mesh>
          <mesh position={[0.12, 0.36, 0]} castShadow>
            <boxGeometry args={[0.72, 0.32, 0.64]} />
            <meshStandardMaterial color="#d5e7f0" roughness={0.08} metalness={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DoorPaths({ plots }: { plots: readonly Plot[] }) {
  return (
    <group>
      {plots.map((plot) => {
        const basis = doorBasis(plot);
        const length = 2.4;
        return (
          <mesh
            key={plot.id}
            position={[basis.doorX + basis.ox * (length / 2), 0.055, basis.doorZ + basis.oz * (length / 2)]}
            rotation={[0, plot.yaw, 0]}
            receiveShadow
          >
            <boxGeometry args={[1.35, 0.04, length]} />
            <meshStandardMaterial color="#cfc8bb" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

export function CityLayer({
  district,
  quality,
  detailed,
  selectedId,
  interiorOpen,
  locked,
  canOpen,
  onEnter,
  tier,
  weather,
  claimedLotIds,
  decor = null,
}: {
  district: CityDistrict;
  quality: "fine" | "fast";
  detailed: boolean;
  selectedId: string | null;
  interiorOpen: boolean;
  locked: boolean;
  canOpen: () => boolean;
  onEnter: (id: string) => void;
  tier: HomeTier;
  weather: OfficeWeather;
  claimedLotIds: readonly string[];
  decor?: {
    model: HousingModel;
    placements: readonly DecorPlacement[];
    mode: DecorMode | null;
  } | null;
}) {
  const { ground } = district;
  const canopy = FOLIAGE_COLORS[weather.foliage].canopy[0] ?? "#3e8a42";
  const dark = weather.sunElevation <= 0.05;
  return (
    <group name="worlds-city">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ground.x + ground.w / 2, -0.05, ground.z + ground.d / 2]} receiveShadow>
        <planeGeometry args={[ground.w, ground.d]} />
        <meshStandardMaterial color={dark ? "#1d3324" : "#5f8a46"} roughness={0.96} />
      </mesh>
      <Streets district={district} />
      <CityPark canopy={canopy} />
      <MansionFountain />
      <StreetLife district={district} canopy={canopy} />
      <DoorPaths plots={district.plots} />
      <Lamps district={district} dark={dark} />
      <ParkedCars streets={district.streets} />
      <DistrictLabels plots={district.plots} />
      {district.lots.map((lot) => (
        <EmptyLotMarker
          key={lot.id}
          lot={lot}
          claimed={claimedLotIds.includes(lot.id)}
          selected={selectedId === lot.id}
          onEnter={() => onEnter(lot.id)}
        />
      ))}
      <Verges district={district} canopy={canopy} />
      {district.plots.map((plot) => (
        <CityBuilding
          key={plot.id}
          plot={plot}
          tier={tier}
          quality={quality}
          detailed={detailed}
          selected={selectedId === plot.id}
          interiorOpen={selectedId === plot.id && interiorOpen}
          locked={selectedId === plot.id && locked}
          canOpen={canOpen}
          onEnter={() => onEnter(plot.id)}
          placements={decor?.placements}
          mode={decor?.mode && selectedId === plot.id && plot.model === decor.model ? decor.mode : null}
        />
      ))}
    </group>
  );
}
