import { clearSessionCookie } from "../../_lib/auth.js";
import { error, json } from "../../_lib/http.js";

export async function onRequestPost(context) {
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(context.request) });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return error("Method not allowed", 405);
  return onRequestPost(context);
}
