/**
 * Worlds fashion avatar. Office You and the creator draw this illustration
 * onto a camera-facing plane for the creator studio. In the office, You is the
 * rigged glam figure. Roster bots keep the MakeHuman rig.
 * `public/worlds/humanoid.glb` is the hero only when NEXT_PUBLIC_WORLDS_HUMANOID=true.
 *
 * The default owner look paints the locked glam plate (the approved
 * full-body illustration: plum waves, no headphones, hand on hip). Every
 * other outfit still uses this shaded fashion painter.
 *
 * Coordinates are a 560×1120 design. The bitmap is 2× so lashes stay sharp.
 */

import type { CharacterConfig } from "./character";
import { isLockedGlam, paintLockedGlam } from "./fashion-glam-lock";

export const FASHION_CANVAS = { width: 1120, height: 2240 };
/** World height of the billboard, matching the old standing figure so name tags stay put. */
export const FASHION_FIGURE_HEIGHT = 1.76;

const DESIGN_W = 560;
const DESIGN_H = 1120;
const SCALE = FASHION_CANVAS.width / DESIGN_W;

export type FashionPose = "idle" | "walk" | "sit" | "wave";

/** The realistic mesh is the hero only when this public flag is exactly "true". */
export function humanoidMeshEnabled() {
  return (process.env.NEXT_PUBLIC_WORLDS_HUMANOID ?? "").trim().toLowerCase() === "true";
}

export function fashionPoseFrom(emote: string | undefined, moving: boolean, seated: boolean): FashionPose {
  if (seated || emote === "sit") return "sit";
  if (moving || emote === "walk") return "walk";
  if (emote === "wave" || emote === "cheer") return "wave";
  return "idle";
}

const INK = "#2a1824";
const LIP = "#d9899c";
const LIP_DEEP = "#b4637c";
const LIP_LIGHT = "#fff1f3";

type Rgb = { r: number; g: number; b: number };
type Point = { x: number; y: number };

function rgb(color: string): Rgb {
  const hex = color.replace("#", "");
  const value = Number.parseInt(hex.length === 3 ? hex.replace(/./g, "$&$&") : hex, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function mix(color: string, amount: number) {
  const tone = rgb(color);
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value + amount * 255)));
  return `rgb(${channel(tone.r)}, ${channel(tone.g)}, ${channel(tone.b)})`;
}

function ink(color: string, alpha: number) {
  const tone = rgb(color);
  return `rgba(${tone.r}, ${tone.g}, ${tone.b}, ${alpha})`;
}

type Layout = {
  cx: number;
  head: Point;
  rx: number;
  ry: number;
  neck: number;
  shoulder: number;
  waist: number;
  hip: number;
  knee: number;
  foot: number;
  hipW: number;
  shoulderW: number;
  swing: number;
  sit: boolean;
  wave: boolean;
  wink: boolean;
};

function layoutFor(pose: FashionPose, step: number, shape: CharacterConfig["body"]["shape"]): Layout {
  const swing = pose === "walk" ? Math.sin((step / 8) * Math.PI * 2) : 0;
  const sit = pose === "sit";
  const wide = shape === "wide" || shape === "round" ? 1.08 : shape === "compact" ? 0.94 : 1;
  const tall = shape === "tall" ? 14 : 0;
  const drop = sit ? 40 : 0;
  return {
    cx: 280,
    head: { x: 280, y: 146 + drop },
    rx: 46,
    ry: 58,
    neck: 212 + drop,
    shoulder: 244 + drop,
    waist: 412 + drop - tall,
    hip: 500 + drop - tall,
    knee: sit ? 690 : 748,
    foot: 1072,
    hipW: 36 * wide,
    shoulderW: 62 * (shape === "wide" ? 1.06 : 1),
    swing,
    sit,
    wave: pose === "wave",
    wink: false,
  };
}

function trace(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, width = 1.7) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function shade(ctx: CanvasRenderingContext2D, color: string, x0: number, y0: number, x1: number, y1: number) {
  const tone = ctx.createLinearGradient(x0, y0, x1, y1);
  tone.addColorStop(0, mix(color, 0.2));
  tone.addColorStop(0.42, color);
  tone.addColorStop(1, mix(color, -0.2));
  return tone;
}

function limb(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  width: number,
  color: string,
  taper = 0.82,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const nx = Math.sin(angle);
  const ny = -Math.cos(angle);
  const end = width * taper;
  ctx.beginPath();
  ctx.moveTo(from.x + nx * width, from.y + ny * width);
  ctx.lineTo(to.x + nx * end, to.y + ny * end);
  ctx.quadraticCurveTo(to.x + nx * end * 0.15, to.y + ny * end * 0.15, to.x - nx * end, to.y - ny * end);
  ctx.lineTo(from.x - nx * width, from.y - ny * width);
  ctx.closePath();
  trace(ctx, shade(ctx, color, from.x + nx * width, from.y, to.x - nx * width, to.y), 1.6);
}

