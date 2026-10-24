"use client";

import { useMemo } from "react";
import { CanvasTexture, DoubleSide, SRGBColorSpace } from "three";
import type { CityDistrict, Plot, Street } from "@/lib/worlds/city/locations";
import type { HomeTier } from "@/lib/worlds/economy";
import { FOLIAGE_COLORS, type OfficeWeather } from "@/lib/worlds/office-weather";
import { CityBuilding } from "./building";

function Streets({ district }: { district: CityDistrict }) {
  return (
    <group>
      {district.streets.map((street) => (
        <mesh
          key={street.id}
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

function districtSign(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1f3b2d";
    ctx.fillRect(0, 0, 1024, 220);
    ctx.fillStyle = "#fbf8f3";
    ctx.font = "700 92px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 512, 116);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function DistrictLabels({ plots }: { plots: readonly Plot[] }) {
  const signs = useMemo(() => plots.filter((plot) => plot.district).map((plot) => ({
    id: plot.id,
    label: plot.district ?? "",
    map: districtSign(plot.district ?? ""),
    x: plot.x + plot.w / 2,
    z: plot.z + plot.d + 1.2,
    wide: Math.min(14, Math.max(8, plot.w * 0.62)),
  })), [plots]);
  return (
    <group>
      {signs.map((sign) => (
        <mesh key={sign.id} position={[sign.x, 8.6, sign.z]}>
          <planeGeometry args={[sign.wide, 2.2]} />
          <meshBasicMaterial map={sign.map} toneMapped={false} side={DoubleSide} />
        </mesh>
      ))}
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
