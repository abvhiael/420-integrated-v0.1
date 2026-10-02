# GOV-AUDIT-6 Qualification Evidence

## Status

**COMPLETE — Level 1 qualification satisfied.**

Qualified implementation SHA: `ce294990581aac97fc005ed3400be077eb8bc7a0`

Canonical roadmap step: **GOV-AUDIT-6 — deployment, artifacts, discovery and initialization**

Pull request: #449  
Branch: `audit/420governance-complete-20261001`

## Qualified scope

GOV-AUDIT-6 turns the source-complete 420 Civic Governance family into a reproducible deployment candidate without assigning invented fixed addresses or external bootstrap authority.

The qualified implementation includes:

- pinned Solidity `0.8.24`, Cancun EVM target, optimizer, optimizer runs and via-IR configuration;
- retained reproducible runtime artifacts for:
  - `GovernanceTimelock`;
  - `Governance420`;
  - `CivicConstitution420`;
  - `CivicProposalRegistry420`;
  - `CivicElectorateRegistry420`;
  - `CivicVoting420`;
  - `CivicGovernor420`;
  - `CivicMerkleElectorateSource420`;
- exact runtime-code hashes recorded in `contracts/config/governance-deployment-v1.json`;
- deterministic predeploy state for:
  - `GovernanceTimelock@0x0000000000000000000000000000000000000429`;
  - `Governance420@0x0000000000000000000000000000000000000437`;
- canonical bootstrap scheduler fixed to `Governance420@0x0437`;
- a one-shot, non-discretionary bootstrap path that cannot accept arbitrary governance policy;
- canonical Registry service/component IDs and publication profile;
- Registry-resolved Civic modules and electorate adapters with no invented reserved addresses;
- equal-weight COMMUNITY electorate semantics;
- equal-weight active-validator-owner VALIDATOR semantics with no stake-weighted Civic voting;
- frozen revision-1 G1–G4 constitutional rules;
- deterministic constructor/module graph and initialization order;
- Proposal Registry and Electorate Registry one-time Governor bindings;
- compatibility-pointer binding;
- Registry component publication and active Governance service publication;
- one-way `GovernanceTimelock.activateCivicAuthority` handoff;
- explicit bootstrap retirement and post-activation cancellation rejection;
- rollback/recovery instructions for pre-activation deployment failure;
- canonical Genesis contract-map registration for `CivicMerkleElectorateSource420`.

## Canonical initialization decisions

### Bootstrap authority

`GovernanceTimelock.bootstrapGovernor` is canonically materialized as:

`0x0000000000000000000000000000000000000437` — `Governance420`.

This does **not** create a second normal governance authority. Before Civic activation, the fixed compatibility identity may schedule only the exact hard-coded canonical initialization plan. The invocation is permissionless but non-discretionary. After successful verified activation, the bootstrap role is permanently retired and Timelock scheduling authority transfers to `CivicGovernor420`.

### Electorate sources

Both canonical electorate sources use `CivicMerkleElectorateSource420`:

- COMMUNITY: one eligible address = one vote;
- VALIDATOR: one eligible active-validator owner = one vote;
- validator stake, bond size and delegation do not increase Civic voting weight.

The two source instances are deployment outputs and Registry-resolved. They do not receive invented fixed Genesis addresses.

### Initial constitutional revision

The exact revision-1 values are retained in `contracts/config/governance-deployment-v1.json` and enforced by the bootstrap path:

| Class | Voting period | Timelock delay | Community quorum | Community approval | Validator quorum | Validator approval | Dual house |
|---|---:|---:|---:|---:|---:|---:|---|
| G1 | 17,640 blocks | 7 days | 10% | 50.01% | 0 | 0 | no |
| G2 | 35,280 blocks | 14 days | 20% | 60% | 0 | 0 | no |
| G3 | 35,280 blocks | 14 days | 33.34% | 66.67% | 33.34% | 66.67% | yes |
| G4 | 105,840 blocks | 42 days | 50% | 75% | 50% | 75% | yes |

The voting-period unit uses the repository's existing `ValidatorRegistry.ROTATION_BLOCKS = 17_640`.

## Retained runtime hashes

At the qualified implementation:

- GovernanceTimelock: `0xca5e96c6048b190839d68a8857b2ff5f0a7e0f356d4089ac31fa684cdee00139`
- Governance420: `0x9af678e7626b6141b4af33e7729b27835949f8dad634298e7ce5a5e754305d64`
- CivicConstitution420: `0x2946e9f82bb274f1f85c1a7eb5e6fc0b580ee3cf7ec1c879dd9eb041f39068e5`
- CivicProposalRegistry420: `0x5c08d1c7bb5e814c027e1a06fb371038e5e5727a0758642090bd8b59f4e496bc`
- CivicElectorateRegistry420: `0xb9c1246005033a0d23112ab0c471287f7102d6b15a30f2658cdd0cc164f66aea`
- CivicVoting420: `0x3ec8ce38ed4b641521899d79dd4e2f97009efce9844eb8796ef60042f2d3b781`
- CivicGovernor420: `0xbc34f741b779c76fd339b23335d98cd4a166f20e02dc4570a46f895a1a5d008e`
- CivicMerkleElectorateSource420: `0xff8be4d7fca8a0f193dc1441b9000f205ba50dbf22df6c05c8396f00e6d803c6`

Artifact generation is implemented by `scripts/generate-governance-audit-6-artifacts.py`, which reconstructs the retained files from pinned compiler/source inputs and fails on drift.

## Exact-head CI evidence

Workflow: **420Governance audit qualification**  
Run: `36941357663`  
Job: `110633341982`  
Run number: `251`  
Qualified SHA: `ce294990581aac97fc005ed3400be077eb8bc7a0`  
Conclusion: **SUCCESS**

Successful steps:

1. exact qualification-head verification;
2. Governance audit authority/hardening verifier;
3. affected Genesis address and predeploy authority verification;
4. Governance Solidity formatting;
5. canonical Governance build;
6. retained GOV-AUDIT-6 runtime artifact generation/reproduction verification;
7. GOV-AUDIT-4 exact Civic artifact and Indexer contract verification;
8. GOV-AUDIT-6 deterministic deployment simulation;
9. retained Civic/Governance contract qualification;
10. Governance forbidden-primitive scan;
11. Governance Indexer build/tests.

The retained GOV-AUDIT-5 Wallet workflow also completed successfully on the same exact head:

- run `36941357729`;
- conclusion **SUCCESS**.

The repository `Solidity Contracts` workflow also completed successfully on the same exact head:

- run `36941357826`;
- conclusion **SUCCESS**.

## Exit-criteria assessment

- compiler/toolchain pinned: **PASS**
- reproducible compiler/runtime artifacts: **PASS**
- runtime-code hashes retained: **PASS**
- fixed-predeploy vs Registry-resolved classification: **PASS**
- canonical Registry IDs/publication profile: **PASS**
- deterministic deployment/initialization order: **PASS**
- electorate-source configuration: **PASS**
- initial constitutional rules: **PASS**
- exact authority bindings: **PASS**
- bootstrap retirement/Civic handoff: **PASS**
- storage/init manifests and immutable verification: **PASS**
- deployment smoke simulation: **PASS**
- rollback/recovery instructions: **PASS**
- no guessed address, authority or initialization value: **PASS**

## Boundary

This is repository/offline deployment qualification. It does not claim live-chain deployment. Production-equivalent testnet evidence remains a later Governance roadmap gate and cannot be satisfied by repository simulation alone.

**GOV-AUDIT-6 is COMPLETE.**