function hand(ctx: CanvasRenderingContext2D, at: Point, from: Point, skin: string) {
  const angle = Math.atan2(at.y - from.y, at.x - from.x);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(10, 0, 12, 8, 0, 0, Math.PI * 2);
  trace(ctx, shade(ctx, skin, 0, -8, 0, 8), 1.3);
  for (const [x, y] of [
    [16, -6],
    [20, -2],
    [20, 3],
    [16, 7],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, 5.5, 2.4, y * 0.08, 0, Math.PI * 2);
    trace(ctx, skin, 1.15);
  }
  ctx.restore();
}

function glamHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.bezierCurveTo(cx + rx * 0.62, cy - ry, cx + rx * 1.02, cy - ry * 0.28, cx + rx * 0.9, cy + ry * 0.12);
  ctx.bezierCurveTo(cx + rx * 0.72, cy + ry * 0.62, cx + rx * 0.34, cy + ry * 1.02, cx, cy + ry * 0.98);
  ctx.bezierCurveTo(cx - rx * 0.34, cy + ry * 1.02, cx - rx * 0.72, cy + ry * 0.62, cx - rx * 0.9, cy + ry * 0.12);
  ctx.bezierCurveTo(cx - rx * 1.02, cy - ry * 0.28, cx - rx * 0.62, cy - ry, cx, cy - ry);
  ctx.closePath();
}

