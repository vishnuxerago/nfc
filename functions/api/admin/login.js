import { checkAdminPassword, issueSessionCookie } from "../../_lib/auth.js";
import { audit } from "../../_lib/db.js";
import { clientIp, error, json, readJson } from "../../_lib/http.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const password = body?.password;

  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return error("Admin auth is not configured on the server", 500);
  }

  const ok = await checkAdminPassword(env, password);
  if (!ok) {
    if (env.DB) {
      await audit(env.DB, {
        action: "login_fail",
        actor: "admin",
        meta: { ip: clientIp(request) },
      });
    }
    return error("Invalid password", 401);
  }

  const cookie = await issueSessionCookie(env, request);
  return json({ ok: true }, 200, { "set-cookie": cookie });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return error("Method not allowed", 405);
  return onRequestPost(context);
}
