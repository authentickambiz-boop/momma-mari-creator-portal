"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, DoubleSide, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type Mesh } from "three";
import { withBasePath } from "@/lib/format";
import type { CharacterConfig, CharacterPose } from "@/lib/worlds/character";
import {
  FASHION_CANVAS,
  FASHION_FIGURE_HEIGHT,
  fashionPoseFrom,
  paintFashionAvatar,
  type FashionPose,
} from "@/lib/worlds/fashion-avatar";
import { GLAM_LAYER_FILES, glamLayersReady, setGlamLayers, type GlamLayerName, type GlamLayers } from "@/lib/worlds/fashion-glam-lock";

const WIDTH = FASHION_FIGURE_HEIGHT * (FASHION_CANVAS.width / FASHION_CANVAS.height);
const _world = new Vector3();
const _quat = new Quaternion();

function loadGlamImage(file: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(file));
    image.src = withBasePath(file);
  });
}

let glamLoad: Promise<void> | null = null;

export function ensureGlamLayers() {
  if (!glamLoad) {
    const names = Object.keys(GLAM_LAYER_FILES) as GlamLayerName[];
    glamLoad = Promise.all(names.map(async (name) => [name, await loadGlamImage(GLAM_LAYER_FILES[name])] as const))
      .then((pairs) => {
        setGlamLayers(Object.fromEntries(pairs) as GlamLayers);
      })
      .catch(() => {
        glamLoad = null;
      });
  }
  return glamLoad;
}

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
    let cancel = false;
    void ensureGlamLayers().then(() => {
      if (cancel) return;
      painted.current = "";
    });
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
      cancel = true;
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

type Crop = { x: number; y: number; w: number; h: number };

/** Stable crop so a stride does not resize the doll under the follow camera. */
function contentCrop(ctx: CanvasRenderingContext2D): Crop | null {
  const { width, height } = ctx.canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if ((data[(y * width + x) * 4 + 3] ?? 0) < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const padX = 36;
  const padY = 18;
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  return {
    x,
    y,
    w: Math.min(width - x, maxX - minX + padX * 2),
    h: Math.min(height - y, maxY - minY + padY * 2),
  };
}

/**
 * Follow-camera doll. The HTML plate uses the same close distance as the HUD
 * (distanceFactor 3.2) and this crop fills that frame, so You is not the tiny
 * map-distance sprite.
 */
export function OfficeGlamPlate({
  config,
  emote,
  step = 0,
}: {
  config: CharacterConfig;
  emote: FashionPose;
  step?: number;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const crop = useRef<Crop | null>(null);

  useEffect(() => {
    let cancel = false;
    const paint = () => {
      if (cancel) return;
      const canvas = view.current;
      if (!canvas || !glamLayersReady()) return;
      if (!scratch.current) {
        scratch.current = document.createElement("canvas");
        scratch.current.width = FASHION_CANVAS.width;
        scratch.current.height = FASHION_CANVAS.height;
      }
      const plate = scratch.current;
      const source = plate.getContext("2d");
      const dest = canvas.getContext("2d");
      if (!source || !dest) return;
      if (!crop.current) {
        paintFashionAvatar(source, config, "idle", 0);
        crop.current = contentCrop(source);
      }
      paintFashionAvatar(source, config, emote, step);
      const frame = crop.current;
      if (!frame) return;
      if (canvas.width !== frame.w || canvas.height !== frame.h) {
        canvas.width = frame.w;
        canvas.height = frame.h;
      }
      dest.clearRect(0, 0, canvas.width, canvas.height);
      dest.drawImage(plate, frame.x, frame.y, frame.w, frame.h, 0, 0, frame.w, frame.h);
    };
    paint();
    void ensureGlamLayers().then(paint);
    return () => {
      cancel = true;
    };
  }, [config, emote, step]);

  return (
    <div className="fashion-doll fashion-glam-frame" data-glam="office">
      <canvas ref={view} className="fashion-glam-media" />
    </div>
  );
}
