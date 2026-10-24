"use client";

import { useId, type ReactNode } from "react";
import type { CharacterConfig } from "@/lib/worlds/character";
import { GlamPortrait, isGlamSilhouette } from "./glam-portrait";

export type FashionView = "front" | "side" | "back" | "profile";
export type FashionEmote = "idle" | "walk" | "wave" | "sit";

const INK = "#2a2230";

function channels(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) || 0);
}

function mix(hex: string, toward: string, amount: number) {
  const from = channels(hex);
  const to = channels(toward);
  const mixed = from.map((channel, index) => Math.round(channel + ((to[index] ?? channel) - channel) * amount));
  return `#${mixed.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0")).join("")}`;
}

function shade(hex: string) {
  return mix(hex, "#241820", 0.32);
}

function lift(hex: string) {
  return mix(hex, "#fff7f2", 0.55);
}

type Paint = {
  skin: string;
  skinDeep: string;
  skinLite: string;
  hair: string;
  hairDeep: string;
  hairLite: string;
  top: string;
  topDeep: string;
  topLite: string;
  bottom: string;
  bottomDeep: string;
  bottomLite: string;
  shoes: string;
  shoesDeep: string;
  shoesLite: string;
  extra: string;
  hat: string;
};

function paints(config: CharacterConfig): Paint {
  const skin = config.body.color;
  const hair = config.slots.hair.color;
  const top = config.slots.top.item === "none" ? "#f7f1e4" : config.slots.top.color;
  const bottom = config.slots.bottom.item === "none" ? "#3a3344" : config.slots.bottom.color;
  const shoes = config.slots.shoes.item === "none" ? "#1c211e" : config.slots.shoes.color;
  return {
    skin,
    skinDeep: shade(skin),
    skinLite: lift(skin),
    hair,
    hairDeep: shade(hair),
    hairLite: lift(hair),
    top,
    topDeep: shade(top),
    topLite: lift(top),
    bottom,
    bottomDeep: shade(bottom),
    bottomLite: lift(bottom),
    shoes,
    shoesDeep: shade(shoes),
    shoesLite: lift(shoes),
    extra: config.slots.accessory.color,
    hat: config.slots.headwear.color,
  };
}