function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  skin: string,
  style: CharacterConfig["face"]["eyes"],
  shut: boolean,
  outer: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(outer, 1);
  const wide = style === "wide";
  const rx = style === "dot" ? 11 : wide ? 16 : 14.5;
  const ry = style === "sleepy" ? 5.5 : style === "dot" ? 8 : wide ? 9.2 : 8.4;
  const smoke = ctx.createRadialGradient(rx * 0.2, -ry, 2, 0, -2, rx * 1.35);
  smoke.addColorStop(0, "rgba(92, 52, 96, 0.55)");
  smoke.addColorStop(0.45, "rgba(126, 78, 112, 0.28)");
  smoke.addColorStop(1, "rgba(126, 78, 112, 0)");
  ctx.fillStyle = smoke;
  ctx.beginPath();
  ctx.ellipse(1, -ry * 0.35, rx * 1.15, ry * 1.35, 0, 0, Math.PI * 2);
  ctx.fill();
  if (shut) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-rx, 1);
    ctx.quadraticCurveTo(0, 6, rx, 0);
    ctx.quadraticCurveTo(rx + 5, -4, rx + 7, -6);
    ctx.stroke();
    lashes(ctx, rx, 7);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-rx, 0.6);
  ctx.quadraticCurveTo(-rx * 0.25, -ry * 1.05, rx * 0.15, -ry * 0.62);
  ctx.quadraticCurveTo(rx * 0.78, -ry * 0.08, rx, -0.8);
  ctx.quadraticCurveTo(rx * 0.2, ry * 0.95, -rx * 0.15, ry * 0.55);
  ctx.quadraticCurveTo(-rx * 0.7, ry * 0.15, -rx, 0.6);
  ctx.closePath();
  ctx.fillStyle = "#fffaf8";
  ctx.fill();
  ctx.lineWidth = 1.15;
  ctx.strokeStyle = "#3a2430";
  ctx.stroke();
  ctx.save();
  ctx.clip();
  const irisR = ry * 0.78;
  const iris = ctx.createRadialGradient(-irisR * 0.25, -irisR * 0.3, 1, 0.4, 1, irisR);
  iris.addColorStop(0, "#f4e2f8");
  iris.addColorStop(0.22, "#b57ad2");
  iris.addColorStop(0.55, "#7a3ea8");
  iris.addColorStop(0.82, "#4c2270");
  iris.addColorStop(1, "#2a123c");
  ctx.beginPath();
  ctx.arc(0.4, 1.1, irisR, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(0.4, 1.1, irisR * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.5, 1.5, irisR * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = "#140c16";
  ctx.fill();
  if (style === "star") {
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.arc(0.4, 1.2, irisR * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(-rx * 0.22, -ry * 0.25, 0.3, -rx * 0.16, -ry * 0.16, rx * 0.28);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.45, "rgba(255,255,255,0.4)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(-rx * 0.16, -ry * 0.12, rx * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(rx * 0.18, ry * 0.18, 1.3, 0, Math.PI * 2);
  ctx.fill();
  if (style === "sleepy") {
    ctx.fillStyle = skin;
    ctx.fillRect(-rx - 4, -ry - 6, rx * 2 + 8, ry + 2);
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.35;
  ctx.beginPath();
  ctx.moveTo(-rx + 1, 0.2);
  ctx.quadraticCurveTo(-rx * 0.1, -ry, rx * 0.45, -ry * 0.35);
  ctx.quadraticCurveTo(rx * 0.9, -1, rx, -0.6);
  ctx.quadraticCurveTo(rx + 4.5, -4.5, rx + 7, -6.5);
  ctx.stroke();
  lashes(ctx, rx, ry);
  ctx.strokeStyle = ink("#3a2430", 0.45);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-rx + 2, ry * 0.35);
  ctx.quadraticCurveTo(0, ry * 0.7, rx - 2, ry * 0.2);
  ctx.stroke();
  ctx.restore();
}

function lashes(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  ctx.save();
  ctx.strokeStyle = "#1c1018";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.05;
  const fans = [
    [-0.72, -0.2, -0.95, -1.15],
    [-0.4, -0.75, -0.48, -1.55],
    [-0.05, -0.9, 0.02, -1.7],
    [0.28, -0.7, 0.42, -1.5],
    [0.55, -0.4, 0.78, -1.2],
    [0.8, -0.1, 1.05, -0.85],
  ] as const;
  for (const [ax, ay, bx, by] of fans) {
    ctx.beginPath();
    ctx.moveTo(ax * rx, ay * ry);
    ctx.quadraticCurveTo(((ax + bx) / 2) * rx, ((ay + by) / 2) * ry - 1.2, bx * rx, by * ry);
    ctx.stroke();
  }
  ctx.restore();
}

function brow(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(outer, 1);
  ctx.beginPath();
  ctx.moveTo(-15, -15);
  ctx.quadraticCurveTo(-2, -25, 13, -14);
  ctx.quadraticCurveTo(2, -19, -12, -16.5);
  ctx.closePath();
  ctx.fillStyle = "#3a241c";
  ctx.fill();
  ctx.restore();
}

function lips(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  expression: CharacterConfig["face"]["expression"],
  mouth: CharacterConfig["face"]["mouth"],
) {
  const open = mouth === "open" || expression === "surprised";
  const grin = mouth === "grin" || expression === "smile";
  const flat = (mouth === "flat" || expression === "focused") && !grin && !open;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (flat) {
    ctx.strokeStyle = LIP_DEEP;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 1);
    ctx.quadraticCurveTo(x, y + 3, x + 12, y + 1);
    ctx.stroke();
    return;
  }
  const half = grin ? 16 : 13;
  const lift = grin ? 3.5 : 2;
  const lower = open ? 9 : grin ? 7.5 : 6;
  ctx.beginPath();
  ctx.moveTo(x - half, y - lift);
  ctx.quadraticCurveTo(x - half * 0.25, y - 5, x, y - 3.2);
  ctx.quadraticCurveTo(x + half * 0.25, y - 5, x + half, y - lift);
  ctx.quadraticCurveTo(x + half * 0.55, y + lower, x, y + lower + 2.4);
  ctx.quadraticCurveTo(x - half * 0.55, y + lower, x - half, y - lift);
  ctx.closePath();
  const gloss = ctx.createLinearGradient(x, y - 6, x, y + lower + 3);
  gloss.addColorStop(0, LIP_LIGHT);
  gloss.addColorStop(0.4, LIP);
  gloss.addColorStop(1, LIP_DEEP);
  trace(ctx, gloss, 1.15);
  if (open) {
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 4.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#a85a72";
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.beginPath();
  ctx.ellipse(x - 1, y + lower * 0.15, half * 0.38, 1.7, -0.1, 0, Math.PI * 2);
  ctx.fill();
}

function hairBack(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  if (item === "none" || item === "spikes") return;
  const { cx, head, ry, waist, hip } = layout;
  const tone = shade(ctx, color, cx - 80, head.y - ry, cx + 40, hip);
  ctx.lineJoin = "round";
  if (item === "long" || item === "waves") {
    ctx.beginPath();
    ctx.moveTo(cx - 18, head.y - ry - 6);
    ctx.bezierCurveTo(cx - 78, head.y - ry - 18, cx - 96, head.y + 20, cx - 84, head.y + 90);
    ctx.bezierCurveTo(cx - 130, waist - 40, cx - 118, hip - 20, cx - 136, hip + 70);
    ctx.bezierCurveTo(cx - 148, hip + 150, cx - 70, hip + 190, cx - 24, hip + 150);
    ctx.quadraticCurveTo(cx + 10, hip + 210, cx + 48, hip + 146);
    ctx.bezierCurveTo(cx + 100, hip + 180, cx + 150, hip + 90, cx + 124, waist + 10);
    ctx.bezierCurveTo(cx + 104, head.y + 70, cx + 96, head.y + 8, cx + 36, head.y - ry + 4);
    ctx.quadraticCurveTo(cx + 4, head.y - ry - 26, cx - 18, head.y - ry - 6);
    trace(ctx, tone, 1.6);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = ink(mix(color, 0.35), 0.55);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(cx - 40, head.y - 20);
    ctx.bezierCurveTo(cx - 70, head.y + 80, cx - 90, waist, cx - 70, hip + 40);
    ctx.moveTo(cx + 24, head.y - 10);
    ctx.bezierCurveTo(cx + 60, head.y + 90, cx + 80, waist, cx + 50, hip + 20);
    ctx.stroke();
    ctx.restore();
    if (item === "waves") {
      ctx.strokeStyle = ink(mix(color, -0.15), 0.45);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 100, head.y + 120);
      ctx.quadraticCurveTo(cx - 70, waist, cx - 110, hip + 20);
      ctx.moveTo(cx + 96, head.y + 130);
      ctx.quadraticCurveTo(cx + 70, waist + 20, cx + 112, hip + 10);
      ctx.stroke();
    }
    return;
  }
  if (item === "bob" || item === "cap") {
    ctx.beginPath();
    ctx.ellipse(cx, head.y + 18, item === "cap" ? 58 : 70, item === "cap" ? 64 : 86, 0, 0, Math.PI * 2);
    trace(ctx, tone, 1.6);
    return;
  }
  if (item === "bun") {
    ctx.beginPath();
    ctx.ellipse(cx + 6, head.y - ry - 8, 22, 18, 0.2, 0, Math.PI * 2);
    trace(ctx, tone, 1.5);
    ctx.beginPath();
    ctx.ellipse(cx, head.y + 8, 54, 62, 0, 0, Math.PI * 2);
    trace(ctx, tone, 1.5);
  }
}

function hairFront(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  if (item === "none") return;
  const { cx, head, rx, ry } = layout;
  const tone = shade(ctx, color, cx - 30, head.y - ry, cx + 40, head.y + 20);
  if (item !== "spikes") {
    ctx.beginPath();
    ctx.moveTo(cx - rx + 8, head.y - 18);
    ctx.quadraticCurveTo(cx - 28, head.y - ry - 4, cx - 4, head.y - ry + 6);
    ctx.quadraticCurveTo(cx + 24, head.y - ry - 16, cx + rx - 6, head.y - 22);
    ctx.quadraticCurveTo(cx + 18, head.y - 8, cx - 8, head.y - 6);
    ctx.quadraticCurveTo(cx - 30, head.y - 4, cx - rx + 8, head.y - 18);
    trace(ctx, tone, 1.4);
    ctx.strokeStyle = ink("#ffffff", 0.28);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - 10, head.y - ry + 10);
    ctx.quadraticCurveTo(cx + 16, head.y - ry + 2, cx + 34, head.y - ry + 16);
    ctx.stroke();
  }
  if (item === "long" || item === "waves" || item === "bob") {
    const lock = (x0: number, x1: number, reach: number) => {
      ctx.beginPath();
      ctx.moveTo(x0, head.y - 10);
      ctx.bezierCurveTo(x0 - 18, head.y + 40, x1 - 10, head.y + reach * 0.45, x1, head.y + reach);
      ctx.bezierCurveTo(x1 + 14, head.y + reach * 0.7, x0 + 16, head.y + 30, x0 + 8, head.y - 6);
      ctx.closePath();
      trace(ctx, shade(ctx, color, x0, head.y, x1, head.y + reach), 1.3);
    };
    lock(cx - rx + 6, cx - rx - 8, item === "bob" ? 70 : 150);
    lock(cx + rx - 4, cx + rx + 14, item === "bob" ? 64 : 168);
  }
  if (item === "spikes") {
    for (const [x, h] of [
      [-28, 22],
      [-8, 30],
      [12, 26],
      [30, 18],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + x - 8, head.y - ry + 16);
      ctx.quadraticCurveTo(cx + x, head.y - ry - h, cx + x + 8, head.y - ry + 12);
      ctx.closePath();
      trace(ctx, color, 1.3);
    }
  }
}

type Arm = { shoulder: Point; elbow: Point; hand: Point };

function armPose(layout: Layout): { back: Arm; front: Arm } {
  const { cx, shoulder, waist, hip, shoulderW, hipW, swing, wave, sit, head } = layout;
  if (wave) {
    return {
      back: {
        shoulder: { x: cx + shoulderW - 8, y: shoulder + 8 },
        elbow: { x: cx + shoulderW + 6, y: (shoulder + waist) / 2 },
        hand: { x: cx + shoulderW - 4, y: hip - 10 },
      },
      front: {
        shoulder: { x: cx - shoulderW + 10, y: shoulder },
        elbow: { x: cx - shoulderW - 36, y: shoulder - 36 },
        hand: { x: cx - 70, y: head.y + 8 },
      },
    };
  }
  if (sit) {
    return {
      back: {
        shoulder: { x: cx + shoulderW - 6, y: shoulder + 10 },
        elbow: { x: cx + 48, y: hip - 10 },
        hand: { x: cx + 10, y: hip + 16 },
      },
      front: {
        shoulder: { x: cx - shoulderW + 8, y: shoulder + 8 },
        elbow: { x: cx - shoulderW - 28, y: waist },
        hand: { x: cx - 8, y: hip + 8 },
      },
    };
  }
  if (Math.abs(swing) > 0.2) {
    return {
      back: {
        shoulder: { x: cx + shoulderW - 4, y: shoulder + 6 },
        elbow: { x: cx + shoulderW + 4 - swing * 18, y: waist - 20 + swing * 16 },
        hand: { x: cx + shoulderW - 8 - swing * 26, y: hip + swing * 36 },
      },
      front: {
        shoulder: { x: cx - shoulderW + 6, y: shoulder + 6 },
        elbow: { x: cx - shoulderW - 4 + swing * 16, y: waist - 16 - swing * 14 },
        hand: { x: cx - shoulderW + 8 + swing * 22, y: hip - swing * 34 },
      },
    };
  }
  return {
    back: {
      shoulder: { x: cx + shoulderW - 6, y: shoulder + 8 },
      elbow: { x: cx + shoulderW + 10, y: waist - 6 },
      hand: { x: cx + shoulderW - 2, y: hip + 28 },
    },
    front: {
      shoulder: { x: cx - shoulderW + 8, y: shoulder + 6 },
      elbow: { x: cx - shoulderW - 34, y: waist - 28 },
      hand: { x: cx - hipW + 2, y: hip - 6 },
    },
  };
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  arm: Arm,
  cloth: string,
  skin: string,
  sleeve: "long" | "short" | "none",
) {
  limb(ctx, arm.shoulder, arm.elbow, 11, sleeve === "none" ? skin : cloth);
  const forearm = sleeve === "long" ? cloth : skin;
  if (sleeve === "short") limb(ctx, arm.shoulder, arm.elbow, 12, cloth, 0.7);
  limb(ctx, arm.elbow, arm.hand, 8, forearm, 0.78);
  hand(ctx, arm.hand, arm.elbow, skin);
}

function legPair(ctx: CanvasRenderingContext2D, layout: Layout, fromY: number, skin: string, cloth?: string) {
  const { cx, foot, swing, sit, hip, hipW } = layout;
  const color = cloth ?? skin;
  if (sit) {
    limb(ctx, { x: cx - 8, y: hip }, { x: cx - 78, y: hip + 36 }, 16, color, 0.8);
    limb(ctx, { x: cx - 78, y: hip + 36 }, { x: cx - 62, y: foot - 8 }, 12, color, 0.75);
    limb(ctx, { x: cx + 8, y: hip }, { x: cx + 86, y: hip + 28 }, 16, color, 0.8);
    limb(ctx, { x: cx + 86, y: hip + 28 }, { x: cx + 70, y: foot - 12 }, 12, color, 0.75);
    return;
  }
  const spread = swing * 18;
  const liftL = Math.max(0, -swing) * 16;
  const liftR = Math.max(0, swing) * 16;
  const poseKnee = swing === 0 ? 10 : 0;
  limb(ctx, { x: cx - hipW * 0.35, y: fromY }, { x: cx - 18 - spread, y: layout.knee - poseKnee }, 13, color, 0.86);
  limb(ctx, { x: cx - 18 - spread, y: layout.knee - poseKnee }, { x: cx - 14 - spread, y: foot - 16 - liftL }, 10, color, 0.8);
  limb(ctx, { x: cx + hipW * 0.35, y: fromY }, { x: cx + 16 + spread, y: layout.knee + poseKnee }, 13, color, 0.86);
  limb(ctx, { x: cx + 16 + spread, y: layout.knee + poseKnee }, { x: cx + 18 + spread, y: foot - 16 - liftR }, 10, color, 0.8);
}

function bottoms(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string, skin: string) {
  const { cx, hip, hipW, knee } = layout;
  if (layout.sit && item !== "skirt") {
    legPair(ctx, layout, hip, skin, item === "none" ? skin : color);
    return;
  }
  if (item === "skirt" || item === "none") {
    const cloth = item === "none" ? "#2c3038" : color;
    const hem = item === "none" ? hip + 36 : knee - 36;
    ctx.beginPath();
    ctx.moveTo(cx - hipW - 2, hip - 8);
    ctx.quadraticCurveTo(cx - hipW - 8, hip + 40, cx - hipW + 4, hem);
    ctx.lineTo(cx + hipW - 4, hem);
    ctx.quadraticCurveTo(cx + hipW + 8, hip + 40, cx + hipW + 2, hip - 8);
    ctx.quadraticCurveTo(cx, hip - 18, cx - hipW - 2, hip - 8);
    trace(ctx, shade(ctx, cloth, cx - hipW, hip, cx + hipW, hem), 1.6);
    ctx.strokeStyle = ink("#ffffff", 0.22);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - hipW + 8, hip);
    ctx.quadraticCurveTo(cx - hipW + 4, (hip + hem) / 2, cx - hipW + 10, hem - 4);
    ctx.stroke();
    ctx.strokeStyle = ink(mix(cloth, -0.25), 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, hip + 4);
    ctx.lineTo(cx + 1, hem - 2);
    ctx.stroke();
    if (item === "skirt") legPair(ctx, layout, hem - 4, skin);
    return;
  }
  const hem = item === "shorts" ? knee - 70 : layout.foot - 28;
  legPair(ctx, layout, hip - 6, skin, color);
  if (item === "shorts") legPair(ctx, layout, hem, skin);
}

