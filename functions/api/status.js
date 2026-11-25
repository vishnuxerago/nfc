import { expireIfNeeded } from "../_lib/db.js";
import { error, json } from "../_lib/http.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return error("Database not configured", 500);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !/^[a-f0-9]{32}$/i.test(id)) {
    return error("Missing or invalid registration id");
  }

  let row = await db
    .prepare(
      `SELECT id, mobile, status, created_at, expires_at, verified_at, rejected_at, reject_reason
       FROM registrations WHERE id = ?`
    )
    .bind(id)
    .first();

  if (!row) return error("Registration not found", 404);

  row = await expireIfNeeded(db, row);

  return json({
    ok: true,
    registrationId: row.id,
    mobile: row.mobile ? `+${row.mobile}` : null,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    rejectedAt: row.rejected_at,
    rejectReason: row.reject_reason,
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return error("Method not allowed", 405);
  }
  return onRequestGet(context);
}
