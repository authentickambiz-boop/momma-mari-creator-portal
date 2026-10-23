"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import {
  characterFigure,
  limbRotation,
  type CharacterConfig,
  type CharacterPart,
  type CharacterPose,
} from "@/lib/worlds/character";

function Geometry({ part }: { part: CharacterPart }) {
  if (part.shape === "sphere") return <sphereGeometry args={part.args as [number, number, number]} />;
  if (part.shape === "box") return <boxGeometry args={part.args as [number, number, number]} />;
  if (part.shape === "capsule") return <capsuleGeometry args={part.args as [number, number, number, number]} />;
  if (part.shape === "cylinder") return <cylinderGeometry args={part.args as [number, number, number, number]} />;
  if (part.shape === "torus") return <torusGeometry args={part.args as [number, number, number, number]} />;
  return <coneGeometry args={part.args as [number, number, number]} />;
}

function Solid({ part, position }: { part: CharacterPart; position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={part.rotation} scale={part.scale} castShadow>
      <Geometry part={part} />
      <meshStandardMaterial color={part.color} roughness={0.62} metalness={0.04} />
    </mesh>
  );
}

function Limb({ part, poseRef }: { part: CharacterPart; poseRef?: RefObject<CharacterPose | null> }) {
  const pivot = useRef<Group>(null);
  useFrame(() => {
    if (!pivot.current) return;
    const pose = poseRef?.current ?? { phase: 0, moving: false, seated: false };
    const [x, y, z] = limbRotation(part.animate, pose);
    pivot.current.rotation.set(x, y, z);
  });
  return (
    <group ref={pivot} position={part.position}>
      <Solid part={part} position={[0, -0.16, 0]} />
    </group>
  );
}

/** Low-poly bot built from the saved look. Primitives only, no external files. */
export function CharacterFigure({
  config,
  poseRef,
}: {
  config: CharacterConfig;
  poseRef?: RefObject<CharacterPose | null>;
}) {
  const figure = useMemo(() => characterFigure(config), [config]);
  return (
    <group scale={figure.scale}>
      {figure.parts.map((part) => (
        part.animate === "none"
          ? <Solid key={part.id} part={part} position={part.position} />
          : <Limb key={part.id} part={part} poseRef={poseRef} />
      ))}
    </group>
  );
}
