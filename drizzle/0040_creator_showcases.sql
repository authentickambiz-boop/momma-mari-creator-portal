-- Public Meet Our Creators cards. Only rows the owner marks public_on show on the page.
-- Photos are adult creator portraits already used on mommamari.com. No children's faces.

CREATE TABLE creator_showcases (
  creator_id TEXT PRIMARY KEY,
  public_on INTEGER NOT NULL DEFAULT 0,
  bio TEXT,
  photo_path TEXT,
  updated_at TEXT NOT NULL
);

INSERT INTO creator_showcases (creator_id, public_on, bio, photo_path, updated_at) VALUES
  ('mariclare', 1, 'Mom in North Carolina. Lifestyle, home, and family content.', '/creators/mariclare.jpg', '2026-10-19T16:00:00.000Z'),
  ('authentickam', 1, 'Stay-at-home dad in North Carolina.', '/creators/authentickam.jpg', '2026-10-19T16:00:00.000Z'),
  ('abby', 1, 'Mom sharing lifestyle content.', '/creators/abby-theriot.jpg', '2026-10-19T16:00:00.000Z');
