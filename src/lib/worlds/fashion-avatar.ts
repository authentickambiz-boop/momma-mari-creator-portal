/**
 * Worlds fashion avatar. Office You and the creator draw this illustration
 * onto a camera-facing plane. Roster bots keep the rigged humanoid.
 * `public/worlds/humanoid.glb` is the hero only when NEXT_PUBLIC_WORLDS_HUMANOID=true.
 * Share this module and `src/components/worlds/fashion-figure.tsx` with the
 * creator studio (PR #214) instead of mounting the realistic mesh as You.
 *
 * The face is cute Y2K glam, not oversized doll eyes: smaller almond eyes,
 * lashes, a soft catchlight, a frosted glossy lid, a thin arched brow, warm
 * blush, and glossy lips. Headphones sit beside the head so they do not cover
 * the eyes. There is no shared face component with the SVG doll on PR #214,
 * so this canvas face carries that same look.
 *
 * Coordinates below are in a 560×1120 design space. The bitmap is 2× so the
 * lashes and lip highlight stay sharp on a close camera.
 */

import type { CharacterConfig } from "./character";

export const FASHION_CANVAS = { width: 1120, height: 2240 };
/** World height of the billboard, matching the old standing figure so name tags stay put. */
export const FASHION_FIGURE_HEIGHT = 1.76;

const DESIGN_W = 560;
const DESIGN_H = 1120;
const SCALE = FASHION_CANVAS.width / DESIGN_W;

export type FashionPose = "idle" | "walk" | "sit" | "wave";

/** The realistic mesh is off unless this public flag is exactly "true". */
export function humanoidMeshEnabled() {
  return (process.env.NEXT_PUBLIC_WORLDS_HUMANOID ?? "").trim().toLowerCase() === "true";
}

export function fashionPoseFrom(emote: string | undefined, moving: boolean, seated: boolean): FashionPose {
  if (seated || emote === "sit") return "sit";
  if (moving || emote === "walk") return "walk";
  if (emote === "wave" || emote === "cheer") return "wave";
  return "idle";
}

const OUTLINE = "#2a1c24";
const LIP = "#ee86a4";
const LIP_DEEP = "#d56b8c";
const LIP_LIGHT = "#fff0f4";
const LASH = "#2a1c24";
const CAMI = "#f4efe6";

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
  const wide = shape === "wide" || shape === "round" ? 1.1 : shape === "compact" ? 0.92 : 1;
  const tall = shape === "tall" ? 18 : 0;
  const drop = sit ? 48 : 0;
  return {
    cx: 280,
    head: { x: 280, y: 236 + drop },
    rx: 140,
    ry: 142,
    neck: 392 + drop,
    shoulder: 448 + drop,
    waist: 668 + drop - tall,
    hip: 778 + drop - tall,
    knee: sit ? 900 : 948,
    foot: 1096,
    hipW: 62 * wide,
    shoulderW: 102 * (shape === "wide" ? 1.08 : 1),
    swing,
    sit,
    wave: pose === "wave",
    wink: false,
  };
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, width = 5) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function clothFill(ctx: CanvasRenderingContext2D, color: string, x0: number, y0: number, x1: number, y1: number) {
  const tone = ctx.createLinearGradient(x0, y0, x1, y1);
  tone.addColorStop(0, mix(color, 0.16));
  tone.addColorStop(0.42, color);
  tone.addColorStop(1, mix(color, -0.16));
  return tone;
}

function limb(ctx: CanvasRenderingContext2D, from: Point, to: Point, width: number, color: string) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const nx = Math.sin(angle);
  const ny = -Math.cos(angle);
  ctx.beginPath();
  ctx.moveTo(from.x + nx * width, from.y + ny * width);
  ctx.lineTo(to.x + nx * width * 0.78, to.y + ny * width * 0.78);
  ctx.quadraticCurveTo(to.x + nx * width * 0.2, to.y + ny * width * 0.2, to.x - nx * width * 0.78, to.y - ny * width * 0.78);
  ctx.lineTo(from.x - nx * width, from.y - ny * width);
  ctx.closePath();
  fillStroke(ctx, color, 4);
}

function drawHand(ctx: CanvasRenderingContext2D, at: Point, from: Point, skin: string) {
  const angle = Math.atan2(at.y - from.y, at.x - from.x);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.ellipse(14, 0, 18, 12, 0, 0, Math.PI * 2);
  fillStroke(ctx, skin, 3.5);
  ctx.beginPath();
  ctx.ellipse(4, -12, 7, 4.5, 0.5, 0, Math.PI * 2);
  fillStroke(ctx, skin, 3);
  ctx.restore();
}

