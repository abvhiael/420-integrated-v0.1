# 420 Governance operator guide

## Sources of truth

Use these repository files together:

- `contracts/config/governance-deployment-v1.json`;
- `contracts/config/predeploy/GovernanceTimelock-predeploy-state.json`;
- `contracts/config/predeploy/Governance420-predeploy-state.json`;
- `contracts/config/predeploy/storage-init.json`;
- `contracts/config/predeploy/predeploy-plan.json`;
- `contracts/config/deployment-manifest.json`;
- `contracts/config/interfaces/governance-dependency-model.json`;
- `contracts/config/interfaces/governance-cross-protocol-integration.json`.

Do not infer missing authority or addresses from documentation prose.

## Configuration and environment

Governance has no operator secret, owner key or Governance-specific environment variable that grants protocol authority.

Canonical fixed addresses, compiler settings, runtime hashes, Registry identifiers and initialization values come from committed configuration. Registry-resolved Civic addresses are deployment outputs and must be discovered/published rather than supplied as guessed constants.

420Wallet runtime configuration must provide canonical ProtocolRegistry-backed Governance discovery for the selected network. Hosted Indexer/Search/Explorer/Notifications endpoints are replaceable consumer configuration and do not become Governance authority.

## Build and verification

From repository root:

```sh
python3 scripts/verify-governance-audit-1.py
python3 scripts/verify-governance-audit-2.py
python3 scripts/verify-governance-audit-3.py
python3 scripts/verify-governance-audit-6.py --require-ready
# Strict final-chain gate: expected to fail while actual authorized electorates are uncommitted.
python3 scripts/verify-governance-audit-6.py --require-activation-ready
python3 scripts/verify-governance-audit-7.py
python3 scripts/verify-genesis-interface-layer.py
python3 scripts/verify-genesis-canonical-addresses.py
python3 scripts/verify-genesis-predeploy-authority.py
python3 scripts/audit-genesis-address-collisions.py
```

From `contracts/`:

```sh
forge fmt --check src/governance
forge build src/governance
forge test --match-path 'test/Civic*.t.sol' -vvv
forge test --match-path 'test/Governance*.t.sol' -vvv
FOUNDRY_SRC=src/governance FOUNDRY_TEST=test-governance-audit-6 forge test --match-path test-governance-audit-6/GovernanceAudit6Deployment420.t.sol -vvv
FOUNDRY_SRC=src/governance FOUNDRY_TEST=test-governance-audit-7 forge test --match-path test-governance-audit-7/GovernanceAudit7Integration420.t.sol -vvv
```

Retained artifacts:

```sh
python3 scripts/generate-governance-audit-6-artifacts.py --write --check --print
```

Any generated diff is deployment-artifact drift and must be reconciled before release.

## Compiler/runtime pins

Canonical build inputs are Solidity 0.8.24, Cancun EVM, optimizer enabled with 200 runs, and via-IR enabled. Runtime hashes are retained in `governance-deployment-v1.json`.

## Deployment topology

Fixed Genesis predeploys:

- GovernanceTimelock — `0x0429`;
- Governance420 — `0x0437`;
- ProtocolRegistry — `0x0434`.

Registry-resolved deployment outputs:

- CivicConstitution420;
- CivicProposalRegistry420;
- CivicElectorateRegistry420;
- CivicVoting420;
- CivicGovernor420;
- COMMUNITY CivicMerkleElectorateSource420;
- VALIDATOR CivicMerkleElectorateSource420.

Never invent fixed addresses for Registry-resolved outputs.

## Initialization order

1. Materialize GovernanceTimelock at frozen `0x0429` with bootstrapGovernor/scheduler `Governance420@0x0437`.
2. Materialize Governance420 at frozen `0x0437`, bound to Timelock, with the **previously Genesis-approved** plan hash and authentic Community/Validator Merkle roots and totals. An unset/partial commitment must fail closed; no external caller may set it.
3. Ensure the actual ProtocolRegistry is installed at frozen `0x0434`, bound to the same Timelock and reporting protocol version 4. The Governance service version and all **seven** Civic component revisions must still be zero. Other unrelated Registry services do not need to be empty.
4. Deploy the Constitution, Proposal Registry and Electorate Registry with the exact Timelock, leaving G1–G4 constitutional rules absent, proposal/snapshot authorities unset and both electorate house sources unconfigured.
5. Deploy separate Community and Validator equal-weight Merkle electorate sources with their correct source types and the exact Timelock. Both source checkpoint lists must initially be empty.
6. Deploy CivicVoting420 and CivicGovernor420 with matching Proposal/Electorate/Constitution/Voting dependencies. All five core Civic modules must report protocol version 1.
7. Verify all seven addresses, actual runtime code hashes, constructor/dependency relationships and initial electorate commitments against the pre-seeded, chain-specific `Governance420.canonicalBootstrapPlanHash`. Wrong addresses with the same bytecode are not acceptable.
8. **Only then** allow any caller to invoke `scheduleCanonicalCivicBootstrap`. Scheduling exactly 19 G1 Timelock operations must succeed atomically or revert without setting `bootstrapPlanScheduled`, `bootstrapPlanHash` or partial operations.
9. After the Timelock floor, execute scheduled operations `0..18` in order. They configure both sources, set frozen revision-1 G1–G4 rules, bind the authorities and compatibility pointer, register the seven Civic components, publish the Governance service, and publish the two initial electorate checkpoints. **Do not perform these mutations manually before scheduling**: the preflight deliberately rejects a partially initialized graph.
10. Advance beyond the two initial checkpoints' effective blocks, and verify both roots/totals, constitutional rules, Registry resolutions, service version and Timelock scheduler preconditions.
11. Invoke `activateCanonicalCivic` only after all preconditions are proven; verify permanent handoff to CivicGovernor420, `bootstrapRetired == true` and `civicAuthorityActivated == true`.

