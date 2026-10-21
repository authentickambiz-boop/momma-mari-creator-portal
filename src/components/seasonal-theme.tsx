"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { dismissSeasonalThemeAction, restoreSeasonalThemeAction } from "@/app/theme-actions";
import { BatIcon, GhostIcon, PumpkinIcon } from "@/components/seasonal-icons";
import { SeasonalSparkle } from "@/components/seasonal-sparkle";
import { SEASONAL_PREVIEW_PARAM } from "@/lib/seasonal-calendar";
import { publicBasePath, withBasePath } from "@/lib/format";
import {
  seasonalSurface,
  themeById,
  THEME_FLOATERS,
  THEME_GLOWS,
  type FloaterKind,
  type SeasonalSurface,
  type SeasonalTheme,
  type ThemeFloater,
} from "@/lib/seasonal-theme";

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

function FloaterGlyph({ kind }: { kind: FloaterKind }) {
  if (kind === "ghost") return <GhostIcon />;
  if (kind === "bat") return <BatIcon />;
  if (kind === "leaf") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#E09A3A" stroke="#1C140E" strokeWidth="2" d="M24 6c10 8 16 18 12 30-12-2-20-10-26-18C6 10 14 4 24 6z" />
        <path d="M16 32c6-6 12-10 18-12" fill="none" stroke="#6B3414" strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "star") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#E2B657" stroke="#1C140E" strokeWidth="2" d="M24 4l5 14h14l-11 8 4 14-12-8-12 8 4-14L5 18h14z" />
      </svg>
    );
  }
  if (kind === "flake") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="none" stroke="#F7F1FF" strokeWidth="2.4" strokeLinecap="round" d="M24 6v36M8 14l32 20M8 34l32-20" />
      </svg>
    );
  }
  if (kind === "spark" || kind === "burst") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill={kind === "burst" ? "#E8873A" : "#E2B657"} stroke="#1C140E" strokeWidth="2" d="M24 4l4 14 14 2-12 8 4 14-10-8-10 8 4-14L6 20l14-2z" />
      </svg>
    );
  }
  if (kind === "heart") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#E7A0B4" stroke="#1C140E" strokeWidth="2" d="M24 40C8 28 6 16 14 12c6-3 10 2 10 2s4-5 10-2c8 4 6 16-10 28z" />
      </svg>
    );
  }
  if (kind === "clover") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="16" r="7" fill="#3E9A56" stroke="#0C1812" strokeWidth="2" />
        <circle cx="15" cy="26" r="7" fill="#3E9A56" stroke="#0C1812" strokeWidth="2" />
        <circle cx="33" cy="26" r="7" fill="#2F7A44" stroke="#0C1812" strokeWidth="2" />
        <path d="M24 28v12" stroke="#1C140E" strokeWidth="2" />
      </svg>
    );
  }
  if (kind === "apple") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="28" r="12" fill="#C4453A" stroke="#1C140E" strokeWidth="2" />
        <path d="M24 16c2-6 8-8 10-6" fill="none" stroke="#1E6A48" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <ellipse cx="24" cy="26" rx="8" ry="12" fill="#F4C7D4" stroke="#1C140E" strokeWidth="2" transform="rotate(-20 24 26)" />
    </svg>
  );
}

function Floater({ item }: { item: ThemeFloater }) {
  const height = item.kind === "bat" ? item.size * 0.56 : item.size;
  return (
    <span
      className={`seasonal-floater seasonal-floater-${item.kind} seasonal-floater-${item.drift}`}
      style={{
        top: item.top,
        left: item.left,
        width: item.size,
        height,
        animationDuration: item.duration,
        animationDelay: item.delay,
      }}
    >
      <FloaterGlyph kind={item.kind} />
    </span>
  );
}

function previewThemeId() {
  const param = new URLSearchParams(window.location.search).get(SEASONAL_PREVIEW_PARAM);
  const next = param ? themeById(param) : null;
  return next?.preview ? next.id : null;
}

