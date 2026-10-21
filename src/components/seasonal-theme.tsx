"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dismissSeasonalThemeAction, restoreSeasonalThemeAction } from "@/app/theme-actions";
import { BatIcon, GhostIcon, PumpkinIcon } from "@/components/seasonal-icons";
import { SeasonalSparkle } from "@/components/seasonal-sparkle";
import { publicBasePath, withBasePath } from "@/lib/format";
import {
  HALLOWEEN_FLOATERS,
  HALLOWEEN_LANTERNS,
  seasonalSurface,
  type HalloweenFloater,
  type SeasonalSurface,
  type SeasonalTheme,
} from "@/lib/seasonal-theme";

const SCENE_FILES = {
  site: "halloween-site.svg",
  portal: "halloween-portal.svg",
  mobile: "halloween-mobile.svg",
} as const;

type Presentation = {
  active: SeasonalTheme | null;
  hidden: SeasonalTheme | null;
};

function SeasonalOffSwitch({ themeId, themeName, mode }: { themeId: string; themeName: string; mode: "hide" | "show" }) {
  const action = mode === "hide" ? dismissSeasonalThemeAction : restoreSeasonalThemeAction;
  const label = mode === "hide" ? `Turn off ${themeName} decorations` : `Show ${themeName} decorations`;
  return (
    <form action={action} className="seasonal-off-form">
      <input type="hidden" name="theme" value={themeId} />
      <button className="seasonal-off" type="submit">{label}</button>
    </form>
  );
}

function Cobweb({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 140 140" aria-hidden="true">
      <g fill="none" stroke="#E6D8F6" strokeWidth="1.3" strokeLinecap="round">
        <path d="M6 8 C 48 18, 86 28, 132 14" />
        <path d="M6 8 C 18 52, 28 92, 16 132" />
        <path d="M6 8 L 126 118" />
        <path d="M6 8 L 78 132" />
        <path d="M6 8 L 132 70" />
        <path d="M28 22 C 46 40, 62 58, 84 70" />
        <path d="M18 48 C 40 58, 64 66, 92 62" />
        <path d="M22 78 C 42 84, 66 86, 96 78" />
      </g>
    </svg>
  );
}

function Floater({ item }: { item: HalloweenFloater }) {
  return (
    <span
      className={`seasonal-floater seasonal-floater-${item.kind} seasonal-floater-${item.drift}`}
      style={{
        top: item.top,
        left: item.left,
        width: item.size,
        height: item.kind === "bat" ? item.size * 0.56 : item.size,
        animationDuration: item.duration,
        animationDelay: item.delay,
      }}
    >
      {item.kind === "ghost" ? <GhostIcon /> : <BatIcon />}
    </span>
  );
}

/**
 * The night sky paints immediately. The illustrated hill is requested after
 * idle, and phones get the smaller static file.
 */
function useSceneSrc(surface: SeasonalSurface) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    let cancelled = false;
    const load = () => {
      const file = query.matches ? SCENE_FILES.mobile : SCENE_FILES[surface];
      const next = withBasePath(`/seasonal/${file}`);
      if (!cancelled) setSrc(next);
    };
    let idle = 0;
    let timer = 0;
    const host = window as Window & {
      requestIdleCallback?: (callback: () => void, options: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (host.requestIdleCallback) idle = host.requestIdleCallback(load, { timeout: 700 });
    else timer = window.setTimeout(load, 1);
    query.addEventListener("change", load);
    return () => {
      cancelled = true;
      if (idle) host.cancelIdleCallback?.(idle);
      if (timer) window.clearTimeout(timer);
      query.removeEventListener("change", load);
    };
  }, [surface]);
  return src;
}

function HalloweenScene({ surface }: { surface: SeasonalSurface }) {
  const src = useSceneSrc(surface);
  const floaters = HALLOWEEN_FLOATERS.filter((item) => item.surface === surface);
  const lanterns = HALLOWEEN_LANTERNS.filter((item) => item.surface === surface);
  return (
    <div className={`seasonal-scene seasonal-scene-${surface}`} aria-hidden="true">
      <div className="seasonal-sky-paint" />
      <div className="seasonal-stars seasonal-stars-far" />
      <div className="seasonal-stars seasonal-stars-near" />
      <div className="seasonal-moon" />
      {src ? (
        <img className="seasonal-illustration" src={src} alt="" decoding="async" loading="lazy" fetchPriority="low" />
      ) : null}
      {lanterns.map((lantern) => (
        <span
          key={`${lantern.top}-${lantern.left}`}
          className="seasonal-lantern"
          style={{ top: lantern.top, left: lantern.left, width: lantern.size, height: lantern.size, animationDelay: lantern.delay }}
        />
      ))}
      {floaters.map((item, index) => (
        <Floater key={`${item.kind}-${item.drift}-${index}`} item={item} />
      ))}
      <Cobweb className="seasonal-web seasonal-web-left" />
      <Cobweb className="seasonal-web seasonal-web-right" />
    </div>
  );
}

export function SeasonalThemeFrame({ presentation }: { presentation: Presentation }) {
  const surface = seasonalSurface(usePathname() ?? "/", publicBasePath());
  const theme = presentation.active;
  const hidden = presentation.hidden;
  return (
    <>
      {theme ? (
        <div className={`seasonal-banner seasonal-banner-${surface}${theme.id === "halloween" ? " seasonal-banner-halloween" : ""}`}>
          {theme.id === "halloween" ? <PumpkinIcon className="seasonal-mark" /> : <span className="seasonal-banner-label">{theme.name}</span>}
          <SeasonalOffSwitch themeId={theme.id} themeName={theme.name} mode="hide" />
        </div>
      ) : hidden ? (
        <div className="seasonal-banner seasonal-banner-quiet">
          <SeasonalOffSwitch themeId={hidden.id} themeName={hidden.name} mode="show" />
        </div>
      ) : null}
      {theme?.id === "halloween" ? (
        <>
          <HalloweenScene surface={surface} />
          <SeasonalSparkle />
        </>
      ) : null}
    </>
  );
}
