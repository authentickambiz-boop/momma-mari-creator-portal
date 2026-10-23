"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, DataTexture, NearestFilter, NoColorSpace, RGBAFormat, type Texture } from "three";
import type { Group } from "three";
import {
  characterFigure,
  limbRotation,
  type CharacterConfig,
  type CharacterPart,
  type CharacterPose,
} from "@/lib/worlds/character";

const OUTLINE = "#1a1614";

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

function Geometry({ part }: { part: CharacterPart }) {
  if (part.shape === "sphere") return <sphereGeometry args={part.args as [number, number, number]} />;
  if (part.shape === "box") return <boxGeometry args={part.args as [number, number, number]} />;
  if (part.shape === "capsule") return <capsuleGeometry args={part.args as [number, number, number, number]} />;
  if (part.shape === "cylinder") return <cylinderGeometry args={part.args as [number, number, number, number]} />;
  if (part.shape === "torus") return <torusGeometry args={part.args as [number, number, number, number]} />;
  return <coneGeometry args={part.args as [number, number, number]} />;
}

function Solid({ part, position }: { part: CharacterPart; position: [number, number, number] }) {
  const gradient = toonGradient();
  return (
    <group position={position} rotation={part.rotation} scale={part.scale}>
      <mesh>
        <Geometry part={part} />
        <meshToonMaterial color={part.color} gradientMap={gradient} />
      </mesh>
      <mesh scale={1.12}>
        <Geometry part={part} />
        <meshBasicMaterial color={OUTLINE} side={BackSide} toneMapped={false} />
      </mesh>
    </group>
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

/** Chibi used by the creator preview and every office bot. */
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