/** Almond eye with a frosted lid. Sized under the head so it stays expressive, not a saucer. */
function eye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  skin: string,
  style: CharacterConfig["face"]["eyes"],
  shut: boolean,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const wide = style === "wide";
  const rx = style === "dot" ? 11 : wide ? 18 : 16;
  const ry = style === "sleepy" ? 5 : style === "dot" ? 8 : wide ? 9 : 8;
  glossyLid(ctx, rx, ry);
  if (shut) {
    ctx.strokeStyle = LASH;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-rx, 2);
    ctx.quadraticCurveTo(0, 8, rx + 2, 0);
    ctx.quadraticCurveTo(rx + 7, -5, rx + 9, -7);
    ctx.stroke();
    y2kLashes(ctx, rx, 8);
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(-rx, 0.4);
  ctx.quadraticCurveTo(-rx * 0.4, -ry, rx * 0.05, -ry * 0.55);
  ctx.quadraticCurveTo(rx * 0.72, -ry * 0.08, rx, -1);
  ctx.quadraticCurveTo(rx * 0.2, ry * 0.7, -rx * 0.2, ry * 0.4);
  ctx.quadraticCurveTo(-rx * 0.75, ry * 0.1, -rx, 0.4);
  ctx.closePath();
  ctx.fillStyle = "#fffaf8";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#3d282c";
  ctx.stroke();
  ctx.save();
  ctx.clip();
  const irisR = style === "dot" ? rx * 0.38 : ry * 0.55;
  const iris = ctx.createRadialGradient(-irisR * 0.3, -irisR * 0.35, 1, 0, 1, irisR);
  iris.addColorStop(0, "#f6d8ec");
  iris.addColorStop(0.35, "#9a648c");
  iris.addColorStop(0.78, "#5c3458");
  iris.addColorStop(1, "#3a2038");
  ctx.beginPath();
  ctx.arc(0.5, 1.2, irisR, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0.6, 1.6, style === "star" ? irisR * 0.34 : irisR * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1216";
  ctx.fill();
  if (style === "star") {
    ctx.fillStyle = "#f2c14e";
    ctx.beginPath();
    ctx.arc(0.4, 1.2, irisR * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(-rx * 0.22, -ry * 0.28, 0.4, -rx * 0.16, -ry * 0.18, rx * 0.28);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.5, "rgba(255,255,255,0.45)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(-rx * 0.16, -ry * 0.16, rx * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(rx * 0.16, ry * 0.22, 1.5, 0, Math.PI * 2);
  ctx.fill();
  if (style === "sleepy") {
    ctx.fillStyle = skin;
    ctx.fillRect(-rx - 4, -ry - 8, rx * 2 + 10, ry + 6);
  }
  ctx.restore();
  ctx.strokeStyle = LASH;
  ctx.lineWidth = 1.45;
  ctx.beginPath();
  ctx.moveTo(-rx + 1, 0);
  ctx.quadraticCurveTo(-rx * 0.1, -ry * 0.9, rx * 0.35, -ry * 0.4);
  ctx.quadraticCurveTo(rx * 0.8, -1.2, rx, -1);
  ctx.quadraticCurveTo(rx + 4, -4, rx + 6.5, -5.5);
  ctx.stroke();
  y2kLashes(ctx, rx, ry);
  ctx.restore();
}

/** A thin pearl sheen on the lid. It stays above the opening so the eye does not grow. */
function glossyLid(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  const frost = ctx.createLinearGradient(0, -ry - 7, 0, -ry * 0.2);
  frost.addColorStop(0, "rgba(255,255,255,0.05)");
  frost.addColorStop(0.5, "rgba(255, 232, 240, 0.82)");
  frost.addColorStop(1, "rgba(255, 186, 206, 0)");
  ctx.fillStyle = frost;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.72, -ry * 0.2);
  ctx.quadraticCurveTo(-rx * 0.05, -ry - 6, rx * 0.42, -ry - 4);
  ctx.quadraticCurveTo(rx * 0.85, -ry * 0.45, rx * 0.55, -ry * 0.15);
  ctx.quadraticCurveTo(rx * 0.05, -ry * 0.7, -rx * 0.72, -ry * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.ellipse(rx * 0.02, -ry - 1.2, rx * 0.28, 1.05, -0.16, 0, Math.PI * 2);
  ctx.fill();
}

function y2kLashes(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
  ctx.save();
  ctx.strokeStyle = LASH;
  ctx.lineCap = "round";
  const fans = [
    [-0.5, -0.65, -0.62, -1.35],
    [-0.05, -0.85, -0.02, -1.6],
    [0.38, -0.5, 0.52, -1.3],
    [0.72, -0.18, 0.95, -0.95],
  ] as const;
  ctx.lineWidth = 1.2;
  for (const [ax, ay, bx, by] of fans) {
    ctx.beginPath();
    ctx.moveTo(ax * rx, ay * ry);
    ctx.quadraticCurveTo(((ax + bx) / 2) * rx, ((ay + by) / 2) * ry - 1.5, bx * rx, by * ry);
    ctx.stroke();
  }
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
    const width = expression === "focused" ? 14 : 18;
    ctx.strokeStyle = LIP_DEEP;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - width, y + 1);
    ctx.quadraticCurveTo(x, y + 4, x + width, y + 1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.4, y);
    ctx.quadraticCurveTo(x - 2, y - 1, x + width * 0.15, y);
    ctx.stroke();
    return;
  }
  const half = grin ? 32 : 24;
  const lift = grin ? 8 : 5;
  const bow = 3.2;
  const lower = open ? 15 : grin ? 11 : 8;
  ctx.beginPath();
  ctx.moveTo(x - half, y - lift);
  ctx.quadraticCurveTo(x - half * 0.28, y - bow - 1, x, y - bow);
  ctx.quadraticCurveTo(x + half * 0.28, y - bow - 1, x + half, y - lift);
  ctx.quadraticCurveTo(x + half * 0.58, y + lower, x, y + lower + 3);
  ctx.quadraticCurveTo(x - half * 0.58, y + lower, x - half, y - lift);
  ctx.closePath();
  const gloss = ctx.createLinearGradient(x, y - bow - 4, x, y + lower + 4);
  gloss.addColorStop(0, LIP_LIGHT);
  gloss.addColorStop(0.45, LIP);
  gloss.addColorStop(1, LIP_DEEP);
  fillStroke(ctx, gloss, 2);
  ctx.beginPath();
  ctx.moveTo(x - half * 0.5, y - lift * 0.2);
  ctx.quadraticCurveTo(x, y + 1.5, x + half * 0.5, y - lift * 0.2);
  ctx.strokeStyle = ink(LIP_DEEP, 0.28);
  ctx.lineWidth = 1.15;
  ctx.stroke();
  if (open) {
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 6.5, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#b85a74";
    ctx.fill();
    ctx.fillStyle = "#fff7f5";
    ctx.beginPath();
    ctx.ellipse(x, y + 1.2, 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.ellipse(x - half * 0.02, y + lower * 0.28, half * 0.4, 2.6, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(x - half * 0.12, y - bow * 0.35, half * 0.22, 1.4, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

/** Round cheeks and a short soft chin, inside the hair's head box. */
function softHead(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.bezierCurveTo(cx + rx * 0.55, cy - ry, cx + rx * 0.96, cy - ry * 0.48, cx + rx * 1.02, cy + ry * 0.02);
  ctx.bezierCurveTo(cx + rx * 1.05, cy + ry * 0.5, cx + rx * 0.58, cy + ry * 0.98, cx, cy + ry * 0.96);
  ctx.bezierCurveTo(cx - rx * 0.58, cy + ry * 0.98, cx - rx * 1.05, cy + ry * 0.5, cx - rx * 1.02, cy + ry * 0.02);
  ctx.bezierCurveTo(cx - rx * 0.96, cy - ry * 0.48, cx - rx * 0.55, cy - ry, cx, cy - ry);
  ctx.closePath();
}

function warmBlush(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 26);
  glow.addColorStop(0, "rgba(236, 120, 98, 0.4)");
  glow.addColorStop(0.55, "rgba(242, 156, 116, 0.2)");
  glow.addColorStop(1, "rgba(242, 156, 116, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
}

function hairBack(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  const { cx, head, ry, waist, hip } = layout;
  const tone = clothFill(ctx, color, cx - 80, head.y - ry, cx + 40, hip);
  ctx.lineJoin = "round";
  if (item === "long" || item === "waves") {
    ctx.beginPath();
    ctx.moveTo(cx - 96, head.y - 10);
    ctx.bezierCurveTo(cx - 168, head.y + 80, cx - 150, waist, cx - 118, waist + 70);
    ctx.quadraticCurveTo(cx - 90, hip + 36, cx - 36, hip + 8);
    ctx.lineTo(cx + 36, hip + 8);
    ctx.quadraticCurveTo(cx + 110, hip + 20, cx + 142, waist + 30);
    ctx.bezierCurveTo(cx + 176, head.y + 40, cx + 120, head.y - 40, cx + 90, head.y - 16);
    ctx.quadraticCurveTo(cx + 10, head.y - ry - 36, cx - 96, head.y - 10);
    fillStroke(ctx, tone, 5);
    ctx.strokeStyle = ink("#ffffff", 0.28);
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(cx - 48, head.y - 50);
    ctx.quadraticCurveTo(cx - 78, head.y + 70, cx - 58, waist);
    ctx.stroke();
    return;
  }
  if (item === "bob" || item === "cap") {
    ctx.beginPath();
    ctx.ellipse(cx, head.y + 28, item === "cap" ? 132 : 146, item === "cap" ? 150 : 176, 0, 0, Math.PI * 2);
    fillStroke(ctx, tone, 5);
    return;
  }
  if (item === "bun") {
    ctx.beginPath();
    ctx.arc(cx + 8, head.y - ry + 6, 48, 0, Math.PI * 2);
    fillStroke(ctx, tone, 5);
    ctx.beginPath();
    ctx.ellipse(cx, head.y + 16, 128, 150, 0, 0, Math.PI * 2);
    fillStroke(ctx, tone, 5);
  }
}

function hairFront(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  const { cx, head, rx, ry } = layout;
  const tone = clothFill(ctx, color, cx - 40, head.y - ry, cx + 80, head.y);
  const fringe = head.y - 58;
  ctx.beginPath();
  ctx.moveTo(cx - rx + 14, fringe);
  ctx.quadraticCurveTo(cx - 78, head.y - ry - 6, cx - 10, head.y - ry + 4);
  ctx.quadraticCurveTo(cx + 48, head.y - ry - 24, cx + rx - 10, fringe - 6);
  ctx.quadraticCurveTo(cx + 70, fringe - 16, cx + 18, fringe + 4);
  ctx.quadraticCurveTo(cx - 24, fringe + 10, cx - 50, fringe);
  ctx.quadraticCurveTo(cx - rx + 4, fringe + 6, cx - rx + 14, fringe);
  fillStroke(ctx, tone, 4);
  ctx.strokeStyle = ink("#ffffff", 0.35);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx - 20, head.y - ry + 18);
  ctx.quadraticCurveTo(cx + 24, head.y - ry + 4, cx + 58, head.y - ry + 26);
  ctx.stroke();
  if (item === "spikes") {
    for (const [x, h] of [
      [-70, 36],
      [-28, 50],
      [18, 44],
      [64, 32],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + x - 16, head.y - ry + 18);
      ctx.quadraticCurveTo(cx + x, head.y - ry - h, cx + x + 16, head.y - ry + 14);
      ctx.closePath();
      fillStroke(ctx, color, 4);
    }
  }
}

type Arm = { shoulder: Point; elbow: Point; hand: Point };

function armPose(layout: Layout): { back: Arm; front: Arm } {
  const { cx, shoulder, waist, hip, shoulderW, hipW, swing, wave, sit, head } = layout;
  if (wave) {
    return {
      back: {
        shoulder: { x: cx + shoulderW - 12, y: shoulder + 16 },
        elbow: { x: cx + shoulderW + 18, y: waist },
        hand: { x: cx + shoulderW - 6, y: hip + 6 },
      },
      front: {
        shoulder: { x: cx - shoulderW + 14, y: shoulder + 4 },
        elbow: { x: cx - shoulderW - 48, y: shoulder - 28 },
        hand: { x: cx - 86, y: head.y + 8 },
      },
    };
  }
  if (sit) {
    return {
      back: {
        shoulder: { x: cx + shoulderW - 8, y: shoulder + 18 },
        elbow: { x: cx + 78, y: hip + 6 },
        hand: { x: cx + 20, y: hip + 24 },
      },
      front: {
        shoulder: { x: cx - shoulderW + 12, y: shoulder + 16 },
        elbow: { x: cx - shoulderW - 34, y: waist + 8 },
        hand: { x: cx - 18, y: hip + 18 },
      },
    };
  }
  if (Math.abs(swing) > 0.15) {
    return {
      back: {
        shoulder: { x: cx + shoulderW - 8, y: shoulder + 18 },
        elbow: { x: cx + shoulderW + 8 - swing * 16, y: waist + swing * 12 },
        hand: { x: cx + shoulderW - 10 - swing * 22, y: hip + swing * 34 },
      },
      front: {
        shoulder: { x: cx - shoulderW + 8, y: shoulder + 18 },
        elbow: { x: cx - shoulderW - 6 + swing * 14, y: waist - swing * 10 },
        hand: { x: cx - shoulderW + 12 + swing * 18, y: hip - swing * 32 },
      },
    };
  }
  return {
    back: {
      shoulder: { x: cx + shoulderW - 8, y: shoulder + 22 },
      elbow: { x: cx + shoulderW + 26, y: waist + 18 },
      hand: { x: cx + shoulderW - 4, y: hip + 28 },
    },
    front: {
      shoulder: { x: cx - shoulderW + 18, y: shoulder + 16 },
      elbow: { x: cx - shoulderW - 50, y: (shoulder + waist) / 2 + 6 },
      hand: { x: cx - hipW + 4, y: hip - 4 },
    },
  };
}

function drawArm(ctx: CanvasRenderingContext2D, arm: Arm, cloth: string, skin: string, sleeve: "long" | "short" | "none") {
  limb(ctx, arm.shoulder, arm.elbow, 18, sleeve === "none" ? skin : cloth);
  limb(ctx, arm.elbow, arm.hand, 14, sleeve === "long" ? cloth : skin);
  drawHand(ctx, arm.hand, arm.elbow, skin);
}

function pantsPath(ctx: CanvasRenderingContext2D, layout: Layout, hem: number) {
  const { cx, hip, knee, hipW, swing } = layout;
  const spread = swing * 30;
  const left = -spread;
  const right = spread;
  ctx.beginPath();
  ctx.moveTo(cx - hipW, hip - 6);
  ctx.quadraticCurveTo(cx - hipW - 4 + left * 0.15, knee, cx - 36 + left, hem);
  ctx.lineTo(cx - 4 + left, hem);
  ctx.quadraticCurveTo(cx - 14 + left * 0.25, knee + 8, cx - 8, hip + 30);
  ctx.quadraticCurveTo(cx, hip + 48, cx + 8, hip + 30);
  ctx.quadraticCurveTo(cx + 16 + right * 0.25, knee + 8, cx + 6 + right, hem);
  ctx.lineTo(cx + 38 + right, hem);
  ctx.quadraticCurveTo(cx + hipW + 6 + right * 0.15, knee, cx + hipW, hip - 6);
  ctx.quadraticCurveTo(cx, hip - 30, cx - hipW, hip - 6);
}

function legSkin(ctx: CanvasRenderingContext2D, layout: Layout, fromY: number, skin: string) {
  const { cx, foot, swing } = layout;
  const spread = swing * 30;
  limb(ctx, { x: cx - 20 - spread, y: fromY }, { x: cx - 16 - spread, y: foot - 18 }, 15, skin);
  limb(ctx, { x: cx + 22 + spread, y: fromY }, { x: cx + 18 + spread, y: foot - 18 }, 15, skin);
}

function bottoms(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string, skin: string) {
  const cloth = item === "none" ? "#2c3038" : color;
  const tone = clothFill(ctx, cloth, layout.cx - 40, layout.hip, layout.cx + 70, layout.foot);
  if (layout.sit) {
    limb(ctx, { x: layout.cx - 12, y: layout.hip }, { x: layout.cx - 92, y: layout.hip + 46 }, 24, cloth);
    limb(ctx, { x: layout.cx - 92, y: layout.hip + 46 }, { x: layout.cx - 74, y: layout.foot - 16 }, 18, cloth);
    limb(ctx, { x: layout.cx + 12, y: layout.hip }, { x: layout.cx + 102, y: layout.hip + 34 }, 24, cloth);
    limb(ctx, { x: layout.cx + 102, y: layout.hip + 34 }, { x: layout.cx + 82, y: layout.foot - 20 }, 18, cloth);
    return;
  }
  if (item === "skirt") {
    const hem = layout.knee + 8;
    ctx.beginPath();
    ctx.moveTo(layout.cx - layout.hipW - 4, layout.hip - 12);
    ctx.quadraticCurveTo(layout.cx - layout.hipW - 28, hem - 30, layout.cx - 58, hem);
    ctx.lineTo(layout.cx + 58, hem);
    ctx.quadraticCurveTo(layout.cx + layout.hipW + 28, hem - 30, layout.cx + layout.hipW + 4, layout.hip - 12);
    ctx.quadraticCurveTo(layout.cx, layout.hip - 28, layout.cx - layout.hipW - 4, layout.hip - 12);
    fillStroke(ctx, tone, 5);
    legSkin(ctx, layout, hem - 6, skin);
    return;
  }
  if (item === "shorts") {
    const hem = layout.knee - 48;
    pantsPath(ctx, layout, hem);
    fillStroke(ctx, tone, 5);
    legSkin(ctx, layout, hem, skin);
    return;
  }
  pantsPath(ctx, layout, layout.foot - 30);
  fillStroke(ctx, tone, 5);
}

function footPoints(layout: Layout): Point[] {
  if (layout.sit) {
    return [
      { x: layout.cx - 74, y: layout.foot - 6 },
      { x: layout.cx + 82, y: layout.foot - 10 },
    ];
  }
  const spread = layout.swing * 30;
  const liftL = Math.max(0, -layout.swing) * 26;
  const liftR = Math.max(0, layout.swing) * 26;
  return [
    { x: layout.cx - 20 - spread, y: layout.foot - 6 - liftL },
    { x: layout.cx + 22 + spread, y: layout.foot - 6 - liftR },
  ];
}

function shoes(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  const cloth = item === "none" ? "#f7f1e4" : color;
  for (const foot of footPoints(layout)) {
    const toe = item === "heels" ? 46 : 36;
    ctx.beginPath();
    ctx.moveTo(foot.x - 20, foot.y - 10);
    ctx.quadraticCurveTo(foot.x - 4, foot.y - 20, foot.x + 16, foot.y - 16);
    ctx.quadraticCurveTo(foot.x + toe, foot.y - 12, foot.x + toe - 2, foot.y - 4);
    ctx.quadraticCurveTo(foot.x + 18, foot.y + 8, foot.x - 16, foot.y + 4);
    ctx.closePath();
    fillStroke(ctx, clothFill(ctx, cloth, foot.x - 10, foot.y - 18, foot.x + 20, foot.y + 8), 3.5);
    if (item === "heels") {
      ctx.beginPath();
      ctx.moveTo(foot.x - 14, foot.y + 2);
      ctx.lineTo(foot.x - 18, foot.y + 18);
      ctx.lineTo(foot.x - 8, foot.y + 18);
      ctx.lineTo(foot.x - 2, foot.y + 2);
      ctx.closePath();
      fillStroke(ctx, mix(cloth, -0.18), 2.5);
    }
    if (item === "boots") {
      ctx.beginPath();
      ctx.roundRect(foot.x - 18, foot.y - 58, 34, 52, 8);
      fillStroke(ctx, cloth, 3.5);
    }
    if (item === "sandals") {
      ctx.strokeStyle = mix(cloth, -0.25);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(foot.x - 8, foot.y - 14);
      ctx.lineTo(foot.x + 10, foot.y - 2);
      ctx.moveTo(foot.x + 14, foot.y - 14);
      ctx.lineTo(foot.x + 6, foot.y + 2);
      ctx.stroke();
    }
  }
}

function top(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  const cloth = item === "none" ? CAMI : color;
  const { cx, shoulder, waist, hip, shoulderW } = layout;
  const hem = hip - 8;
  const tone = clothFill(ctx, cloth, cx - shoulderW, shoulder, cx + 30, hem);
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulder + 6);
  ctx.quadraticCurveTo(cx - shoulderW - 10, shoulder + 90, cx - 58, waist);
  ctx.quadraticCurveTo(cx - 66, hem - 16, cx - 74, hem);
  ctx.lineTo(cx + 74, hem);
  ctx.quadraticCurveTo(cx + 66, hem - 16, cx + 58, waist);
  ctx.quadraticCurveTo(cx + shoulderW + 10, shoulder + 90, cx + shoulderW, shoulder + 6);
  ctx.quadraticCurveTo(cx + 20, shoulder - 34, cx, shoulder - 18);
  ctx.quadraticCurveTo(cx - 20, shoulder - 34, cx - shoulderW, shoulder + 6);
  fillStroke(ctx, tone, 5);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW, shoulder + 6);
  ctx.quadraticCurveTo(cx - shoulderW - 10, shoulder + 90, cx - 58, waist);
  ctx.lineTo(cx - 10, waist);
  ctx.lineTo(cx - 24, shoulder + 10);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = ink("#ffffff", 0.16);
  ctx.fillRect(cx - shoulderW - 20, shoulder, 80, hem - shoulder);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - 34, shoulder - 2);
  ctx.quadraticCurveTo(cx, shoulder + 28, cx + 34, shoulder - 2);
  ctx.quadraticCurveTo(cx, shoulder + 10, cx - 34, shoulder - 2);
  fillStroke(ctx, item === "none" ? CAMI : mix(cloth, 0.14), 3);
  if (item === "jacket") {
    ctx.beginPath();
    ctx.moveTo(cx - 30, shoulder + 2);
    ctx.lineTo(cx - 8, shoulder + 46);
    ctx.lineTo(cx - 2, shoulder + 16);
    ctx.closePath();
    fillStroke(ctx, mix(cloth, -0.08), 3);
    ctx.beginPath();
    ctx.moveTo(cx + 30, shoulder + 2);
    ctx.lineTo(cx + 8, shoulder + 46);
    ctx.lineTo(cx + 2, shoulder + 16);
    ctx.closePath();
    fillStroke(ctx, mix(cloth, 0.08), 3);
    ctx.fillStyle = "#f2c14e";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const y of [shoulder + 62, shoulder + 98]) {
      ctx.beginPath();
      ctx.arc(cx, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (item === "hoodie") {
    ctx.beginPath();
    ctx.roundRect(cx - 28, waist - 10, 56, 40, 10);
    fillStroke(ctx, mix(cloth, -0.06), 3);
  }
  if (item === "vest") {
    ctx.beginPath();
    ctx.moveTo(cx, shoulder + 18);
    ctx.lineTo(cx - 10, hem - 8);
    ctx.lineTo(cx + 10, hem - 8);
    ctx.closePath();
    ctx.fillStyle = mix(cloth, -0.1);
    ctx.fill();
  }
}

function hood(ctx: CanvasRenderingContext2D, layout: Layout, color: string) {
  const { cx, head, rx, ry } = layout;
  ctx.beginPath();
  ctx.ellipse(cx, head.y + 16, rx + 34, ry + 28, 0, Math.PI * 0.95, Math.PI * 2.05);
  ctx.quadraticCurveTo(cx + rx + 10, head.y + 20, cx + rx - 8, head.y + 8);
  ctx.ellipse(cx, head.y + 18, rx - 6, ry - 8, 0, Math.PI * 1.9, Math.PI * 1.1, true);
  ctx.closePath();
  fillStroke(ctx, color, 4);
}

function overallsBib(ctx: CanvasRenderingContext2D, layout: Layout, color: string) {
  const { cx, shoulder, waist } = layout;
  ctx.beginPath();
  ctx.moveTo(cx - 36, waist);
  ctx.lineTo(cx - 28, shoulder + 24);
  ctx.lineTo(cx + 28, shoulder + 24);
  ctx.lineTo(cx + 36, waist);
  ctx.closePath();
  fillStroke(ctx, color, 4);
  ctx.strokeStyle = mix(color, 0.2);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 24, shoulder + 28);
  ctx.lineTo(cx - 40, shoulder + 4);
  ctx.moveTo(cx + 24, shoulder + 28);
  ctx.lineTo(cx + 40, shoulder + 4);
  ctx.stroke();
}

function headwear(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string) {
  if (item === "none") return;
  const { cx, head, rx, ry } = layout;
  if (item === "cap") {
    ctx.beginPath();
    ctx.ellipse(cx, head.y - 40, rx - 6, 58, 0, Math.PI, 0);
    fillStroke(ctx, color, 4);
    ctx.beginPath();
    ctx.ellipse(cx + 78, head.y - 18, 52, 14, 0.15, 0, Math.PI * 2);
    fillStroke(ctx, color, 4);
    return;
  }
  if (item === "beanie") {
    ctx.beginPath();
    ctx.ellipse(cx, head.y - 54, rx - 2, 74, 0, Math.PI, 0);
    fillStroke(ctx, color, 4);
    ctx.beginPath();
    ctx.arc(cx + 10, head.y - ry - 6, 16, 0, Math.PI * 2);
    fillStroke(ctx, color, 4);
    return;
  }
  if (item === "bow") {
    const bx = cx + 96;
    const by = head.y - 86;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - 46, by - 26, bx - 34, by + 6);
    ctx.quadraticCurveTo(bx - 50, by + 28, bx, by + 8);
    ctx.quadraticCurveTo(bx + 48, by + 26, bx + 36, by + 4);
    ctx.quadraticCurveTo(bx + 52, by - 24, bx, by);
    fillStroke(ctx, clothFill(ctx, color, bx - 40, by - 20, bx + 40, by + 16), 3.5);
    ctx.beginPath();
    ctx.arc(bx, by + 4, 7, 0, Math.PI * 2);
    fillStroke(ctx, mix(color, -0.12), 3);
    ctx.beginPath();
    ctx.moveTo(bx - 8, by + 10);
    ctx.quadraticCurveTo(bx - 16, by + 28, bx - 4, by + 36);
    ctx.moveTo(bx + 8, by + 10);
    ctx.quadraticCurveTo(bx + 18, by + 26, bx + 8, by + 38);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }
  if (item === "headphones") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - rx - 26, head.y - 4);
    ctx.quadraticCurveTo(cx, head.y - ry - 8, cx + rx + 26, head.y - 4);
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 3;
    ctx.fillStyle = color;
    const cupY = head.y + 6;
    ctx.beginPath();
    ctx.roundRect(cx - rx - 40, cupY - 18, 28, 42, 12);
    ctx.roundRect(cx + rx + 12, cupY - 18, 28, 42, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = mix(color, 0.28);
    ctx.beginPath();
    ctx.roundRect(cx - rx - 33, cupY - 8, 14, 22, 7);
    ctx.roundRect(cx + rx + 19, cupY - 8, 14, 22, 7);
    ctx.fill();
    return;
  }
  if (item === "crown") {
    ctx.beginPath();
    ctx.moveTo(cx - 74, head.y - ry + 28);
    ctx.lineTo(cx - 52, head.y - ry - 18);
    ctx.lineTo(cx - 22, head.y - ry + 10);
    ctx.lineTo(cx, head.y - ry - 32);
    ctx.lineTo(cx + 22, head.y - ry + 10);
    ctx.lineTo(cx + 52, head.y - ry - 18);
    ctx.lineTo(cx + 74, head.y - ry + 28);
    ctx.closePath();
    fillStroke(ctx, color, 4);
  }
}

