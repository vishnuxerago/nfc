# NFC + WhatsApp mobile verification

**Free** customer registration: enter an Indian mobile number → send a pre-filled WhatsApp message → admin confirms the sender → status becomes verified.

[![License: MIT](https://img.shields.io/badge/License-MIT-teal.svg)](LICENSE)

## Free stack (₹0/month)

- **Cloudflare Pages** — website  
- **Cloudflare Pages Functions** — API  
- **Cloudflare D1** — database  
- **WhatsApp Business app** + `wa.me` — customer message (manual)  
- **Admin dashboard** — approve / reject  

No SMS gateways, no paid OTP providers, no unofficial WhatsApp bots.

## How it works

1. Customer opens the site and enters a 10-digit Indian mobile number.  
2. Backend creates a registration ID + random token (5‑minute expiry, hashed in DB).  
3. Site opens WhatsApp with a pre-filled `VERIFY …` message to your business number.  
4. Customer sends the message manually.  
5. Admin matches WhatsApp **sender** to the pending row and Approves.  
6. Customer page polls status and continues to the thank-you screen.

v1 does **not** auto-read WhatsApp. Architecture includes `markVerified()` so official Cloud API automation can be added later without a rewrite.

## Quick links after deploy

- Customer: `https://<your-project>.pages.dev/`  
- Admin: `https://<your-project>.pages.dev/admin.html`  

## Setup

Follow **[DEPLOY.md](DEPLOY.md)** step by step (Cloudflare login → D1 → secrets → deploy).

## Project layout

| Path | Role |
|------|------|
| `public/` | Customer + admin + thank-you UI |
| `functions/api/` | Register, status, admin APIs |
| `functions/_lib/` | Crypto, auth, rate limit, DB helpers |
| `migrations/` | D1 schema |
| `legacy/` | Old GitHub Pages + Apps Script files |

## License

[MIT](LICENSE) © 2026 Dinesh Singamala
