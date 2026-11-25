/**
 * Free WhatsApp verification backend (Google Apps Script + Sheet).
 *
 * SETUP:
 * 1. Create a Google Sheet. First tab name: Registrations
 *    Headers row 1: id | mobile | token_hash | status | created_at | expires_at | verified_at | rejected_at | reject_reason
 * 2. Add a second tab: Audit
 *    Headers: id | registration_id | action | actor | meta | created_at
 * 3. Extensions → Apps Script → paste THIS file → Save
 * 4. Project Settings (gear) → Script properties → Add:
 *      BUSINESS_WA_E164 = 9198XXXXXXXX   (digits only, India = 91 + 10 digits)
 *      ADMIN_PASSWORD  = your-strong-password
 * 5. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Copy the /exec URL into index.html and admin.html (APPS_SCRIPT_URL)
 *
 * Frontend sends POST with Content-Type: text/plain and JSON body:
 *   { "action": "register"|"status"|"adminLogin"|"adminList"|"approve"|"reject"|"history", ... }
 */

var TOKEN_TTL_MS = 5 * 60 * 1000;
var RATE_WINDOW_MS = 15 * 60 * 1000;
var MAX_PER_MOBILE = 3;
var MAX_PER_IP = 10;
var ADMIN_TOKEN_TTL_SEC = 12 * 60 * 60;

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = String(data.action || "");
    var result;

    if (action === "register") result = actionRegister(data, e);
    else if (action === "status") result = actionStatus(data);
    else if (action === "adminLogin") result = actionAdminLogin(data);
    else if (action === "adminList") result = actionAdminList(data);
    else if (action === "approve") result = actionApprove(data);
    else if (action === "reject") result = actionReject(data);
    else if (action === "history") result = actionHistory(data);
    else result = { ok: false, error: "Unknown action" };

    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({
    ok: true,
    message: "WhatsApp verify API is live. Use POST with action.",
  });
}

/* ---------- actions ---------- */

function actionRegister(data, e) {
  var mobileInfo = normalizeIndianMobile_(data.mobile);
  if (!mobileInfo) return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };

  var business = String(props_().getProperty("BUSINESS_WA_E164") || "").replace(/\D/g, "");
  if (!business) return { ok: false, error: "BUSINESS_WA_E164 is not set in Script properties" };

  var ip = clientIp_(e);
  var ipHit = hitRate_("ip:" + ip, MAX_PER_IP);
  if (!ipHit.allowed) {
    return { ok: false, error: "Too many attempts from this network. Try again later.", retryAfterSec: ipHit.retryAfterSec };
  }
  var mobileHit = hitRate_("mobile:" + mobileInfo.e164, MAX_PER_MOBILE);
  if (!mobileHit.allowed) {
    return { ok: false, error: "Too many attempts for this number. Try again later.", retryAfterSec: mobileHit.retryAfterSec };
  }

  var id = randomId_();
  var token = randomToken_();
  var tokenHash = sha256Hex_(token);
  var createdAt = new Date();
  var expiresAt = new Date(createdAt.getTime() + TOKEN_TTL_MS);

  sheetRegistrations_().appendRow([
    id,
    mobileInfo.e164,
    tokenHash,
    "awaiting_admin",
    createdAt.toISOString(),
    expiresAt.toISOString(),
    "",
    "",
    "",
  ]);

  audit_(id, "created", "system", { mobile: mobileInfo.e164, ip: ip });

  var message = ["VERIFY " + token, "Mobile: " + mobileInfo.local, "ID: " + id].join("\n");
  var waLink = "https://wa.me/" + business + "?text=" + encodeURIComponent(message);

  return {
    ok: true,
    registrationId: id,
    mobile: mobileInfo.display,
    token: token,
    expiresAt: expiresAt.toISOString(),
    waLink: waLink,
    note: "Send the WhatsApp message, then wait for admin approval.",
  };
}

