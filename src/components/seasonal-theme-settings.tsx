import { saveSeasonalThemeAction } from "@/app/theme-actions";
import { SEASONAL_THEMES } from "@/lib/seasonal-theme";
import { loadSeasonalPresentation } from "@/lib/seasonal-theme-request";

export async function SeasonalThemeSettings() {
  const { override } = await loadSeasonalPresentation();
  return (
    <form action={saveSeasonalThemeAction} className="card stack" style={{ marginTop: 14 }}>
      <div className="sec-title">Seasonal theme</div>
      <p className="note">
        The public calendar follows Eastern Time. Halloween runs through November 1, 2026.
        The other seasons are drafted and stay off. Open any page with ?mm_preview=thanksgiving
        (hanukkah, christmas, new-year, valentines, st-patricks, easter, mothers-day, fathers-day,
        summer, or back-to-school) to look. That link does not change the site for anyone else.
      </p>
      <label htmlFor="seasonal-theme">Theme</label>
      <select id="seasonal-theme" name="theme" defaultValue={override}>
        <option value="auto">Follow the calendar</option>
        <option value="none">None</option>
        {SEASONAL_THEMES.filter((theme) => !theme.preview).map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>
      <button className="btn" type="submit">Save theme</button>
    </form>
  );
}
