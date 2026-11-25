# Rescued from Cursor

Source: Stamply loyalty wallet SaaS | Cursor https://cursor.com/agents/bc-715075be-4ac9-582b-9f3e-bfb11bcf2a0b
Scope: Last Agent Turn
Captured: 2026-11-25T12:13:17.179Z
Files written: 80

Not in this copy: files Cursor's template created and the agent never changed (e.g. tsconfig, shadcn ui components, lockfiles, public assets) when scope is 'Last Agent Turn'; binaries.

- may be incomplete (check): lib/loyalty.ts

## Repairs (25 Nov 2026, Claude Code)

- `lib/loyalty.ts` was empty in the capture (the export marked it unreadable; the original was ~1047 lines). Rebuilt from its callers (`lib/handlers.ts`, `lib/request-store.ts`, dashboard/admin pages, `tests/loyalty.test.ts`) and from the Supabase functions in `supabase/migrations` (`punch_card`, `redeem_card`, `lookup_card`, `get_public_card`), whose rules and error messages it mirrors: seeded read-only showcase (Lumen Coffee, Atelier North, Iron & Oak; LUMEN-MAYA 8/8, ATELIER-NINA 6/6, IRON-ANDRE 9/10), cookie delta merged over the seed, 90 s confirm cooldown (`PUNCH_COOLDOWN_SECONDS`), plan limits, 8-week retention, super-admin overview, and a mock outbox. The seed's customer names other than Maya/Nina/Andre, the colors for the salon and gym, card-code format for new cards, and the exact retention formula are reconstructions, not the original text.
- Recreated template files: `next.config.ts` (Cache Components + Partial Prefetching + the `@tailwindcss/turbopack` CSS loader; without it Tailwind is not processed and the build fails), `eslint.config.mjs`, `components.json` (shadcn `radix-nova`; the agent added `radix-ui` to package.json).
- Regenerated shadcn/ui components with `npx shadcn@4.23.0 add button input label dialog` (they import `cn` from the `cn` package; no `lib/utils.ts` needed).
- Regenerated `package-lock.json` with `npm install`.
- Regenerated README screenshots (`docs/screenshots/*.png`) from the running app with `node scripts/screenshots.mjs`.

Verified locally: `npm run typecheck` OK, `npm run lint` 0 errors (6 warnings), `npm test` 3/3 passed, `npm run build` OK, `npx playwright test` 5/5 passed.

## Review of the reconstructed `lib/loyalty.ts` (25 Nov 2026, Claude Code)

Re-checked every export against `lib/handlers.ts`, `lib/request-store.ts`, the pages, `tests/loyalty.test.ts`, the E2E spec, the README and the Cursor thread summary (LUMEN-MAYA 8/8 with redeem refused, Nina 6/6, Andre 9/10, punch by phone/email/code/QR, 90 s confirm, showcase read-only, signup creates a browser-local program, seven seeded logins). Error codes and messages match the Supabase functions `punch_card`, `redeem_card`, `lookup_card` and `get_public_card` line for line; seed users match `scripts/seed-supabase.mjs`.

Fixed (missing piece):
- The browser-only program lives in a signed cookie delta that grew ~110 bytes per punch with no bound. After roughly 120 punches the Cookie header passed Node's 16 KB request-header limit (431 errors), and past 8 x 3200 chars the chunks were cut, the signature failed and the program vanished. New `compactDelta()` keeps users, tenants, customers and cards, drops punches older than the 8-week retention window and trims punches/activity/outbox newest-first until the encoded delta fits 10,000 chars; `request-store` runs it before writing the cookies. Unit test added (20 cards, 160 punches, 20 redemptions stays within budget and every card still resolves).
- `playwright.config.ts` reads an optional `E2E_PORT` (default 43123).

Still inferred, not copied: seed customer names other than Maya/Nina/Andre, salon/gym colors, the `PREFIX-XXXXXX` code format for new mock cards (the SQL path uses 8 hex chars), the retention formula, and the mock-only plan card limit check in `lookupCard`. In mock mode a heavy counter keeps the newest history only (dashboard totals for rewards come from the cards, so they stay exact).

Verified: typecheck OK, lint 0 errors (6 existing `<img>` warnings), `npm test` 4/4, `npm run build` OK, Playwright 5/5.
