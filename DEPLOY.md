# NFC Check-in — Deploy Guide (no app required)

**License:** [MIT](LICENSE) — free to use, copy, modify, and share.

This setup lets a customer **tap an NFC card → open a web form → save name + WhatsApp number → redirect** to your page. Works on **iPhone (iOS 14+) and modern Android** without installing anything.

---

## Architecture (plain English)

```
Customer taps NFC card
        ↓
Phone reads a URL written on the card (NDEF URI)
        ↓
Phone opens that URL in the browser
        ↓
Customer fills: Full name + WhatsApp number
        ↓
Form sends data to Google Apps Script
        ↓
Apps Script appends a row in Google Sheets
        ↓
Browser redirects to YOUR destination URL
```

| Piece | What it is | Who hosts it |
|-------|------------|--------------|
| NFC card | Blank NTAG sticker/card with one URL | You buy & write once |
| Web form | `index.html` (this folder) | Netlify / GitHub Pages / Vercel (free) |
| Storage | Google Sheet via Apps Script | Your Google account (free) |
| Redirect | Any URL you choose | Your site / WhatsApp / menu / etc. |

Nothing is installed on the customer’s phone. The card is just a shortcut to a website.

---

## Do this in order

### Step 1 — Create the Google Sheet (storage)

1. Go to [https://sheets.google.com](https://sheets.google.com) and sign in.
2. Click **Blank** to create a new spreadsheet.
3. Rename it to something like `NFC Check-ins`.
4. On the first tab (usually named **Sheet1**), put these headers in row 1:

| A1 | B1 | C1 |
|----|----|----|
| Timestamp | Name | WhatsApp |

5. Keep this tab named **Sheet1** (or change `SHEET_NAME` in the script to match).

---

### Step 2 — Attach Google Apps Script

1. In that same spreadsheet: menu **Extensions → Apps Script**.
2. Delete any code already in the editor.
3. Open the file `google-apps-script.js` from this project folder, copy **everything**, paste into Apps Script.
4. Click the floppy-disk **Save** icon. Name the project `NFC Check-in` if asked.
5. Click **Deploy → New deployment**.
6. Click the gear next to **Select type** → choose **Web app**.
7. Fill in:
   - **Description:** `NFC form endpoint`
   - **Execute as:** **Me** (your Google account)
   - **Who has access:** **Anyone**
8. Click **Deploy**.
9. Google may ask you to **Authorize access**:
   - Click **Authorize access**
   - Choose your Google account
   - If you see “Google hasn’t verified this app”, click **Advanced → Go to NFC Check-in (unsafe)** — this is normal for your own script
   - Click **Allow**
10. Copy the **Web app URL** (it looks like `https://script.google.com/macros/s/....../exec`).  
    Keep it somewhere safe — you need it in Step 3.

**Test the script quickly:** paste that URL into a browser. You should see JSON like  
`{"ok":true,"message":"NFC check-in endpoint is live..."}`.

---

### Step 3 — Edit the form config

1. Open `index.html` in any text editor (Notepad, VS Code, Cursor).
2. Near the top, find the three config lines and change them:

```js
const REDIRECT_URL = "https://example.com/thank-you";
// ↑ Put YOUR destination (menu, WhatsApp link, booking page, etc.)

const APPS_SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
// ↑ Paste the /exec URL from Step 2

const RETURN_BEHAVIOR = "always_form";
// ↑ "always_form"  = show the form every tap (simplest)
// ↑ "skip_if_seen" = if this phone already submitted once, skip straight to REDIRECT_URL
```

3. Save the file.

**Second tap behavior explained**

| Setting | What happens on a second tap |
|---------|------------------------------|
| `always_form` | Customer always sees the form again (good if different people share a phone, or you want every visit logged). |
| `skip_if_seen` | After one successful submit, that **same browser** remembers and jumps straight to `REDIRECT_URL` (uses `localStorage`; clearing browser data resets it). |

The NFC card itself always opens the same URL. The choice above only changes what the **web page** does.

---

### Step 4 — Host the web page (pick one free option)

You only need to publish **`index.html`**. Netlify Drop is the easiest if you are not a developer.

#### Option A — Netlify Drop (easiest, ~2 minutes)

1. Go to [https://app.netlify.com/drop](https://app.netlify.com/drop) (create a free Netlify account if asked).
2. Put **only** `index.html` in a folder on your computer (this `nfc` folder is fine).
3. Drag that folder onto the Netlify Drop page.
4. Netlify gives you a live URL like `https://random-name-123.netlify.app`.
5. Open that URL on your phone and confirm the form loads.
6. (Optional) Site settings → Domain → change the site name to something nicer, e.g. `https://my-shop-checkin.netlify.app`.

#### Option B — GitHub Pages

1. Create a free GitHub account at [https://github.com](https://github.com).
2. Create a new repository (e.g. `nfc-checkin`), set it to **Public**.
3. Upload `index.html` to the repo (Add file → Upload files).
4. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
5. Branch: `main` / folder: `/ (root)` → Save.
6. After a minute, your site is at `https://YOURUSERNAME.github.io/nfc-checkin/`  
   (exact path depends on the repo name).

#### Option C — Vercel

1. Go to [https://vercel.com](https://vercel.com), sign up (GitHub login is fine).
2. **Add New → Project** → import a Git repo that contains `index.html`, **or** use the Vercel CLI / drag-and-drop.
3. Deploy. Use the URL Vercel shows (e.g. `https://nfc-checkin.vercel.app`).

**Your NFC card must point at this hosted URL** (with `https://`), not a file on your computer.

---

### Step 5 — Buy and write the NFC card

#### Card type to buy

Use **NTAG213**, **NTAG215**, or **NTAG216** (NXP). These are the usual choice for URL tags:

| Type | Memory | Good for |
|------|--------|----------|
| **NTAG213** | ~144 bytes user | Short URLs — **usually enough** |
| **NTAG215** | ~504 bytes | Longer URLs / extras |
| **NTAG216** | ~888 bytes | Longest of the three |

Buy blank NFC stickers or cards labeled **NTAG213/215/216**. Avoid obscure no-name chips unless the listing says they support **NDEF**.

You only need to store **one HTTPS URL**, so NTAG213 is fine for a Netlify/GitHub short URL.

#### Free / low-cost phone apps to write the URL

| Phone | App | Cost | Notes |
|-------|-----|------|-------|
| Android | **NFC Tools** (wakdev) | Free | Reliable; write URI/URL record |
| Android | **TagWriter** (NXP) | Free | From the chip maker |
| iPhone | **NFC Tools** | Free tier | iPhone 7+ with NFC; iOS can write NDEF |
| iPhone | **Shortcuts** (built-in) | Free | Can write a URL to a tag on newer iOS |

#### How to write the URL (NFC Tools example)

1. Install **NFC Tools**.
2. Open **Write → Add a record → URL / URI**.
3. Paste your hosted form URL, e.g. `https://my-shop-checkin.netlify.app`
4. Tap **Write** / **Write & Confirm**.
5. Hold the phone against the blank card until it confirms success.
6. Optional but recommended: use **Lock** only after you are sure the URL is final (locking is often permanent).

The record type should be an **NDEF URI / URL** record — not plain text, not an app deep link.

#### Tip for short URLs

If your host URL is long and you worry about fitting on NTAG213, use a short domain or Netlify’s short site name. Almost all modern HTTPS URLs fit on NTAG213.

---

## Device compatibility (customers)

### What works without an app

- **iPhone, iOS 14+**: Background NFC tag reading. Customer holds the top of the iPhone near the card; a notification / banner appears → they tap it → Safari opens your URL.
- **Modern Android**: NFC on → tap → Chrome (or default browser) opens the URL automatically on most phones.

### Customer settings

**iPhone**

1. Settings → **Control Center** — optional; not required for tags.
2. NFC reading is usually on by default for tags (iOS 14+). Screen should be **on / unlocked** for reliable reads.
3. Hold the **upper edge** of the phone near the card (not the center like Android).

**Android**

1. Settings → search **NFC** → turn **NFC** **On**.
2. Screen usually needs to be **on / unlocked**.
3. Hold the back of the phone (often near the camera) against the card for 1–2 seconds.

### Fallback if the phone does not auto-read

| Situation | What to do |
|-----------|------------|
| NFC off / old phone / metal case blocking | Show a **QR code** next to the NFC card that opens the **same URL**. |
| iPhone asks for confirmation | Customer taps the banner — this is normal. |
| Cheap phone with no NFC | QR code is the only option. |

Print the QR of the same hosted URL (use any free QR generator). NFC + QR side-by-side is the practical real-world setup.

---

## Test checklist

Do these after hosting + writing a card (or open the hosted URL directly if you have not written a card yet).

### 1. Android tap

- [ ] NFC is on.
- [ ] Tap the card → browser opens your form (HTTPS).
- [ ] Page looks readable on a phone screen.

### 2. iPhone tap

- [ ] Unlock the phone, screen on.
- [ ] Hold top of iPhone to the card → banner appears → open form.
- [ ] Form loads in Safari.

### 3. Invalid number

- [ ] Leave name blank → submit → see name error.
- [ ] Enter too-short number (e.g. `12`) → see phone error.
- [ ] Nothing new appears in the Google Sheet.

### 4. Valid submit

- [ ] Enter a real-looking name and number with the correct country code.
- [ ] Submit → “Saving…” then redirect to your `REDIRECT_URL`.
- [ ] Open the Google Sheet → new row with Timestamp, Name, WhatsApp like `+919876543210`.

### 5. Second tap

- [ ] With `RETURN_BEHAVIOR = "always_form"`: tap again → form shows again.
- [ ] (Optional) Switch to `"skip_if_seen"`, redeploy, submit once, tap again → should go straight to redirect on that phone.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Form says “Setup incomplete” | You still have the placeholder `APPS_SCRIPT_URL`. Paste the `/exec` URL. |
| “Could not save” | Re-check Apps Script deployment: **Anyone** access, **Execute as Me**. Redeploy a **New version** after script edits. |
| Sheet stays empty | Confirm tab name is `Sheet1` (or match `SHEET_NAME`). Open Apps Script → Executions to see errors. |
| Card does nothing | Confirm the written URL opens in a browser when typed manually. Re-write as **URL** record. Try removing a thick case. |
| iPhone only works with an app | You may have written a non-URI record; rewrite as URL. Ensure iOS 14+. |
| CORS / blocked request | Keep using `Content-Type: text/plain` as in `index.html` (already set). Do not switch to `application/json` unless you know CORS. |

---

## Files in this folder

| File | Purpose |
|------|---------|
| `index.html` | Full form (HTML + CSS + JS). Edit the 3 config values, then host. |
| `google-apps-script.js` | Paste into Google Apps Script attached to your Sheet. |
| `DEPLOY.md` | This guide. |

You do **not** need a database, a backend server, or a mobile app for this flow.
