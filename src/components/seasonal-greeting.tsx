import { PumpkinIcon } from "@/components/seasonal-icons";
import { loadSeasonalPresentation } from "@/lib/seasonal-theme-request";

/** One seasonal line on the creator home. Other roles keep the usual hello. */
export async function SeasonalGreeting() {
  const { active } = await loadSeasonalPresentation();
  if (!active?.greeting) return null;
  return (
    <p className="seasonal-hello">
      {active.id === "halloween" ? <PumpkinIcon /> : null}
      <span>{active.greeting}</span>
    </p>
  );
}
