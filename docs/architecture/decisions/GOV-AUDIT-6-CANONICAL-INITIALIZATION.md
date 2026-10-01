# GOV-AUDIT-6 — canonical Governance initialization policy

## Status

**Accepted for the GOV-AUDIT-6 Genesis candidate.**

This decision resolves the previously undefined Governance bootstrap authority, electorate-source model and initial constitutional revision without assigning new fixed Genesis addresses or introducing stake-weighted Civic voting.

## Bootstrap authority

`GovernanceTimelock` remains frozen at `0x0000000000000000000000000000000000000429`.

Its canonical `bootstrapGovernor` is the already-frozen compatibility identity:

`Governance420@0x0000000000000000000000000000000000000437`.

This does **not** restore the retired Governance420 proposal/vote/result system. The compatibility contract receives only a one-shot bootstrap role:

1. validate the exact Civic module graph and canonical electorate-source roles;
2. schedule the fixed initialization plan through GovernanceTimelock;
3. verify all bindings, revision-1 rules and ProtocolRegistry publications;
4. invoke `GovernanceTimelock.activateCivicAuthority(CivicGovernor420)`;
5. permanently retire bootstrap scheduling.

The scheduling entry point is permissionless because callers cannot choose policy values, Registry identifiers, authority identities or arbitrary targets. Those values are fixed by the canonical bootstrap implementation. Safety rests on exact-plan validation rather than possession of a private bootstrap key.

After activation, `GovernanceTimelock.scheduler == CivicGovernor420`, `civicAuthorityActivated == true`, bootstrap cancellation is unavailable, and the bootstrap plan cannot be scheduled again.

## Canonical electorate sources

Both initial houses use `CivicMerkleElectorateSource420`, deployed independently and resolved through ProtocolRegistry. Neither receives a fixed `0x04xx` address.

### Community house

- component ID preimage: `420/component/governance/civic-community-electorate-source/v1`
- source type preimage: `420CIVIC_COMMUNITY_EQUAL_WEIGHT_MERKLE_V1`
- membership commitment: append-only prospective Merkle checkpoints
- leaf: `keccak256(abi.encode(voter))`
- weight: exactly 1 for a valid member proof

### Validator house

- component ID preimage: `420/component/governance/civic-validator-electorate-source/v1`
- source type preimage: `420CIVIC_VALIDATOR_EQUAL_WEIGHT_MERKLE_V1`
- membership commitment: append-only prospective Merkle checkpoints
- leaf: `keccak256(abi.encode(voter))`
- weight: exactly 1 for a valid member proof

The validator house is deliberately **one eligible validator owner, one vote**. Bond amount, delegated stake, protocol credit and token balance do not increase Civic voting weight. The canonical validator electorate root must be generated from the eligible validator-owner set at the checkpoint boundary by deployment/operator tooling; Civic consumes the frozen root and does not derive consensus eligibility itself.

## Initial constitutional revision

The repository already defines the validator rotation unit as `17,640` blocks. Initial Civic voting periods are expressed in that existing protocol unit.

| Class | Voting period | Timelock | Community quorum | Community approval | Validator quorum | Validator approval | Dual house |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| G1 | 17,640 blocks | 7 days | 10% | 50.01% | — | — | no |
| G2 | 35,280 blocks | 14 days | 20% | 60% | — | — | no |
| G3 | 35,280 blocks | 14 days | 33.34% | 66.67% | 33.34% | 66.67% | yes |
| G4 | 105,840 blocks | 42 days | 50% | 75% | 50% | 75% | yes |

These values are revision 1 only. Later changes remain prospective and must pass canonical Civic governance after activation; they cannot rewrite the frozen rule revision of an existing proposal.

## Registry publication

The five Civic core modules and the two electorate-source deployments are Registry-resolved, with no fixed Genesis address implied. The Governance service publication resolves to `CivicGovernor420`; the compatibility and Timelock identities remain the only fixed Governance predeploys.

## Failure and recovery rule

Civic authority MUST NOT be activated until all scheduled bootstrap operations have executed successfully and the compatibility contract verifies the exact rule revision, source bindings, proposal/snapshot authority bindings and Registry resolutions.

Before activation, a failed candidate may be discarded and redeployed from retained artifacts. After activation there is no bootstrap rollback path; recovery proceeds through canonical Civic governance.
