-- Seed the users table from accounts that already exist in the app's data (no data is removed).
-- Catalog store keys that aren't `id<telegram id>` are the owner's @username.
INSERT INTO "users" ("telegram_user_id", "username", "first_seen_at", "last_seen_at")
SELECT u.telegram_user_id,
       COALESCE((SELECT p.store_key FROM "places" p WHERE p.telegram_user_id = u.telegram_user_id AND p.store_key NOT LIKE 'id%' ORDER BY p.created_at DESC LIMIT 1), ''),
       MIN(u.created_at),
       MAX(u.created_at)
FROM (
  SELECT telegram_user_id, created_at FROM "ads"
  UNION ALL SELECT telegram_user_id, created_at FROM "places"
  UNION ALL SELECT telegram_user_id, created_at FROM "cart_items"
  UNION ALL SELECT telegram_user_id, created_at FROM "topup_orders"
) u
GROUP BY u.telegram_user_id
ON CONFLICT ("telegram_user_id") DO NOTHING;
