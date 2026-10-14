# DOOBr R05.5 — Expired licences, policy changes mid-order, emergency stop and revoke

Canonical R05.5: app-scoped Level 1 audit. Branch `roadmap/doobr-bc-vancouver-infrastructure`; PR #601 remains open, unmerged. Main/base inspected `bc0faa5dafecda3de0620a9581f9953b89cd95fb` (ahead 389, behind 1110 at inspection). **Implementation SHA:** `7a78540bceb2701f306ae8511019feb2b01511bb`.

Implementation: `doobr/transition_authority.py` adds a fail-closed, **per-transition** canonical authority gate: emergency stop before and after licence and 420Compliance validation, then current policy-version revalidation, then final emergency-stop check. Retained `ApprovedProviderAdapter` verifies expiry/revocation, issuer and Registry binding; `require_compliance` verifies scope, date, evidence, revocation and approved current decision. Any denial, unknown response or authority outage prevents the transition. This function performs **admission validation only**; callers must bind successful validation to the actual state transition in an atomic authoritative transaction and revalidate if it becomes stale. There is no new issuer, local licence or emergency-stop override.

Tests: `doobr/storage/tests/test_r05_5_transition_authority.py` checks expiry, revocation, wrong tenant/category, Registry mismatch, Compliance denial, expired or changed policy, policy revocation, emergency stop activated at three timing points and authority outages. Targeted `.github/workflows/doobr-r05-5-level1.yml` compiles source, runs these plus retained provider, Compliance, Identity, retailer and routing suites, R04.1 frozen authority guard and exact-SHA before/after. No global Solidity/Genesis/Integrated/Docs inventories duplicated.

**Qualification:** PENDING exact-SHA GitHub Actions job inspection. Do not treat queued/skipped/cancelled as PASS. R04.11 Level 2 previously qualified its own earlier SHA. R05.10 Level 3 remains deferred until main reconciliation.

**External boundaries:** authenticated production canonical policy/version source, live licence registry, push emergency-stop propagation, atomic state-transition binding, independent regulator and live testnet acceptance remain explicitly deferred, including DOOBR-AUDIT-9/10. DOOBr remains NON-OPERATIONAL; public checkout and frozen Genesis Travel transaction methods stay disabled.

**Next canonical step:** R05.6 Multi-instance deployment, data migrations, restore/rollback.
