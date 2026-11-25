# Deploy: Free WhatsApp mobile verification

**Cost: ₹0/month** on Cloudflare free plan + free WhatsApp Business app.  
No SMS/OTP vendors. Manual admin approval (not automatic WhatsApp reading).

---

## What you get

| URL | Purpose |
|-----|---------|
| `/` | Customer registration + WhatsApp verify |
| `/admin.html` | Admin login, approve/reject, history |
| `/thank-you.html` | Shown after verified |

NFC card should store your Pages URL, e.g. `https://nfc-whatsapp-verify.pages.dev/`

---

## One-time setup (order)

### 1. Install tools

1. Install [Node.js LTS](https://nodejs.org/) (free).
2. In this project folder:

```bash
npm install
```

3. Log in to Cloudflare (free account at [dash.cloudflare.com](https://dash.cloudflare.com)):

```bash
npx wrangler login
```

### 2. Create free D1 database

```bash
npx wrangler d1 create nfc-verify
```

Copy the `database_id` UUID from the output. Open `wrangler.toml` and replace:

```toml
database_id = "00000000-0000-0000-0000-000000000000"
```

with your real id.

Apply the schema:

```bash
npx wrangler d1 execute nfc-verify --remote --file=migrations/0001_init.sql
```

### 3. Set secrets (free; stored in Cloudflare)

Use your WhatsApp Business number **digits only with country code** (India example `9198XXXXXXXX` — no `+`):

```bash
npx wrangler pages secret put BUSINESS_WA_E164 --project-name=nfc-whatsapp-verify
npx wrangler pages secret put ADMIN_PASSWORD --project-name=nfc-whatsapp-verify
npx wrangler pages secret put SESSION_SECRET --project-name=nfc-whatsapp-verify
```

For `SESSION_SECRET`, paste a long random string (e.g. 32+ characters).

> First time: create the Pages project by deploying once (step 4), then set secrets, then redeploy.

### 4. Deploy (free Pages)

```bash
npx wrangler pages deploy public --project-name=nfc-whatsapp-verify
```

Open the URL Wrangler prints (ends with `.pages.dev`).

### 5. Local test (optional)

```bash
copy .dev.vars.example .dev.vars
# edit .dev.vars with your number + passwords

npx wrangler d1 execute nfc-verify --local --file=migrations/0001_init.sql
npm run dev
```

---

## Admin workflow

1. Customer enters mobile → opens WhatsApp → sends pre-filled `VERIFY …` message.
2. You receive it in WhatsApp Business and note the **sender number**.
3. Open `/admin.html` → log in → **Pending**.
4. Confirm sender matches the listed mobile (optional: paste the token from the chat).
5. **Approve** or **Reject**.
6. Customer page auto-updates to verified → thank-you page.

---

## Security notes

- Tokens expire in **5 minutes** and are one-time.
- DB stores **SHA-256 token hashes**, not plaintext tokens.
- Rate limits: 3 attempts / number / 15 min; 10 / IP / 15 min.
- Admin session cookie is HttpOnly.

---

## Free-tier limits (not fees)

Cloudflare free Workers/Pages/D1 have daily request and size caps. Fine for small/medium volume. Plans can change; there is no paid subscription required for this design.

---

## Test checklist

- [ ] Invalid mobile (e.g. `123`) rejected on the form  
- [ ] Valid number opens `wa.me` with VERIFY message  
- [ ] Admin sees pending row  
- [ ] Approve → customer waiting page redirects to thank-you  
- [ ] Reject → customer sees rejected  
- [ ] Wait 5+ minutes → status expired  
- [ ] Spam register → rate limit message  

---

## Legacy

Older GitHub Pages + Google Sheets files are in `legacy/` (archived). Live path is Cloudflare Pages + D1.
