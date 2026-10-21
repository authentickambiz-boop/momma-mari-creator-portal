"use client";

import { useSyncExternalStore } from "react";
import { HANUKKAH_NIGHT_PARAM, hanukkahFlameDelay, hanukkahView, parseHanukkahNight } from "@/lib/hanukkah";
import type { SeasonalSurface } from "@/lib/seasonal-theme";

const BRANCHES = [
  { x: 40, y: 190, bend: 8 },
  { x: 86, y: 180, bend: -5 },
  { x: 132, y: 172, bend: 7 },
  { x: 176, y: 166, bend: -3 },
  { x: 284, y: 165, bend: 4 },
  { x: 330, y: 171, bend: -6 },
  { x: 376, y: 180, bend: 5 },
  { x: 422, y: 191, bend: -4 },
] as const;

const SHAMASH = { x: 230, y: 124 };

const LOOK = {
  site: {
    wax: "#F7FBFF",
    metal: "#D5DEEA",
    metalDeep: "#B7C6DA",
    cup: "#F4F7FB",
    tag: "#F7FBFF",
    tagInk: "#16325C",
  },
  portal: {
    wax: "#E4EAF3",
    metal: "#9BB0C8",
    metalDeep: "#6E86A8",
    cup: "#D5DEEA",
    tag: "#E8EEF6",
    tagInk: "#0C1C3A",
  },
} as const;

function nightOverride() {
  return parseHanukkahNight(new URLSearchParams(window.location.search).get(HANUKKAH_NIGHT_PARAM));
}

function branchPath(x: number, y: number, bend: number) {
  const midX = 230 + (x - 230) * 0.42;
  const midY = Math.min(y, 168) - 18 + bend;
  return `M230 214 C ${230 + bend} ${y + 10}, ${midX} ${midY}, ${x} ${y}`;
}

function Flame({ delay }: { delay: number }) {
  const catchAt = `${delay}s`;
  const flickerAt = `${delay + 0.45}s`;
  return (
    <g className="hanukkah-flame" style={{ animationDelay: `${catchAt}, ${flickerAt}` }}>
      <ellipse cx="0" cy="2" rx="11" ry="16" fill="#FFE7A8" opacity="0.55" />
      <path d="M0 14 C7 4 5 -8 9 -22 C2 -10 -3 -4 -5 2 C-3 8 -2 12 0 14 Z" fill="#FFE7A8" stroke="#C4922A" strokeWidth="1.5" />
      <path d="M0 10 C3 2 2 -4 4 -10 C1 -4 -1 0 -2 4 C-1 7 -1 9 0 10 Z" fill="#FFFDF8" />
    </g>
  );
}

/**
 * The countdown menorah. Holders stay empty until that night, candles sit
 * from the right, and the newest flame catches first.
 */
export function HanukkahMenorah({ surface }: { surface: SeasonalSurface }) {
  const override = useSyncExternalStore(() => () => {}, nightOverride, () => null);
  const view = hanukkahView(new Date(), override);
  const look = LOOK[surface];
  return (
    <div className={`seasonal-menorah seasonal-menorah-${surface}`} data-hanukkah-night={view.night}>
      <svg className="seasonal-menorah-art" viewBox="0 0 460 300" aria-hidden="true">
        <path d="M158 232 C196 220 268 222 304 234 L316 262 C248 274 196 272 146 260 Z" fill={look.metal} stroke="#1C2430" strokeWidth="3" />
        <path d="M214 230 L207 156 C220 150 242 150 254 156 L246 230 Z" fill={look.metalDeep} stroke="#1C2430" strokeWidth="3" />
        <rect x="132" y="258" width="196" height="18" rx="7" fill={look.cup} stroke="#1C2430" strokeWidth="3" />
        <path d="M168 266 H292" stroke="#1C2430" strokeWidth="1.5" opacity="0.35" />
        {surface === "portal" ? (
          <path d="M214 268 l8 6 h-16 z M230 268 l8 6 h-16 z" fill="#16325C" />
        ) : (
          <path d="M200 266 h60" stroke="#F7FBFF" strokeWidth="3" strokeLinecap="round" />
        )}
        {BRANCHES.map((branch) => (
          <path key={`arm-${branch.x}`} d={branchPath(branch.x, branch.y, branch.bend)} fill="none" stroke={look.metal} strokeWidth="7" strokeLinecap="round" />
        ))}
        {BRANCHES.map((branch) => (
          <path key={`shine-${branch.x}`} d={branchPath(branch.x, branch.y, branch.bend)} fill="none" stroke="#F7FBFF" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
        ))}
        <ellipse cx={SHAMASH.x} cy={SHAMASH.y + 2} rx="12" ry="5.5" fill={look.cup} stroke="#1C2430" strokeWidth="2.4" />
        {BRANCHES.map((branch, index) => {
          const candle = view.candles[index];
          return (
            <g key={`cup-${branch.x}`} transform={`translate(${branch.x} ${branch.y})`}>
              <ellipse cx="0" cy="2" rx="11" ry="5" fill={look.cup} stroke="#1C2430" strokeWidth="2.4" />
              {candle?.lit ? (
                <g>
                  <rect x="-6.5" y="-36" width="13" height="40" rx="3" fill={look.wax} stroke="#1C2430" strokeWidth="2.3" />
                  <path d="M-2 -34 v28" stroke="#E8EEF6" strokeWidth="1.4" opacity="0.8" />
                  <g transform="translate(0 -36)">
                    <Flame delay={hanukkahFlameDelay(candle.lightIndex ?? 0)} />
                  </g>
                </g>
              ) : (
                <path d="M0 -2 v-8" stroke="#1C2430" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
              )}
            </g>
          );
        })}
        {view.shamashLit ? (
          <g transform={`translate(${SHAMASH.x} ${SHAMASH.y})`}>
            <rect x="-7" y="-46" width="14" height="48" rx="3" fill={look.wax} stroke="#1C2430" strokeWidth="2.4" />
            <path d="M-2 -44 v34" stroke="#F7FBFF" strokeWidth="1.5" />
            <g transform="translate(0 -46)">
              <Flame delay={hanukkahFlameDelay("shamash")} />
            </g>
          </g>
        ) : (
          <path d={`M${SHAMASH.x} ${SHAMASH.y} v-10`} stroke="#1C2430" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
        )}
        {view.night === 0 ? (
          <g transform="translate(230 78)">
            <ellipse cx="0" cy="0" rx="58" ry="30" fill={look.tag} stroke="#1C2430" strokeWidth="3" />
            <ellipse cx="-2" cy="-2" rx="48" ry="22" fill="none" stroke={look.metalDeep} strokeWidth="1.5" />
            <text x="0" y={view.daysUntil === 0 ? 6 : 8} textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize={view.daysUntil != null && view.daysUntil > 9 ? 26 : 30} fill={look.tagInk} fontWeight="700">
              {view.daysUntil === 0 ? "Tonight" : view.daysUntil}
            </text>
          </g>
        ) : null}
      </svg>
      <p className="seasonal-menorah-label">{view.label}</p>
    </div>
  );
}
