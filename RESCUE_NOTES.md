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
