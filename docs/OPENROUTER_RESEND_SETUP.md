# SafeKey — OpenRouter + Resend setup

Both integrations are optional, server-side, **disabled by default**, and separate from the rule-based screening engine.

## 1. Format

Use the exact variable names below. API key prefixes shown are illustrative, **not actual credentials**.

| Setting | Format | Type | Purpose |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | full `sk-or-v1-…` token | Secret | Authenticates OpenRouter |
| `OPENROUTER_MODEL` | e.g. `openai/gpt-4o-mini` | Server variable | Your chosen model; check its current availability and price |
| `AI_EXPLANATION_ENABLED` | `false` / `true` | Server variable | Controls optional AI guidance |
| `RESEND_API_KEY` | full `re_…` token | Secret | Authenticates Resend |
| `RESEND_FROM_EMAIL` | `notifications@your-verified-domain.example` | Server variable | Verified sender in your Resend account |
| `ALERT_RECIPIENT_EMAIL` | `moderator@example.com` | Server variable | Private moderator inbox |
| `EMAIL_ALERTS_ENABLED` | `false` / `true` | Server variable | Enables report reference alerts |

**Do not paste actual API keys into ChatGPT, GitHub, issues, browser settings, source code or a public environment file.** If a key was ever shared publicly, revoke it and issue a replacement.

### Local development
1. Copy `.dev.vars.example` to `.dev.vars`. The latter is gitignored.
2. Replace the placeholder keys with your actual **full** tokens.
3. Set `OPENROUTER_MODEL` to a currently supported model in your OpenRouter dashboard. The example model may be billed; set a provider spending limit before enabling.
4. Set `AI_EXPLANATION_ENABLED=true` to test the optional checkbox. Keep `EMAIL_ALERTS_ENABLED=false` until the sending domain is verified.
5. Run `npm run db:local`, then `npm run dev`. Use the preliminary-check form and tick the optional AI checkbox.
6. For email testing, use a verified Resend domain, valid sender and moderator inbox. Enable `REPORTS_ENABLED=true` and `EMAIL_ALERTS_ENABLED=true` only in a controlled **local/test environment**, then submit a dummy (non-personal) incident report. Check Resend delivery logs.

### Cloudflare Worker secrets
When a Worker and its D1 database are ready, use **Cloudflare dashboard → Workers & Pages → safekey-nigeria → Settings → Variables and Secrets**.
- Add `OPENROUTER_API_KEY` and `RESEND_API_KEY` with **Secret** type (encrypted).
- Add `OPENROUTER_MODEL`, `AI_EXPLANATION_ENABLED`, `RESEND_FROM_EMAIL`, `ALERT_RECIPIENT_EMAIL`, `EMAIL_ALERTS_ENABLED` as Worker environment variables. Begin with both flags `false`.
- Add the app's existing `HASH_PEPPER` and `ADMIN_API_KEY` separately as **Secret** values.
- Complete the D1 `database_id` binding and migrations; the repository still contains a placeholder ID.
- Only enable either integration after testing permissions, account budgets, domain verification, data handling and the public pilot's moderation controls.

Alternatively, on an initialized Worker project with authenticated Wrangler, secret values can be entered interactively:

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put RESEND_API_KEY
```

Do not type actual tokens into the commands, only into Wrangler's private prompt. Changing secrets may create a deployment; review the targeted environment before performing operations.

## 2. What SafeKey sends to each provider

**OpenRouter**: after a user opts in and an operator enables the feature, SafeKey sends only property category (`land`, `house`, `rental`) plus generic risk-code names such as `payment_name`, and a statement that no official verification has occurred. It does not forward property address, listing text, names, phone numbers, URL, uploaded files or report descriptions. The generated three questions are labelled AI suggestions, not evidence. Failed AI calls do not block standard screening. Requests are limited to eight per source per hour, in addition to screening limits.

**Resend**: when private reporting is enabled and a user submits a report, SafeKey stores it in D1 and optionally emails the moderator a random case reference only. No report body, location, person, description or file is included. Email failures never block the accepted report. Delivery requires a Resend-verified sender domain; **API key validity alone does not prove sender verification**.

## 3. Costs, abuse and limits

- OpenRouter costs vary with model/provider and usage. Use a restricted API key, budgets and low maximum token count. The current implementation uses `max_tokens: 210`, a six-second timeout and eight optional AI requests per source per hour. Cloudflare WAF and stronger user-based limits remain required for a public pilot.
- Resend requires domain verification (including the required DNS records). Begin with a private test recipient and use provider logs to confirm acceptance and delivery.
- Neither provider authenticates property titles, agents, seller identities or payments.
- The app does not collect client email addresses or send buyers transaction-related emails in this phase.
- Confirm NDPA and relevant cross-border processor obligations before enabling integrations for real individuals.

## 4. Validation and troubleshooting

```bash
npm run check
npm test
npx wrangler deploy --dry-run --outdir /tmp/safekey-bundle
```

If the optional AI checkbox returns "disabled", verify the Worker has both an enabled flag and a server-only OpenRouter token + model. If "unavailable", verify provider quota/model and server logs without logging secrets. If Resend alerts do not arrive, first verify `REPORTS_ENABLED`, `EMAIL_ALERTS_ENABLED`, sender domain/DNS, recipient, and Resend logs. Do not assume a stored report means an email was successfully delivered.

## 5. Production release gates

Before public traffic: implement protected moderator identities (Cloudflare Access or equivalent), consent and data-subject workflows, abuse resistance, legal and privacy review, reliable observability, a verified sender domain, a conservative OpenRouter budget, and end-to-end integration tests. Do **not** merge/deploy merely because a dry-run passes.

Official references: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request and https://resend.com/cloudflare