The exact deployment specification remains authoritative where this summary omits detail. The initial storage approval cannot be selected or replaced by the transaction sender; competing, duplicate and post-activation bootstrap requests revert without creating new authority.

## Bootstrap recovery

Before activation, bootstrap Timelock operations may be cancelled through the canonical bootstrap authority. If verification is wrong, discard the candidate deployment and reproduce it from retained artifacts/configuration.

After activation the handoff is one-way. Bootstrap cancellation is disabled. Recovery must use canonical Civic governance.

## Upgrade and migration policy

The current Civic contracts expose no proxy-admin or in-place implementation upgrade mechanism.

A future implementation revision must be deployed reproducibly and published/versioned through the canonical Registry/governance process. Existing proposal snapshots, frozen rules, ballots and completed lifecycle history must not be rewritten.

A migration introducing a new runtime authority, cancellation path, electorate weighting rule, proxy, storage migration, service/component ID or fixed address is a substantive protocol change requiring separate qualification.

## Operational monitoring

Monitor canonical chain state for Timelock scheduler/activation, Governance service implementation/version, component resolutions/runtime hashes, constitutional revisions, electorate source/checkpoint revisions, proposal transitions, vote/tally events, queued operations and execution results.

Indexer, Explorer, Search and Notifications are convenience projections only.

## Incident response

If a client projection is stale, verify chain/Registry state directly.

If a Registry component unexpectedly resolves elsewhere, treat discovery as failed closed and stop transacting until reconciled.

If a target action reverts, do not mutate the proposal commitment; diagnose the target and retry the same queued action batch when valid.

If a canonical runtime hash or fixed predeploy differs from retained authority, stop deployment/operation and treat it as a release-integrity failure.

## Canonical Genesis bootstrap commitment and first electorate checkpoint (GOV-REC-1/2)

The compatibility predeploy at `0x0437` contains five Genesis-materialized, non-writable state fields: `approvedBootstrapPlanHash`, `initialCommunityRoot`, `initialCommunityTotalWeight`, `initialValidatorRoot` and `initialValidatorTotalWeight`. Their sole source is `contracts/config/governance-deployment-v1.json#genesisBootstrapCommitment`; `scripts/generate-governance-audit-6-artifacts.py` populates the corresponding five Solidity storage slots from the actual artifact layout. The initial all-zero values deliberately **reject any first-caller bootstrap**. No operator setter, new owner, or emergency bypass may initialize them after Genesis.

For an actual Genesis candidate, first establish the final chain ID, exact seven Civic module/source addresses and runtime code hashes, then authenticate both sets of eligible community and active-validator owner voters. Build equal-weight Merkle roots using `keccak256(abi.encode(address))` leaves and sorted-pair parent hashes. Count unique eligible addresses, not token/stake amounts. Independently verify the roots and weight counts. Set **all five** Genesis fields at once. With those values materialized into `0x0437`, compute and compare `Governance420.canonicalBootstrapPlanHash` against the immutable approved value *before chain activation*. Neither an external caller nor a competing graph may establish its own plan approval.

The canonical schedule contains **19** fixed G1 Timelock operations, indices `0..18`. Original operations `0..16` remain unchanged. Indices `17` and `18` publish the one-time Community and Validator checkpoints through the actual Timelock, effective from the next block; subsequent checkpoints remain prospective and governance-controlled. Execute every required initialization and checkpoint operation and advance past both checkpoint-effective blocks before calling `activateCanonicalCivic`. The handoff rejects uninitialized or mismatched electorates.

`--require-ready` checks reproducible offline deployment and contract policy; `--require-activation-ready` additionally enforces nonzero, complete, real Genesis release commitments. **Default zero fields are deliberately pending actual membership and chain-specific deployment data and do not signify live-testnet readiness.**
