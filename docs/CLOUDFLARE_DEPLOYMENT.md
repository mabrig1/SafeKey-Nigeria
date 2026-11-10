# Deploy SafeKey to Cloudflare without invalid database bindings

## Why the original build failed

The Cloudflare build was linked to the GitHub `main` branch while application source and `wrangler.jsonc` lived only on `feat/safekey-check-mvp-20261110`. An empty `main` does not provide Wrangler's required entrypoint.

The previous feature-branch `wrangler.jsonc` also contained an all-zero `database_id` placeholder. This is **not** a real D1 database ID and must never be used to deploy a D1 binding.

## Safe rollout

The default configuration now deploys the mobile-first SafeKey website and **stateless preliminary checks** without D1 or API secrets.

In stateless preview mode:
- property checks are evaluated but **not saved**;
- previous submissions are not compared;
- private reports, moderation, and verified professional uploads remain disabled;
- OpenRouter and Resend calls are not made;
- the health endpoint returns `stateless_preview`.

Cloudflare settings on the screenshot can remain:
- Root directory: `/`
- Build command: `None` (no compilation needed)
- Deploy command: `npx wrangler deploy`
- Production branch: `main` (requires tested app code to be merged into main)

The Wrangler `name` must match your actual Worker name in Cloudflare. This repository uses `safekey-nigeria`. If your Worker is named differently, update `wrangler.jsonc` or confirm Cloudflare's name override before deployment.

## Configure D1 to enable stored screening and protected features

1. Open the Cloudflare dashboard → Workers & Pages → D1 SQL Database, and create a database called `safekey-nigeria`. Copy the **real** database UUID.
2. Add this to `wrangler.jsonc` immediately before the final closing brace (add a comma after the `assets` object):

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "safekey-nigeria",
    "database_id": "YOUR_REAL_D1_UUID",
    "migrations_dir": "migrations"
  }
],
"triggers": { "crons": ["0 2 * * *"] }
```

3. Create separate private secrets for `HASH_PEPPER` (minimum 32 characters) and `ADMIN_API_KEY` (minimum 32 characters) in **Worker Settings → Variables and Secrets**.
4. Run `npx wrangler d1 migrations apply safekey-nigeria --remote` only after confirming the intended Cloudflare account and database, then update and deploy the version with D1 binding.
5. Verify `GET /api/health` reports `configured` and `database: ready`. The health check now queries the D1 schema, rather than assuming the presence of a D1 binding means migrations were applied. If it reports `migrations_required`, apply the correct migrations; if `database_unavailable`, investigate D1 connectivity and permissions. For `stateless_preview`, no database and no case persistence are enabled.
6. Keep `REPORTS_ENABLED=false`, `AI_EXPLANATION_ENABLED=false`, and `EMAIL_ALERTS_ENABLED=false` until data protection, moderator identity, consent, anti-abuse and provider setup are finished.
7. Configure API keys through encrypted **Cloudflare secrets**, not Git or client-side code; see [OPENROUTER_RESEND_SETUP.md](OPENROUTER_RESEND_SETUP.md).

## Check the build

Open the Cloudflare Worker → Deployments → build logs. A successful GitHub Actions `wrangler deploy --dry-run` checks bundling only, **not** account permissions, D1 IDs, production configuration or the active domain.

If a deploy still fails, inspect the **first error** under the Deploying step. Possible follow-on causes:
- Wrangler Worker name and dashboard project name differ
- build token is invalid, revoked, expired or has insufficient Worker deployment privileges
- missing or invalid D1 database binding (only after enabling D1)
- Cloudflare account mismatch, Workers subdomain or account policy

Do not use a fake UUID to suppress errors. A safe stateless app is preferable to publishing misleading verification results.

Cloudflare references:
- https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/
- https://developers.cloudflare.com/workers/wrangler/configuration/

## Automated verification

The CI workflow now runs `scripts/smoke.mjs` against a real **local** Wrangler Worker. It checks that static HTML/CSS/JavaScript and the privacy page load, that security headers are present, that the health endpoint reports stateless mode, that screening returns an unverified report, that invalid inputs fail, and that admin/report features remain closed without D1.

This is stronger than a bundle-only dry-run, but **it is not proof that Cloudflare production is deployed**. It requires no Cloudflare account credentials, has no database, and never contacts OpenRouter or Resend.

For live release validation, inspect the Cloudflare Deployments tab for the commit currently on `main`. After a successful deployment, open its actual **published** Worker hostname and check:

- `GET /api/health` responds with the expected mode.
- `/`, `/styles.css`, `/app.js`, and `/privacy.html` all load.
- Run a fictional, non-personal property check and confirm the result is explicitly unverified.
- Confirm that real property reports remain disabled until secure D1, access controls, and policies are configured.
- Verify the first error in Cloudflare logs if the build fails; GitHub green checks do not prove Cloudflare deployment permissions.

Do not publish a guessed workers.dev address; use the actual Workers & Pages URL shown in the account.
