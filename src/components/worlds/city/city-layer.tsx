"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, SRGBColorSpace, Vector3, type Mesh } from "three";
import type { CityDistrict, CityLot, Plot, Street } from "@/lib/worlds/city/locations";
import type { HomeTier } from "@/lib/worlds/economy";
import { districtBillboard } from "@/lib/worlds/city/scene-shell";
import { FOLIAGE_COLORS, type OfficeWeather } from "@/lib/worlds/office-weather";
import { CityBuilding } from "./building";

function Streets({ district }: { district: CityDistrict }) {
  return (
    <group>
      {district.streets.map((street) => (
        <mesh
          key={street.id}
          name={street.id}
          position={[street.x + street.w / 2, street.kind === "road" ? 0.03 : 0.05, street.z + street.d / 2]}
          receiveShadow
        >
          <boxGeometry args={[street.w, street.kind === "road" ? 0.05 : 0.05, street.d]} />
          <meshStandardMaterial
            color={street.kind === "road" ? "#3a3d42" : "#cfc8bb"}
            roughness={street.kind === "road" ? 0.92 : 0.86}
          />
        </mesh>
      ))}
      {district.streets.filter((street) => street.kind === "road").map((street) => {
        const alongX = street.w >= street.d;
        return (
          <mesh
            key={`${street.id}-curb`}
            position={[street.x + street.w / 2, 0.07, street.z + street.d / 2]}
            receiveShadow
          >
            <boxGeometry args={[alongX ? street.w : 0.18, 0.06, alongX ? 0.18 : street.d]} />
            <meshStandardMaterial color="#b7b1a6" roughness={0.9} />
          </mesh>
        );
      })}
    </group>
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

function Lamps({ district }: { district: CityDistrict }) {
  const spots = useMemo(() => lampSpots(district.streets), [district.streets]);
  return (
    <group>
      {spots.map((spot) => (
        <group key={spot.id} position={[spot.x, 0, spot.z]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.08, 3.1, 6]} />
            <meshStandardMaterial color="#2a2926" roughness={0.7} />
          </mesh>
          <mesh position={[0, 3.15, 0]}>
            <sphereGeometry args={[0.18, 10, 8]} />
            <meshStandardMaterial color="#f6e2a8" emissive="#f2c14e" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
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
      {claimed ? (
        <mesh position={[0, 0.16, 0]} receiveShadow>
          <boxGeometry args={[w * 0.55, 0.18, d * 0.55]} />
          <meshStandardMaterial color="#efe6d6" roughness={0.86} />
        </mesh>
      ) : null}
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
      <mesh ref={board} position={[0, 2.15, 0]}>
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
}) {
  const { ground } = district;
  const canopy = FOLIAGE_COLORS[weather.foliage].canopy[0] ?? "#3e8a42";
  return (
    <group name="worlds-city">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ground.x + ground.w / 2, -0.05, ground.z + ground.d / 2]} receiveShadow>
        <planeGeometry args={[ground.w, ground.d]} />
        <meshStandardMaterial color="#5f8a46" roughness={0.96} />
      </mesh>
      <Streets district={district} />
      <DoorPaths plots={district.plots} />
      <Lamps district={district} />
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
        />
      ))}
    </group>
  );
}