function accessory(ctx: CanvasRenderingContext2D, layout: Layout, item: string, color: string, eyeY: number) {
  if (item === "none") return;
  const { cx, shoulder, waist, hip, shoulderW } = layout;
  if (item === "glasses") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.ellipse(cx - 40, eyeY, 24, 13, -0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 42, eyeY, 24, 13, 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, eyeY - 1);
    ctx.quadraticCurveTo(cx + 1, eyeY + 2, cx + 12, eyeY - 1);
    ctx.stroke();
    return;
  }
  if (item === "scarf") {
    ctx.beginPath();
    ctx.moveTo(cx - 46, layout.neck + 6);
    ctx.quadraticCurveTo(cx, layout.neck + 36, cx + 50, layout.neck + 8);
    ctx.lineTo(cx + 38, layout.neck + 78);
    ctx.lineTo(cx + 16, layout.neck + 70);
    ctx.lineTo(cx + 22, layout.neck + 22);
    ctx.quadraticCurveTo(cx, layout.neck + 14, cx - 46, layout.neck + 6);
    fillStroke(ctx, color, 4);
    return;
  }
  if (item === "bag") {
    ctx.beginPath();
    ctx.roundRect(cx + 78, waist - 10, 58, 70, 12);
    fillStroke(ctx, color, 4);
    ctx.beginPath();
    ctx.moveTo(cx + 88, waist - 6);
    ctx.quadraticCurveTo(cx + 46, shoulder + 10, cx + 24, shoulder - 8);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 4;
    ctx.stroke();
    return;
  }
  if (item === "badge") {
    ctx.beginPath();
    ctx.arc(cx + 30, shoulder + 52, 13, 0, Math.PI * 2);
    fillStroke(ctx, color, 3);
    return;
  }
  if (item === "watch") {
    ctx.beginPath();
    ctx.roundRect(cx - shoulderW + 6, hip - 8, 26, 16, 4);
    fillStroke(ctx, color, 2.5);
  }
}

