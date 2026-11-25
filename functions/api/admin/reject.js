import { requireAdmin } from "../../_lib/auth.js";
import { audit, expireIfNeeded } from "../../_lib/db.js";
import { error, json, readJson } from "../../_lib/http.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return error(auth.error, 401);

  const db = env.DB;
  if (!db) return error("Database not configured", 500);

  const body = await readJson(request);
  const id = body?.id;
  if (!id) return error("Missing registration id");

  let row = await db
    .prepare(`SELECT * FROM registrations WHERE id = ?`)
    .bind(id)
    .first();
  if (!row) return error("Registration not found", 404);

  row = await expireIfNeeded(db, row);
  if (row.status === "expired") return error("Token expired", 410);
  if (row.status === "verified" || row.status === "rejected") {
    return error("Already finalized");
  }

  const now = new Date().toISOString();
  const reason = String(body?.reason || "").slice(0, 300);

  await db
    .prepare(
      `UPDATE registrations
       SET status = 'rejected', rejected_at = ?, reject_reason = ?, consumed_at = ?
       WHERE id = ?`
    )
    .bind(now, reason || null, now, id)
    .run();

  await audit(db, {
    registrationId: id,
    action: "rejected",
    actor: "admin",
    meta: { reason: reason || null },
  });

  return json({ ok: true, rejectedAt: now });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return error("Method not allowed", 405);
  return onRequestPost(context);
}
