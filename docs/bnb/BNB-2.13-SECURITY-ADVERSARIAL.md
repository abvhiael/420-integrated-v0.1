# BNB-2.13 — Security and Adversarial Hardening

**Canonical scope:** Fraud protection; IDOR/CSRF/XSS defenses; booking races; payment replay, reorgs, refund invariants, recovery and privacy tests.

**Status:** Level 1 exact-SHA qualification pending. No production claims or Level 3 phase closeout.

## Threat boundaries and prior retained evidence
- Independent identity sessions: `active_subject` verifies bearer JWT externally and looks up the active non-revoked session and recovery epoch in PostgreSQL. No cookie-based user-auth grants and no CORS credential grants.
- Booking admission: property-serialized PostgreSQL locking, capacity projections, quote expiry, idempotent request keys, one-use quote binding, independently authorized licence and guest-eligibility checks. Retained adversarial tests include concurrent holds across multiple HTTP clients/processes, calendar changes and booking-request replay.
- Payment: 420Pay is authoritative, never client headers; separate proof-verifying issuer for finality, payout/splits/refunds, canonical chain/asset/payment/invoice/receipt binding, payment replay nonce, completed-stay payout safeguards, recovery-required state for late finality and explicit reorg/finality-revoked input handling. BnB cannot create funds or refund authorizations. Retained PostgreSQL tests cover failure replay, split conservation and partial refunds.
- Confidentiality: private addresses, contact details, guest identity and private messages remain scoped to authorized records. Public Travel, listing and reputation endpoints fail closed when signed property, jurisdiction or licence authority is stale, prohibited or revoked. Moderation and guest review edits retain signed issuer purpose and reviewer replay controls.

## BNB-2.13 implementation increment
- BnB FastAPI HTTP middleware sets no-store by default, nosniff, no framing, no-referrer and a restrictive API content-security policy. Existing explicit privacy headers are preserved.
- `test_bnb213_security.py` adds hostile Origin + forged cookie request attempts, forged moderator/Pay authority headers, cross-property 420Reputation service scope denial, public listing data-minimization checks, HTTP privacy/security header checks, prevention of cross-origin authorization preflight, and static browser DOM-sink assertions against HTML injection and credentialed fetch.
- Retained `test_postgres_adversarial.py`, `test_bnb211_postgres_adversarial.py`, `test_bnb212_compliance.py` and app-specific deployment/browser suites provide booking race, payment replay, financial conservation, reorg recovery, revocation, property IDOR and moderation race coverage. These must PASS again on the final executable SHA; a prior successful run cannot replace it.

## Remediation and remaining acceptance
Document any newly exposed failing test, exact job/run and SHA, then fix the root cause. Before acceptance, inspect source and retained test coverage for actual reorg/finality-on-confirmed-funds response, refund recipient/amount invariants, multi-instance concurrency and recovery audit trails. Do not invent canonical Pay or upstream legal/issuer signoff. Production-equivalent 420Pay reorg, chain finality, settlement, authorized refunds and third-party security acceptance depend on separately administered real official testnet systems and belong on the testnet roadmap, not to an app-only synthetic Level 1 signoff.

**Qualification rule:** Level 1 on one exact implementation SHA; Level 2 retained app integration at material security boundary; Level 3 once at final accumulated BnB audit-phase merge candidate, no duplicate full Foundry/Genesis inventories.