function actionStatus(data) {
  var id = String(data.id || "");
  if (!/^[a-f0-9]{32}$/i.test(id)) return { ok: false, error: "Missing or invalid registration id" };

  var row = findRegistration_(id);
  if (!row) return { ok: false, error: "Registration not found" };

  row = expireIfNeeded_(row);

  return {
    ok: true,
    registrationId: row.id,
    mobile: "+" + row.mobile,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at || null,
    rejectedAt: row.rejected_at || null,
    rejectReason: row.reject_reason || null,
  };
}

function actionAdminLogin(data) {
  var expected = props_().getProperty("ADMIN_PASSWORD");
  if (!expected) return { ok: false, error: "ADMIN_PASSWORD is not set in Script properties" };
  if (String(data.password || "") !== String(expected)) {
    audit_("", "login_fail", "admin", {});
    return { ok: false, error: "Invalid password" };
  }
  var token = randomId_() + randomId_();
  CacheService.getScriptCache().put("admin:" + token, "1", ADMIN_TOKEN_TTL_SEC);
  return { ok: true, adminToken: token };
}

function actionAdminList(data) {
  if (!requireAdmin_(data.adminToken)) return { ok: false, error: "Unauthorized" };

  var status = String(data.status || "awaiting_admin");
  var allowed = { awaiting_admin: 1, pending: 1, verified: 1, rejected: 1, expired: 1, all: 1 };
  if (!allowed[status]) return { ok: false, error: "Invalid status filter" };

  var sheet = sheetRegistrations_();
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = rowFromValues_(values[i], i + 1);
    if (!row.id) continue;
    row = expireIfNeeded_(row);
    if (status !== "all" && row.status !== status) continue;
    out.push({
      id: row.id,
      mobile: "+" + row.mobile,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      verifiedAt: row.verified_at || null,
      rejectedAt: row.rejected_at || null,
      rejectReason: row.reject_reason || null,
    });
  }
  out.reverse();
  return { ok: true, registrations: out.slice(0, 200) };
}

function actionApprove(data) {
  if (!requireAdmin_(data.adminToken)) return { ok: false, error: "Unauthorized" };

  var id = String(data.id || "");
  var row = findRegistration_(id);
  if (!row) return { ok: false, error: "Registration not found" };
  row = expireIfNeeded_(row);

  if (row.status === "expired") return { ok: false, error: "Token expired" };
  if (row.status === "verified") return { ok: false, error: "Already verified" };
  if (row.status === "rejected") return { ok: false, error: "Already rejected" };

  if (data.token) {
    var hash = sha256Hex_(String(data.token).trim());
    if (hash !== row.token_hash) return { ok: false, error: "Token does not match this registration" };
  }

  var now = new Date().toISOString();
  var sheet = sheetRegistrations_();
  sheet.getRange(row.rowNumber, 4).setValue("verified");
  sheet.getRange(row.rowNumber, 7).setValue(now);
  sheet.getRange(row.rowNumber, 8).setValue("");
  sheet.getRange(row.rowNumber, 9).setValue("");

  audit_(id, "approved", "admin", { source: "admin", tokenChecked: !!data.token });
  return { ok: true, verifiedAt: now };
}

function actionReject(data) {
  if (!requireAdmin_(data.adminToken)) return { ok: false, error: "Unauthorized" };

  var id = String(data.id || "");
  var row = findRegistration_(id);
  if (!row) return { ok: false, error: "Registration not found" };
  row = expireIfNeeded_(row);

  if (row.status === "expired") return { ok: false, error: "Token expired" };
  if (row.status === "verified" || row.status === "rejected") return { ok: false, error: "Already finalized" };

  var now = new Date().toISOString();
  var reason = String(data.reason || "").slice(0, 300);
  var sheet = sheetRegistrations_();
  sheet.getRange(row.rowNumber, 4).setValue("rejected");
  sheet.getRange(row.rowNumber, 8).setValue(now);
  sheet.getRange(row.rowNumber, 9).setValue(reason);

  audit_(id, "rejected", "admin", { reason: reason || null });
  return { ok: true, rejectedAt: now };
}

