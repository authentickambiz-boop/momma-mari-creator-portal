-- Display name only. The creator id, email, Instagram handle, and Drive folder id stay as they are.
-- Applied once on databases that already ran 0000_schema.sql and 0001_seed.sql.

UPDATE creators
SET name = 'MariClare'
WHERE id = 'mariclare';

UPDATE deals
SET
  kamron_notes = REPLACE(kamron_notes, 'Mariclare', 'MariClare'),
  next_step = REPLACE(next_step, 'Mariclare', 'MariClare'),
  bot_message = REPLACE(bot_message, 'Mariclare', 'MariClare'),
  deliverables_json = REPLACE(deliverables_json, 'Mariclare', 'MariClare')
WHERE kamron_notes GLOB '*Mariclare*'
   OR next_step GLOB '*Mariclare*'
   OR bot_message GLOB '*Mariclare*'
   OR deliverables_json GLOB '*Mariclare*';

UPDATE revisions
SET summary = REPLACE(summary, 'Mariclare', 'MariClare')
WHERE summary GLOB '*Mariclare*';
