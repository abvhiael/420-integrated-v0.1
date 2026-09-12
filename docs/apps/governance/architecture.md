# 420 Governance architecture

The Genesis governance suite includes `CivicConstitution420`, `CivicProposalRegistry420`, `CivicElectorateRegistry420`, `CivicVoting420`, `CivicGovernor420` and `GovernanceTimelock`.

Proposal rules and electorate sources are snapshotted prospectively. Later rule/source changes do not rewrite existing proposals. Execution must use the exact committed batch after the frozen timelock delay.