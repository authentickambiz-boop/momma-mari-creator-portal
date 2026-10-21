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
  HOLIDAY_FLOATERS,
  HOLIDAY_GLOWS,
  seasonalSurface,
  themeHasScene,
  type HolidayThemeId,
  type SeasonalSurface,
  type SeasonalTheme,
  type SeasonalThemeId,
} from "@/lib/seasonal-theme";

const SCENE_FILES = {
  halloween: { site: "halloween-site.svg", portal: "halloween-portal.svg", mobile: "halloween-mobile.svg" },
  thanksgiving: { site: "thanksgiving-site.svg", portal: "thanksgiving-portal.svg", mobile: "thanksgiving-mobile.svg" },
  hanukkah: { site: "hanukkah-site.svg", portal: "hanukkah-portal.svg", mobile: "hanukkah-mobile.svg" },
  christmas: { site: "christmas-site.svg", portal: "christmas-portal.svg", mobile: "christmas-mobile.svg" },
  "new-year": { site: "new-year-site.svg", portal: "new-year-portal.svg", mobile: "new-year-mobile.svg" },
} as const;

type SceneThemeId = keyof typeof SCENE_FILES;

type Presentation = {
  active: SeasonalTheme | null;
  hidden: SeasonalTheme | null;
};

function isSceneTheme(id: SeasonalThemeId): id is SceneThemeId {
  return id in SCENE_FILES;
}

function isHoliday(id: SeasonalThemeId): id is HolidayThemeId {
  return id === "thanksgiving" || id === "hanukkah" || id === "christmas" || id === "new-year";
}

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

function LeafIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 36c12-2 22-12 28-26-14 2-26 12-28 26z" fill="#E8873A" stroke="#6B3414" strokeWidth="2" />
      <path d="M14 32c8-6 16-14 20-20" fill="none" stroke="#8C3E22" strokeWidth="1.6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 4l4 12h12l-10 8 4 12-10-7-10 7 4-12-10-8h12z" fill="#E2B657" stroke="#1C1A1F" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function FlakeIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <g fill="none" stroke="#F7FBFF" strokeWidth="2.2" strokeLinecap="round">
        <path d="M24 6v36M10 14l28 20M38 14L10 34" />
        <path d="M24 14l-4-4M24 14l4-4M24 34l-4 4M24 34l4 4" />
      </g>
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 2l3 15 15 3-15 3-3 15-3-15-15-3 15-3z" fill="#E2B657" />
    </svg>
  );
}

function FloaterGlyph({ kind }: { kind: string }) {
  if (kind === "ghost") return <GhostIcon />;
  if (kind === "bat") return <BatIcon />;
  if (kind === "leaf") return <LeafIcon />;
  if (kind === "star") return <StarIcon />;
  if (kind === "flake") return <FlakeIcon />;
  return <SparkIcon />;
}

function Floater({ item }: { item: { kind: string; top: string; left: string; size: number; duration: string; delay: string; drift: string } }) {
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
      <FloaterGlyph kind={item.kind} />
    </span>
  );
}

function BannerMark({ themeId }: { themeId: SceneThemeId }) {
  if (themeId === "halloween") return <PumpkinIcon className="seasonal-mark" />;
  return (
    <span className="seasonal-mark" aria-hidden="true">
      {themeId === "thanksgiving" ? <LeafIcon /> : null}
      {themeId === "hanukkah" ? <StarIcon /> : null}
      {themeId === "christmas" ? <FlakeIcon /> : null}
      {themeId === "new-year" ? <SparkIcon /> : null}
    </span>
  );
}

/**
 * The sky paints immediately. The illustrated hill is requested after idle,
 * and phones get the smaller static file.
 */
function useSceneSrc(themeId: SceneThemeId, surface: SeasonalSurface) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    let cancelled = false;
    const load = () => {
      const files = SCENE_FILES[themeId];
      const file = query.matches ? files.mobile : files[surface];
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
  }, [themeId, surface]);
  return src;
}

function IllustratedScene({ themeId, surface }: { themeId: SceneThemeId; surface: SeasonalSurface }) {
  const src = useSceneSrc(themeId, surface);
  const floaters = themeId === "halloween"
    ? HALLOWEEN_FLOATERS.filter((item) => item.surface === surface)
    : HOLIDAY_FLOATERS.filter((item) => item.theme === themeId && item.surface === surface);
  const lanterns = themeId === "halloween"
    ? HALLOWEEN_LANTERNS.filter((item) => item.surface === surface)
    : HOLIDAY_GLOWS.filter((item) => isHoliday(themeId) && item.theme === themeId && item.surface === surface);
  return (
    <div className={`seasonal-scene seasonal-scene-${surface} seasonal-scene-${themeId}`} aria-hidden="true">
      <div className="seasonal-sky-paint" />
      <div className="seasonal-stars seasonal-stars-far" />
      <div className="seasonal-stars seasonal-stars-near" />
      <div className="seasonal-moon" />
      <div className="seasonal-sun" />
      {src ? (
        <img className="seasonal-illustration" src={src} alt="" decoding="async" loading="lazy" fetchPriority="low" />
      ) : null}
      {lanterns.map((lantern) => (
        <span
          key={`${lantern.top}-${lantern.left}`}
          className={`seasonal-lantern seasonal-lantern-${themeId}`}
          style={{ top: lantern.top, left: lantern.left, width: lantern.size, height: lantern.size, animationDelay: lantern.delay }}
        />
      ))}
      {floaters.map((item, index) => (
        <Floater key={`${item.kind}-${item.drift}-${index}`} item={item} />
      ))}
      {themeId === "halloween" ? (
        <>
          <Cobweb className="seasonal-web seasonal-web-left" />
          <Cobweb className="seasonal-web seasonal-web-right" />
        </>
      ) : null}
    </div>
  );
}

export function SeasonalThemeFrame({ presentation }: { presentation: Presentation }) {
  const surface = seasonalSurface(usePathname() ?? "/", publicBasePath());
  const theme = presentation.active;
  const hidden = presentation.hidden;
  const scene = theme && isSceneTheme(theme.id) && themeHasScene(theme.id) ? theme.id : null;
  return (
    <>
      {theme ? (
        <div className={`seasonal-banner seasonal-banner-${surface}${scene ? " seasonal-banner-scene" : ""}`}>
          {scene ? <BannerMark themeId={scene} /> : <span className="seasonal-banner-label">{theme.name}</span>}
          <SeasonalOffSwitch themeId={theme.id} themeName={theme.name} mode="hide" />
        </div>
      ) : hidden ? (
        <div className="seasonal-banner seasonal-banner-quiet">
          <SeasonalOffSwitch themeId={hidden.id} themeName={hidden.name} mode="show" />
        </div>
      ) : null}
      {scene ? (
        <>
          <IllustratedScene key={`${scene}-${surface}`} themeId={scene} surface={surface} />
          <SeasonalSparkle />
        </>
      ) : null}
    </>
  );
}
