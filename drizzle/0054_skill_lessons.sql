-- Lessons for the Learn page. A blank creator_id means every creator.
-- This does not change any deal, payment, contract, or creator row.

CREATE TABLE skill_lessons (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  creator_id TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO skill_lessons (id, topic, title, body, creator_id, created_by, updated_by, created_at, updated_at) VALUES
(
  'starter-hooks',
  'hooks',
  'Start with the part they came for',
  'The first second is the promise. Show the mess, the result, or the question before you explain anything.

Say it the way you would to a friend in the kitchen. A hook is a sentence, not a slogan.

If you would skip it, they will too. Film the hook again after you know how the story ends.',
  NULL,
  'seed',
  'seed',
  '2026-10-21T12:00:00.000Z',
  '2026-10-21T12:00:00.000Z'
),
(
  'starter-filming',
  'filming',
  'Film in the light you already have',
  'A window and a steady phone beat a dark room. Face the light. Hold the phone near your eyes so it feels like you are looking at them.

Leave a little extra at the start and the end. The edit needs room to breathe.

Talk to one person. One honest take is better than five stiff ones.',
  NULL,
  'seed',
  'seed',
  '2026-10-21T12:00:00.000Z',
  '2026-10-21T12:00:00.000Z'
),
(
  'starter-editing',
  'editing',
  'Cut until it feels easy to watch',
  'Take out the pause before the point. The viewer should land on the thing you meant.

Captions help when the sound is off. Keep each line short enough to read while the clip moves.

Watch it once with the sound off. If the story still makes sense, you are close.',
  NULL,
  'seed',
  'seed',
  '2026-10-21T12:00:00.000Z',
  '2026-10-21T12:00:00.000Z'
),
(
  'starter-posting',
  'posting',
  'Put it where you said it would go',
  'Post on the day you promised. If the day slips, tell Kamron before the brand has to ask.

The caption is the second hook. The first line should make sense on its own.

A brand post needs a clear paid-partnership label where a viewer can see it.',
  NULL,
  'seed',
  'seed',
  '2026-10-21T12:00:00.000Z',
  '2026-10-21T12:00:00.000Z'
),
(
  'starter-growth',
  'growth',
  'Stay with the people who stay',
  'Reply to the comments that took time. That is the part of growth you can do today.

One series you can repeat beats a brand-new idea every morning. Keep the format when people stay for it.

A save or a share tells you more than a view that scrolled past.',
  NULL,
  'seed',
  'seed',
  '2026-10-21T12:00:00.000Z',
  '2026-10-21T12:00:00.000Z'
),
(
  'starter-ugc',
  'ugc',
  'Make the ad in your own voice',
  'UGC is a clip a brand can use as an ad. You are still you. You are not putting on a new personality to read a script.

Show the product in a real moment: the problem, the use, and what changed. Hold it still long enough to see it.

Send the clean file, the caption, and the disclosure. Where the brand can use the clip lives in the agreement, not in a guess.',
  NULL,
  'seed',
  'seed',
  '2026-10-21T12:00:00.000Z',
  '2026-10-21T12:00:00.000Z'
);
