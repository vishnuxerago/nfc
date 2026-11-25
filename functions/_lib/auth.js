import { createSessionToken, sha256Hex, timingSafeEqualHex, verifySessionToken } from "./crypto.js";

const COOKIE = "nfc_admin_session";

export function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

export async function checkAdminPassword(env, password) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected || !password) return false;
  const a = await sha256Hex(String(password));
  const b = await sha256Hex(String(expected));
  return timingSafeEqualHex(a, b);
}

export async function requireAdmin(request, env) {
  const secret = env.SESSION_SECRET;
  if (!secret) return { ok: false, error: "SESSION_SECRET not configured" };
  const cookies = parseCookies(request);
  const token = cookies[COOKIE];
  const valid = await verifySessionToken(secret, token);
  if (!valid) return { ok: false, error: "Unauthorized" };
  return { ok: true };
}

export async function issueSessionCookie(env, request) {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not configured");
  const token = await createSessionToken(secret);
  const secure = request ? new URL(request.url).protocol === "https:" : true;
  const securePart = secure ? " Secure;" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly;${securePart} SameSite=Lax; Max-Age=${60 * 60 * 12}`;
}

export function clearSessionCookie(request) {
  const secure = request ? new URL(request.url).protocol === "https:" : true;
  const securePart = secure ? " Secure;" : "";
  return `${COOKIE}=; Path=/; HttpOnly;${securePart} SameSite=Lax; Max-Age=0`;
}
