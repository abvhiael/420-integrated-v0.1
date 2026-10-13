# DOOBr R04.8 — Canonical Notifications and Arbitration routing

Canonical step: **R04.8 Notifications and Arbitration routing**. PR #601; branch `roadmap/doobr-bc-vancouver-infrastructure`. Inspected `main` SHA: `bc0faa5dafecda3de0620a9581f9953b89cd95fb`, with branch 361 commits ahead and 1110 behind at inventory. Level 1 app-scoped. No new Solidity contract, payment authority, notification infrastructure or local adjudicator.

## Implementation
`doobr/canonical_routing.py` accepts only opaque tenant/case/event references and narrowly allowlisted delivery-related notification or dispute categories. 420Notifications and 420Arbitration retain transport and adjudication respectively. A configured canonical router must independently authorize and authenticate the request, deduplicate or journal delivery via its canonical service and return an authenticated receipt with matching tenant, references, service, issuer, accepted status and valid time. DOOBr checks those bindings and rejects mismatched, unavailable, stale, future, unapproved, cross-service and malformed requests. No private recipient names, addresses, GPS or arbitrary textual message bodies are forwarded by this boundary. 420Arbitration decisions are **not** inferred from acceptance receipts; DOOBr may only submit case references and never rule on disputes.

The R02.11 tenant-scoped outbox remains the required reliable delivery/replay infrastructure; R04.8 itself does not directly wire real canonical API endpoints, guarantee remote delivery, or create permissions. Any integration needs independently authenticated service credentials, live endpoint tests and durable idempotent correlation. Existing transaction release gates remain disabled.

## Targeted qualification
`doobr/storage/tests/test_canonical_routing.py` checks positive Notifications and Arbitration routing, tenant/issuer/reference/service spoof denial, privacy-invalid fields, invalid categories, negative status, future-dated receipts, and outages. `.github/workflows/doobr-r04-8-level1.yml` checks exact implementation SHA before/after, runs routing and retained outbox tests, and R04.1 frozen authority inventory. No global Foundry, Genesis, integrated or Docs inventory is warranted.

**Implementation SHA:** `a5ccc6c80978251831f9cc0d3d336b1c0cb7340d`. Targeted Level 1 CI **PENDING verification**. Live canonical Notifications/Arbitration authentication, delivery acknowledgments, adjudicator permissions and release gates remain deferred to existing testnet roadmap; not counted PASS.

**Next canonical step:** R04.9 Payment conservation, canonical Dev Compensation Vault routing, cancellation, duplicate callback and refund tests.
