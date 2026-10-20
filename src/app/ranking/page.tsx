import { refreshRanksAction, saveRankInputsAction, saveRankSettingsAction } from "@/app/growth-actions";
import { PortalFrame } from "@/components/portal-frame";
import { RANK_FIELDS, inputsFor, leaderboard, rankHistory, rankSettings } from "@/lib/creator-rank";
import { loadPortal } from "@/lib/current-user";

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ creator?: string; saved?: string; growthError?: string }> }) {
  const params = await searchParams;
  const portal = await loadPortal(params.creator ?? null);
  const board = await leaderboard(portal.db, portal.viewer);
  if (!board.ok) {
    return (
      <PortalFrame viewer={portal.viewer} tab="ranking" creators={portal.creators} viewedId={portal.viewedId} hello={<h1>Ranking</h1>}>
        <p className="note">{board.error}</p>
      </PortalFrame>
    );
  }
  const settings = await rankSettings(portal.db);
  const creatorId = portal.viewed?.id ?? board.rows[0]?.creatorId ?? "";
  const inputs = creatorId ? await inputsFor(portal.db, creatorId) : null;
  const history = creatorId ? await rankHistory(portal.db, portal.viewer, creatorId) : null;
  return (
    <PortalFrame
      viewer={portal.viewer}
      tab="ranking"
      creators={portal.creators}
      viewedId={portal.viewedId}
      hello={<div className="hello"><div><h1>Ranking</h1><p>A 0 to 100 score for who should see the best-fit deals first. Only your sign-in can see this.</p></div></div>}
    >
      {params.saved ? <p className="note">Saved. Nothing was emailed.</p> : null}
      {params.growthError ? <p className="private-note">{params.growthError}</p> : null}
      <div className="card">
        <div className="sec-title">Leaderboard</div>
        <p className="note">Updates {settings.cadence}. Fit still decides who can take a campaign. Rank only sorts the creators who clear that gate.</p>
        {board.rows.length === 0 ? <p className="note">No ranks yet. Nothing is emailed.</p> : null}
        <table>
          <thead><tr><th>Rank</th><th>Creator</th><th>Score</th><th>Tier</th></tr></thead>
          <tbody>
            {board.rows.map((row) => (
              <tr key={row.creatorId}>
                <td>{row.rank ?? "—"}</td>
                <td>{row.name}</td>
                <td>{row.score}</td>
                <td>{row.tier}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={refreshRanksAction}><button className="btn" type="submit">Update ranks</button></form>
      </div>
      {history?.ok && history.rows.length ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="sec-title">History</div>
          {history.rows.map((row) => <p key={row.recordedOn}>{row.recordedOn}: {row.score} · {row.tier} · rank {row.rank}</p>)}
        </div>
      ) : null}
      {inputs ? (
        <form action={saveRankInputsAction} className="card stack" style={{ marginTop: 14 }}>
          <input type="hidden" name="creatorId" value={creatorId} />
          <div className="sec-title">Inputs for {portal.viewed?.name ?? "this creator"}</div>
          {RANK_FIELDS.map((field) => (
            <label key={field.id}>{field.label}<input name={field.id} defaultValue={inputs[field.id]} inputMode="decimal" /></label>
          ))}
          <button className="btn" type="submit">Save inputs</button>
        </form>
      ) : null}
      <form action={saveRankSettingsAction} className="card stack" style={{ marginTop: 14 }}>
        <div className="sec-title">Weights</div>
        {RANK_FIELDS.map((field) => (
          <label key={field.id}>{field.label}<input name={`weight-${field.id}`} defaultValue={settings.weights[field.id]} inputMode="decimal" /></label>
        ))}
        <label>
          How often
          <select name="cadence" defaultValue={settings.cadence}>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        <button className="btn" type="submit">Save weights</button>
      </form>
    </PortalFrame>
  );
}
