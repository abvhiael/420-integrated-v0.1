# NAMES-AUDIT-2 — Canonical dependency-model reconciliation evidence

Status: **QUALIFICATION PENDING**

Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Canonical requirement

NAMES-AUDIT-2 requires an architecture decision on whether the frozen 420Names dependency matrix is normative, implementation of every retained dependency or amendment of the matrix, and reconciliation before further contract freezing.

## Implementation

The stale 11-entry 420Names dependency row has been reconciled to the actual Names authority model.

Canonical direct runtime dependency:

- `GovernanceAuthority` — retained through the nonzero immutable `SystemAccess.governanceTimelock` constructor boundary.

Explicit non-runtime classifications are recorded for every removed legacy entry:

- `ProtocolRegistry` — OPTIONAL_INTEGRATION;
- `GenesisInitialization` — REQUIRED_INDIRECT deployment/predeploy concern;
- `ReplayProtection` — LOCAL_MECHANISM through committer-bound, age-bounded, consumed commitments;
- `ChainContext` — CONSUMER_LAYER;
- `PauseRegistry`, `CapabilityRegistry`, `SystemSafety`, `Migration`, `SignedEnvelope`, and `MetadataCommitment` — not current Names420 runtime dependencies.

No additional authority or storage was added to `Names420.sol`.

## Files changed for the dependency decision

- `contracts/config/interfaces/dependency-matrix.json`
- `contracts/config/interfaces/names-dependency-model.json`
- `docs/architecture/decisions/NAMES-AUDIT-2-DEPENDENCY-MODEL.md`
- `docs/architecture/protocols/registry-names-identity-420is.md`
- `contracts/test/Names420DependencyModel.t.sol`
- `scripts/verify-names-dependency-model.py`
- `.github/workflows/names-audit.yml`
- `docs/audit/420NAMES-COMPLETE-AUDIT-20260930.md`

## CI qualification-model optimization included in this phase

Audit PRs now defer repository-wide Level-3 workflows while preserving normal `main`, non-audit PR, and manual-dispatch behavior. The affected global workflows remain runnable manually for exact-head phase closeout.

This prevents ordinary app-audit commits from automatically consuming:

- 420 Integrated Qualification;
- complete 16-shard Solidity PR inventory;
- repository-wide Docs qualification;
- Genesis Address Authority/full Genesis Foundry inventory;
- unrelated Registry audit qualification;
- Explorer EXP-1.9/EXP-1.10 phase qualification;
- broad Indexer qualification.

The app-specific `420Names audit qualification` remains the Level-1 gate.

## Level-1 required checks

The exact implementation head must pass:

1. exact-head checkout verification;
2. Genesis interface inventory verification;
3. `verify-names-dependency-model.py`;
4. Names Solidity formatting;
5. focused Names implementation/interface/dependency test build;
6. `Names420Audit.t.sol`;
7. `Names420DependencyModel.t.sol`;
8. retained `RegistryIdentityNames420.t.sol`;
9. Wallet Names integration tests;
10. Names static authority/opcode scan.

Repository-wide Level-3 checks are intentionally deferred to final NAMES-AUDIT phase closeout.

## Main divergence review

Current `main` at the time of this evidence record: `4d0ede3692efe55f04a50c7bf5b749afe579eccb`.

The audit branch is 28 commits ahead and 8 commits behind current `main`. The dependency matrix and global workflow files inspected before modification matched current `main`; no dependency-model conflict requiring immediate branch reconciliation was found. Full branch reconciliation remains deferred until needed by an actual dependency conflict or final Level-3 closeout.

## Completion criteria

NAMES-AUDIT-2 may be marked COMPLETE when the Level-1 Names workflow passes on the implementation state containing this dependency decision and no blocking dependency-model defect remains.

The next canonical roadmap step is:

**NAMES-AUDIT-3 — contract hardening expansion** — add fuzz/property/invariant coverage for registration availability, commitment timing/consumption, expiry, transfer, reverse agreement and renewal bounds; run hardening/static analysis.
