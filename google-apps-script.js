/**
 * Free email OTP verification (Google Apps Script + Sheet + Gmail).
 *
 * SETUP:
 * 1. Create a Google Sheet (personal Gmail).
 * 2. Extensions → Apps Script → paste THIS file → Save.
 * 3. Project Settings → Script properties:
 *      ADMIN_PASSWORD = your-admin-password
 *      (optional) EMAIL_FROM_NAME = Your Shop Name
 * 4. Deploy → New deployment → Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Authorize Gmail when asked (script sends mail as your Gmail).
 * 6. Paste the /exec URL into index.html and admin.html (APPS_SCRIPT_URL).
 *
 * POST body (text/plain JSON):
 *   { "action": "sendOtp"|"verifyOtp"|"status"|"adminLogin"|"adminList"|"history", ... }
 *
 * Gmail free quota is limited (about 100 emails/day for consumer Gmail).
 */

var OTP_TTL_MS = 5 * 60 * 1000;
var RATE_WINDOW_MS = 15 * 60 * 1000;
var MAX_PER_MOBILE = 3;
var MAX_PER_EMAIL = 3;
var MAX_PER_IP = 10;
var MAX_OTP_ATTEMPTS = 5;
var ADMIN_TOKEN_TTL_SEC = 12 * 60 * 60;

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var action = String(data.action || "");
    var result;

    if (action === "sendOtp") result = actionSendOtp(data, e);
    else if (action === "verifyOtp") result = actionVerifyOtp(data);
    else if (action === "status") result = actionStatus(data);
    else if (action === "adminLogin") result = actionAdminLogin(data);
    else if (action === "adminList") result = actionAdminList(data);
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
    message: "Email OTP API is live. Use POST with action sendOtp or verifyOtp.",
  });
}

/* ---------- customer actions ---------- */

function actionSendOtp(data, e) {
  var mobileInfo = normalizeIndianMobile_(data.mobile);
  if (!mobileInfo) return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };

  var email = normalizeEmail_(data.email);
  if (!email) return { ok: false, error: "Enter a valid email address" };

  var ip = clientIp_(e);
  if (!hitRate_("ip:" + ip, MAX_PER_IP).allowed) {
    return { ok: false, error: "Too many attempts from this network. Try again later." };
  }
  if (!hitRate_("mobile:" + mobileInfo.e164, MAX_PER_MOBILE).allowed) {
    return { ok: false, error: "Too many attempts for this number. Try again later." };
  }
  if (!hitRate_("email:" + email, MAX_PER_EMAIL).allowed) {
    return { ok: false, error: "Too many attempts for this email. Try again later." };
  }

  var id = randomId_();
  var otp = randomOtp6_();
  var tokenHash = sha256Hex_(otp);
  var createdAt = new Date();
  var expiresAt = new Date(createdAt.getTime() + OTP_TTL_MS);

  ensureSheets_();
  sheetRegistrations_().appendRow([
    id,
    mobileInfo.e164,
    email,
    tokenHash,
    "awaiting_otp",
    createdAt.toISOString(),
    expiresAt.toISOString(),
    "",
    "",
    "",
    0,
  ]);

  audit_(id, "otp_sent", "system", { mobile: mobileInfo.e164, email: email, ip: ip });

  var fromName = props_().getProperty("EMAIL_FROM_NAME") || "Verification";
  var subject = "Your verification code: " + otp;
  var body =
    "Your verification code is: " + otp + "\n\n" +
    "Mobile: +" + mobileInfo.e164 + "\n" +
    "This code expires in 5 minutes.\n\n" +
    "If you did not request this, ignore this email.\n";

  try {
    GmailApp.sendEmail(email, subject, body, { name: fromName });
  } catch (err) {
    return { ok: false, error: "Could not send email: " + String(err) };
  }

  return {
    ok: true,
    registrationId: id,
    mobile: mobileInfo.display,
    email: email,
    expiresAt: expiresAt.toISOString(),
    note: "Check your inbox (and spam) for the 6-digit code.",
  };
}

