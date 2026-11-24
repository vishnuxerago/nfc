# NFC Check-in

**Open-source, no-app NFC → web form → Google Sheets → redirect.**

Tap an NFC card (or scan a QR of the same URL). The phone opens a mobile form, saves the customer’s name and WhatsApp number to a Google Sheet, then redirects to your page.

Works on **iOS 14+** and **modern Android** using native NDEF URL reading — customers do not install an app.

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)

## How it works

```
NFC card (NTAG213/215/216)
   stores one HTTPS URL
        ↓
Phone opens index.html
        ↓
Customer enters name + WhatsApp
        ↓
Google Apps Script appends a Sheet row
        ↓
Browser redirects to your URL
```

## Features

- Single-file form (`index.html`) — HTML, CSS, and JS together
- Country-code selector; numbers saved as E.164 (e.g. `+15551234567`)
- Google Sheets storage via Apps Script (free)
- Configurable redirect URL and return-visit behavior
- Plain-language deploy guide for non-developers

## Quick start

1. Create a Google Sheet with headers: `Timestamp | Name | WhatsApp`
2. Paste [`google-apps-script.js`](google-apps-script.js) into **Extensions → Apps Script**, deploy as a **Web app** (access: **Anyone**)
3. Edit the three config values at the top of [`index.html`](index.html):

```js
const REDIRECT_URL = "https://your-destination.example";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/.../exec";
const RETURN_BEHAVIOR = "always_form"; // or "skip_if_seen"
```

4. Host `index.html` on [Netlify Drop](https://app.netlify.com/drop), GitHub Pages, or Vercel
5. Write that HTTPS URL to an **NTAG213/215/216** card with **NFC Tools** (URL / URI record)

Full walkthrough: **[DEPLOY.md](DEPLOY.md)**

## Repository layout

| File | Purpose |
|------|---------|
| `index.html` | Form UI + validation + submit + redirect |
| `google-apps-script.js` | Sheet backend (paste into Apps Script) |
| `DEPLOY.md` | Step-by-step hosting, NFC writing, tests |
| `LICENSE` | MIT |

## Return visits

| `RETURN_BEHAVIOR` | Second tap |
|-------------------|------------|
| `always_form` | Show the form again |
| `skip_if_seen` | Skip to `REDIRECT_URL` if this browser already submitted |

## Compatibility

- **iPhone (iOS 14+):** screen on; hold top edge to the card; tap the system banner
- **Android:** NFC on; hold back of phone to the card
- **Fallback:** print a QR code of the same URL for phones without NFC

## Contributing

Issues and pull requests are welcome. Keep the form a single static file when possible so non-developers can still deploy with drag-and-drop hosting.

## License

[MIT](LICENSE) © 2026 Dinesh Singamala