function shoes(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  const { cx, foot, swing, sit, hip } = layout;
  const points: Point[] = sit
    ? [
        { x: cx - 62, y: foot - 6 },
        { x: cx + 70, y: foot - 10 },
      ]
    : [
        { x: cx - 14 - swing * 18, y: foot - 4 - Math.max(0, -swing) * 16 },
        { x: cx + 18 + swing * 18, y: foot - 4 - Math.max(0, swing) * 16 },
      ];
  if (sit) {
    points[0] = { x: cx - 62, y: foot - 6 };
    points[1] = { x: cx + 70, y: foot - 10 };
  }
  void hip;
  for (const at of points) {
    const cloth = item === "none" ? "#f6efe4" : color;
    const heel = item === "heels" || item === "boots";
    ctx.beginPath();
    ctx.moveTo(at.x - 12, at.y - 8);
    ctx.quadraticCurveTo(at.x + 4, at.y - 16, at.x + 22, at.y - 12);
    ctx.quadraticCurveTo(at.x + (heel ? 34 : 28), at.y - 8, at.x + 30, at.y - 2);
    ctx.lineTo(at.x + 16, at.y + 4);
    ctx.quadraticCurveTo(at.x, at.y + 6, at.x - 12, at.y + 2);
    ctx.closePath();
    trace(ctx, shade(ctx, cloth, at.x - 8, at.y - 16, at.x + 16, at.y + 4), 1.35);
    if (heel) {
      ctx.beginPath();
      ctx.moveTo(at.x - 8, at.y);
      ctx.lineTo(at.x - 10, at.y + 16);
      ctx.lineTo(at.x - 4, at.y + 16);
      ctx.lineTo(at.x - 1, at.y);
      ctx.closePath();
      trace(ctx, mix(cloth, -0.12), 1.1);
    }
    if (item === "boots" || item === "heels") {
      ctx.beginPath();
      ctx.moveTo(at.x - 14, at.y - 8);
      ctx.lineTo(at.x - 12, at.y - (item === "heels" ? 28 : 36));
      ctx.quadraticCurveTo(at.x + 4, at.y - (item === "heels" ? 40 : 48), at.x + 16, at.y - (item === "heels" ? 26 : 34));
      ctx.lineTo(at.x + 18, at.y - 10);
      ctx.closePath();
      trace(ctx, shade(ctx, cloth, at.x - 10, at.y - 40, at.x + 12, at.y), 1.3);
      ctx.strokeStyle = ink("#ffffff", 0.35);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(at.x - 4, at.y - 30);
      ctx.lineTo(at.x + 2, at.y - 14);
      ctx.stroke();
    }
  }
}

