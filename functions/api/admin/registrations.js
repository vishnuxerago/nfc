import { requireAdmin } from "../../_lib/auth.js";
import { expireIfNeeded } from "../../_lib/db.js";
import { error, json } from "../../_lib/http.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return error(auth.error, 401);

  const db = env.DB;
  if (!db) return error("Database not configured", 500);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "awaiting_admin";
  const allowed = new Set(["awaiting_admin", "pending", "verified", "rejected", "expired", "all"]);
  if (!allowed.has(status)) return error("Invalid status filter");

  let rows;
  if (status === "all") {
    rows = await db
      .prepare(
        `SELECT id, mobile, status, created_at, expires_at, verified_at, rejected_at, reject_reason
         FROM registrations
         ORDER BY created_at DESC
         LIMIT 200`
      )
      .all();
  } else {
    rows = await db
      .prepare(
        `SELECT id, mobile, status, created_at, expires_at, verified_at, rejected_at, reject_reason
         FROM registrations
         WHERE status = ?
         ORDER BY created_at DESC
         LIMIT 200`
      )
      .bind(status)
      .all();
  }

  const list = [];
  for (const row of rows.results || []) {
    const fresh = await expireIfNeeded(db, row);
    if (status !== "all" && fresh.status !== status && status !== "expired") {
      // skip rows that just flipped to expired when filtering another status
      if (fresh.status === "expired" && status !== "expired") continue;
    }
    list.push({
      id: fresh.id,
      mobile: `+${fresh.mobile}`,
      status: fresh.status,
      createdAt: fresh.created_at,
      expiresAt: fresh.expires_at,
      verifiedAt: fresh.verified_at,
      rejectedAt: fresh.rejected_at,
      rejectReason: fresh.reject_reason,
    });
  }

  return json({ ok: true, registrations: list });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") return error("Method not allowed", 405);
  return onRequestGet(context);
}
