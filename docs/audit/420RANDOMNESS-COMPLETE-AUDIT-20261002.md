# 420Randomness complete audit — 2026-10-02

Status: **RANDOM-AUDIT-5 REPOSITORY HARNESS QUALIFIED; LIVE PUBLIC TESTNET BLOCKED**

Baseline main: `edfd0752e825fc5379700851358e8398efb0b9c5`

Current main at RANDOM-AUDIT-3 durable closeout review: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`

RANDOM-AUDIT-3 exact qualified implementation SHA: `809cff5ea67fc48c3082f5ce0702b8572b18c663`  
Qualification workflow run/job: `37098929839` / `111134459600`  
Durable evidence: `docs/audit/RANDOM-AUDIT-3-QUALIFICATION.md`

The post-qualification delta through the documentation closeout lineage is evidence-only: only this audit record and the RANDOM-AUDIT-3 qualification evidence file changed. Current-main reconciliation is intentionally deferred to the appropriate later integration/Level-3 boundary.

## Canonical definition

The current architecture defines generalized 420 Randomness as a provider-neutral request protocol with governance-versioned routes and profiles, a canonical router, a one-time-router-bound immutable result registry, method-specific proof verifiers and deterministic draw helpers. Randomness and ordinary oracle facts are separate trust domains and failure is fail-closed.

The Genesis contract map names eight required Solidity/interface files for 420 Random. `RandomnessRegistry` retains frozen address `0x0000000000000000000000000000000000000428`; the application router is Registry-resolved with no fixed Genesis address.

## Inventory

| Requirement | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|
| Route registry | `RandomnessRouteRegistry420` | base + audit negative tests | architecture + app README | COMPLETE | none |
| Profile registry | `RandomnessProfileRegistry420` | base + audit fallback/timeout tests | architecture + app README | COMPLETE | none |
| Canonical router | `RandomnessRouter420` | request/proof/fallback/expiry/replay tests | architecture + app README | COMPLETE | live deployment/Registry publication later |
| Immutable result registry | `src/randomness/RandomnessRegistry.sol` + retained `0x0428` materialization | router-scope/one-time-binding + deterministic materialization verification | architecture + app README + RANDOM-AUDIT-3 evidence | COMPLETE | live deployment/binding later |
| Verifier interface | `IRandomnessVerifier420` | mock verifier exercised | architecture | COMPLETE | production verifier implementations are route-specific deployment inputs |
| Draw helpers | `RandomnessDraw420` | deterministic/bounds/sample tests | architecture | COMPLETE | none |
| Genesis source wiring | frozen `0x0428` predeploy plan and Step-6 verifier point to `src/randomness/RandomnessRegistry.sol`; legacy system registry retained only as historical evidence | exact-head verifier + CI | this audit + RANDOM-AUDIT-1 evidence | COMPLETE | none for RANDOM-AUDIT-1 |
| Retained runtime artifact | `contracts/artifacts/RandomnessRegistry.json`; runtime hash `0x0c921ab8b2282ea3ed2d7f64b5ca0f6ecb54c67d52e421a347a1449d43e8345a` | exact-head reproducibility check | RANDOM-AUDIT-3 evidence | COMPLETE | live code identity later |
| Retained predeploy state | `RandomnessRegistry-predeploy-state.json`; immutable GovernanceTimelock `0x0429`, zero mutable slots, empty storage root | generator/verifier + clean-tree check | RANDOM-AUDIT-3 evidence | COMPLETE | live storage verification later |
| Router deployment | deterministic RANDOM-AUDIT-4 deployment bundle freezes constructor graph and Registry-resolved address policy | deployment-binding + full Randomness tests | RANDOM-AUDIT-4 evidence | REPOSITORY COMPLETE / LIVE BLOCKED | execute exact bundle on production-equivalent testnet |
| Router one-time binding | exact post-publication `RandomnessRegistry@0x0428.bindRouter(RandomnessRouter420)` transaction frozen | governance/one-time/rebinding tests | RANDOM-AUDIT-4 evidence | REPOSITORY COMPLETE / LIVE BLOCKED | execute once on qualified testnet deployment |
| ProtocolRegistry publication | exact router component registration + `420/service/randomness/v1` publication frozen | exact router/codehash/profile-resolution tests | RANDOM-AUDIT-4 evidence | REPOSITORY COMPLETE / LIVE BLOCKED | retain live publication transactions and resolve-active evidence |
| Indexer lifecycle | pinned generalized `RandomnessRegistry` + Registry-resolved `RandomnessRouter420` descriptor and requestId-keyed lifecycle projection retained | focused descriptor/lifecycle + full affected Indexer regression | RANDOM-AUDIT-5 qualification evidence | REPOSITORY COMPLETE / LIVE BLOCKED | verify projection against exact deployed router/events on production-equivalent testnet |
| Frontend | no dedicated frontend required by canonical architecture | N/A | protocol docs | NOT APPLICABLE | consumers integrate through router |
| Backend worker | provider-specific and replaceable, not canonical app authority | N/A | trust model | NOT APPLICABLE | route operators/verifiers qualified separately |

## Security findings

Verified/mitigated repository behavior: frozen request authority, proof-gated fulfillment, requester nonce replay resistance, single terminal fulfillment, bounded fallback, expiry-to-void, one-time registry router binding, deterministic domain-separated derived draws.

Accepted design risk: governance can configure routes/profiles and therefore controls which operators/verifiers become eligible. Operational governance security is outside these contracts.

Resolved repository provenance finding: the baseline `0x0428` source ambiguity has been removed, and the canonical generalized registry now has retained compiler/runtime/storage provenance. Live-chain code/storage identity and production verifier/operator security remain later qualification work.

## Readiness

- CODE COMPLETE: **YES** for the canonical generalized protocol sources.
- BUILD COMPLETE: **YES** for repository/offline materialization; exact-head CI and deterministic runtime/state reproduction pass.
- CONTRACT COMPLETE: **YES** at source level.
- TEST COMPLETE: **NO** overall; repository Randomness and directly affected Indexer qualification pass, but required production-equivalent live deployment smoke qualification is not yet possible.
- DOCUMENTATION COMPLETE: **PARTIAL**; this audit adds the app-level operator/integration reference, but deployment evidence is outstanding.
- INTEGRATION COMPLETE: **NO** overall; the repository-side Registry/binding/Indexer integration harness is qualified, but live ProtocolRegistry publication, router binding and deployed Indexer agreement remain outstanding.
- SECURITY QUALIFIED: **NO** for production; repository review is not an independent external audit.
- TESTNET READY: **NO**; RANDOM-AUDIT-5 repository harness is qualified, but the official public testnet remains non-live/candidate with placeholder endpoints and unfrozen public chain identity.
- GENESIS READY: **NO**.
- PRODUCTION READY: **NO**.

## Remediation roadmap

1. **RANDOM-AUDIT-1 — canonical source reconciliation — COMPLETE.** `0x0428` predeploy source and the retained Step-6 verifier now resolve `src/randomness/RandomnessRegistry.sol`; the legacy `src/system/RandomnessRegistry.sol` remains historical evidence only. Level 1 exact-head qualification passed on implementation SHA `95b7b4c7f6cfc214ab10c8673a665788b389568b`, workflow run `37093289263`, job `111117991983`.
2. **RANDOM-AUDIT-2 — repository qualification — COMPLETE.** The complete retained Randomness source/interface/test set is formatter-clean and passed the dedicated verifier, canonical build, all `Randomness*.t.sol` tests and app-scoped static security scan on exact implementation SHA `f40d9b89e9e4c8626a8105c61385041b986853ca`; workflow run `37094231759`, job `111120749696`.
3. **RANDOM-AUDIT-3 — deterministic Genesis materialization — COMPLETE.** Retained exact compiler/runtime artifact, source blob, stable compiler-derived immutable locations, runtime hash, storage layout and `RandomnessRegistry-predeploy-state.json` for `0x0428`; exact implementation SHA `809cff5ea67fc48c3082f5ce0702b8572b18c663`, workflow run `37098929839`, job `111134459600`; durable evidence: `docs/audit/RANDOM-AUDIT-3-QUALIFICATION.md`. The subsequent closeout commits are documentation-only and preserve the exact-SHA qualification under the evidence-only exception.
4. **RANDOM-AUDIT-4 — deployment bundle — COMPLETE.** Frozen six-step deployment/publication/binding sequence for route registry, profile registry and router; exact ProtocolRegistry router component identity and canonical `420/service/randomness/v1` publication; post-publication one-time `RandomnessRegistry@0x0428.bindRouter(RandomnessRouter420)` transaction. Level 1 exact-head qualification passed on implementation SHA `5158e7f5505d51cfa7db0d778de3871dd2525653`, workflow run `37101060785`, job `111140517818`; 24 passed / 0 failed / 0 skipped. Durable evidence: `docs/audit/RANDOM-AUDIT-4-QUALIFICATION.md`.
5. **RANDOM-AUDIT-5 — production-equivalent testnet qualification — ACTIVE / LIVE BLOCKED.** Repository-side qualification harness is complete and app-focused integration passed on frozen exact SHA `c867398cfe640064f09e0fac65f83f4551ab59de`: retained Randomness workflow run `37102627109` / job `111145007450` passed 24/0/0 Foundry plus verifier/build/static gates; Step-5 integration run `37102627093` / job `111145006199` passed fail-closed live-readiness/template guards, generalized Randomness Indexer descriptor/lifecycle tests, and the full directly affected Indexer regression (229 pass / 0 fail / 1 unrelated PostgreSQL-fixture skip). Durable evidence: `docs/audit/RANDOM-AUDIT-5-TESTNET-QUALIFICATION.md`. Canonical completion remains blocked until the official production-equivalent public testnet is live/frozen so exact artifacts can be deployed, code/storage identities verified, Registry entries published, router bound, qualified routes/profiles configured, primary/fallback/void smoke tests executed, and deployed Indexer projection verified.
6. **RANDOM-AUDIT-6 — production security/release closeout — NOT YET ELIGIBLE.** Do not begin closeout until RANDOM-AUDIT-5 live production-equivalent testnet qualification satisfies its canonical exit criteria.

## Testnet handoff and merge-candidate reconciliation

Repository remediation remains complete through **RANDOM-AUDIT-4**. The unfinished work is retained on the canonical `docs/ROADMAP.md` testnet handoff as **RANDOM-AUDIT-5 — production-equivalent testnet qualification**, followed by **RANDOM-AUDIT-6 — production security/release closeout**. RANDOM-AUDIT-5 requires genuine live-chain deployment, publication, binding, smoke/failure-path and Indexer evidence; repository/local-EVM evidence must not be promoted to live completion evidence.

This audit branch was reconciled with current `main` at `d37d751dfa232b20c8158d55c20c13cc1d7a10ef` before final merge-candidate qualification. The final merge candidate must pass the dedicated 420Randomness exact-head workflow before merge.
