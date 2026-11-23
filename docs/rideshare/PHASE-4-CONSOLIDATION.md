# Phase 4 — LIFTd historical PR reconciliation

**Scope:** Historical open PRs #742, #740, #717, #676, #658, #657, #656, #655, #653, #652, #651, #650, #649, #646 and #633. Reconcile against current `main`; do **not** merge obsolete diverged branches or claim live transport certification.

## Canonical implementation

- L01 rider/driver backend, signed authorization, immutable PostgreSQL trip/quote/location/financial/event stores, idempotent Pay/Wallet intent + consent, finality/reorg/refund/driver payout projections and audit safety were merged via [#661](https://github.com/abvhiael/420-integrated-v0.1/pull/661), merge SHA `d3310d153e7ccc71f5ded95639aadfd7a6f6e682`. Retain [L01.10 Level 3 certificate](L01.10-LEVEL3-CERTIFICATE.md).
- L02.1–L02.7 protected role-based rider/driver UI, account preferences, pickup/place/route preview, explicit quote consent, lifecycle, private onboarding and driver offers were reconciled via [#664](https://github.com/abvhiael/420-integrated-v0.1/pull/664), merge SHA `9aa207b9ab8c30b470bd05dd5ed76b7d0807989e`. Retain [L02 main qualification evidence](L02-MAIN-RECONCILIATION-QUALIFICATION.md) and later L02.8–L02.13/M-L02-B coverage.
- The current, stronger `rideshare/src/trip-communications.mjs` (PT-05), supported by `rideshare/test/trip-communications.test.mjs`, supersedes the unmerged L02.7-era `rideshare/src/scoped-messaging.mjs` in #658. It requires independently owner-issued Messenger grants and rechecks trip membership/assignment/revision, subject/account/session/device/recovery epoch and notification consent after async boundaries. The old prototype is **not** restored.
- Current Pay/Wallet/Treasury projections and controls supersede historical L01 code; [LIFTd canonical compatibility gates](LIFTD-CANONICAL-COMPATIBILITY-GATES.md) records the resolved **10%** development-compensation cap while leaving actual operations and live settlement fail closed.

## Historical PR disposition and preservation

| Historical PR | Disposition / preserved surface |
| --- | --- |
| #742 | Unique public `/drive` landing retained in this replacement, with all four already-present owner-supplied driver images; the protected `/driver` workspace remains role gated. |
| #740 | Superseded **without merging its blocked branch**: `main` already contains `rideshare/web/assets/liftd-official-logo.png` (Git blob `45df9ff77f5efc592ce0eedd18ddc9db4e989943`) and `favicon.ico` (Git blob `5b41d5c6622e312601c1b8768288cb858852dcd7`), wired into existing header/footer/favicon. The historical no-merge restriction was investigated against the original 1536×1024 owner-approved LIFTd “arrive higher” Library PNG: **byte-for-byte identity is verified**, SHA-256 `0eae68ec0b22e227df57eb8aa44a58dd995515e2dff41089e2c553c98c356766`, calculated Git blob `45df9ff77f5efc592ce0eedd18ddc9db4e989943`, exactly matching the GitHub object for the existing master. The actual favicon binary also exists and is wired. The blocked historic branch is not merged because current main already contains the validated artwork. |
| #717 | The standalone PT-06 threat model, security/privacy review packet and open-risk register are copied unchanged into this replacement; all independent/deployed acceptances remain NOT ACCEPTED. |
| #676 | M-L02-B historical head was confirmed a Git ancestor of current main (ahead 0 / behind main). Retain existing Level 2 local journey qualification evidence. |
| #658 | The short-lived signed-session messaging prototype is superseded by the PT-05 canonical Messenger integration and stricter post-await trust checks on main. No self-issued transport credentials or premature live messaging. |
| #657 | Driver availability/offers and role/assignment/revocation tests retained in canonical L02 implementation, with explicit server-authoritative acceptance/decline. |
| #656 | M-L02-A signed-session, PostgreSQL and rider/driver integration retained in main with milestone evidence. |
| #655 | Private driver onboarding, evidence-reference metadata and reviewer separation retained; **this replacement additionally restores the missing protected onboarding panel mounting** alongside the existing driver availability and trip controls. No self-approval or public document bytes. |
| #653 | Rider confirmed-trip, cancellation and safety flows retained in main. |
| #652 | Quote-expiry, full fare disclosure, hash/amount explicit consent and idempotent ride commands retained. |
| #651 | Permissioned/manual pickup and destination, privacy-preserving provider route preview and stale-response rejection retained. |
| #650 | Role-bound rider account preferences, opt-in privacy defaults and optimistic concurrency retained. |
| #649 | Accessible role-gated rider/driver/operator app shell retained and extended in main. |
| #646 | **DO NOT MERGE**, qualification-only historical PR. Preserve historical exact-head qualification intent and separate Solidity/Genesis owner boundaries. Actual L01 foundation subsequently merged through #661 with a retained Level 3 certificate. Close historical #646 *only as superseded*, never merge its stale qualifying head. |
| #633 | Foundation authorization, location privacy, idempotent trip/dispatch, quote/consent, payment/refund/finality, conserved financial projections and safety retained through merged #661 and later revisions. |

## Qualification and release limits

The protected `/driver` route now mounts the retained driver onboarding/remediation UI with the independently authenticated session adapter; a missing adapter displays an unavailable state and cannot grant approval. The existing teardown clears this UI on role/session changes. A regression test pins the protected mounting and prevents a disconnected onboarding panel from lingering.

The public `/drive` route is **marketing only**; it does not create driver applications, invoke a recruitment service, grant any driver session, accept ride requests or dispatch, or authorize Pay/Wallet movement. Verify `rideshare/web/package.json` `npm run check` through the dedicated LIFTd web Level 1 owner on the replacement exact SHA; preserve all existing rider and protected driver route regressions. PT-06 is evidence only and does not make independent security, privacy or regulator acceptance PASS.

All external/testnet conditions in [production acceptance register](L02-PRODUCTION-ACCEPTANCE-REGISTER.md) and [testnet work roadmap](LIFTD-TESTNET-WORK-ROADMAP.md) remain **NOT ACCEPTED / NO-GO**: real passenger transport and driver/vehicle/insurance licensing, independent Identity/session keys, location-provider privacy, approved vault/reviewer, real Messenger and notification, independently tested WCAG/device experience, production access/monitoring/backup/recovery, actual Wallet/Pay/Treasury finality/refund/settlement/driver payout, and verified approved compensation. Offline fixtures and projections cannot enable live rider bookings, driver offers or payment execution.

**Final closure rule:** Close historical branches only as superseded after the replacement's exact-head affected qualification passes and its merge is verified on `main`. Do not merge #646 or #740. The source-master SHA-256 is independently calculated and pinned in `rideshare/web/test/official-brand-assets.test.mjs`. This safeguards exact logo bytes and dimensions on each affected web qualification. The historical #740 branch remains unmerged as redundant, not as an implicit override of the original prohibition.
