# DOOBr R04.2 — Approved provider credential/Registry reference adapter

Canonical: **R04.2 Only approved provider credential/registry reference contract/adapter**. Preserve R04.1 no-duplicate-authority decision: **off-chain adapter selected, no new Solidity contract, frozen address or Genesis application**. PR #601; audit branch `roadmap/doobr-bc-vancouver-infrastructure`. Main SHA inspected `835e9ec8a43481f65f0b68ae83b399743efee5b2`, 337 ahead/1108 behind at inspection.

Repository implementation: `doobr/provider_registry_adapter.py` consumes independently signed canonical credential evidence and live registry-binding decisions, with explicit trust allowlists and exact tenant/provider/issuer/category, positive approval reference, bounded identifiers, interval validity, revocation and fail-closed rejection for missing/negative/outage responses. Adapter does NOT independently cryptographically verify signatures; the configured external authority MUST do so and enforce audience, algorithms, key rotations, issuer trust and token revocation. It does not issue a credential, license, policy, payment or service permission. `doobr/storage/tests/test_provider_registry_adapter.py` includes negative role/category, expiry, revocation, cross-provider/tenant, missing trust and outage tests. `.github/workflows/doobr-r04-2-level1.yml` runs the targeted unit tests and retained R04.1 canonical reuse guard with exact-SHA pre/post verification.

External staging/testnet acceptance remains NOT COMPLETE: approve authority endpoints and trust roots, independent provider/licensing approvals, live canonical Verify/Registry credential binding, key rotation/revocation and genuine service identity. Those are captured by DOOBR-AUDIT-9/10 and R06. No local simulation proves regulatory eligibility or permits operations.

**Implementation SHA:** `663cf32a843e79befe78853b9389c8bc749b3386`. Level 1 must finish PASS before R04.2 can be recorded complete. R04.11 app protocol Level 2 and R05.10 exact-SHA Level 3 are intentionally not executed here.

**Next canonical step:** R04.3 Minimal delivery attestation commitments without PII.