function top(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  const cloth = item === "none" ? "#f4efe6" : color;
  const { cx, shoulder, waist, hip, shoulderW } = layout;
  const hem = hip - 6;
  const neckW = 16;
  const waistW = 28;
  ctx.beginPath();
  ctx.moveTo(cx - neckW, shoulder - 6);
  ctx.quadraticCurveTo(cx - shoulderW - 4, shoulder + 18, cx - shoulderW + 8, shoulder + 54);
  ctx.bezierCurveTo(cx - waistW - 10, waist - 10, cx - waistW - 6, waist + 20, cx - layout.hipW + 2, hem);
  ctx.lineTo(cx + layout.hipW - 2, hem);
  ctx.bezierCurveTo(cx + waistW + 6, waist + 20, cx + waistW + 10, waist - 10, cx + shoulderW - 8, shoulder + 54);
  ctx.quadraticCurveTo(cx + shoulderW + 4, shoulder + 18, cx + neckW, shoulder - 6);
  ctx.quadraticCurveTo(cx, shoulder + 16, cx - neckW, shoulder - 6);
  trace(ctx, shade(ctx, cloth, cx - shoulderW, shoulder, cx + 20, hem), 1.6);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = ink("#ffffff", 0.2);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW + 10, shoulder + 20);
  ctx.quadraticCurveTo(cx - waistW, waist, cx - layout.hipW + 8, hem);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = ink(mix(cloth, -0.28), 0.7);
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(cx - 8, shoulder + 18);
  ctx.quadraticCurveTo(cx - 16, waist - 10, cx - 10, hem - 4);
  ctx.moveTo(cx + 10, shoulder + 22);
  ctx.quadraticCurveTo(cx + 18, waist, cx + 12, hem - 8);
  ctx.stroke();
  if (item === "jacket") {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 6, shoulder + 8);
    ctx.lineTo(cx - 2, hem);
    ctx.moveTo(cx + 6, shoulder + 8);
    ctx.lineTo(cx + 2, hem);
    ctx.stroke();
  }
  if (item === "hoodie") {
    ctx.beginPath();
    ctx.roundRect(cx - 16, waist + 8, 32, 22, 6);
    trace(ctx, mix(cloth, -0.06), 1.3);
  }
}

