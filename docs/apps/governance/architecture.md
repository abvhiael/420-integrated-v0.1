# 420 Governance architecture

## Public name and implementation name

**420 Governance** is the public Genesis application name. **420 Civic** is the implementation-family name used by the canonical governance contracts.

They are not separate governance systems. The public Governance application is a user-facing surface over the Civic protocol suite.

The canonical implementation includes `CivicConstitution420`, `CivicProposalRegistry420`, `CivicElectorateRegistry420`, `CivicVoting420`, `CivicGovernor420` and `GovernanceTimelock`.

The legacy `Governance420` contract is retained only as a compatibility surface. Its legacy proposal, vote and result mutation paths are retired; it must not be treated as an alternate canonical governance authority.

## Authority

`CivicGovernor420` coordinates canonical proposal lifecycle and committed execution. `CivicVoting420` owns ballot/tally state. `CivicElectorateRegistry420` owns proposal-bound electorate sources and snapshots. `CivicConstitution420` owns versioned proposal-class rules. Execution occurs only through `GovernanceTimelock` after the applicable frozen delay.

Proposal rules and electorate sources are snapshotted prospectively. Later rule/source changes do not rewrite existing proposals. Execution must use the exact committed action batch after the frozen timelock delay.

## Cancellation and dependency boundary

Canonical Civic v1 proposals are **not cancellable** once created. ACTIVE, PASSED and QUEUED proposal states have no cancellation transition. `GovernanceTimelock.cancel` is retained only for legacy/bootstrap operations before Civic authority activation and is disabled after activation. The reserved `CANCELLED` enum value is not a canonical v1 Civic lifecycle state.

The Civic core does not consume the repository-wide shared Genesis interfaces as direct proposal/voting/execution dependencies. Its runtime authority graph is the explicit Civic module graph plus `GovernanceTimelock`. Registry discovery and Genesis initialization remain deployment/integration concerns; Wallet/Indexer/Status health, fee and chain-context checks remain consumer concerns.

## Documentation rule

User-facing references SHOULD say **420 Governance**. Developer and architecture documentation MAY say **420 Civic** when referring to implementation contracts. Where ambiguity is possible, use **420 Governance (420 Civic implementation)**.

The Genesis contract-map entry `420 Civic` is therefore an implementation alias of the public `420 Governance` application, not an additional Genesis dApp.

## Bootstrap deployment authority

The frozen `Governance420` identity at `0x0000000000000000000000000000000000000437` remains compatibility-only for normal protocol operation. GOV-AUDIT-6 additionally gives that fixed identity a **one-shot, non-discretionary bootstrap scheduling role before Civic activation** because the frozen `GovernanceTimelock` at `0x0429` requires an initial scheduler and the repository intentionally has no privileged owner key.

This is not an alternate governance authority. The bootstrap surface is permissionless to invoke but can schedule only the exact hard-coded Civic initialization plan: canonical electorate-source roles, frozen revision-1 G1–G4 rules, exact module bindings, canonical Registry component/service publication, and the final Civic handoff. Callers cannot substitute thresholds, component IDs, authorities, Registry address, or proposal/voting semantics.

Activation is fail-closed: `Governance420.activateCanonicalCivic` verifies the configured sources, revision-1 rules, Governor/Registry bindings and active Registry resolutions before `GovernanceTimelock.activateCivicAuthority` transfers scheduling authority irreversibly to `CivicGovernor420`. After that transition the bootstrap path cannot be scheduled again and bootstrap cancellation is disabled.

The canonical COMMUNITY and VALIDATOR electorate adapters are `CivicMerkleElectorateSource420` deployments. Both are equal-weight membership sources. COMMUNITY is one eligible address = one vote. VALIDATOR is one eligible active-validator owner = one vote; validator stake, bond size and delegated stake do not increase Civic voting weight.
