"use client";

import { useMemo } from "react";
import type { CityDistrict } from "@/lib/worlds/city/locations";
import { CityBuilding } from "./building";

function Streets({ district }: { district: CityDistrict }) {
  return (
    <group>
      {district.streets.map((street) => (
        <mesh
          key={street.id}
          position={[street.x + street.w / 2, street.kind === "road" ? 0.03 : 0.045, street.z + street.d / 2]}
          receiveShadow
        >
          <boxGeometry args={[street.w, street.kind === "road" ? 0.05 : 0.04, street.d]} />
          <meshStandardMaterial
            color={street.kind === "road" ? "#3a3d42" : "#c8c2b6"}
            roughness={street.kind === "road" ? 0.92 : 0.86}
          />
        </mesh>
      ))}
    </group>
  );
}

function Lamps({ district }: { district: CityDistrict }) {
  const spots = useMemo(() => {
    const roads = district.streets.filter((street) => street.kind === "road");
    return roads.flatMap((street) => {
      const alongX = street.w >= street.d;
      const count = alongX ? 3 : 2;
      return Array.from({ length: count }, (_, index) => {
        const t = (index + 1) / (count + 1);
        return {
          id: `${street.id}-${index}`,
          x: street.x + (alongX ? street.w * t : 0.4),
          z: street.z + (alongX ? 0.4 : street.d * t),
        };
      });
    });
  }, [district.streets]);
  return (
    <group>
      {spots.map((spot) => (
        <group key={spot.id} position={[spot.x, 0, spot.z]}>
          <mesh position={[0, 1.3, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 2.6, 6]} />
            <meshStandardMaterial color="#2a2926" roughness={0.7} />
          </mesh>
          <mesh position={[0, 2.65, 0]}>
            <sphereGeometry args={[0.16, 8, 8]} />
            <meshStandardMaterial color="#f6e2a8" emissive="#f2c14e" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CityLayer({
  district,
  quality,
  detailed,
  selectedId,
  canOpen,
  onEnter,
}: {
  district: CityDistrict;
  quality: "fine" | "fast";
  detailed: boolean;
  selectedId: string | null;
  canOpen: () => boolean;
  onEnter: (id: string) => void;
}) {
  const { ground } = district;
  return (
    <group name="worlds-city">
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ground.x + ground.w / 2, -0.05, ground.z + ground.d / 2]} receiveShadow>
        <planeGeometry args={[ground.w, ground.d]} />
        <meshStandardMaterial color="#5f8a46" roughness={0.96} />
      </mesh>
      <hemisphereLight args={["#f4efe4", "#3d4a34", 0.55]} />
      <directionalLight position={[40, 28, 18]} intensity={0.55} color="#fff1d2" />
      <Streets district={district} />
      <Lamps district={district} />
      {district.plots.map((plot) => (
        <CityBuilding
          key={plot.id}
          plot={plot}
          quality={quality}
          detailed={detailed}
          selected={selectedId === plot.id}
          canOpen={canOpen}
          onEnter={() => onEnter(plot.id)}
        />
      ))}
    </group>
  );
}
