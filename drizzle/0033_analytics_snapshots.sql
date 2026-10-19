-- July snapshots captured 2026-10-19. One row per creator per platform.
-- This does not change any existing deal row. MariClare's KOSBLING deal is left exactly as it is.
-- Values are July's own labels. A metric July did not display is omitted. Abby's Instagram saves are NULL, not -1.

CREATE TABLE analytics_snapshots (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  captured_on TEXT NOT NULL,
  source TEXT NOT NULL,
  period_key TEXT NOT NULL DEFAULT '',
  period TEXT,
  handle TEXT,
  benchmark TEXT,
  updated_label TEXT,
  channel_name TEXT,
  total_audience TEXT,
  largest_platform TEXT,
  location TEXT,
  metrics_json TEXT NOT NULL,
  audience_json TEXT,
  clips_json TEXT,
  revenue_cents INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX analytics_snapshot_key ON analytics_snapshots (creator_id, platform, captured_on, period_key);

INSERT INTO analytics_snapshots (
  id, creator_id, platform, captured_on, source, period_key, period, handle, benchmark, updated_label, channel_name,
  total_audience, largest_platform, location, metrics_json, audience_json, clips_json, revenue_cents, created_at, updated_at
) VALUES
  ('snap-mariclare-instagram-2026-10-19-past30d', 'mariclare', 'Instagram', '2026-10-19', 'July', 'Past 30d', 'Past 30d', '@_mariclaremaclamroc_', 'Above average performance', NULL, NULL, '2,643,404', 'TikTok', 'North Carolina, USA', '{"engagement":"3.57%","similarCreators":"1.75%","followers":"326k","views":"3m","reach":"1.2m","likes":"94.8k","comments":"802","shares":"2,832","saves":"5,769","totalInteractions":"108k","avgStoryViews":"8,533"}', '{"gender":["Female 79%","Male 21%"],"age":["13-17 12.3%","18-24 40.5%","25-34 31.0%","35-44 10.1%","45+ 6.2%"],"country":["USA 52.4%","India 10.2%","UK 5.0%","Canada 3.2%","Other 29.2%"],"city":["New York NY 9.2%","Delhi 4.0%","Semnan 3.9%","Philadelphia PA 3.7%","Other 79.2%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-mariclare-tiktok-2026-10-19', 'mariclare', 'TikTok', '2026-10-19', 'July', '', NULL, '@_mariclaremaclamroc_', 'Above average performance', 'updated 3 hours ago', NULL, '2,643,404', 'TikTok', 'North Carolina, USA', '{"engagement":"6.76%","similarCreators":"1.35%","followers":"2.3m","avgLikes":"16.3k","avgComments":"115","avgViews":"245k","avgShares":"107"}', '{"gender":["Female 86%","Male 14%"],"age":["13-17 10.2%","18-24 69.6%","25-34 17.6%","35-44 2.0%","45+ 0.7%"],"country":["USA 63.4%","Canada 6.2%","UK 5.4%","Philippines 5.0%","Other 20.0%"]}', '["24K likes/208K views","31.5K/409K","1,658/38.8K","3,974/…"]', NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-mariclare-youtube-2026-10-19', 'mariclare', 'YouTube', '2026-10-19', 'July', '', NULL, NULL, 'Above average performance', 'updated 8 hours ago', 'MariClare X Scarlett', '2,643,404', 'TikTok', 'North Carolina, USA', '{"engagement":"5.19%","similarCreators":"2%","subscribers":"9,630","totalViews":"1m","longForm":{"avgViews":"9,695","avgLikes":"493","avgComments":"10"},"shorts":{"avgViews":"10.8k","avgLikes":"610"}}', '{"gender":["Female 90%","Male 10%"],"age":["13-17 18.9%","18-24 24.9%","25-34 35.2%","35-44 13.1%","45+ 7.9%"],"country":["USA 51.4%","India 9.1%","Poland 5.0%","UK 4.9%","Other 29.7%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-mariclare-twitch-2026-10-19-past90d', 'mariclare', 'Twitch', '2026-10-19', 'July', 'Past 90d', 'Past 90d', NULL, NULL, 'updated a day ago', 'MariClareMacLamroc', '2,643,404', 'TikTok', 'North Carolina, USA', '{"followers":"462"}', NULL, NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-authentickam-instagram-2026-10-19-past30d', 'authentickam', 'Instagram', '2026-10-19', 'July', 'Past 30d', 'Past 30d', '@authentickam', NULL, 'updated 10 hours ago', NULL, '193,956', 'TikTok', 'North Carolina, USA', '{"followers":"15.8k","engagement":"1.57%","views":"21.7k","reach":"6,189","likes":"298","comments":"10","shares":"2","saves":"15","totalInteractions":"342","avgPostLikes":"91","avgPostComments":"4","avgStoryViews":"731"}', '{"gender":["Female 85%","Male 15%"],"age":["13-17 9.4%","18-24 47.7%","25-34 29.3%","35-44 9.0%","45+ 4.6%"],"country":["USA 75.0%","UK 4.9%","Canada 4.3%","Australia 2.6%","Other 13.2%"],"city":["New York NY 8.9%","Charlotte NC 5.2%","Houston TX 4.7%","Philadelphia PA 4.6%","Other 76.6%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-authentickam-tiktok-2026-10-19', 'authentickam', 'TikTok', '2026-10-19', 'July', '', NULL, '@authentickam', NULL, 'updated a few seconds ago', NULL, '193,956', 'TikTok', 'North Carolina, USA', '{"followers":"178k","avgLikes":"3,731","engagement":"6.46%","avgComments":"34","avgViews":"58.6k","avgShares":"18"}', '{"gender":["Female 88%","Male 12%"],"age":["13-17 10.5%","18-24 70.2%","25-34 15.5%","35-44 2.6%","45+ 1.2%"],"country":["USA 71.9%","Canada 10.5%","UK 4.6%","Australia 4.1%","Other 8.8%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-authentickam-youtube-2026-10-19', 'authentickam', 'YouTube', '2026-10-19', 'July', '', NULL, NULL, 'Above average performance', 'updated 10 hours ago', 'AuthenticKam', '193,956', 'TikTok', 'North Carolina, USA', '{"engagement":"4.91%","similarCreators":"2%","subscribers":"653","totalViews":"6,419","longForm":{"avgViews":"133","avgLikes":"5","avgComments":"2"},"shorts":{"avgViews":"769","avgLikes":"7"}}', '{"gender":["Female 60%","Male 40%"],"age":["13-17 14.9%","18-24 3.3%","25-34 36.0%","35-44 31.9%","45+ 13.9%"],"country":["USA 95.6%","UK 2.5%","Australia 1.1%","Philippines 0.8%","Other 0.0%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-authentickam-facebook-2026-10-19', 'authentickam', 'Facebook', '2026-10-19', 'July', '', NULL, NULL, NULL, 'updated 10 hours ago', NULL, '193,956', 'TikTok', 'North Carolina, USA', '{"followers":"2","pageLikes":"2"}', NULL, NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-abby-instagram-2026-10-19-past30d', 'abby', 'Instagram', '2026-10-19', 'July', 'Past 30d', 'Past 30d', '@theofficialtheriots', NULL, 'updated 10 hours ago', NULL, '110,371', 'TikTok', 'Lifestyle', '{"followers":"1,728","engagement":"1.57%","views":"3,429","reach":"411","likes":"53","shares":"1","saves":null,"totalInteractions":"54","avgPostLikes":"26"}', '{"gender":["Female 76%","Male 24%"],"age":["13-17 2.3%","18-24 32.4%","25-34 38.2%","35-44 15.8%","45+ 11.3%"],"country":["USA 78.4%","UK 4.2%","Canada 3.0%","Australia 1.8%","Other 12.6%"],"city":["Oklahoma City OK 5.7%","Houston TX 5.3%","Cordell OK 4.3%","Guthrie OK 4.3%","Other 80.4%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-abby-tiktok-2026-10-19', 'abby', 'TikTok', '2026-10-19', 'July', '', NULL, NULL, NULL, 'updated a few seconds ago', NULL, '110,371', 'TikTok', 'Lifestyle', '{"followers":"78.8k","avgLikes":"385","engagement":"6.39%","avgComments":"11","avgViews":"6,237","avgShares":"3"}', '{"gender":["Female 85%","Male 15%"],"age":["13-17 10.4%","18-24 57.4%","25-34 21.5%","35-44 6.9%","45+ 3.8%"],"country":["USA 87.8%","Nigeria 5.5%","Canada 3.0%","UK 1.6%","Other 2.1%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z'),
  ('snap-abby-facebook-2026-10-19', 'abby', 'Facebook', '2026-10-19', 'July', '', NULL, NULL, NULL, 'updated 10 hours ago', NULL, '110,371', 'TikTok', 'Lifestyle', '{"followers":"29.8k","engagement":"0.04%","pageLikes":"29.8k","avgLikes":"8","avgReactions":"10","avgShares":"1","avgComments":"1","impressions":"68.7k"}', '{"country":["USA 83.6%","Canada 4.8%","UK 3.8%","Australia 2.2%","Other 5.7%"]}', NULL, NULL, '2026-10-19T16:00:00.000Z', '2026-10-19T16:00:00.000Z');
