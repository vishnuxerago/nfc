import { randomId, randomToken, sha256Hex } from "../_lib/crypto.js";
import { audit, normalizeIndianMobile } from "../_lib/db.js";
import { clientIp, error, json, readJson } from "../_lib/http.js";
import { hitRateLimit } from "../_lib/rateLimit.js";

const TOKEN_TTL_MS = 5 * 60 * 1000;

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return error("Database not configured", 500);

  const business = String(env.BUSINESS_WA_E164 || "").replace(/\D/g, "");
  if (!business) {
    return error("BUSINESS_WA_E164 is not configured", 500);
  }

  const body = await readJson(request);
  const mobileInfo = normalizeIndianMobile(body?.mobile);
  if (!mobileInfo) {
    return error("Enter a valid 10-digit Indian mobile number");
  }

  const ip = clientIp(request);
  const ipLimit = await hitRateLimit(db, `ip:${ip}`, 10);
  if (!ipLimit.allowed) {
    return error("Too many attempts from this network. Try again later.", 429, {
      retryAfterSec: ipLimit.retryAfterSec,
    });
  }
  const mobileLimit = await hitRateLimit(db, `mobile:${mobileInfo.e164}`, 3);
  if (!mobileLimit.allowed) {
    return error("Too many attempts for this number. Try again later.", 429, {
      retryAfterSec: mobileLimit.retryAfterSec,
    });
  }

  const id = randomId();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + TOKEN_TTL_MS);

  await db
    .prepare(
      `INSERT INTO registrations
        (id, mobile, token_hash, status, created_at, expires_at)
       VALUES (?, ?, ?, 'awaiting_admin', ?, ?)`
    )
    .bind(id, mobileInfo.e164, tokenHash, createdAt.toISOString(), expiresAt.toISOString())
    .run();

  await audit(db, {
    registrationId: id,
    action: "created",
    actor: "system",
    meta: { mobile: mobileInfo.e164, ip },
  });

  const message = [
    "VERIFY " + token,
    "Mobile: " + mobileInfo.local,
    "ID: " + id,
  ].join("\n");

  const waLink = `https://wa.me/${business}?text=${encodeURIComponent(message)}`;

  return json({
    ok: true,
    registrationId: id,
    mobile: mobileInfo.display,
    token,
    expiresAt: expiresAt.toISOString(),
    waLink,
    note: "Send the WhatsApp message, then wait for admin approval. Entering a number alone does not verify you.",
  });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return error("Method not allowed", 405);
  }
  return onRequestPost(context);
}
