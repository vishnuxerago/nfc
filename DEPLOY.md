# Deploy guide (GitHub Pages + Google Sheet — no Cloudflare)

**Cost: ₹0.** Hosting on GitHub Pages. Data in Google Sheets. WhatsApp Business app for messages. Manual admin approval.

---

## Links after setup

| Page | URL |
|------|-----|
| Customer register | `https://vishnuxerago.github.io/nfc/` |
| Admin dashboard | `https://vishnuxerago.github.io/nfc/admin.html` |
| Thank you | `https://vishnuxerago.github.io/nfc/thank-you.html` |

Write the customer URL on your NFC card.

---

## Step 1 — Google Sheet (personal Gmail)

Use **personal Gmail** in Incognito (not office Outlook).

1. Open [https://sheets.new](https://sheets.new)
2. Name the spreadsheet `NFC WhatsApp Verify`
3. Rename the first tab to **Registrations**
4. Row 1 headers:

`id | mobile | token_hash | status | created_at | expires_at | verified_at | rejected_at | reject_reason`

5. Add a second tab named **Audit** with headers:

`id | registration_id | action | actor | meta | created_at`

(The script can also create these tabs automatically if missing.)

---

## Step 2 — Apps Script

1. In the Sheet: **Extensions → Apps Script**
2. Delete any starter code
3. Paste everything from `google-apps-script.js` → **Save**
4. Left sidebar: **Project Settings** (gear) → **Script properties** → **Add script property**:

| Property | Value |
|----------|--------|
| `BUSINESS_WA_E164` | Your WhatsApp number digits only, e.g. `919876543210` |
| `ADMIN_PASSWORD` | A strong password for `/admin.html` |

5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorize (Advanced → Go to … → Allow)
7. Copy the **Web app URL** (`…/exec`)

Test: open that URL in Incognito → you should see JSON like `{"ok":true,"message":"..."}`.

---

## Step 3 — Put the URL in the website files

In both files, replace the placeholder:

- `index.html` → `APPS_SCRIPT_URL = "..."`  
- `admin.html` → `APPS_SCRIPT_URL = "..."`  

Use the same `/exec` URL in both.

---

## Step 4 — GitHub Pages (already on if you used it before)

1. Push these files to `https://github.com/vishnuxerago/nfc`
2. Repo **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** / folder: **/ (root)**
3. Wait 1–2 minutes, then open `https://vishnuxerago.github.io/nfc/`

---

## How staff verifies

1. Customer sends WhatsApp message with `VERIFY …`
2. You check **sender number** in WhatsApp
3. Open `admin.html` → log in with `ADMIN_PASSWORD`
4. Pending list → **Approve** (optional: paste token from chat) or **Reject**
5. Customer page auto-updates → thank-you screen

---

## Test checklist

- [ ] Invalid mobile rejected  
- [ ] Valid mobile opens WhatsApp with VERIFY text  
- [ ] Row appears in Sheet / admin Pending  
- [ ] Approve → customer goes to thank-you  
- [ ] Reject → customer sees rejected  
- [ ] After 5 minutes → expired  

---

## Notes

- Tokens are stored as **SHA-256 hashes** (not plain text) in the Sheet.
- This does **not** auto-read WhatsApp; approval is manual (keeps it free and safe).
- No Cloudflare / Wrangler / D1 required.