function stroke(color: string, width: number) {
  return { fill: "none" as const, stroke: color, strokeWidth: width, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
}

function Limb({ d, color, width = 16 }: { d: string; color: string; width?: number }) {
  return (
    <g>
      <path d={d} {...stroke(INK, width + 4.5)} />
      <path d={d} {...stroke(color, width)} />
    </g>
  );
}

function Eye({
  cx,
  cy,
  wink,
  wide,
  sleepy,
  star,
  scale = 1,
}: {
  cx: number;
  cy: number;
  wink: boolean;
  wide: boolean;
  sleepy: boolean;
  star: boolean;
  scale?: number;
}) {
  const rx = (wide ? 10.2 : 9) * scale;
  const ry = (sleepy ? 6.2 : wide ? 11.2 : 10) * scale;
  if (wink) return <path d={`M${cx - rx} ${cy + 1} Q${cx} ${cy - ry * 0.28} ${cx + rx} ${cy + 1}`} {...stroke(INK, 2.2)} />;
  return (
    <g>
      <path d={`M${cx - rx * 0.2} ${cy - ry * 0.2} Q${cx + rx * 0.15} ${cy - ry - ry * 0.42} ${cx + rx * 0.85} ${cy - ry * 0.05}`} {...stroke(INK, 2.15)} />
      <path d={`M${cx + rx * 0.45} ${cy - ry * 0.45} Q${cx + rx + 3.5} ${cy - ry * 0.05} ${cx + rx * 0.9} ${cy + ry * 0.28}`} {...stroke(INK, 1.7)} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fffaf6" stroke={INK} strokeWidth="1.6" />
      <path d={`M${cx - rx * 0.72} ${cy - ry * 0.08} Q${cx} ${cy - ry * 0.78} ${cx + rx * 0.72} ${cy - ry * 0.08}`} {...stroke("#fff6fb", Math.max(1.7, ry * 0.2))} opacity="0.95" />
      <ellipse cx={cx + rx * 0.02} cy={cy + ry * 0.1} rx={rx * 0.5} ry={ry * 0.54} fill="#7a4570" />
      <ellipse cx={cx + rx * 0.02} cy={cy + ry * 0.14} rx={rx * 0.24} ry={ry * 0.28} fill="#2a1a28" />
      <ellipse cx={cx - rx * 0.26} cy={cy - ry * 0.28} rx={rx * 0.28} ry={ry * 0.24} fill="#fff" opacity="0.95" />
      {star ? <circle cx={cx} cy={cy} r={2.6 * scale} fill="#f2c14e" /> : null}
    </g>
  );
}

function Sparkle({ x, y, size = 4.2 }: { x: number; y: number; size?: number }) {
  const s = size;
  return (
    <path
      d={`M${x} ${y - s} L${x + s * 0.22} ${y - s * 0.22} L${x + s} ${y} L${x + s * 0.22} ${y + s * 0.22} L${x} ${y + s} L${x - s * 0.22} ${y + s * 0.22} L${x - s} ${y} L${x - s * 0.22} ${y - s * 0.22} Z`}
      fill="#fff"
      stroke="#f2c14e"
      strokeWidth="0.6"
    />
  );
}

function Face({ config, paint, side }: { config: CharacterConfig; paint: Paint; side: boolean }) {
  const wink = config.face.expression === "wink";
  const sleepy = config.face.eyes === "sleepy" || config.face.expression === "calm";
  const wide = config.face.eyes === "wide" || config.face.expression === "surprised";
  const star = config.face.eyes === "star";
  const grin = config.face.mouth === "grin" || config.face.expression === "smile";
  const open = config.face.mouth === "open" || config.face.expression === "surprised";
  const flat = config.face.mouth === "flat" && config.face.expression !== "smile";
  const blush = mix(paint.skin, "#ffb09a", 0.48);
  const lip = flat ? "none" : "#e56d96";
  if (side) {
    return (
      <g>
        <ellipse cx="118" cy="94" rx="11" ry="5.5" fill={blush} opacity="0.42" />
        <path d="M108 58 Q120 48 132 62" {...stroke(INK, 1.15)} />
        <Eye cx={122} cy={76} wink={wink} wide={wide} sleepy={sleepy} star={star} scale={0.92} />
        <path d="M136 86 Q141 88 138 93" {...stroke(INK, 1.35)} />
        <path
          d={flat ? "M132 104 H146" : open ? "M132 102 C138 98 146 100 148 105 C144 110 136 110 132 105 Z" : "M130 103 C138 98 146 100 148 106 C144 112 134 111 130 105 Z"}
          fill={lip}
          stroke={INK}
          strokeWidth="1.45"
          strokeLinejoin="round"
        />
        {flat ? null : <path d="M134 105 Q140 107 145 104" {...stroke("#fff", 1.5)} opacity="0.9" />}
        <Sparkle x={136} y={58} size={3.4} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="70" cy="98" rx="14" ry="6.5" fill={blush} opacity="0.4" />
      <ellipse cx="130" cy="98" rx="14" ry="6.5" fill={blush} opacity="0.4" />
      <path d="M66 70 Q78 58 92 68" {...stroke(INK, 1.15)} />
      <path d="M108 68 Q122 56 134 68" {...stroke(INK, 1.15)} />
      <Eye cx={84} cy={82} wink={false} wide={wide} sleepy={sleepy} star={star} />
      <Eye cx={116} cy={82} wink={wink} wide={wide} sleepy={sleepy} star={star} />
      <path d="M99 96 Q101 99 99 101" {...stroke(INK, 1.3)} />
      <path
        d={flat ? "M88 108 H112" : open ? "M90 106 C96 101 104 101 110 106 C108 114 92 114 90 106 Z" : grin ? "M84 107 C92 100 108 100 116 107 C114 115 86 115 84 107 Z" : "M88 107 C94 102 106 102 112 107 C110 114 90 114 88 107 Z"}
        fill={lip}
        stroke={INK}
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      {flat ? null : <path d="M90 109 Q100 112 110 109" {...stroke("#fff", 1.6)} opacity="0.92" />}
      <Sparkle x={134} y={66} size={4} />
      <Sparkle x={64} y={74} size={2.6} />
    </g>
  );
}

function HairLocks({ item, paint, gid, back }: { item: string; paint: Paint; gid: string; back?: boolean }) {
  if (item === "none" || item === "cap" || item === "spikes") return null;
  const color = `url(#${gid}-hair)`;
  if (item === "bun") {
    return <ellipse cx="100" cy="28" rx="14" ry="12" fill={paint.hair} stroke={INK} strokeWidth="2" />;
  }
  if (item === "bob") {
    return (
      <g>
        <Limb d="M78 78 C62 120 64 150 76 168" color={color} width={back ? 20 : 16} />
        <Limb d="M122 78 C138 120 136 150 124 168" color={color} width={back ? 20 : 16} />
      </g>
    );
  }
  return (
    <g>
      <Limb d="M76 86 C48 140 46 230 62 300" color={color} width={18} />
      <Limb d="M124 86 C152 140 154 230 138 300" color={paint.hairDeep} width={18} />
      {item === "waves" ? <path d="M58 150 Q72 180 56 220" {...stroke(paint.hairLite, 3)} /> : null}
    </g>
  );
}

function Bangs({ item, paint }: { item: string; paint: Paint }) {
  if (item === "none") return null;
  if (item === "spikes") return <path d="M70 62 L80 24 L90 60 L100 18 L110 60 L124 26 L134 64 L126 78 Q100 66 74 78 Z" fill={paint.hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />;
  if (item === "bun") return <path d="M72 70 Q100 46 128 70 Q118 84 100 80 Q82 84 72 70" fill={paint.hair} stroke={INK} strokeWidth="2" />;
  if (item === "cap") return <path d="M74 72 Q100 46 126 72 Q116 86 100 82 Q84 86 74 72" fill={paint.hair} stroke={INK} strokeWidth="2" />;
  return (
    <g>
      <path d="M74 48 Q100 30 126 48 Q116 58 100 54 Q84 58 74 48" fill={item === "waves" ? paint.hairLite : paint.hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M84 40 Q100 34 116 44" {...stroke(paint.hairLite, 3)} />
    </g>
  );
}

function Headwear({ item, paint, side }: { item: string; paint: Paint; side?: boolean }) {
  if (item === "none") return null;
  const fill = paint.hat;
  if (item === "headphones") {
    return side ? (
      <g>
        <path d="M78 50 Q104 22 128 54" {...stroke(shade(fill), 8)} />
        <ellipse cx="90" cy="84" rx="9" ry="12" fill={fill} stroke={INK} strokeWidth="1.7" />
        <ellipse cx="90" cy="84" rx="4" ry="5" fill={lift(fill)} />
      </g>
    ) : (
      <g>
        <path d="M58 58 Q100 16 142 58" {...stroke(shade(fill), 8)} />
        <ellipse cx="46" cy="88" rx="11" ry="14" fill={fill} stroke={INK} strokeWidth="1.7" />
        <ellipse cx="154" cy="88" rx="11" ry="14" fill={fill} stroke={INK} strokeWidth="1.7" />
        <ellipse cx="46" cy="88" rx="4.5" ry="6" fill={lift(fill)} />
        <ellipse cx="154" cy="88" rx="4.5" ry="6" fill={lift(fill)} />
      </g>
    );
  }
  if (item === "bow") {
    return (
      <path d={side ? "M120 40 Q136 28 146 44 Q134 50 120 46 Q106 50 96 42 Q108 28 120 40" : "M112 42 Q128 28 140 46 Q126 52 112 48 Q98 52 86 44 Q98 28 112 42"} fill={fill} stroke={INK} strokeWidth="1.6" />
    );
  }
  if (item === "crown") return <path d="M78 50 L88 28 L98 46 L100 22 L108 46 L118 28 L128 50 Z" fill={fill} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />;
  if (item === "cap") {
    return <path d={side ? "M90 58 Q118 30 146 56 L164 68 L140 70 Q112 48 94 68 Z" : "M72 64 Q100 32 128 64 L152 78 L122 76 Q100 50 78 76 L58 78 Z"} fill={fill} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />;
  }
  return <path d={side ? "M92 60 Q116 32 142 58 L138 78 Q114 60 96 78 Z" : "M70 66 Q100 30 130 66 L126 88 Q100 70 74 88 Z"} fill={fill} stroke={INK} strokeWidth="1.8" />;
}

function Accessory({ item, paint, side }: { item: string; paint: Paint; side?: boolean }) {
  if (item === "none") return null;
  const fill = paint.extra;
  if (item === "glasses") {
    return side ? (
      <g>
        <ellipse cx="122" cy="76" rx="11" ry="9" fill={mix(fill, "#ffffff", 0.65)} stroke={INK} strokeWidth="1.6" />
        <path d="M133 76 H146" {...stroke(INK, 1.6)} />
      </g>
    ) : (
      <g>
        <ellipse cx="84" cy="82" rx="12.5" ry="10" fill={mix(fill, "#ffffff", 0.65)} stroke={INK} strokeWidth="1.6" />
        <ellipse cx="116" cy="82" rx="12.5" ry="10" fill={mix(fill, "#ffffff", 0.65)} stroke={INK} strokeWidth="1.6" />
        <path d="M96 82 H104" {...stroke(INK, 1.6)} />
      </g>
    );
  }
  if (item === "scarf") {
    return (
      <g>
        <path d="M78 118 Q100 132 122 118 Q114 134 100 136 Q86 134 78 118" fill={fill} stroke={INK} strokeWidth="1.6" />
        <path d="M92 134 L84 172 L96 170" fill={shade(fill)} stroke={INK} strokeWidth="1.4" />
      </g>
    );
  }
  if (item === "badge") return <circle cx={side ? 118 : 118} cy="168" r="7" fill={fill} stroke={INK} strokeWidth="1.5" />;
  if (item === "watch") return <rect x={side ? 108 : 52} y="210" width="12" height="8" rx="2" fill={fill} stroke={INK} strokeWidth="1.3" />;
  const x = side ? 128 : 28;
  return (
    <g>
      <path d={side ? "M112 140 Q146 168 140 196" : "M86 142 Q46 170 42 198"} {...stroke(shade(fill), 3.2)} />
      <rect x={x} y="190" width="30" height="36" rx="7" fill={fill} stroke={INK} strokeWidth="1.7" />
      <path d={`M${x + 5} 202 H${x + 25}`} {...stroke(lift(fill), 2)} />
    </g>
  );
}

function Blouse({ item, paint, gid }: { item: string; paint: Paint; gid: string }) {
  const fill = item === "none" ? "#f7f1e4" : `url(#${gid}-top)`;
  if (item === "hoodie") {
    return (
      <g>
        <path d="M70 118 Q100 96 130 118 Q148 132 140 156 L128 140 V214 H72 V140 L60 156 Q52 132 70 118" fill={fill} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
      </g>
    );
  }
  if (item === "jacket") {
    return <path d="M74 124 L58 148 L74 156 V216 H126 V156 L142 148 L126 124 Q100 110 74 124" fill={fill} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />;
  }
  if (item === "vest") {
    return (
      <g>
        <path d="M82 128 Q100 118 118 128 L122 196 H78 Z" fill="#f7f1e4" stroke={INK} strokeWidth="2" />
        <path d="M76 136 H124 L120 210 H80 Z" fill={fill} stroke={INK} strokeWidth="2.2" />
      </g>
    );
  }
  if (item === "collar" || item === "none") {
    return (
      <g>
        <path d="M78 126 Q100 112 122 126 L118 214 H82 Z" fill={fill} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />
        {item === "none" ? null : (
          <>
            <path d="M84 126 L100 148 L116 126 L110 120 Q100 114 90 120 Z" fill={paint.topLite} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M100 146 V206" {...stroke(paint.topDeep, 1.5)} />
            <circle cx="100" cy="164" r="1.5" fill={paint.topDeep} />
            <circle cx="100" cy="178" r="1.5" fill={paint.topDeep} />
            <circle cx="100" cy="192" r="1.5" fill={paint.topDeep} />
          </>
        )}
      </g>
    );
  }
  return <path d="M78 130 Q100 116 122 130 L126 216 H74 Z" fill={fill} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />;
}

function SkirtOrPants({ item, gid, paint, sit }: { item: string; gid: string; paint: Paint; sit: boolean }) {
  if (item === "skirt") {
    return <path d={`M76 206 Q58 224 52 ${sit ? 268 : 292} H148 Q142 224 124 206 Q100 194 76 206`} fill={`url(#${gid}-bottom)`} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />;
  }
  if (item === "shorts" || item === "none") {
    return <path d="M74 206 H126 L132 258 H108 L100 242 H92 L84 258 H68 Z" fill={`url(#${gid}-bottom)`} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />;
  }
  return (
    <g>
      <Limb d="M88 214 Q80 300 86 392" color={`url(#${gid}-bottom)`} width={20} />
      <Limb d="M112 214 Q122 300 116 392" color={paint.bottomDeep} width={20} />
      {item === "overalls" ? <path d="M90 140 V210 M112 140 V210 M90 150 H112" {...stroke(INK, 2.2)} /> : null}
    </g>
  );
}

function Boots({ item, gid, paint, shift }: { item: string; gid: string; paint: Paint; shift: number }) {
  const y = item === "heels" ? 378 : item === "sneakers" ? 368 : 374;
  if (item === "sandals" || item === "none") {
    return (
      <g>
        <ellipse cx={88 - shift} cy="396" rx="14" ry="6" fill={`url(#${gid}-shoes)`} stroke={INK} strokeWidth="1.6" />
        <ellipse cx={116 + shift} cy="396" rx="14" ry="6" fill={paint.shoes} stroke={INK} strokeWidth="1.6" />
      </g>
    );
  }
  return (
    <g>
      <path d={`M${74 - shift} ${y} H${102 - shift} L${104 - shift} 408 H${70 - shift} Z`} fill={`url(#${gid}-shoes)`} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={`M${108 + shift} ${y - 2} H${136 + shift} L${138 + shift} 406 H${104 + shift} Z`} fill={paint.shoesDeep} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      {item === "heels" ? <path d={`M${100 - shift} 400 V418 M${132 + shift} 398 V416`} {...stroke(INK, 2)} /> : null}
    </g>
  );
}

function FrontBody({ config, paint, emote, gid }: { config: CharacterConfig; paint: Paint; emote: FashionEmote; gid: string }) {
  const sit = emote === "sit";
  const walk = emote === "walk";
  const wave = emote === "wave";
  const top = config.slots.top.item;
  const bottom = config.slots.bottom.item;
  const shoes = config.slots.shoes.item;
  const hair = config.slots.hair.item;
  const sleeved = top === "hoodie" || top === "jacket";
  const shift = walk ? 8 : 0;
  const arm = sleeved ? `url(#${gid}-top)` : `url(#${gid}-skin)`;
  const pants = bottom === "pants" || bottom === "overalls";
  return (
    <g transform={sit ? "translate(0 36)" : undefined}>
      <HairLocks item={hair} paint={paint} gid={gid} />
      {pants ? null : (
        <>
          <Limb d={`M${88 - shift} 250 Q${78 - shift} 320 ${86 - shift} 392`} color={`url(#${gid}-skin)`} width={18} />
          <Limb d={`M${114 + shift} 250 Q${126 + shift} 320 ${118 + shift} 392`} color={paint.skinDeep} width={18} />
        </>
      )}
      <SkirtOrPants item={bottom} gid={gid} paint={paint} sit={sit} />
      <Blouse item={top} paint={paint} gid={gid} />
      <Limb d="M78 136 Q46 158 44 196 Q46 214 78 210" color={arm} width={15} />
      <Limb d={wave ? "M122 134 Q154 108 148 64" : "M122 136 Q146 176 136 236"} color={sleeved ? paint.topDeep : paint.skinDeep} width={15} />
      <ellipse cx="74" cy="214" rx="8" ry="6" fill={sleeved ? paint.top : paint.skin} stroke={INK} strokeWidth="1.6" />
      {pants ? null : <Boots item={shoes} gid={gid} paint={paint} shift={shift} />}
      {pants ? <Boots item={shoes} gid={gid} paint={paint} shift={0} /> : null}
      <path d="M92 112 H108 L106 132 H94 Z" fill={`url(#${gid}-skin)`} stroke={INK} strokeWidth="1.7" />
      <ellipse cx="100" cy="76" rx="46" ry="42" fill={`url(#${gid}-skin)`} stroke={INK} strokeWidth="2.3" />
      <Face config={config} paint={paint} side={false} />
      <Bangs item={hair} paint={paint} />
      <Headwear item={config.slots.headwear.item} paint={paint} />
      <Accessory item={config.slots.accessory.item} paint={paint} />
    </g>
  );
}

function SideBody({
  config,
  paint,
  emote,
  headOnly,
  gid,
}: {
  config: CharacterConfig;
  paint: Paint;
  emote: FashionEmote;
  headOnly?: boolean;
  gid: string;
}): ReactNode {
  const hair = config.slots.hair.item;
  const top = config.slots.top.item;
  const bottom = config.slots.bottom.item;
  const walk = emote === "walk";
  return (
    <g>
      {headOnly || hair === "none" || hair === "cap" || hair === "spikes" ? null : (
        <Limb d="M96 78 C62 120 58 210 74 280" color={`url(#${gid}-hair)`} width={20} />
      )}
      {headOnly ? null : (
        <>
          <Limb d={`M108 230 Q${walk ? 96 : 104} 320 ${walk ? 100 : 108} 390`} color={`url(#${gid}-skin)`} width={18} />
          <Limb d={`M118 232 Q${walk ? 140 : 128} 324 ${walk ? 146 : 124} 388`} color={paint.skinDeep} width={16} />
          {bottom === "skirt" ? (
            <path d="M96 206 C78 224 86 292 112 308 H150 C160 270 148 220 128 204 Z" fill={`url(#${gid}-bottom)`} stroke={INK} strokeWidth="2.2" />
          ) : bottom === "shorts" || bottom === "none" ? (
            <path d="M98 206 H136 L142 258 H96 Z" fill={`url(#${gid}-bottom)`} stroke={INK} strokeWidth="2.2" />
          ) : (
            <Limb d="M112 214 Q120 310 116 392" color={`url(#${gid}-bottom)`} width={22} />
          )}
          <path d="M100 128 C90 160 94 200 108 220 H140 C146 186 138 150 128 128 Z" fill={top === "none" ? "#f7f1e4" : `url(#${gid}-top)`} stroke={INK} strokeWidth="2.2" />
          <Limb d="M118 146 Q132 190 124 236" color={top === "hoodie" || top === "jacket" ? paint.topDeep : `url(#${gid}-skin)`} width={14} />
          <path d="M104 376 H150 L152 406 H100 Z" fill={`url(#${gid}-shoes)`} stroke={INK} strokeWidth="1.8" />
          <path d="M104 112 H122 V132 H104 Z" fill={`url(#${gid}-skin)`} stroke={INK} strokeWidth="1.6" />
        </>
      )}
      {hair === "none" ? null : <path d="M82 62 C60 86 58 128 74 164 L92 150 C80 118 82 88 98 66 Q88 46 82 62" fill={`url(#${gid}-hair)`} stroke={INK} strokeWidth="2" />}
      <ellipse cx="108" cy="76" rx="36" ry="40" fill={`url(#${gid}-skin)`} stroke={INK} strokeWidth="2.3" />
      <Face config={config} paint={paint} side />
      <Headwear item={config.slots.headwear.item} paint={paint} side />
      {headOnly ? null : <Accessory item={config.slots.accessory.item} paint={paint} side />}
    </g>
  );
}

function BackBody({ config, paint, emote, gid }: { config: CharacterConfig; paint: Paint; emote: FashionEmote; gid: string }) {
  const hair = config.slots.hair.item;
  const top = config.slots.top.item;
  const bottom = config.slots.bottom.item;
  const walk = emote === "walk";
  const sleeved = top === "hoodie" || top === "jacket";
  return (
    <g>
      <Limb d={`M${86 - (walk ? 6 : 0)} 250 Q${78 - (walk ? 8 : 0)} 320 ${84 - (walk ? 6 : 0)} 392`} color={paint.skinDeep} width={18} />
      <Limb d="M114 250 Q126 320 118 392" color={`url(#${gid}-skin)`} width={18} />
      {bottom === "skirt" ? (
        <path d="M72 206 Q54 228 50 294 H150 Q146 228 128 206 Q100 192 72 206" fill={`url(#${gid}-bottom)`} stroke={INK} strokeWidth="2.2" />
      ) : bottom === "shorts" || bottom === "none" ? (
        <path d="M74 206 H126 L132 258 H68 Z" fill={`url(#${gid}-bottom)`} stroke={INK} strokeWidth="2.2" />
      ) : (
        <Limb d="M100 214 Q100 310 100 392" color={`url(#${gid}-bottom)`} width={36} />
      )}
      <path d="M76 126 Q100 112 124 126 L120 214 H80 Z" fill={top === "none" ? "#f7f1e4" : `url(#${gid}-top)`} stroke={INK} strokeWidth="2.2" />
      <path d="M100 140 V200" {...stroke(top === "none" ? INK : paint.topDeep, 1.6)} />
      <Limb d="M76 138 Q46 170 58 230" color={sleeved ? `url(#${gid}-top)` : paint.skin} width={15} />
      <Limb d="M124 138 Q150 176 140 232" color={sleeved ? paint.topDeep : paint.skinDeep} width={15} />
      <path d="M70 376 H102 L104 408 H66 Z" fill={`url(#${gid}-shoes)`} stroke={INK} strokeWidth="1.8" />
      <path d="M108 376 H140 L142 408 H104 Z" fill={paint.shoesDeep} stroke={INK} strokeWidth="1.8" />
      <ellipse cx="100" cy="74" rx="38" ry="42" fill={`url(#${gid}-hair)`} stroke={INK} strokeWidth="2.3" />
      <HairLocks item={hair === "none" ? "bob" : hair} paint={paint} gid={gid} back />
      <Headwear item={config.slots.headwear.item === "headphones" ? "headphones" : "none"} paint={paint} />
    </g>
  );
}

/**
 * Layered 2D paper doll. Slot colors tint each garment.
 * The 3D humanoid is not drawn here.
 */
export function FashionDoll({
  config,
  view,
  emote = "idle",
}: {
  config: CharacterConfig;
  view: FashionView;
  emote?: FashionEmote;
}) {
  const gid = useId().replace(/:/g, "");
  if (isGlamSilhouette(config)) {
    return <GlamPortrait config={config} view={view} emote={emote} />;
  }
  const paint = paints(config);
  const tall = config.body.shape === "tall" ? 1.04 : config.body.shape === "compact" ? 0.92 : 1;
  const wide = config.body.shape === "wide" ? 1.08 : config.body.shape === "round" ? 1.04 : config.body.shape === "compact" ? 0.96 : 1;
  const size = config.body.size === "large" ? 1.04 : config.body.size === "small" ? 0.92 : 1;
  const viewBox = view === "profile" ? "46 16 132 142" : "0 0 200 440";
  const label = view === "profile" ? "profile headshot" : `${view} view`;
  return (
    <svg
      className={`fashion-doll fashion-doll-${view}`}
      width="100%"
      height="100%"
      viewBox={viewBox}
      preserveAspectRatio={view === "profile" ? "xMidYMid meet" : "xMidYMax meet"}
      role="img"
      aria-label={`Content creator fashion avatar, ${label}`}
    >
      <defs>
        <linearGradient id={`${gid}-skin`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={paint.skinLite} />
          <stop offset="0.55" stopColor={paint.skin} />
          <stop offset="1" stopColor={paint.skinDeep} />
        </linearGradient>
        <linearGradient id={`${gid}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint.hairLite} />
          <stop offset="0.5" stopColor={paint.hair} />
          <stop offset="1" stopColor={paint.hairDeep} />
        </linearGradient>
        <linearGradient id={`${gid}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={paint.topLite} />
          <stop offset="0.5" stopColor={paint.top} />
          <stop offset="1" stopColor={paint.topDeep} />
        </linearGradient>
        <linearGradient id={`${gid}-bottom`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint.bottomLite} />
          <stop offset="1" stopColor={paint.bottomDeep} />
        </linearGradient>
        <linearGradient id={`${gid}-shoes`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint.shoesLite} />
          <stop offset="1" stopColor={paint.shoesDeep} />
        </linearGradient>
      </defs>
      {view === "profile" ? null : <ellipse cx="100" cy="418" rx="46" ry="7" fill="#d0d0d0" />}
      <g transform={`translate(100 400) scale(${wide * size} ${tall * size}) translate(-100 -400)`}>
        {view === "front" ? <FrontBody config={config} paint={paint} emote={emote} gid={gid} /> : null}
        {view === "side" || view === "profile" ? (
          <SideBody config={config} paint={paint} emote={emote} gid={gid} headOnly={view === "profile"} />
        ) : null}
        {view === "back" ? <BackBody config={config} paint={paint} emote={emote} gid={gid} /> : null}
      </g>
    </svg>
  );
}