/** Paint one fashion-game frame. The background stays clear so the plane can billboard. */
export function paintFashionAvatar(
  ctx: CanvasRenderingContext2D,
  config: CharacterConfig,
  pose: FashionPose,
  step = 0,
) {
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
  const cloth = topItem === "none" ? CAMI : config.slots.top.color;
  drawArm(ctx, arms.back, cloth, skin, sleeve);
  bottoms(ctx, layout, config.slots.bottom.item, config.slots.bottom.color, skin);
  shoes(ctx, layout, config.slots.shoes.item, config.slots.shoes.color);
  if (topItem === "hoodie") hood(ctx, layout, config.slots.top.color);
  top(ctx, layout, topItem, config.slots.top.color);
  if (config.slots.bottom.item === "overalls") overallsBib(ctx, layout, config.slots.bottom.color);
  drawArm(ctx, arms.front, cloth, skin, sleeve);
  ctx.beginPath();
  ctx.moveTo(layout.cx - 20, layout.neck + 4);
  ctx.quadraticCurveTo(layout.cx, layout.shoulder + 6, layout.cx + 20, layout.neck + 4);
  ctx.lineTo(layout.cx + 16, layout.head.y + layout.ry - 28);
  ctx.quadraticCurveTo(layout.cx, layout.head.y + layout.ry - 8, layout.cx - 16, layout.head.y + layout.ry - 28);
  ctx.closePath();
  fillStroke(ctx, skin, 4);
  const cheek = ctx.createRadialGradient(layout.head.x - 16, layout.head.y - 30, 28, layout.head.x, layout.head.y + 12, layout.ry);
  cheek.addColorStop(0, mix(skin, 0.18));
  cheek.addColorStop(0.58, skin);
  cheek.addColorStop(1, mix(skin, -0.03));
  softHead(ctx, layout.head.x, layout.head.y, layout.rx, layout.ry);
  fillStroke(ctx, cheek, 5);
  ctx.save();
  softHead(ctx, layout.head.x, layout.head.y, layout.rx * 0.92, layout.ry * 0.92);
  ctx.clip();
  warmBlush(ctx, layout.cx - 72, layout.head.y + 32);
  warmBlush(ctx, layout.cx + 74, layout.head.y + 32);
  ctx.restore();
  hairFront(ctx, layout, hairItem, hair);
  headwear(ctx, layout, config.slots.headwear.item, config.slots.headwear.color);
  const eyeY = layout.head.y - 10;
  eye(ctx, layout.cx - 40, eyeY, skin, config.face.eyes, layout.wink);
  eye(ctx, layout.cx + 42, eyeY, skin, config.face.eyes, false);
  ctx.strokeStyle = "#6a4036";
  ctx.lineWidth = 1.65;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(layout.cx - 56, eyeY - 14);
  ctx.quadraticCurveTo(layout.cx - 40, eyeY - 26, layout.cx - 22, eyeY - 13);
  ctx.moveTo(layout.cx + 24, eyeY - 13);
  ctx.quadraticCurveTo(layout.cx + 42, eyeY - 26, layout.cx + 58, eyeY - 14);
  ctx.stroke();
  ctx.strokeStyle = ink(mix(skin, -0.28), 0.55);
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(layout.cx + 1, layout.head.y + 28);
  ctx.quadraticCurveTo(layout.cx + 6, layout.head.y + 36, layout.cx + 1, layout.head.y + 42);
  ctx.stroke();
  lips(ctx, layout.cx, layout.head.y + 68, config.face.expression, config.face.mouth);
  accessory(ctx, layout, config.slots.accessory.item, config.slots.accessory.color, eyeY);
}
