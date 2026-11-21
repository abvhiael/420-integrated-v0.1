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

Before activation, any incomplete but otherwise valid one-shot bootstrap must be recovered by executing its **original** remaining operation IDs through the real GovernanceTimelock after their G1 delay; every `execute` call is permissionless, and the Timelock calls the target with its actual authority. Do not impersonate the Timelock or reschedule a second bootstrap. Although GovernanceTimelock has a bootstrap-only `cancel` selector, its caller must be Governance420 and the compatibility contract has **no public arbitrary-cancel forwarding path**. An externally submitted cancellation is not an available recovery option. If a scheduled operation is permanently wrong or cannot be executed, abandon and reproducibly regenerate that Genesis candidate from the approved commitments; do not bypass bootstrap checks or invent a new operator key.

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

## GOV-REC-2 — initial eligibility evidence, deterministic roots and cold-start recovery

**Release truth:** The repository does **not** contain an authenticated real Genesis Community owner roster, active-validator owner roster, or chain-specific electorate source-state commitment. The five materialization slots in `contracts/config/governance-deployment-v1.json#genesisBootstrapCommitment` deliberately remain zero and `genesisActivationReady=false`. Synthetic voter addresses and roots under `contracts/test/fixtures/governance-rec-2-*` are **test fixtures only** and must never be substituted into a live Genesis release.

To build a genuine release candidate, independently obtain and verify both eligibility snapshots against their authoritative membership and active-validator-owner records at the **same finalized chain/genesis identity**. For each unique eligible owner address, retain the source record reference, record hash and evidence of eligibility at the frozen snapshot. Exclude inactive/nonowner validator records, normalize addresses case-insensitively, reject duplicate owners, and count **one eligible owner as one vote** regardless of stake or token holdings. Require nonempty Community and Validator electorates. Evidence must be authenticated by the authoritative source; a self-declared `eligible=true` field is not proof by itself.

Run the deterministic builder for the verified source inventory:

```bash
python3 scripts/build-governance-rec-2-electorates.py --input <verified-eligibility-input.json> --output <candidate-proof-vectors.json>
```

The input schema is `420-civic-electorate-input-v1`, with `fixtureOnly=false`, a positive target `chainId`, `eligibilitySource.reference` and `eligibilitySource.snapshotHash`, and exactly `COMMUNITY` and `VALIDATOR` houses. Each house needs `totalWeight` equal to its independently verified unique-member count and a `members` list of nonzero `address` entries with source `evidence.reference`, `evidence.recordHash` and eligible status. An optional `expectedRoot` enforces comparison to an independent approval. The tool uses Ethereum Keccak-256 (not NIST SHA3), a numerically sorted address list, `keccak256(abi.encode(address))` leaves, sorted-pair inner hashing and promotion of odd nodes. It emits one membership proof per address and the canonical source-input SHA-256 digest. **This tool checks structural consistency and reproducible proofs, not whether external records are true.** The approved evidence and generator output must be independently reconciled before a release decision.

Copy **only** independently approved Community/Validator roots and unique-member totals into the five Genesis materialization fields, paired with the verified full chain-specific plan hash over the seven deployable components and code hashes. Re-run `scripts/generate-governance-audit-6-artifacts.py --write --check`, verify the frozen predeploy storage slots against the release approval, and require `scripts/verify-governance-audit-6.py --require-activation-ready` to pass. Never initialize release storage from `fixtureOnly=true` data.

**Execution sequence:** After Genesis graph preflight and a successful one-shot schedule, any account can call `GovernanceTimelock.execute` on each fixed operation ID after its G1 timestamp floor. Indices 17 and 18 invoke `publishInitialCheckpoint` from the **real Timelock** to the two role-bound Merkle sources. Each initial checkpoint's `effectiveBlock` is computed as its **actual execution block + 1**, not when the operation was scheduled; it is not usable until the first proposal's snapshot at `block.number - 1` includes it. If either operation is missing, failed or not yet effective, `activateCanonicalCivic` must revert and leave the bootstrap authority unchanged. Execute any outstanding original operations, advance until both initial snapshots are effective, verify checkpoint count one, root, total weight and source revisions, and only then invoke the irreversible activation. Reverting activation is recoverable; an invalid committed operation requires discarding the candidate, not silently editing its commitments.

**First-vote proof:** Create a normal G3/G4 proposal only after activation, inspect the immutable Community and Validator `HouseSnapshot` values, and vote as actual eligible wallet addresses using the appropriate Merkle sibling paths. Invalid membership, replayed ballots, overweight tallies and votes outside the window must fail. Later electorate changes must go through an independently passed Civic proposal, be prospectively checkpointed and/or source-replaced by a Governor-queued Timelock batch; a previous proposal's source, root, total and revision remain immutable.

**Offline checks:**

```bash
python3 scripts/test-governance-rec-2-electorates.py
python3 scripts/build-governance-rec-2-electorates.py --input contracts/test/fixtures/governance-rec-2-members.json --output contracts/test/fixtures/governance-rec-2-vectors.json --check
```

Both bundled houses have two synthetic members solely to test the first real, authority-correct Governance voting path. No user or developer is required to impersonate the Timelock in that end-to-end test. Neither these fixtures nor offline Foundry passes assert that a public electorate exists.