function neck(ctx: CanvasRenderingContext2D, layout: Layout, skin: string) {
  const { cx, neck: neckY, shoulder, head, ry } = layout;
  ctx.beginPath();
  ctx.moveTo(cx - 12, neckY);
  ctx.quadraticCurveTo(cx, shoulder + 4, cx + 12, neckY);
  ctx.lineTo(cx + 11, head.y + ry - 16);
  ctx.quadraticCurveTo(cx, head.y + ry - 6, cx - 11, head.y + ry - 16);
  ctx.closePath();
  trace(ctx, shade(ctx, skin, cx - 12, neckY, cx + 12, head.y), 1.4);
}

function face(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  config: CharacterConfig,
) {
  const { cx, head, rx, ry } = layout;
  const skin = config.body.color;
  const cheek = ctx.createRadialGradient(head.x - 10, head.y - 18, 8, head.x, head.y + 8, ry);
  cheek.addColorStop(0, mix(skin, 0.18));
  cheek.addColorStop(0.55, skin);
  cheek.addColorStop(1, mix(skin, -0.1));
  glamHead(ctx, head.x, head.y, rx, ry);
  trace(ctx, cheek, 1.6);
  const blushAt = (x: number) => {
    const glow = ctx.createRadialGradient(x, head.y + 16, 1, x, head.y + 16, 14);
    glow.addColorStop(0, "rgba(226, 112, 98, 0.4)");
    glow.addColorStop(1, "rgba(226, 112, 98, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, head.y + 16, 14, 0, Math.PI * 2);
    ctx.fill();
  };
  blushAt(cx - 24);
  blushAt(cx + 24);
  const eyeY = head.y - 2;
  const wide = config.face.eyes === "wide" || config.face.expression === "surprised";
  const style = wide && config.face.eyes !== "sleepy" ? "wide" : config.face.eyes;
  eye(ctx, cx - 20, eyeY, skin, style, false, 1);
  eye(ctx, cx + 20, eyeY, skin, style, layout.wink, -1);
  brow(ctx, cx - 20, eyeY, 1);
  brow(ctx, cx + 20, eyeY, -1);
  ctx.strokeStyle = ink(mix(skin, -0.28), 0.7);
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, head.y + 8);
  ctx.quadraticCurveTo(cx + 3.2, head.y + 16, cx + 0.4, head.y + 20);
  ctx.stroke();
  lips(ctx, cx, head.y + 32, config.face.expression, config.face.mouth);
  if (config.slots.headwear.item !== "headphones") {
    for (const x of [cx - rx + 2, cx + rx - 2]) {
      ctx.beginPath();
      ctx.ellipse(x, head.y + 10, 3.2, 5.2, 0, 0, Math.PI * 2);
      trace(ctx, shade(ctx, "#f4f7fb", x - 2, head.y + 4, x + 2, head.y + 16), 1);
      ctx.beginPath();
      ctx.arc(x, head.y + 4, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = "#d7dde6";
      ctx.fill();
    }
  }
}

function headwear(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  if (item === "none") return;
  const { cx, head, rx, ry } = layout;
  if (item === "headphones") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - rx - 8, head.y - 4);
    ctx.quadraticCurveTo(cx, head.y - ry - 16, cx + rx + 8, head.y - 4);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(cx - rx - 22, head.y - 2, 16, 26, 6);
    ctx.roundRect(cx + rx + 6, head.y - 2, 16, 26, 6);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (item === "cap") {
    ctx.beginPath();
    ctx.ellipse(cx, head.y - 28, rx - 4, 26, 0, Math.PI, 0);
    trace(ctx, color, 1.4);
    ctx.beginPath();
    ctx.ellipse(cx + 36, head.y - 8, 26, 7, 0.2, 0, Math.PI * 2);
    trace(ctx, color, 1.3);
    return;
  }
  if (item === "beanie") {
    ctx.beginPath();
    ctx.ellipse(cx, head.y - 36, rx - 2, 34, 0, Math.PI, 0);
    trace(ctx, color, 1.4);
    return;
  }
  if (item === "bow") {
    const bx = cx + rx + 4;
    const by = head.y - ry + 10;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - 18, by - 12, bx - 14, by + 2);
    ctx.quadraticCurveTo(bx - 20, by + 12, bx, by + 3);
    ctx.quadraticCurveTo(bx + 20, by + 12, bx + 16, by + 2);
    ctx.quadraticCurveTo(bx + 22, by - 12, bx, by);
    trace(ctx, shade(ctx, color, bx - 16, by - 10, bx + 16, by + 8), 1.2);
    return;
  }
  if (item === "crown") {
    ctx.beginPath();
    ctx.moveTo(cx - 28, head.y - ry + 8);
    ctx.lineTo(cx - 18, head.y - ry - 12);
    ctx.lineTo(cx - 8, head.y - ry + 2);
    ctx.lineTo(cx, head.y - ry - 18);
    ctx.lineTo(cx + 8, head.y - ry + 2);
    ctx.lineTo(cx + 18, head.y - ry - 12);
    ctx.lineTo(cx + 28, head.y - ry + 8);
    ctx.closePath();
    trace(ctx, color, 1.3);
  }
}

