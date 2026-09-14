# 420 Governance architecture

## Public name and implementation name

**420 Governance** is the public Genesis application name. **420 Civic** is the implementation-family name used by the canonical governance contracts.

They are not separate governance systems. The public Governance application is a user-facing surface over the Civic protocol suite.

The canonical implementation includes `CivicConstitution420`, `CivicProposalRegistry420`, `CivicElectorateRegistry420`, `CivicVoting420`, `CivicGovernor420` and `GovernanceTimelock`.

The legacy `Governance420` contract is retained only as a compatibility surface. Its legacy proposal, vote and result mutation paths are retired; it must not be treated as an alternate canonical governance authority.

## Authority

`CivicGovernor420` coordinates canonical proposal lifecycle and committed execution. `CivicVoting420` owns ballot/tally state. `CivicElectorateRegistry420` owns proposal-bound electorate sources and snapshots. `CivicConstitution420` owns versioned proposal-class rules. Execution occurs only through `GovernanceTimelock` after the applicable frozen delay.

Proposal rules and electorate sources are snapshotted prospectively. Later rule/source changes do not rewrite existing proposals. Execution must use the exact committed action batch after the frozen timelock delay.

## Documentation rule

User-facing references SHOULD say **420 Governance**. Developer and architecture documentation MAY say **420 Civic** when referring to implementation contracts. Where ambiguity is possible, use **420 Governance (420 Civic implementation)**.

The Genesis contract-map entry `420 Civic` is therefore an implementation alias of the public `420 Governance` application, not an additional Genesis dApp.