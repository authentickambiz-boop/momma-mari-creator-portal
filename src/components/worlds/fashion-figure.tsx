"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type Mesh } from "three";
import type { CharacterConfig, CharacterPose } from "@/lib/worlds/character";
import {
  FASHION_CANVAS,
  FASHION_FIGURE_HEIGHT,
  fashionPoseFrom,
  paintFashionAvatar,
  type FashionPose,
} from "@/lib/worlds/fashion-avatar";

const WIDTH = FASHION_FIGURE_HEIGHT * (FASHION_CANVAS.width / FASHION_CANVAS.height);
const _world = new Vector3();
const _quat = new Quaternion();

/**
 * Camera-facing fashion illustration. Office You and the creator studio both
 * mount this instead of the realistic humanoid mesh.
 */
export function FashionFigure({
  config,
  poseRef,
  emote,
}: {
  config: CharacterConfig;
  poseRef?: RefObject<CharacterPose | null>;
  emote?: string;
}) {
  const mesh = useRef<Mesh>(null);
  const painted = useRef("");
  const material = useRef<MeshBasicMaterial>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = FASHION_CANVAS.width;
    canvas.height = FASHION_CANVAS.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    const surface = material.current;
    if (surface) {
      surface.map = texture;
      surface.needsUpdate = true;
    }
    const draw = (pose: FashionPose, step: number) => {
      paintFashionAvatar(context, config, pose, step);
      texture.needsUpdate = true;
      painted.current = `${pose}:${step}:${JSON.stringify(config)}`;
    };
    draw(fashionPoseFrom(emote, false, false), 0);
    const current = mesh.current;
    if (current) current.userData.draw = draw;
    return () => {
      texture.dispose();
      if (current) delete current.userData.draw;
    };
  }, [config, emote]);

  useFrame(({ camera, clock }) => {
    const plane = mesh.current;
    if (!plane) return;
    plane.getWorldPosition(_world);
    const yaw = Math.atan2(camera.position.x - _world.x, camera.position.z - _world.z);
    const parent = plane.parent;
    let parentYaw = 0;
    if (parent) {
      parent.getWorldQuaternion(_quat);
      const y = _quat.y;
      const w = _quat.w;
      parentYaw = Math.atan2(2 * (w * y), 1 - 2 * y * y);
    }
    plane.rotation.set(0, yaw - parentYaw, 0);
    const pose = poseRef?.current;
    const mode = fashionPoseFrom(emote, Boolean(pose?.moving), Boolean(pose?.seated));
    const step = mode === "walk" ? Math.floor(clock.elapsedTime * 6) % 8 : 0;
    const key = `${mode}:${step}:${JSON.stringify(config)}`;
    const draw = plane.userData.draw as ((next: FashionPose, frame: number) => void) | undefined;
    if (draw && painted.current !== key) {
      draw(mode, step);
      painted.current = key;
    }
    const bob = mode === "walk" ? Math.sin(clock.elapsedTime * 8) * 0.045 : mode === "idle" ? Math.sin(clock.elapsedTime * 2.2) * 0.02 : 0;
    plane.position.y = FASHION_FIGURE_HEIGHT / 2 + bob;
  });

  return (
    <mesh ref={mesh} position={[0, FASHION_FIGURE_HEIGHT / 2, 0]} frustumCulled={false}>
      <planeGeometry args={[WIDTH, FASHION_FIGURE_HEIGHT]} />
      <meshBasicMaterial ref={material} transparent alphaTest={0.15} side={DoubleSide} toneMapped={false} />
    </mesh>
  );
}

export const fashionPlane = { width: WIDTH, height: FASHION_FIGURE_HEIGHT };