function accessory(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  const { cx, shoulder, waist, hip, shoulderW, head } = layout;
  if (item === "none") {
    ctx.strokeStyle = "#d5dbe3";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 16, shoulder + 8);
    ctx.quadraticCurveTo(cx, shoulder + 22, cx + 18, shoulder + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, shoulder + 16);
    ctx.lineTo(cx, shoulder + 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, shoulder + 34, 4, 6, 0, 0, Math.PI * 2);
    trace(ctx, shade(ctx, "#f7f9fb", cx - 3, shoulder + 28, cx + 3, shoulder + 40), 1);
    return;
  }
  if (item === "glasses") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    const eyeY = head.y - 2;
    ctx.beginPath();
    ctx.ellipse(cx - 20, eyeY, 18, 10, -0.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 20, eyeY, 18, 10, 0.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 4, eyeY);
    ctx.quadraticCurveTo(cx, eyeY + 2, cx + 4, eyeY);
    ctx.stroke();
    return;
  }
  if (item === "scarf") {
    ctx.beginPath();
    ctx.moveTo(cx - 24, layout.neck + 4);
    ctx.quadraticCurveTo(cx, layout.neck + 22, cx + 26, layout.neck + 2);
    ctx.lineTo(cx + 16, layout.neck + 48);
    ctx.lineTo(cx + 6, layout.neck + 44);
    ctx.quadraticCurveTo(cx, layout.neck + 12, cx - 24, layout.neck + 4);
    trace(ctx, color, 1.4);
    return;
  }
  if (item === "bag") {
    ctx.beginPath();
    ctx.roundRect(cx + shoulderW + 8, waist, 28, 36, 6);
    trace(ctx, shade(ctx, color, cx + shoulderW, waist, cx + shoulderW + 28, waist + 36), 1.3);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + shoulderW + 12, waist + 2);
    ctx.quadraticCurveTo(cx + 20, shoulder + 8, cx + 10, shoulder - 4);
    ctx.stroke();
    return;
  }
  if (item === "badge") {
    ctx.beginPath();
    ctx.arc(cx + 16, shoulder + 36, 7, 0, Math.PI * 2);
    trace(ctx, color, 1.2);
    return;
  }
  if (item === "watch") {
    ctx.beginPath();
    ctx.roundRect(cx - shoulderW + 4, hip - 6, 14, 8, 2);
    trace(ctx, color, 1.1);
  }
}

