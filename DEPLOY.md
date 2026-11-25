# Deploy guide — Free email OTP (GitHub Pages + Gmail)

**Cost: ₹0** for low volume. Apps Script sends mail with **your Gmail**. Consumer Gmail ~**100 emails/day**.

---

## Live links

| Page | URL |
|------|-----|
| Register | https://vishnuxerago.github.io/nfc/ |
| Admin | https://vishnuxerago.github.io/nfc/admin.html |

---

## Setup (order)

### 1. Google Sheet (personal Gmail)

1. [https://sheets.new](https://sheets.new) while signed into **personal Gmail**
2. **Extensions → Apps Script**
3. Paste `google-apps-script.js` → Save  
   (Script creates **Registrations** + **Audit** tabs automatically)

### 2. Script property

**Project Settings (gear) → Script properties:**

| Property | Value |
|----------|--------|
| `ADMIN_PASSWORD` | Password for `/admin.html` |
| `ADMIN_EMAIL` | Admin Gmail for forgot-password codes |
| `SPREADSHEET_ID` | Sheet ID from the spreadsheet URL |
| `EMAIL_FROM_NAME` | Optional display name, e.g. `My Shop` |

You no longer need `BUSINESS_WA_E164` for this email OTP flow.

### 3. Deploy Web app

1. **Deploy → New deployment → Web app**
2. Execute as: **Me**
3. Who has access: **Anyone**
4. Authorize **Gmail** + Sheets when Google asks
5. Copy `/exec` URL into `index.html` and `admin.html` (`APPS_SCRIPT_URL`)
6. After code changes: **Manage deployments → Edit → New version → Deploy**

### 4. GitHub Pages

Branch **main**, folder **/ (root)** — already used for this repo.

---

## Customer flow

1. Enter mobile + email  
2. Receive 6-digit code by email  
3. Enter code on the site → verified → thank-you  

---

## Limits

- Free Gmail send quota (~100/day). Workspace accounts have higher limits.
- OTP expires in **5 minutes**, max **5** wrong tries, rate limits per email/mobile/IP.

---

## Test

- [ ] Send code → email arrives (check spam)  
- [ ] Wrong code → error  
- [ ] Correct code → thank-you page  
- [ ] Row appears in Sheet as `verified`  
