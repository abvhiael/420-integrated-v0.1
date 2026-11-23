# Phase 2: Genesis Application Decision #2 reconciliation

This record preserves the historical owner-authorized 2026-10-18 29-application expansion decision from Genesis PR #734 as `config/genesis-application-decision-2.json`, with identical source Git blob `914b1d6290f4e0fa42cf79d4d53807ac51e21983`.

**Authority hierarchy:** `config/genesis-applications.json` remains the current definitive 22-entry Genesis launch catalog (including the later explicit Arcade deferral and 420 Pay inclusion amendment). The Decision #2 entries are **release-disabled candidates**. Archiving them does not add them to active genesis, deploy contracts, enable on-chain services, modify addresses/token allocations, waive legal approvals, or override project-specific testnet gates.

The candidate registry records names, classification, existing service ownership, scope and release gate. To activate a candidate, reconcile the latest service ownership and governance decision, then run the full canonical catalogue verification on an exact candidate SHA with explicit authority and deployment qualification. This migration closeout is not approval of the historic 51-entry snapshot.

The checked-in `scripts/migration/verify-phase2-genesis-candidates.mjs` fails closed if any archived candidate becomes release-enabled, identities collide, the frozen 22-entry catalog drifts, or the 420 Gaming Protocol, 420Pay and Arcade deferral disappear. It is run by `.github/workflows/phase2-genesis-catalogue-candidates.yml`.

PR #788's old 420Arcade-as-contract-free-Genesis assumption is superseded by the newer explicit Arcade deferral, retaining the Genesis-owned shared Gaming Protocol and independent external Arcade repository. Do not restore old active Arcade classification over this decision.
