# SafeKey private professional review desk — controlled pilot

## Scope

This is an **administrator-only coordination system**, NOT title authentication, identity verification, escrow, seller assessment, legal opinion, or approval to transfer funds. It links an internal case reference to a land, house or rental workflow, optionally referencing a professional listed in the existing directory.

The desk is intentionally disabled by default and cannot work in stateless mode. It requires Cloudflare D1 with both migrations applied, an administrator secret, and an explicit `VERIFICATION_DESK_ENABLED=true` **only after the controls below are satisfied**. Deployment to production is not performed by this pull request.

### What the desk does

- Operator creates a private case with a random UUID, transaction type, generalized jurisdiction, and optional professional directory UUID.
- Operator uses the public buyer checklist definitions as a **scope of work**: lawyer/title check, survey/boundaries, inspection, contracts, payee and tenancy checks as relevant.
- Operator records enum-only progress (`requested`, `received_unverified`, `review_reported`, `needs_clarification`), each with one strictly controlled evidence category.
- Each event is appended and cannot be edited via the API. A D1 database trigger also blocks SQL UPDATE to review events (new event needed to correct an old report). Per-case event count is capped at 120.
- `GET` endpoints list private cases and show a chronological audit history. Only the existing `X-Admin-Key`-protected admin path can read these.
- The summary always says `titleVerified: false`, `authorizationToPay: false`; "review reported" is not third-party confirmation.

### Privacy

These tables store **no** client name or address, property address, phone/email, ID numbers, payment details, free-text case description, evidence file, note, media, or allegation. Staff link an internal case reference to their own offline professional correspondence; keep any sensitive record outside SafeKey until dedicated legal, privacy and security safeguards are implemented.

Cases and their events are scheduled for deletion after 90 days **only when the actual D1-backed Worker has a cron trigger configured and functioning**. Without a cron trigger, deletion is NOT automatic; operators must manage approved manual deletion and retention requirements. Database backups require separate lifecycle controls.

### Configuration

Do not add fake D1 IDs to `wrangler.jsonc`. The default stateless Worker configuration remains deployable without a database.

1. Create a real D1 database and bind it as `DB` in the intended Worker environment.
2. Apply `migrations/0001_initial.sql` and `migrations/0002_verification_desk.sql` using Wrangler, carefully selecting the intended local/remote database. Back up production data and review the D1 migration before execution.
3. Set an independent strong `HASH_PEPPER` and `ADMIN_API_KEY` using Cloudflare encrypted Worker secrets.
4. Put the **entire** admin application and all `/api/admin/*` routes behind Cloudflare Access with appropriate staff identity, two-factor authentication and audit logging. The existing shared admin key is insufficient for a multi-staff public service.
5. Add WAF/Turnstile and abuse controls, security monitoring, staff access reviews, backup/retention policy and internal dispute/correction process.
6. After these controls are in place, set `VERIFICATION_DESK_ENABLED=true` as a server-only Worker environment variable. Keep the property reporting and paid OpenRouter/Resend flags off until separately reviewed.
7. Add a scheduled cron `"triggers": { "crons": ["0 2 * * *"] }` to the D1-backed Worker config and verify scheduled cleanup in the correct account. No cron is configured by default because the default Worker has no D1 binding.

### API — all behind administrator authorization

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/admin/verification-cases` | List up to 50 latest private cases |
| POST | `/api/admin/verification-cases` | Create case with `kind`, `jurisdiction`, optional active `professionalId` |
| GET | `/api/admin/verification-cases/:id` | Fetch case, summary and append-only event history |
| POST | `/api/admin/verification-cases/:id/events` | Record `checkId`, `status` and `evidenceKind` |

Unknown fields are rejected (including notes, addresses and contact details), preventing accidental storage of PII in the new desk. No public case lookup route is created. No release-ready professional credential verification is claimed.

### Verification

CI uses a synthetic local Cloudflare D1 instance, applies both migrations and exercises:
- Unauthorized access returning 401.
- Case creation and UUID fields.
- Data minimization rejects arbitrary client contact fields.
- Event history creation, invalid "verified_title" rejection, and case summaries that never certify.
- Stateless mode denying all admin actions.

The test setup adds `VERIFICATION_DESK_ENABLED=true` in a **temporary** .dev.vars file generated within GitHub Actions only; it does not enable the production feature.

**Limitations:** A shared administrator API key lacks per-reviewer identity attribution. A later version needs staff SSO, reviewed professional credentials, signed evidence provenance and independent title-registry partnerships before the service can make substantiated verification claims.
