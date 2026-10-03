# 420Randomness complete audit — 2026-10-02

Status: **REPOSITORY REMEDIATION IN PROGRESS; DEPLOYMENT QUALIFICATION BLOCKED**

Baseline main: `edfd0752e825fc5379700851358e8398efb0b9c5`

## Canonical definition

The current architecture defines generalized 420 Randomness as a provider-neutral request protocol with governance-versioned routes and profiles, a canonical router, a one-time-router-bound immutable result registry, method-specific proof verifiers and deterministic draw helpers. Randomness and ordinary oracle facts are separate trust domains and failure is fail-closed.

The Genesis contract map names eight required Solidity/interface files for 420 Random. `RandomnessRegistry` retains frozen address `0x0000000000000000000000000000000000000428`; the application router is Registry-resolved with no fixed Genesis address.

## Inventory

| Requirement | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|
| Route registry | `RandomnessRouteRegistry420` | base + audit negative tests | architecture + app README | COMPLETE | none |
| Profile registry | `RandomnessProfileRegistry420` | base + audit fallback/timeout tests | architecture + app README | COMPLETE | none |
| Canonical router | `RandomnessRouter420` | request/proof/fallback/expiry/replay tests | architecture + app README | COMPLETE | live deployment/Registry publication later |
| Immutable result registry | `src/randomness/RandomnessRegistry.sol` | router-scope/one-time-binding tests | architecture + app README | PARTIAL | deterministic `0x0428` artifact/state materialization |
| Verifier interface | `IRandomnessVerifier420` | mock verifier exercised | architecture | COMPLETE | production verifier implementations are route-specific deployment inputs |
| Draw helpers | `RandomnessDraw420` | deterministic/bounds/sample tests | architecture | COMPLETE | none |
| Genesis source wiring | frozen `0x0428` predeploy plan and Step-6 verifier point to `src/randomness/RandomnessRegistry.sol`; legacy system registry retained only as historical evidence | exact-head verifier + CI | this audit + RANDOM-AUDIT-1 evidence | COMPLETE | none for RANDOM-AUDIT-1 |
| Retained runtime artifact | absent on baseline | none | historical Step-6 docs | MISSING | compile/pin artifact and runtime hash |
| Retained predeploy state | absent on baseline | none | historical Step-6 docs | MISSING | materialize GovernanceTimelock constructor storage and retain state record |
| Router deployment | Registry-resolved identity only | repository tests | app README | BLOCKED | production-equivalent testnet deployment |
| Router one-time binding | implemented | unit test | app README | BLOCKED | execute only after qualified router deployment |
| ProtocolRegistry publication | identity declared | indirect | architecture | BLOCKED | testnet deployment/publication evidence |
| Indexer lifecycle | `420-indexer` recognizes request/fulfillment terminal state | reducer tests exist | system docs | PARTIAL | exact deployed ABI/event descriptor qualification |
| Frontend | no dedicated frontend required by canonical architecture | N/A | protocol docs | NOT APPLICABLE | consumers integrate through router |
| Backend worker | provider-specific and replaceable, not canonical app authority | N/A | trust model | NOT APPLICABLE | route operators/verifiers qualified separately |

## Security findings

Verified/mitigated repository behavior: frozen request authority, proof-gated fulfillment, requester nonce replay resistance, single terminal fulfillment, bounded fallback, expiry-to-void, one-time registry router binding, deterministic domain-separated derived draws.

Accepted design risk: governance can configure routes/profiles and therefore controls which operators/verifiers become eligible. Operational governance security is outside these contracts.

Unresolved release risk: the frozen `0x0428` predeploy provenance is inconsistent on baseline because legacy Step-6 material points to a different contract with the same name and different storage/API semantics.

## Readiness

- CODE COMPLETE: **YES** for the canonical generalized protocol sources.
- BUILD COMPLETE: **NO** until exact-head CI succeeds and the deterministic runtime artifact is retained.
- CONTRACT COMPLETE: **YES** at source level.
- TEST COMPLETE: **NO** until exact-head CI and deployment smoke qualification are retained.
- DOCUMENTATION COMPLETE: **PARTIAL**; this audit adds the app-level operator/integration reference, but deployment evidence is outstanding.
- INTEGRATION COMPLETE: **NO**; ProtocolRegistry publication and deployed indexer ABI identity are outstanding.
- SECURITY QUALIFIED: **NO** for production; repository review is not an independent external audit.
- TESTNET READY: **NO** until `0x0428` artifact/state provenance and deployment bundle are frozen.
- GENESIS READY: **NO**.
- PRODUCTION READY: **NO**.

## Remediation roadmap

1. **RANDOM-AUDIT-1 — canonical source reconciliation — COMPLETE.** `0x0428` predeploy source and the retained Step-6 verifier now resolve `src/randomness/RandomnessRegistry.sol`; the legacy `src/system/RandomnessRegistry.sol` remains historical evidence only. Level 1 exact-head qualification passed on implementation SHA `95b7b4c7f6cfc214ab10c8673a665788b389568b`, workflow run `37093289263`, job `111117991983`.
2. **RANDOM-AUDIT-2 — repository qualification — IN PROGRESS.** Qualify the complete retained Randomness source/interface/test set with the dedicated verifier, full Randomness formatting check, canonical build, all `Randomness*.t.sol` tests and the app-scoped static security scan on one exact branch head.
3. **RANDOM-AUDIT-3 — deterministic Genesis materialization.** Retain the exact compiler artifact, source blob, runtime hash, storage layout and `RandomnessRegistry-predeploy-state.json` for `0x0428`.
4. **RANDOM-AUDIT-4 — deployment bundle.** Freeze deployment ordering/arguments for route registry, profile registry and router; define the exact ProtocolRegistry component publication and one-time `bindRouter` transaction.
5. **RANDOM-AUDIT-5 — production-equivalent testnet qualification.** Deploy exact artifacts, verify code/storage identities, publish Registry entries, bind the router, configure qualified routes/profiles, execute primary/fallback/void smoke tests, and verify indexer lifecycle projection.
6. **RANDOM-AUDIT-6 — production security/release closeout.** Independent security review, operational route/verifier evidence, monitoring/runbook validation and final Genesis/mainnet evidence.
