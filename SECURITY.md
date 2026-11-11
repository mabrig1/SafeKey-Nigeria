# Security and launch conditions

This is a controlled pilot. It processes allegations and potentially sensitive property details. Do **not** promote it as government-backed or legally conclusive.

## Before accepting real public data
- Complete privacy notices, lawful processing assessment, retention/deletion procedures, moderator access reviews and secure disclosure channels.
- Configure separate strong secrets for HASH_PEPPER and ADMIN_API_KEY. Use Cloudflare Access for admin routes, with real multi-user identity and audit trail before scaling.
- Add Turnstile/WAF rules for reporting endpoints and watch for repeated submissions. Current D1 rate buckets are defense-in-depth only.
- Arrange official registry and professional verification processes before claiming a positive verification result.
- Assess data breach management, access logging, backups, disaster recovery and deletion consistency.
- Manually review all allegations; provide correction, right-of-reply and escalation procedures. No automatic negative reputation badges.
- Perform independent penetration testing and privacy/legal review for Nigerian launch.

## Handling suspected vulnerabilities
Do not put sensitive personal information or exploit details in a public issue. Contact the repository maintainer privately.

## Intentional limitations
Automated checks are heuristic; no OCR, AI model inference, public fraudulent-person registry, live credential lookups, bank integration or escrow. Only hash-based correlations across previous inputs, which can be inaccurate. Report statuses are admin-internal.


## Benchmark-driven comparison & local evidence kit

- `POST /api/compare` only compares manually entered listing fields. The application does **not** fetch submitted URLs (avoids SSRF and scraping) or persist their content. D1-backed mode maintains separate, short-lived anonymous request-rate counters. Configure Cloudflare WAF, Turnstile and operator limits before public exposure, particularly when running statelessly without D1.
- Duplicate textual references are not verified property identities. Different prices, phones or payees are **questions requiring evidence**, never assertions of criminal wrongdoing. Do not add public reputation penalties automatically.
- The browser's evidence SHA-256 kit never uploads files or fingerprints. It is capped at 15 MB per file, 12 entries per browser session, and uses no localStorage or server database. Downloaded JSON files can contain sensitive filenames, source labels, and free-text notes: users must protect them.
- A hash only establishes whether bytes match; it says nothing about whether a deed, receipt or image is authentic or issued by an authorized body.
- No third-party GitHub code was copied in this benchmark upgrade. See `docs/GITHUB_BENCHMARK_2026-11-10.md`.

## Buyer due-diligence workspace

- The checklist is session-memory only. No server writes, cookies created by the feature, localStorage or uploads. Closing or reloading the tab discards unsaved progress.
- Downloaded JSON can contain sensitive notes. Imports use a strict versioned schema, known jurisdictions, known task IDs, allowed states, 240-character notes and a 64 KB file limit.
- Checklist statuses are self-reported and cannot become a legal verification, ownership certification, or SafeKey authorization to pay.
- Only maintained agency starting-point links are shown for Lagos, FCT and Enugu. Other jurisdictions get an explicit "not listed" message; no government database is queried.

## Private professional review desk

- `VERIFICATION_DESK_ENABLED` is `false` by default. The desk is behind existing admin authorization, but production must also enforce Cloudflare Access/SSO, MFA and per-staff audit before use.
- Case tables store only random UUIDs, property kind, general jurisdiction, optional directory reference and structured review status/evidence enums; never client contact, property address, attachments, payments or free text.
- Review events are append-only; a database trigger blocks UPDATE. For correction, append a new event. Automatic 90-day case deletion requires a configured, functioning Worker cron; default stateless config has no cron.
- `review_reported` is not proof of credential verification or authenticated land title. See `docs/PROFESSIONAL_VERIFICATION_DESK.md`.
