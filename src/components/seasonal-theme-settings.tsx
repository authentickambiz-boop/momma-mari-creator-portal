import { saveSeasonalThemeAction } from "@/app/theme-actions";
import { SEASONAL_THEMES } from "@/lib/seasonal-theme";
import { loadSeasonalPresentation } from "@/lib/seasonal-theme-request";

export async function SeasonalThemeSettings() {
  const { override } = await loadSeasonalPresentation();
  return (
    <form action={saveSeasonalThemeAction} className="card stack" style={{ marginTop: 14 }}>
      <div className="sec-title">Seasonal theme</div>
      <p className="note">
        Themes follow Eastern Time and switch off on their own. Halloween runs through Nov 1, 2026.
        Force a theme, or choose none. The later themes are palettes waiting for you to fill in.
      </p>
      <label htmlFor="seasonal-theme">Theme</label>
      <select id="seasonal-theme" name="theme" defaultValue={override}>
        <option value="auto">Follow the calendar</option>
        <option value="none">None</option>
        {SEASONAL_THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}{theme.placeholder ? " (placeholder)" : ""}
          </option>
        ))}
      </select>
      <button className="btn" type="submit">Save theme</button>
    </form>
  );
}
