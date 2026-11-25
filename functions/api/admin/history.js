import { requireAdmin } from "../../_lib/auth.js";
import { error, json } from "../../_lib/http.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return error(auth.error, 401);

  const db = env.DB;
  if (!db) return error("Database not configured", 500);

  const rows = await db
    .prepare(
      `SELECT id, registration_id, action, actor, meta, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT 300`
    )
    .all();

  return json({
    ok: true,
    history: (rows.results || []).map((r) => ({
      id: r.id,
      registrationId: r.registration_id,
      action: r.action,
      actor: r.actor,
      meta: r.meta ? JSON.parse(r.meta) : null,
      createdAt: r.created_at,
    })),
  });
}

export async function onRequest(context) {
  if (context.request.method !== "GET") return error("Method not allowed", 405);
  return onRequestGet(context);
}
