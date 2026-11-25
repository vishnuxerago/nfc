const WINDOW_MS = 15 * 60 * 1000;

export async function hitRateLimit(db, key, max) {
  const now = Date.now();
  const row = await db
    .prepare(`SELECT key, window_start, count FROM rate_limits WHERE key = ?`)
    .bind(key)
    .first();

  if (!row) {
    await db
      .prepare(`INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)`)
      .bind(key, new Date(now).toISOString())
      .run();
    return { allowed: true, remaining: max - 1 };
  }

  const start = new Date(row.window_start).getTime();
  if (now - start > WINDOW_MS) {
    await db
      .prepare(`UPDATE rate_limits SET window_start = ?, count = 1 WHERE key = ?`)
      .bind(new Date(now).toISOString(), key)
      .run();
    return { allowed: true, remaining: max - 1 };
  }

  if (row.count >= max) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((WINDOW_MS - (now - start)) / 1000) };
  }

  await db
    .prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`)
    .bind(key)
    .run();

  return { allowed: true, remaining: max - row.count - 1 };
}
