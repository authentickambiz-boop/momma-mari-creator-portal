"use client";

import { useMemo, useState } from "react";
import { CityChrome } from "@/components/worlds/city/city-panel";
import { officeInteractables } from "@/lib/worlds/city/interactables";
import type { AccessRole } from "@/lib/worlds/city/access";
import { HQ_BOT_ID, OFFICE_SECTIONS, buildOfficeLayout } from "@/lib/worlds/office-layout";
import "../office.css";

/** Owner panel only. The page that mounts this 404s unless the smoke flag is on. */
export function CitySmokeApp() {
  const [locationId, setLocationId] = useState<string | null>(null);
  const [role, setRole] = useState<AccessRole>("owner");
  const officeTaps = useMemo(() => {
    const layout = buildOfficeLayout();
    return officeInteractables(layout, OFFICE_SECTIONS, [{ id: HQ_BOT_ID, name: "Kash" }]);
  }, []);

  return (
    <div className="bot-office" data-city-smoke="owner" data-viewer-role={role}>
      <p className="city-smoke-note">Owner panel. Nothing is posted or emailed.</p>
      <CityChrome
        locationId={locationId}
        officeTaps={officeTaps}
        onOpenLocation={setLocationId}
        onClose={() => setLocationId(null)}
        onOpenBank={() => undefined}
        onTier={() => undefined}
        onSession={() => undefined}
        viewerRole={role}
        onViewerRole={setRole}
      />
    </div>
  );
}
