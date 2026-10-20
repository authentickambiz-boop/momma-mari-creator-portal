-- Owner mark for a contracted creator. This does not change any existing deal row.
-- MariClare's KOSBLING deal is left exactly as it is.

ALTER TABLE creators ADD COLUMN contracted INTEGER NOT NULL DEFAULT 0;
