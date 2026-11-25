# NFC + WhatsApp mobile verification

Free customer registration: enter an Indian mobile number → send a pre-filled WhatsApp message → admin confirms the sender → verified.

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)

## Stack (₹0)

- **GitHub Pages** — website  
- **Google Apps Script + Google Sheet** — backend / storage  
- **WhatsApp Business app** + `wa.me` — customer message  
- **Admin page** — approve / reject  

No Cloudflare, no paid OTP/SMS, no unofficial WhatsApp bots.

## Live URLs

- Register: https://vishnuxerago.github.io/nfc/  
- Admin: https://vishnuxerago.github.io/nfc/admin.html  

## Setup

Follow **[DEPLOY.md](DEPLOY.md)** (Sheet → Apps Script → paste `/exec` URL → GitHub Pages).

## Files

| File | Role |
|------|------|
| `index.html` | Customer registration + WhatsApp flow |
| `admin.html` | Admin login + approve/reject/history |
| `thank-you.html` | Animated thank-you after verify |
| `google-apps-script.js` | Paste into Apps Script |

## License

[MIT](LICENSE) © 2026 Dinesh Singamala
