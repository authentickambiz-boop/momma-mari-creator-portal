"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace } from "three";
import { withBasePath } from "@/lib/format";
import type { CharacterPose } from "@/lib/worlds/character";
import { createGlamRig, disposeGlamRig, mountGlamFace, poseGlamRig, type GlamPose } from "@/lib/worlds/glam-rig";

function faceDecal(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  const width = canvas.width;
  const height = canvas.height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const sat = max === 0 ? 0 : (max - min) / max;
      const purple = blue > 70 && blue > green + 18 && red < blue + 35 && green < 140;
      const paper = alpha < 16 || (sat < 0.14 && min > 170);
      if (purple || paper || y > height * 0.72) data[index + 3] = 0;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

/** Office You as the locked glam figure. The follow camera sees a real body, not a photo card. */
export function GlamFigure({ poseRef }: { poseRef?: RefObject<CharacterPose | null> }) {
  const rig = useMemo(() => createGlamRig(), []);

  useEffect(() => {
    let cancel = false;
    const image = new Image();
    image.onload = () => {
      if (cancel) return;
      const map = faceDecal(image);
      if (map) mountGlamFace(rig, map);
    };
    image.src = withBasePath("/worlds/fashion/glam-head.png");
    return () => {
      cancel = true;
      disposeGlamRig(rig);
    };
  }, [rig]);

  useFrame(({ clock }) => {
    const pose = poseRef?.current;
    const mode: GlamPose = pose?.wave ? "wave" : pose?.moving ? "walk" : pose?.seated ? "sit" : "idle";
    poseGlamRig(rig, mode, pose?.moving ? pose.phase * 0.35 : clock.elapsedTime);
  });

  return <primitive object={rig} />;
}
