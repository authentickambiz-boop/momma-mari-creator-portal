/**
 * Office You's locked glam plate. Kamron approved one full-body illustration;
 * the default free outfit (long plum hair, no headphones, pink collar, teal
 * skirt, pink ankle boots) paints that plate. Other outfits stay on the
 * procedural fashion painter.
 */

import { starterFashionLook, type CharacterConfig } from "./character";
import type { FashionPose } from "./fashion-avatar";

const baked = starterFashionLook();

/** Colors of the baked portrait. Recoloring leaves this plate and uses the doll. */
export const GLAM_LOCK = {
  skin: baked.body.color,
  hair: baked.slots.hair.color,
  top: baked.slots.top.color,
  skirt: baked.slots.bottom.color,
  boots: baked.slots.shoes.color,
} as const;

/** Same-size plates. Feet in the source sit at y=1068 so the billboard stands on the floor. */
export const GLAM_FRAME = { width: 864, height: 1152 } as const;

export const GLAM_LAYER_FILES = {
  locked: "/worlds/fashion-glam/locked.png",
  upper: "/worlds/fashion-glam/upper.png",
  lower: "/worlds/fashion-glam/lower.png",
  body: "/worlds/fashion-glam/body.png",
  arm: "/worlds/fashion-glam/arm.png",
} as const;

export type GlamLayerName = keyof typeof GLAM_LAYER_FILES;

export type GlamLayers = Record<GlamLayerName, CanvasImageSource>;

let layers: GlamLayers | null = null;

export function setGlamLayers(next: GlamLayers | null) {
  layers = next;
}

export function glamLayersReady() {
  return layers !== null;
}

function sameColor(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True when the saved look is the approved default, so the plate can replace the painter. */
export function isLockedGlam(config: CharacterConfig) {
  const slots = config.slots;
  return (
    sameColor(config.body.color, GLAM_LOCK.skin) &&
    config.body.shape === baked.body.shape &&
    config.face.eyes === baked.face.eyes &&
    config.face.mouth === baked.face.mouth &&
    config.face.expression === baked.face.expression &&
    slots.hair.item === baked.slots.hair.item &&
    sameColor(slots.hair.color, GLAM_LOCK.hair) &&
    slots.headwear.item === "none" &&
    slots.top.item === baked.slots.top.item &&
    sameColor(slots.top.color, GLAM_LOCK.top) &&
    slots.bottom.item === baked.slots.bottom.item &&
    sameColor(slots.bottom.color, GLAM_LOCK.skirt) &&
    slots.shoes.item === baked.slots.shoes.item &&
    sameColor(slots.shoes.color, GLAM_LOCK.boots) &&
    slots.accessory.item === "none"
  );
}

const SOURCE_TOP = 28;
const SOURCE_FOOT = 1068;
const SOURCE_LEFT = 268;
const SOURCE_RIGHT = 568;

function fit(width: number) {
  const scale = (2 * (1072 - 64)) / (SOURCE_FOOT - SOURCE_TOP);
  const dx = (width - (SOURCE_RIGHT - SOURCE_LEFT) * scale) / 2 - SOURCE_LEFT * scale;
  const dy = 1072 * 2 - SOURCE_FOOT * scale;
  return { scale, dx, dy, dw: GLAM_FRAME.width * scale, dh: GLAM_FRAME.height * scale };
}

/**
 * Draw the locked plate. Returns false when the images are not decoded yet,
 * so the caller can wait instead of flashing another drawing.
 */
export function paintLockedGlam(ctx: CanvasRenderingContext2D, pose: FashionPose, step: number) {
  if (!layers) return false;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { scale, dx, dy, dw, dh } = fit(width);
  const phase = Math.sin((step / 8) * Math.PI * 2);
  if (pose === "idle") {
    ctx.drawImage(layers.locked, dx, dy, dw, dh);
    return true;
  }
  if (pose === "walk") {
    ctx.drawImage(layers.upper, dx, dy, dw, dh);
    const hipX = dx + 420 * scale;
    const hipY = dy + 670 * scale;
    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.transform(1, 0, phase * 0.22, 1, 0, -Math.abs(phase) * 8);
    ctx.translate(-hipX, -hipY);
    ctx.drawImage(layers.lower, dx, dy, dw, dh);
    ctx.restore();
    return true;
  }
  if (pose === "wave") {
    ctx.drawImage(layers.body, dx, dy, dw, dh);
    const elbowX = dx + 520 * scale;
    const elbowY = dy + 430 * scale;
    ctx.save();
    ctx.translate(elbowX, elbowY);
    ctx.rotate(-1.2);
    ctx.translate(-elbowX, -elbowY);
    ctx.drawImage(layers.arm, dx, dy, dw, dh);
    ctx.restore();
    return true;
  }
  const drop = 42 * scale;
  ctx.drawImage(layers.upper, dx, dy + drop, dw, dh);
  const hipX = dx + 418 * scale;
  const hipY = dy + 670 * scale + drop;
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(-0.7);
  ctx.translate(-hipX, -hipY);
  ctx.drawImage(layers.lower, dx, dy + drop, dw, dh);
  ctx.restore();
  return true;
}
