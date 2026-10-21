"use client";

import { usePathname } from "next/navigation";
import { dismissSeasonalThemeAction, restoreSeasonalThemeAction } from "@/app/theme-actions";
import { BatIcon, GhostIcon, PumpkinIcon } from "@/components/seasonal-icons";
import { SeasonalSparkle } from "@/components/seasonal-sparkle";
import { publicBasePath } from "@/lib/format";
import {
  HALLOWEEN_DRIFTERS,
  seasonalSurface,
  type HalloweenDrifter,
  type SeasonalSurface,
  type SeasonalTheme,
} from "@/lib/seasonal-theme";

const FLAG_COLORS = ["#6B46A3", "#E8873A", "#1C1A1F", "#FFF6EA"];

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

function Character({ kind }: { kind: HalloweenDrifter["kind"] }) {
  if (kind === "ghost") return <GhostIcon />;
  if (kind === "bat") return <BatIcon />;
  return <PumpkinIcon />;
}

function Bunting({ surface }: { surface: SeasonalSurface }) {
  const flags = surface === "site" ? 24 : 16;
  return (
    <div className="seasonal-bunting" aria-hidden="true">
      <PumpkinIcon className="seasonal-mark" />
      {surface === "site" ? <BatIcon className="seasonal-mark" /> : null}
      <GhostIcon className="seasonal-mark" />
      {Array.from({ length: flags }, (_, index) => (
        <svg key={index} className="seasonal-flag" viewBox="0 0 24 28">
          <path d="M3 1 H21 L12 24 Z" fill={FLAG_COLORS[index % FLAG_COLORS.length]} stroke="#1C1A1F" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  );
}

function Drifter({ item }: { item: HalloweenDrifter }) {
  return (
    <span
      className={`seasonal-drift seasonal-drift-${item.layer} seasonal-drift-${item.drift}`}
      style={{
        top: item.top,
        left: item.left,
        right: item.right,
        width: item.size,
        height: item.size,
        animationDuration: item.duration,
        animationDelay: item.delay,
      }}
    >
      <Character kind={item.kind} />
    </span>
  );
}

function HalloweenSky({ surface }: { surface: SeasonalSurface }) {
  const cast = HALLOWEEN_DRIFTERS.filter((item) => item.surface === surface);
  return (
    <div className={`seasonal-sky seasonal-sky-${surface}`} aria-hidden="true">
      {cast.map((item, index) => (
        <Drifter key={`${item.kind}-${item.layer}-${index}`} item={item} />
      ))}
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
          {theme.id === "halloween" ? <Bunting surface={surface} /> : <span className="seasonal-banner-label">{theme.name}</span>}
          <SeasonalOffSwitch themeId={theme.id} themeName={theme.name} mode="hide" />
        </div>
      ) : hidden ? (
        <div className="seasonal-banner seasonal-banner-quiet">
          <SeasonalOffSwitch themeId={hidden.id} themeName={hidden.name} mode="show" />
        </div>
      ) : null}
      {theme?.id === "halloween" ? (
        <>
          <HalloweenSky surface={surface} />
          <SeasonalSparkle />
        </>
      ) : null}
    </>
  );
}
