"use client";

import { useEffect, useRef, useState } from "react";
import type { CharacterConfig } from "@/lib/worlds/character";
import { starterFashionLook } from "@/lib/worlds/character";
import { withBasePath } from "@/lib/format";
import type { FashionEmote, FashionView } from "./fashion-doll";

/**
 * Locked glam silhouette: the illustrated portrait (long hair, fitted blouse,
 * pencil skirt, heeled boots, nothing on the head or in the hands).
 * Other items stay on the simpler doll so a picked piece still changes the picture.
 */
export function isGlamSilhouette(config: CharacterConfig) {
  const slots = config.slots;
  const hair = slots.hair.item === "long" || slots.hair.item === "waves";
  const shoes = slots.shoes.item === "boots" || slots.shoes.item === "heels";
  return hair && slots.headwear.item === "none" && slots.top.item === "collar" && slots.bottom.item === "skirt" && shoes && slots.accessory.item === "none";
}

function sameColor(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** True when slot colors are the baked portrait, so the PNG is drawn untouched. */
export function glamColorsMatch(config: CharacterConfig) {
  const baked = starterFashionLook();
  return (
    sameColor(config.body.color, baked.body.color) &&
    sameColor(config.slots.hair.color, baked.slots.hair.color) &&
    sameColor(config.slots.top.color, baked.slots.top.color) &&
    sameColor(config.slots.bottom.color, baked.slots.bottom.color) &&
    sameColor(config.slots.shoes.color, baked.slots.shoes.color)
  );
}

const FACE: Record<FashionView, { x0: number; y0: number; x1: number; y1: number } | null> = {
  front: { x0: 0.34, y0: 0.05, x1: 0.68, y1: 0.24 },
  side: { x0: 0.4, y0: 0.04, x1: 0.74, y1: 0.22 },
  back: null,
  profile: { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.72 },
};

function hexChannels(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) || 0);
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [r, g, b].map((channel) => Math.round(Math.max(0, Math.min(1, channel + m)) * 255));
}

type Region = "hair" | "top" | "bottom" | "shoes" | "skin";

function regionOf(h: number, s: number, l: number, x: number, y: number, view: FashionView): Region | null {
  if (s < 0.18 || l < 0.12 || l > 0.92) return null;
  const face = FACE[view];
  const inFace = Boolean(face && x >= face.x0 && x <= face.x1 && y >= face.y0 && y <= face.y1);
  if (h >= 165 && h <= 230) return "bottom";
  if (h >= 8 && h <= 46) return "skin";
  if (h >= 248 && h <= 320) return inFace ? null : "hair";
  if (h >= 320 || h <= 14) {
    if (inFace || view === "profile") return inFace ? null : "top";
    if (y > 0.78) return "shoes";
    if (y < 0.64) return "top";
  }
  return null;
}

const PORTRAIT: Record<FashionView, string> = {
  front: "/worlds/fashion/glam-front.png",
  side: "/worlds/fashion/glam-side.png",
  back: "/worlds/fashion/glam-back.png",
  profile: "/worlds/fashion/glam-head.png",
};

function portraitSrc(view: FashionView) {
  return withBasePath(PORTRAIT[view]);
}

/**
 * Painted fashion portrait. The default colors draw the locked PNG with no
 * pixel processing. A changed hair, blouse, skirt, boot, or skin color
 * retints that region and leaves eyes, lips, and jewelry alone.
 */
export function GlamPortrait({
  config,
  view,
  emote = "idle",
}: {
  config: CharacterConfig;
  view: FashionView;
  emote?: FashionEmote;
}) {
  const matched = glamColorsMatch(config);
  const src = portraitSrc(view);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [missing, setMissing] = useState(false);
  const tall = config.body.shape === "compact" ? 0.94 : config.body.shape === "round" ? 0.97 : 1;
  const wide = config.body.shape === "wide" ? 1.06 : config.body.shape === "round" ? 1.04 : config.body.shape === "compact" ? 0.96 : 1;
  const size = config.body.size === "large" ? 1.05 : config.body.size === "small" ? 0.93 : 1;
  const scaleX = wide * size;
  const scaleY = tall * size;
  const label = view === "profile" ? "profile headshot" : `${view} view`;

  useEffect(() => {
    if (matched) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancel = false;
    const image = new Image();
    image.onload = () => {
      if (cancel) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = frame.data;
      const baked = starterFashionLook();
      const targets: Record<Region, number[]> = {
        hair: hexChannels(config.slots.hair.color),
        top: hexChannels(config.slots.top.color),
        bottom: hexChannels(config.slots.bottom.color),
        shoes: hexChannels(config.slots.shoes.color),
        skin: hexChannels(config.body.color),
      };
      const bakedTargets: Record<Region, number[]> = {
        hair: hexChannels(baked.slots.hair.color),
        top: hexChannels(baked.slots.top.color),
        bottom: hexChannels(baked.slots.bottom.color),
        shoes: hexChannels(baked.slots.shoes.color),
        skin: hexChannels(baked.body.color),
      };
      const hueOf = (channels: number[]) => rgbToHsl(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0);
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] ?? 0;
        if (alpha < 8) continue;
        const pixel = i / 4;
        const x = (pixel % canvas.width) / canvas.width;
        const y = Math.floor(pixel / canvas.width) / canvas.height;
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        const hsl = rgbToHsl(r, g, b);
        const region = regionOf(hsl.h, hsl.s, hsl.l, x, y, view);
        if (!region) continue;
        const next = targets[region];
        const previous = bakedTargets[region];
        if (sameColor(`#${next.map((c) => c.toString(16).padStart(2, "0")).join("")}`, `#${previous.map((c) => c.toString(16).padStart(2, "0")).join("")}`)) continue;
        const dst = hueOf(next);
        const tinted = hslToRgb(dst.h, dst.s, hsl.l);
        data[i] = tinted[0] ?? r;
        data[i + 1] = tinted[1] ?? g;
        data[i + 2] = tinted[2] ?? b;
      }
      ctx.putImageData(frame, 0, 0);
      setMissing(false);
    };
    image.onerror = () => {
      if (!cancel) setMissing(true);
    };
    image.src = src;
    return () => {
      cancel = true;
    };
  }, [matched, src, view, config.body.color, config.slots.hair.color, config.slots.top.color, config.slots.bottom.color, config.slots.shoes.color]);

  return (
    <div
      className={`fashion-doll fashion-glam-frame fashion-glam-${view} fashion-glam-${emote}`}
      data-glam="1"
      style={scaleX === 1 && scaleY === 1 ? undefined : { transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: "center bottom" }}
      role="img"
      aria-label={`Content creator fashion avatar, ${label}`}
    >
      {missing ? (
        <p className="fashion-glam-missing">Portrait missing</p>
      ) : matched ? (
        <img className="fashion-glam-media" src={src} alt="" draggable={false} onError={() => setMissing(true)} />
      ) : (
        <canvas ref={canvasRef} className="fashion-glam-media" />
      )}
    </div>
  );
}
