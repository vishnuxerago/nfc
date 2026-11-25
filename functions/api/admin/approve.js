import { requireAdmin } from "../../_lib/auth.js";
import { sha256Hex, timingSafeEqualHex } from "../../_lib/crypto.js";
import { expireIfNeeded, markVerified } from "../../_lib/db.js";
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
  if (row.status === "verified") return error("Already verified");
  if (row.status === "rejected") return error("Already rejected");

  if (body?.token) {
    const hash = await sha256Hex(String(body.token).trim());
    const match = await timingSafeEqualHex(hash, row.token_hash);
    if (!match) return error("Token does not match this registration", 403);
  }

  const result = await markVerified(db, id, {
    source: "admin",
    confirmedSenderMatch: true,
    tokenChecked: Boolean(body?.token),
  });

  if (!result.ok) return error(result.error, 409);
  return json({ ok: true, verifiedAt: result.verifiedAt });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return error("Method not allowed", 405);
  return onRequestPost(context);
}
