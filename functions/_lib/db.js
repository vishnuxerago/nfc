import { randomId } from "./crypto.js";

export function normalizeIndianMobile(input) {
  const digits = String(input || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("91") && local.length === 12) local = local.slice(2);
  if (local.startsWith("0") && local.length === 11) local = local.slice(1);
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return {
    local,
    e164: `91${local}`,
    display: `+91${local}`,
  };
}

export async function audit(db, { registrationId = null, action, actor, meta = null }) {
  await db
    .prepare(
      `INSERT INTO audit_log (id, registration_id, action, actor, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      randomId(),
      registrationId,
      action,
      actor,
      meta ? JSON.stringify(meta) : null,
      new Date().toISOString()
    )
    .run();
}

/**
 * Modular verification hook — v1 uses source "admin".
 * Future WhatsApp Cloud API can call the same function with source "whatsapp_cloud_api".
 */
export async function markVerified(db, registrationId, evidence) {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE registrations
       SET status = 'verified', verified_at = ?, consumed_at = ?
       WHERE id = ? AND status IN ('pending', 'awaiting_admin')`
    )
    .bind(now, now, registrationId)
    .run();

  if (!result.meta?.changes) {
    return { ok: false, error: "Registration not found or already finalized" };
  }

  await audit(db, {
    registrationId,
    action: "approved",
    actor: evidence?.source === "whatsapp_cloud_api" ? "whatsapp_cloud_api" : "admin",
    meta: evidence || { source: "admin" },
  });

  return { ok: true, verifiedAt: now };
}

export async function expireIfNeeded(db, row) {
  if (!row) return row;
  if (row.status === "verified" || row.status === "rejected" || row.status === "expired") {
    return row;
  }
  if (new Date(row.expires_at).getTime() > Date.now()) return row;

  await db
    .prepare(
      `UPDATE registrations
       SET status = 'expired', consumed_at = COALESCE(consumed_at, ?)
       WHERE id = ? AND status IN ('pending', 'awaiting_admin')`
    )
    .bind(new Date().toISOString(), row.id)
    .run();

  await audit(db, {
    registrationId: row.id,
    action: "expired",
    actor: "system",
  });

  return { ...row, status: "expired" };
}
