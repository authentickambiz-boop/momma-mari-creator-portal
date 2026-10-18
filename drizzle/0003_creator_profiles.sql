-- Fill in the two placeholder creators with what Momma Mari actually knows (Oct 17, 2026).
-- Applied once on databases that already ran 0000-0002. Does not touch MariClare, deals, or payments.
--
-- Revenue splits stay NULL until the contracts are uploaded. Drive folders stay NULL
-- (uploads fall back to GOOGLE_DRIVE_ROOT_FOLDER_ID until each creator gets a folder).
-- Social connections stay 'disconnected' until Zernio links them.
--
-- Handles were checked against the public TikTok profiles on Oct 17, 2026:
--   @authentickam         177.6K followers, bio lists authentickambiz@gmail.com
--   @theofficialtheriots  78.8K followers, display name "Abby Theriot"
-- Follower counts are not stored here; the analytics bot writes real numbers to analytics_daily.

-- AuthenticKam: Kamron's own stay-at-home-dad creator brand.
-- authentickambiz@gmail.com is his real inbox and portal sign-in. It is also in ADMIN_EMAILS,
-- and admin wins at sign-in, so Kamron sees the admin view and opens AuthenticKam with the creator switcher.
UPDATE creators
SET
  email = 'authentickambiz@gmail.com',
  handles = '@authentickam',
  kids_ages = '5',
  monthly_goal_cents = 500000,
  split_percent = NULL,
  is_seed = 0
WHERE id = 'authentickam';

-- Abby Theriot: parent creator, daughter about 4-5.
-- Her portal sign-in email is NOT confirmed yet. The placeholder below uses the reserved
-- .invalid TLD (RFC 2606), so no Google account can ever have it, and resolveLogin also refuses
-- any *.invalid address. Replace it with PUT /api/bot/creators (or a follow-up migration) once Kamron confirms.
UPDATE creators
SET
  email = 'abby.pending-signin@momma-mari.invalid',
  handles = '@theofficialtheriots',
  kids_ages = 'Daughter, about 4-5',
  monthly_goal_cents = 500000,
  split_percent = NULL,
  is_seed = 0
WHERE id = 'abby';