function actionHistory(data) {
  if (!requireAdmin_(data.adminToken)) return { ok: false, error: "Unauthorized" };
  var sheet = sheetAudit_();
  var values = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r[0]) continue;
    var meta = null;
    try { meta = r[4] ? JSON.parse(r[4]) : null; } catch (e) { meta = r[4]; }
    out.push({
      id: r[0],
      registrationId: r[1] || null,
      action: r[2],
      actor: r[3],
      meta: meta,
      createdAt: r[5],
    });
  }
  out.reverse();
  return { ok: true, history: out.slice(0, 300) };
}

/* ---------- helpers ---------- */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function requireAdmin_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get("admin:" + token) === "1";
}

function sheetRegistrations_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Registrations");
  if (!sheet) {
    sheet = ss.insertSheet("Registrations");
    sheet.appendRow(["id", "mobile", "token_hash", "status", "created_at", "expires_at", "verified_at", "rejected_at", "reject_reason"]);
  }
  return sheet;
}

function sheetAudit_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Audit");
  if (!sheet) {
    sheet = ss.insertSheet("Audit");
    sheet.appendRow(["id", "registration_id", "action", "actor", "meta", "created_at"]);
  }
  return sheet;
}

function audit_(registrationId, action, actor, meta) {
  sheetAudit_().appendRow([
    randomId_(),
    registrationId || "",
    action,
    actor,
    meta ? JSON.stringify(meta) : "",
    new Date().toISOString(),
  ]);
}

function normalizeIndianMobile_(input) {
  var digits = String(input || "").replace(/\D/g, "");
  var local = digits;
  if (local.indexOf("91") === 0 && local.length === 12) local = local.slice(2);
  if (local.charAt(0) === "0" && local.length === 11) local = local.slice(1);
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return { local: local, e164: "91" + local, display: "+91" + local };
}

function randomId_() {
  var s = "";
  for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function randomToken_() {
  return randomId_();
}

function sha256Hex_(value) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  var out = "";
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    out += h.length === 1 ? "0" + h : h;
  }
  return out;
}

function clientIp_(e) {
  try {
    if (e && e.parameter && e.parameter.ip) return e.parameter.ip;
  } catch (err) {}
  return "unknown";
}

function hitRate_(key, max) {
  var cache = CacheService.getScriptCache();
  var raw = cache.get("rate:" + key);
  var now = Date.now();
  var obj = raw ? JSON.parse(raw) : null;
  if (!obj || now - obj.start > RATE_WINDOW_MS) {
    obj = { start: now, count: 1 };
    cache.put("rate:" + key, JSON.stringify(obj), Math.ceil(RATE_WINDOW_MS / 1000));
    return { allowed: true, remaining: max - 1 };
  }
  if (obj.count >= max) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((RATE_WINDOW_MS - (now - obj.start)) / 1000) };
  }
  obj.count += 1;
  cache.put("rate:" + key, JSON.stringify(obj), Math.ceil(RATE_WINDOW_MS / 1000));
  return { allowed: true, remaining: max - obj.count };
}

function rowFromValues_(r, rowNumber) {
  return {
    rowNumber: rowNumber,
    id: String(r[0] || ""),
    mobile: String(r[1] || ""),
    token_hash: String(r[2] || ""),
    status: String(r[3] || ""),
    created_at: String(r[4] || ""),
    expires_at: String(r[5] || ""),
    verified_at: String(r[6] || ""),
    rejected_at: String(r[7] || ""),
    reject_reason: String(r[8] || ""),
  };
}

function findRegistration_(id) {
  var sheet = sheetRegistrations_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) return rowFromValues_(values[i], i + 1);
  }
  return null;
}

function expireIfNeeded_(row) {
  if (!row) return row;
  if (row.status === "verified" || row.status === "rejected" || row.status === "expired") return row;
  if (new Date(row.expires_at).getTime() > Date.now()) return row;

  var sheet = sheetRegistrations_();
  sheet.getRange(row.rowNumber, 4).setValue("expired");
  audit_(row.id, "expired", "system", {});
  row.status = "expired";
  return row;
}
