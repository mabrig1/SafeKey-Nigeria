# SafeKey Nigeria — Check Before You Pay

**Stateless preview is deployable; full pilot requires D1 setup. Not a property-title verification service.** A mobile-first, independent early-warning tool for Nigerian property buyers and renters. The pilot identifies inconsistencies in *submitted data* and prior SafeKey submissions. It does **not** query any official land registry, verify licences, run OCR, hold deposits, or guarantee a safe transaction.

## What works in this MVP
- Responsive site with a practical property/agent/listing intake form.
- Server-side rules covering questionable payment instructions, advertising language, incomplete details and conflicting prior submissions. All findings name their evidence source and limits.
- In the default stateless mode, screening runs without storing inputs or accessing earlier records. After D1 is configured, protected-hash historical cross-checks are available; raw phone numbers, full addresses and full URLs are **not** stored in the check-history table.
- Printable risk report, next-step checklist, and clear unverified status (never a fake 90/100 safety score).
- Private, rate-limited incident reporting to a human moderation queue (**unavailable until D1 is configured, disabled by default thereafter**).
- Admin-only report review and a directory of manually verified professionals; directory starts empty.
- Scheduled deletion of check history after 30 days and some closed/unreviewed reports after 180 days.
- Optional OpenRouter AI questions (strict opt-in, generic warning codes only) and optional Resend private moderator email alerts (case reference only), both disabled by default.
- Unit tests, restrictive CSP, no secrets in the browser, and no automatic public blacklist.

## Benchmark-driven features

- **Two-listing radar:** Compare two buyer-entered advertisements at `#compare` via `POST /api/compare`. It compares normalized Nigerian property references, amounts, contacts, and named payees. It never fetches a listing site, produces a fraud verdict, or stores listing content. Differing names and prices require questions, not accusations.
- **Private evidence manifest:** At `#evidence`, use in-browser SHA-256 on files up to 15 MB and record short source notes. Download a portable JSON manifest when needed. **Files are never uploaded, hashes are not stored by SafeKey, and fingerprints never establish legal authenticity.**
- **Independent GitHub benchmark:** See [GitHub comparison and license notes](docs/GITHUB_BENCHMARK_2026-11-10.md). No third-party source or media was copied.

## Stack
Cloudflare Worker + D1 + plain HTML/CSS/JavaScript. Optional OpenRouter calls require a separately managed API key and can incur usage charges; no mobile build service or complex runtime dependencies. This is deliberate: avoid making unsupported verification claims and keep the first pilot inexpensive. The system is organized so authenticated registry integrations, document OCR and professional evidence workflows can be added as separate modules later.

## Local setup
1. Install Node.js 20+ and run `npm install`.
2. Stateless screening works with no .dev.vars or database. For local D1-backed mode later, copy `.dev.vars.example` to `.dev.vars`; replace hash pepper and admin secret with separate random values of at least 32 characters. Put real API keys only in this ignored local file (not Git). Leave AI and email flags off until configured.
3. Run `npm run dev` to launch the stateless preview. To activate D1, first add your real D1 binding to `wrangler.jsonc` per `docs/CLOUDFLARE_DEPLOYMENT.md`, then run `npm run db:local`.
4. Open the local URL Wrangler prints and test a preliminary check. The preview does not store reports or contact any paid API.
5. Run `npm run check && npm test`. GitHub Actions also runs local Wrangler smoke checks for the stateless and D1-backed modes (including migrations, report intake, admin authentication and moderation). This does not deploy the Worker. For now the admin credential is entered manually in the browser each session (not saved by the app).

