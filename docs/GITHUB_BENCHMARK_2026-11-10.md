# SafeKey Nigeria — Open-source benchmark and feature adoption

Review date: 2026-11-10. Goal: borrow **product patterns and interaction ideas**, not third-party copyrighted source. Nothing from the compared repositories was copied into SafeKey. All implementation files for this upgrade were written independently.

## Repo-by-repo benchmark

| Repository | Evidence from its project documentation | Borrowable concept | SafeKey treatment |
| --- | --- | --- | --- |
| [orangecoding/fredy](https://github.com/orangecoding/fredy) | Multi-portal property monitoring, duplicate suppression, scam heuristics, notifications. GitHub reports Apache-2.0 license. | Compare overlapping advertisements; show understandable signals instead of vague outputs | Implemented conservative, buyer-entered cross-listing comparison. No scraping or notifications added. |
| [abracadabra50/open-properties](https://github.com/abracadabra50/open-properties) | Source-normalized listing schema, deduplication and provider adapters. GitHub reports MIT license. Current supported sources are outside Nigeria. | Normalize fields before checking cross-listing consistency | Implemented Nigerian area/address/plot, agent phone and NGN price normalization. No foreign sources or credentials required. |
| [ajsark419/PropVerify](https://github.com/ajsark419/PropVerify) | Owner identity, property document and listing approval stages; admin review. README states MIT licensing. | Explicit provenance, multiple distinct checkpoints, human role in verification | Evidence manifest and buyer-controlled independent-check workflow. Do **not** introduce a public 'verified owner' badge without actual official searches and governance. |
| [NilayRaut/rentsentry](https://github.com/NilayRaut/rentsentry) | Rental scam red flags, presentation and local history; numeric trust score; optional remote scraping and LLM. No license permission verified in this review. | Plain-English fraud signals, portable results | Explain contradictions and next steps; reject numeric 'safe' scores and remote scraping of buyer links. |
| [ladurshan-dev/LandGuard](https://github.com/ladurshan-dev/LandGuard) | Modular rule engine and clean architecture; README explicitly describes a dummy government registry. No license permission verified in this review. | Keep domain rules separate, testable, and clearly distinguish simulations | `src/comparison.js` contains pure, tested logic. Never claim a simulated registry is a live Nigerian government record. |

## 2026-11-10 adopted changes

### 1. Cross-listing radar — compare two user-provided offers
- `POST /api/compare` accepts two structured user-supplied listing records.
- Uses Nigerian area/address/plot, link, phone, advertiser, payee and NGN price.
- Compares payment recipient, contact number, price and property descriptions only after a *textual* location or plot-reference match.
- Returns `status: comparison_only`, provenance text, clear caveats and next steps — never a fraud verdict, public accusation or safety score.
- No upstream scraping, no ownership registry lookup, and no stored listing/comparison data. In configured D1 mode, an anonymized rate-limit counter is written; no listing fields are retained.

### 2. Private evidence fingerprint kit
- Hash selected local files using browser WebCrypto SHA-256, with a 15 MB per-file limit.
- Add user-entered source labels and short private notes, up to 12 items.
- Export an explicit portable `safekey.local-evidence-manifest.v1` JSON bundle; clear entries on demand.
- Raw files never leave the browser, and the app neither uploads nor stores the fingerprints.
- Hashes only establish whether file bytes match. They **do not authenticate the contents**, sender, title, signature, ownership or date.

### 3. Stronger local verification
- Unit tests for comparison edge cases and hash correctness.
- Actual Worker HTTP smoke tests for `/api/compare` and static scripts.
- Real local D1-backed smoke tests ensure the comparison works with a bound database but remains an unverified, non-persisted operation.

## Deliberately postponed

- Automatic scraping of private Facebook/WhatsApp listings, social accounts or seller contact information, because platform permissions, privacy and anti-abuse obligations are unresolved.
- 'Safe Deal Score', automatic scam labels, fraud blacklists and official registry badges: not defensible on user-entered evidence alone.
- OCR and evidence uploads: require secure object storage, malware scanning, access controls, retention/deletion policies, and explicit consent.
- Public contact identities for alleged scammers: high risk of misidentification and defamation.
- Escrow, bank payments, land-title endorsements and paid professional certification: each needs legal/partner approval.

## Product measurement proposals (not measured results)

- Number of completed comparisons, and fraction that reveal *discrepancies to clarify* (not confirmed fraud).
- Buyer comprehension of differences between 'textual match' and official land-title verification.
- Proportion of users who request independent title checks before payment.
- Evidence manifest export rate; voluntary user feedback on whether offline records improved documentation.

## Licensing and contribution hygiene

This benchmark uses observed repository features as inspiration only. No copied code or third-party visual assets were introduced. License metadata in GitHub/README may change; verify the exact file's license and attribution conditions before importing any actual upstream source code. This product is not an official integration with the listed GitHub projects.
