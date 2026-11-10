# SafeKey Nigeria — Check Before You Pay

**Working pilot, not a property-title verification service.** A mobile-first, independent early-warning tool for Nigerian property buyers and renters. The pilot identifies inconsistencies in *submitted data* and prior SafeKey submissions. It does **not** query any official land registry, verify licences, run OCR, hold deposits, or guarantee a safe transaction.

## What works in this MVP
- Responsive site with a practical property/agent/listing intake form.
- Server-side rules covering questionable payment instructions, advertising language, incomplete details and conflicting prior submissions. All findings name their evidence source and limits.
- Hash-based historical cross-checks: submitted raw phone numbers, full addresses, and full URLs are **not** stored in the check-history table.
- Printable risk report, next-step checklist, and clear unverified status (never a fake 90/100 safety score).
- Private, rate-limited incident reporting to a human moderation queue (off unless enabled).
- Admin-only report review and a directory of manually verified professionals; directory starts empty.
- Scheduled deletion of check history after 30 days and some closed/unreviewed reports after 180 days.
- Unit tests, restrictive CSP, no secrets in the browser, and no automatic public blacklist.

## Stack
Cloudflare Worker + D1 + plain HTML/CSS/JavaScript. No paid AI API, mobile build service or complex runtime dependencies. This is deliberate: avoid making unsupported verification claims and keep the first pilot inexpensive. The system is organized so authenticated registry integrations, document OCR and professional evidence workflows can be added as separate modules later.

## Local setup
1. Install Node.js 20+ and run `npm install`.
2. Copy `.dev.vars.example` to `.dev.vars`; replace both secrets with independent random strings of at least 32 characters. Keep this file out of Git.
3. Run `npm run db:local` to initialize the local D1 database.
4. Run `npm run dev`; open the local URL Wrangler prints.
5. Run `npm run check && npm test`. For now the admin credentials are entered manually in the browser each session (not stored by the client).

## Cloudflare deployment — **do not deploy before the review**
1. Create a real D1 database: `npx wrangler d1 create safekey-nigeria`.
2. Replace the all-zero placeholder `database_id` in `wrangler.jsonc` with the actual ID. Keep the binding name `DB`.
3. Apply migrations with `npm run db:remote` only after reviewing the production database target.
4. Store `HASH_PEPPER` and `ADMIN_API_KEY` via `npx wrangler secret put HASH_PEPPER` and `npx wrangler secret put ADMIN_API_KEY`. They are **different** 32+ character secrets. Never store them in Git or public runtime variables.
5. To receive public complaints, first implement Cloudflare anti-abuse controls, privacy operations and moderator procedures; then set `REPORTS_ENABLED=true` in Worker environment. Default is disabled.
6. Apply domain, access-control, WAF/rate-limit and incident-response settings before a public pilot. Run `npm run deploy` only when ready.
7. Give the admin route additional Cloudflare Access protection before staff use. The built-in admin-key check is a pilot gate, not a complete staff identity solution.

## API
- `GET /api/health`
- `POST /api/check` (30 checks/hour/source, D1-backed)
- `POST /api/reports` (4 reports/hour/source, disabled by default)
- `GET /api/professionals`
- `GET /api/admin/reports`, `POST /api/admin/reports/decision`, `POST /api/admin/professionals` (require `X-Admin-Key`)

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