function actionVerifyOtp(data) {
  var id = String(data.id || "");
  var otp = String(data.otp || "").replace(/\D/g, "");
  if (!/^[a-f0-9]{32}$/i.test(id)) return { ok: false, error: "Missing registration id" };
  if (!/^\d{6}$/.test(otp)) return { ok: false, error: "Enter the 6-digit code from your email" };

  var row = findRegistration_(id);
  if (!row) return { ok: false, error: "Registration not found" };
  row = expireIfNeeded_(row);

  if (row.status === "verified") return { ok: true, alreadyVerified: true, verifiedAt: row.verified_at };
  if (row.status === "expired") return { ok: false, error: "Code expired. Request a new one." };
  if (row.status !== "awaiting_otp") return { ok: false, error: "This registration cannot be verified" };

  var attempts = Number(row.otp_attempts || 0);
  if (attempts >= MAX_OTP_ATTEMPTS) {
    sheetRegistrations_().getRange(row.rowNumber, 5).setValue("expired");
    audit_(id, "otp_locked", "system", {});
    return { ok: false, error: "Too many wrong attempts. Request a new code." };
  }

  var hash = sha256Hex_(otp);
  if (hash !== row.token_hash) {
    sheetRegistrations_().getRange(row.rowNumber, 11).setValue(attempts + 1);
    audit_(id, "otp_fail", "system", { attempts: attempts + 1 });
    return { ok: false, error: "Incorrect code. Try again." };
  }

  var now = new Date().toISOString();
  var sheet = sheetRegistrations_();
  sheet.getRange(row.rowNumber, 5).setValue("verified");
  sheet.getRange(row.rowNumber, 8).setValue(now);
  audit_(id, "verified", "system", { method: "email_otp" });

  return { ok: true, verifiedAt: now };
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
    email: row.email || null,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at || null,
  };
}

/* ---------- admin ---------- */

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

  var status = String(data.status || "awaiting_otp");
  var allowed = { awaiting_otp: 1, verified: 1, expired: 1, all: 1 };
  if (!allowed[status]) return { ok: false, error: "Invalid status filter" };

  ensureSheets_();
  var values = sheetRegistrations_().getDataRange().getValues();
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = rowFromValues_(values[i], i + 1);
    if (!row.id) continue;
    row = expireIfNeeded_(row);
    if (status !== "all" && row.status !== status) continue;
    out.push({
      id: row.id,
      mobile: "+" + row.mobile,
      email: row.email || "",
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      verifiedAt: row.verified_at || null,
    });
  }
  out.reverse();
  return { ok: true, registrations: out.slice(0, 200) };
}

function actionHistory(data) {
  if (!requireAdmin_(data.adminToken)) return { ok: false, error: "Unauthorized" };
  ensureSheets_();
  var values = sheetAudit_().getDataRange().getValues();
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

function ensureSheets_() {
  sheetRegistrations_();
  sheetAudit_();
}

function sheetRegistrations_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Registrations");
  if (!sheet) {
    sheet = ss.insertSheet("Registrations");
    sheet.appendRow([
      "id", "mobile", "email", "token_hash", "status",
      "created_at", "expires_at", "verified_at", "rejected_at", "reject_reason", "otp_attempts",
    ]);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "id", "mobile", "email", "token_hash", "status",
      "created_at", "expires_at", "verified_at", "rejected_at", "reject_reason", "otp_attempts",
    ]);
  }
  return sheet;
}

function sheetAudit_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Audit");
  if (!sheet) {
    sheet = ss.insertSheet("Audit");
    sheet.appendRow(["id", "registration_id", "action", "actor", "meta", "created_at"]);
  } else if (sheet.getLastRow() === 0) {
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

function normalizeEmail_(input) {
  var email = String(input || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function randomId_() {
  var s = "";
  for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

function randomOtp6_() {
  var n = Math.floor(Math.random() * 1000000);
  var s = String(n);
  while (s.length < 6) s = "0" + s;
  return s;
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
    return { allowed: true };
  }
  if (obj.count >= max) return { allowed: false };
  obj.count += 1;
  cache.put("rate:" + key, JSON.stringify(obj), Math.ceil(RATE_WINDOW_MS / 1000));
  return { allowed: true };
}

function rowFromValues_(r, rowNumber) {
  return {
    rowNumber: rowNumber,
    id: String(r[0] || ""),
    mobile: String(r[1] || ""),
    email: String(r[2] || ""),
    token_hash: String(r[3] || ""),
    status: String(r[4] || ""),
    created_at: String(r[5] || ""),
    expires_at: String(r[6] || ""),
    verified_at: String(r[7] || ""),
    rejected_at: String(r[8] || ""),
    reject_reason: String(r[9] || ""),
    otp_attempts: r[10] || 0,
  };
}

function findRegistration_(id) {
  var values = sheetRegistrations_().getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === id) return rowFromValues_(values[i], i + 1);
  }
  return null;
}

function expireIfNeeded_(row) {
  if (!row) return row;
  if (row.status === "verified" || row.status === "expired") return row;
  if (row.status === "awaiting_otp" && new Date(row.expires_at).getTime() <= Date.now()) {
    sheetRegistrations_().getRange(row.rowNumber, 5).setValue("expired");
    audit_(row.id, "expired", "system", {});
    row.status = "expired";
  }
  return row;
}
