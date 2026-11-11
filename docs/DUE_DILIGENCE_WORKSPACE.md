# Buyer due-diligence workspace — SafeKey Nigeria

Implemented: 2026-11-11. All tasks and status labels are **buyer-entered notes**; neither SafeKey nor a government agency has checked the property.

## What is included

- Select purchase of land, purchase of a house or a rental; choose Lagos, FCT, Enugu or another Nigerian state.
- Receive a transaction-specific checklist identifying who should perform each action and what evidence to request.
- Mark a task as not started, information requested, documents received **unverified**, or independent review **reported by buyer**. No completion flag means SafeKey verified any claim.
- Add a short private note (maximum 240 characters) per task. The app does not request government IDs or bank details.
- Download a portable versioned JSON checklist and restore it by selecting the local file. Imports are limited to 64 KB and validated against the known schema, tasks, states and note bounds; no arbitrary data gets rendered as HTML.
- Read selected agency service pages as **external navigation links**, never as integrated search results.

## Reviewed source destinations — 11 November 2026

These are manually selected service starting points, not evidence that SafeKey accessed any registry records.

| Jurisdiction | Agency source | Starting URL |
| --- | --- | --- |
| Lagos | Lagos State Land Administration Portal | https://landonline.lagosstate.gov.ng/ |
| Lagos | Lagos State Lands Bureau | https://landsbureau.lagosstate.gov.ng/ |
| FCT | Abuja Geographic Information Systems (AGIS) | https://www.agis.fcta.gov.ng/services/ |
| Enugu | Enugu State Geographic Information System (ENGIS) | https://engis.enugustate.gov.ng/services |

Links may change, online searches may require registration, fees or professional involvement, and a website alone cannot certify ownership. For other Nigerian states, the app does not invent an official portal.

## Privacy and lifecycle

The workspace lives in **session memory** in the browser. It uses no `localStorage`, no backend writes, no cookies created by this feature and no API calls. Changing property type or state by starting a new checklist resets this workspace. Reloading, closing or navigating away discards unsaved changes. A JSON file is created only when a user explicitly clicks Download.

Users should store exported JSON privately because notes can contain sensitive information. Local export/import does not transmit the file to SafeKey. Avoid including passwords, ID numbers, bank account details or unsubstantiated accusations.

The 'Independent review reported by buyer' status records a **user assertion**, not validation by SafeKey or proof of a qualified professional's identity. Progress is never a numerical safety score and can never clear a payment.

## Tests

`npm test` includes task composition, invalid state and note handling, export/import JSON round-trips, jurisdiction-source restrictions and the fact that progress never yields a safe-to-pay verdict. CI also serves the website, checklist core and UI from a real local Wrangler Worker. No live Cloudflare database or external API keys are needed.

## Future integrations — not implemented

- Formal lawyer/surveyor onboarding and evidence-backed professional review.
- Official title-registry search partnerships and provenance verification.
- Private, consent-based server workspaces with verified identity, retention policy and audited access.
- Secure evidence uploads with malware scanning, access controls and data-subject deletion workflows.

Do not call this a legal-title verification service until those controls and data partnerships exist.
