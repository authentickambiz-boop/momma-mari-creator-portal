-- Remove Kamron's Oct 18 test uploads from MariClare's VEV Gummies deal.
DELETE FROM drafts
WHERE deal_id = 'vev'
  AND is_seed = 0
  AND filename IN (
    'v1-8c32bfb9f7f34c31bfac6d7abf16b805.mov',
    'v2-8c32bfb9f7f34c31bfac6d7abf16b805.mov'
  );
