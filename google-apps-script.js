/**
 * Google Apps Script backend for the NFC check-in form.
 *
 * SETUP (do this in order):
 * 1. Create a Google Sheet named "NFC Check-ins" (or any name).
 * 2. In that sheet, put these headers in row 1 of the first tab:
 *      Timestamp | Name | WhatsApp
 * 3. Extensions → Apps Script
 * 4. Delete any starter code, paste THIS entire file, Save.
 * 5. Deploy → New deployment → Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Copy the Web App URL and paste it into index.html as APPS_SCRIPT_URL.
 *
 * If you edit this script later: Deploy → Manage deployments → Edit (pencil)
 * → Version: New version → Deploy. Then reuse the same URL.
 */

var SHEET_NAME = "Sheet1"; // rename if your first tab has a different name

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || "{}");
    var name = String(data.name || "").trim();
    var whatsapp = String(data.whatsapp || "").trim();
    var timestamp = String(data.timestamp || new Date().toISOString()).trim();

    if (!name || !whatsapp) {
      return json_({ ok: false, error: "Missing name or whatsapp" });
    }

    // Light server-side check for E.164 (+ then 7–15 digits)
    if (!/^\+[1-9]\d{6,14}$/.test(whatsapp)) {
      return json_({ ok: false, error: "Invalid WhatsApp format" });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      return json_({ ok: false, error: "Sheet not found: " + SHEET_NAME });
    }

    // Ensure header row exists
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "WhatsApp"]);
    }

    sheet.appendRow([timestamp, name, whatsapp]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Optional: open the Web App URL in a browser to confirm it is live */
function doGet() {
  return json_({
    ok: true,
    message: "NFC check-in endpoint is live. Use POST from the form."
  });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
