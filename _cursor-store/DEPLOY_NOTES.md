# Stamply deploy notes

Live URL target: https://stamply.quvantic.com
Vercel project: stamply
GitHub target: https://github.com/mustafaautomation/stamply

## Build

```bash
npm ci
npm run build
npm run start
```

Dev server: `npm run dev` on port 43123.
Production: `npm run start` on port 43123.

The app deploys to Vercel with zero environment variables. Mock mode is the default.

## Tests

```bash
npm run typecheck
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:e2e
```

CI: `.github/workflows/ci.yml` on ubuntu-latest. No secrets.

## Env vars (all optional)

See `.env.example`.

- `SESSION_SECRET` — set before a real public deploy. Mock mode has a built-in development key.
- `COOKIE_SECURE` — force Secure cookies. Defaults to the `x-forwarded-proto` header.
- `PUNCH_COOLDOWN_SECONDS` — default 90.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PRO`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `APPLE_PASS_CERT_PEM`
- `APPLE_PASS_KEY_PEM`
- `APPLE_PASS_TYPE_ID`
- `APPLE_TEAM_ID`
- `APPLE_WWDR_PEM`
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`

## Preview

A temporary Vercel deploy was attempted and the CLI aborted the upload because this environment is logged out of Vercel (`vercel whoami` → Logged out). Mustafa can claim the project from the Vercel dashboard after `vercel login`, or import the GitHub repo into the `stamply` project. The app is running locally with zero env vars.


## Mustafa still provides

DNS for stamply.quvantic.com, a Supabase project plus the migration, Stripe test price ids, and `SESSION_SECRET`. Wallet certificates are not required for the preview.
