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