## Cloudflare deployment — **stateless preview first; D1-backed pilot requires review**
1. Default `wrangler.jsonc` can deploy the static site and stateless screening without D1. See [Cloudflare deployment recovery](docs/CLOUDFLARE_DEPLOYMENT.md). Create a real D1 database only when ready to activate persistence: `npx wrangler d1 create safekey-nigeria`.
2. Add a new `d1_databases` section in `wrangler.jsonc` with the actual ID. No fake UUID is committed. Keep the binding name `DB`.
3. Apply migrations with `npm run db:remote` only after reviewing the production database target. Add a cron trigger if you enable D1-backed retention cleanup.
4. Store `HASH_PEPPER` and `ADMIN_API_KEY` via `npx wrangler secret put HASH_PEPPER` and `npx wrangler secret put ADMIN_API_KEY`. They are **different** 32+ character secrets. Never store them in Git or public runtime variables.
5. To receive public complaints, first implement Cloudflare anti-abuse controls, privacy operations and moderator procedures; then set `REPORTS_ENABLED=true` in Worker environment. Default is disabled.
6. Apply domain, access-control, WAF/rate-limit and incident-response settings before a public pilot. Run `npm run deploy` only when ready.
7. Give the admin route additional Cloudflare Access protection before staff use. The built-in admin-key check is a pilot gate, not a complete staff identity solution.

## Optional OpenRouter + Resend setup

See [docs/OPENROUTER_RESEND_SETUP.md](docs/OPENROUTER_RESEND_SETUP.md) for the exact variable format, secure Cloudflare secret setup, verified sender requirements, privacy safeguards, test steps and rollout gates.

Both integrations are **off by default**. OpenRouter receives only non-identifying warning codes after an explicit user opt-in. Resend sends only a reference number for new private reports; it never receives an allegation description. Neither service can be verified live without the user's privately installed credentials and the Cloudflare Worker environment.

## API

Without configured D1, only stateless `/api/check`, `/api/health` and an empty directory work. Private reporting and admin routes return `503` until configured. The preview never retains a case or makes external AI/email calls.

- `POST /api/compare` (two user-supplied listings, no storage, D1-backed abuse limits when configured)
- `GET /api/health`
- `POST /api/check` (30 checks/hour/source, D1-backed)
- `POST /api/reports` (4 reports/hour/source, disabled by default)
- `GET /api/professionals`
- `GET /api/admin/reports`, `POST /api/admin/reports/decision`, `POST /api/admin/professionals` (require `X-Admin-Key`)

## Health and runtime verification

`GET /api/health` reports one of: `stateless_preview` (no database, checks are not saved), `migrations_required` (binding exists but required tables are missing), `database_unavailable` (D1 cannot be inspected), or `configured` (all required table names are present). No health status means legal title or agent verification has occurred.

CI runs `scripts/smoke.mjs` against a local stateless Worker, then creates a synthetic local D1 fixture and runs `scripts/smoke-db.mjs`. It tests actual Worker routing, asset/CSP headers, screening, database migration, duplicate signals, private incident workflow and authorization. Tests do not use Cloudflare production resources, live OpenRouter or Resend keys.

## Trust & privacy boundaries
1. Nothing in an automated assessment means a person or title has been officially verified.
2. A matching property with multiple agents is not necessarily fraudulent.
3. Community reports are private until reviewed; there is no auto-published blacklist.
4. Data is not collected for marketing or sold. Reports include free text that may be personal information; restrict access and establish data-subject request, export and deletion procedures before a real public pilot.
5. Rate limits are lightweight D1 hourly limits, not a substitute for Cloudflare WAF, Turnstile, abuse monitoring and operator controls.
6. Do not treat this repository's administrator form as production multi-user authentication.

## Planned next phases
- Real registry and licensing integrations after agreements and lawful access.
- Secure document ingestion, OCR, and human-reviewed evidence provenance (not blanket document authentication).
- Professional onboarding, re-verification and suspension.
- Optional licensed bank or escrow partnership; SafeKey should not hold client funds.
- UX research, pilot metrics, accessibility audit and Nigerian legal/data-protection review.

See [SECURITY.md](SECURITY.md) for launch gates.