/** Paint one fashion-illustration frame. The background stays clear so the plane can billboard. */
export function paintFashionAvatar(
  ctx: CanvasRenderingContext2D,
  config: CharacterConfig,
  pose: FashionPose,
  step = 0,
) {
  if (isLockedGlam(config)) {
    paintLockedGlam(ctx, pose, step);
    return;
  }
  const layout = layoutFor(pose, step, config.body.shape);
  layout.wink = config.face.expression === "wink";
  const skin = config.body.color;
  const hair = config.slots.hair.color;
  const hairItem = config.slots.hair.item;
  const topItem = config.slots.top.item;
  const sleeve = topItem === "tee" || topItem === "vest" ? "short" : topItem === "none" ? "none" : "long";
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  hairBack(ctx, layout, hairItem, hair);
  const arms = armPose(layout);
  const cloth = topItem === "none" ? "#f4efe6" : config.slots.top.color;
  drawArm(ctx, arms.back, cloth, skin, sleeve);
  bottoms(ctx, layout, config.slots.bottom.item, config.slots.bottom.color, skin);
  shoes(ctx, layout, config.slots.shoes.item, config.slots.shoes.color);
  top(ctx, layout, topItem, config.slots.top.color);
  if (config.slots.bottom.item === "overalls") {
    ctx.strokeStyle = config.slots.bottom.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(layout.cx - 16, layout.hip);
    ctx.lineTo(layout.cx - 12, layout.shoulder + 8);
    ctx.moveTo(layout.cx + 16, layout.hip);
    ctx.lineTo(layout.cx + 12, layout.shoulder + 8);
    ctx.stroke();
  }
  drawArm(ctx, arms.front, cloth, skin, sleeve);
  neck(ctx, layout, skin);
  face(ctx, layout, config);
  hairFront(ctx, layout, hairItem, hair);
  headwear(ctx, layout, config.slots.headwear.item, config.slots.headwear.color);
  accessory(ctx, layout, config.slots.accessory.item, config.slots.accessory.color);
}