/** Reads `?mm_preview=` in the browser. The flag is not written anywhere. */
function usePreviewTheme() {
  const id = useSyncExternalStore(
    () => () => {},
    previewThemeId,
    () => null,
  );
  const theme = id ? themeById(id) : null;
  useEffect(() => {
    if (!theme?.preview) return;
    const root = document.documentElement;
    const previous = root.dataset.seasonal;
    root.dataset.seasonal = theme.id;
    root.dataset.mmPreview = theme.id;
    root.style.setProperty("--cream", theme.palette.page);
    return () => {
      if (previous) root.dataset.seasonal = previous;
      else delete root.dataset.seasonal;
      delete root.dataset.mmPreview;
    };
  }, [theme]);
  return theme;
}

/**
 * The sky paints immediately. The illustrated hill is requested after idle,
 * and phones get the smaller static file.
 */
function useSceneSrc(theme: SeasonalTheme, surface: SeasonalSurface) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 820px)");
    let cancelled = false;
    const load = () => {
      const file = query.matches ? theme.scenes.mobile : theme.scenes[surface];
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
  }, [surface, theme]);
  return src;
}

function IllustratedScene({ theme, surface }: { theme: SeasonalTheme; surface: SeasonalSurface }) {
  const src = useSceneSrc(theme, surface);
  const floaters = THEME_FLOATERS.filter((item) => item.theme === theme.id && item.surface === surface);
  const glows = THEME_GLOWS.filter((item) => item.theme === theme.id && item.surface === surface);
  return (
    <div className={`seasonal-scene seasonal-scene-${surface}`} data-theme={theme.id} data-night={theme.night ? "true" : "false"} aria-hidden="true">
      <div className="seasonal-sky-paint" />
      <div className="seasonal-stars seasonal-stars-far" />
      <div className="seasonal-stars seasonal-stars-near" />
      <div className="seasonal-moon" />
      {src ? (
        <img className="seasonal-illustration" src={src} alt="" decoding="async" loading="lazy" fetchPriority="low" />
      ) : null}
      {glows.map((glow) => (
        <span
          key={`${glow.top}-${glow.left}`}
          className="seasonal-lantern"
          style={{ top: glow.top, left: glow.left, width: glow.size, height: glow.size, animationDelay: glow.delay }}
        />
      ))}
      {floaters.map((item, index) => (
        <Floater key={`${item.kind}-${item.drift}-${index}`} item={item} />
      ))}
      {theme.id === "halloween" ? <Cobweb className="seasonal-web seasonal-web-left" /> : null}
      {theme.id === "halloween" ? <Cobweb className="seasonal-web seasonal-web-right" /> : null}
    </div>
  );
}

export function SeasonalThemeFrame({ presentation }: { presentation: Presentation }) {
  const surface = seasonalSurface(usePathname() ?? "/", publicBasePath());
  const preview = usePreviewTheme();
  const theme = preview ?? presentation.active;
  const hidden = preview ? null : presentation.hidden;
  return (
    <>
      {theme ? (
        <div className={`seasonal-banner seasonal-banner-${surface} seasonal-banner-scene`}>
          {theme.id === "halloween" && !preview ? <PumpkinIcon className="seasonal-mark" /> : <span className="seasonal-banner-label">{preview ? `Preview · ${theme.name}` : theme.name}</span>}
          {preview ? null : <SeasonalOffSwitch themeId={theme.id} themeName={theme.name} mode="hide" />}
        </div>
      ) : hidden ? (
        <div className="seasonal-banner seasonal-banner-quiet">
          <SeasonalOffSwitch themeId={hidden.id} themeName={hidden.name} mode="show" />
        </div>
      ) : null}
      {theme ? (
        <>
          <IllustratedScene theme={theme} surface={surface} />
          {theme.id === "halloween" ? <SeasonalSparkle /> : null}
        </>
      ) : null}
    </>
  );
}
