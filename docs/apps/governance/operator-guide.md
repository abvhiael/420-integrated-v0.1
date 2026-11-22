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
2. Materialize Governance420 at frozen `0x0437`, bound to Timelock, with the **previously Genesis-approved** plan hash and either independently authenticated Genesis Merkle roots/totals or the approved post-Genesis electorate enrollment contract and constitutional authority with zero initial roots/totals. An unset/partial commitment must fail closed; no external caller may set it.
3. Ensure the actual ProtocolRegistry is installed at frozen `0x0434`, bound to the same Timelock and reporting protocol version 4. The Governance service version and all **seven** Civic component revisions must still be zero. Other unrelated Registry services do not need to be empty.
4. Deploy the Constitution, Proposal Registry and Electorate Registry with the exact Timelock, leaving G1–G4 constitutional rules absent, proposal/snapshot authorities unset and both electorate house sources unconfigured.
5. Deploy separate Community and Validator equal-weight Merkle electorate sources with their correct source types and the exact Timelock. Both source checkpoint lists must initially be empty.
6. Deploy CivicVoting420 and CivicGovernor420 with matching Proposal/Electorate/Constitution/Voting dependencies. All five core Civic modules must report protocol version 1.
7. Verify all seven addresses, actual runtime code hashes, constructor/dependency relationships and initial electorate commitments against the pre-seeded, chain-specific `Governance420.canonicalBootstrapPlanHash`. Wrong addresses with the same bytecode are not acceptable.
8. **Only then** allow any caller to invoke `scheduleCanonicalCivicBootstrap`. Legacy scheduling of 19 G1 operations, or deferred scheduling of 17 initialization operations plus the one preapproved Identity issuer operation (index 19), must succeed atomically or revert without setting `bootstrapPlanScheduled`, `bootstrapPlanHash` or partial operations.
9. For legacy approval, execute indices `0..18`. For deferred approval, execute `0..16` and issuer setup index `19` after the first G1 floor, then enroll eligible people and use the one-shot authority to schedule and execute checkpoint indices `17..18` after their own G1 floor. They configure both sources, set frozen revision-1 G1–G4 rules, bind the authorities and compatibility pointer, register the seven Civic components, publish the Governance service, and publish the two initial electorate checkpoints. **Do not perform these mutations manually before scheduling**: the preflight deliberately rejects a partially initialized graph.
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

## Canonical Genesis bootstrap commitment and first electorate checkpoint (GOV-REC-1/2, GOV-PRE-06)

The compatibility predeploy at `0x0437` now has **seven Genesis-only, non-writable approval fields** in `contracts/config/governance-deployment-v1.json#genesisBootstrapCommitment`: `approvedBootstrapPlanHash`, initial Community/Validator roots and totals, `approvedInitialEnrollment`, and `approvedInitialElectorateAuthority`. The retained artifact generator materializes all seven via the independently checked Solidity storage layout. There is **no runtime setter** and all seven remain intentionally zero in the unapproved default candidate.

Only two fully approved modes are valid:

- **Legacy authenticated Genesis snapshot:** one signed chain-specific plan hash and nonzero authentic roots/totals for both houses; both new authority/enrollment slots must be zero. All 19 fixed Timelock G1 operations (indices `0..18`) are scheduled at once, exactly as before.
- **GOV-PRE-06 verified post-Genesis enrollment:** one signed chain-specific plan hash, zero initial roots/totals for both houses, one independently approved enrollment contract address, and one independently approved constitutional electorate authority. The canonical hash has a distinct post-Genesis domain and binds the chain ID, seven real Civic graph addresses/codehashes, actual enrollment codehash, approved authority, and both Identity420 (`0x0436`) and ValidatorRegistry (`0x0423`) codehashes. Any mixed or partial state fails closed.

For the **deferred** route, the first caller may schedule only the already-approved graph. The original initialization operations `0..16` remain unchanged; the fixed new **G1 Timelock operation 19** installs the Genesis-approved authority as the VERIFIED issuer `keccak256("420/CIVIC/INITIAL_ELECTORATE_ISSUER/V1")` in the real Identity420. Execute those original operations and operation 19 after their seven-day G1 delay. Identity420 at `0x0436` and ValidatorRegistry at `0x0423` must be genuine version-3 contracts bound to the same Timelock; otherwise the schedule fails.

Each genuine wallet creates its own active 420Identity profile. The approved issuer independently validates and issues the exact house credential types `keccak256("420/CIVIC/COMMUNITY_ELECTORATE/V1")` or `keccak256("420/CIVIC/VALIDATOR_ELECTORATE/V1")`; a Validator must additionally be the eligible registered validator owner at `0x0423`. Voters call `CivicInitialElectorateEnrollment420.enroll(house, profileId, credentialId)` themselves. Neither a token holding nor an asserted list is eligibility proof. Duplicate accounts/profiles, wrong chain, invalid credentials and ineligible validators are rejected. Before sealing, a registrant may withdraw or anyone may prune an **independently proven invalid** record; no third party can eject an eligible member.

Once both houses contain real eligible owners, **only the Genesis-approved constitutional electorate authority** can call `Governance420.schedulePostGenesisInitialElectorates()`. It freezes both independently re-verified electorates, deterministically computes `keccak256(abi.encode(address))` address leaves, numerically sorted, sorted-pair Merkle roots with one vote per eligible wallet, and schedules the previously reserved G1 Timelock checkpoint operations 17 and 18. No authority supplies an arbitrary root. After their own seven-day delay, execute 17/18 through the real Timelock and advance until both prospective checkpoints are effective for `snapshotBlock = block.number - 1`. `activateCanonicalCivic` then revalidates actual membership and checkpoint identity, permanently retires bootstrap and assigns Timelock scheduler authority to CivicGovernor420. Enrollment and first-checkpoint scheduling cannot reopen after sealing/handoff.

**The new code enables enrollment after a correctly approved Genesis without restarting the chain. It does not itself approve an unsigned Genesis V4, invent a founding wallet or prove that real testnet electors exist.** `--require-activation-ready` must fail with the repository's all-zero default.

## GOV-REC-2 — initial eligibility evidence, deterministic roots and cold-start recovery

**Release truth:** The repository does **not** contain an authenticated real Genesis Community owner roster, active-validator owner roster, or chain-specific electorate source-state commitment. The seven materialization slots in `contracts/config/governance-deployment-v1.json#genesisBootstrapCommitment` deliberately remain zero and `genesisActivationReady=false`. Synthetic voter addresses and roots under `contracts/test/fixtures/governance-rec-2-*` are **test fixtures only** and must never be substituted into a live Genesis release.

To build a genuine release candidate, independently obtain and verify both eligibility snapshots against their authoritative membership and active-validator-owner records at the **same finalized chain/genesis identity**. For each unique eligible owner address, retain the source record reference, record hash and evidence of eligibility at the frozen snapshot. Exclude inactive/nonowner validator records, normalize addresses case-insensitively, reject duplicate owners, and count **one eligible owner as one vote** regardless of stake or token holdings. Require nonempty Community and Validator electorates. Evidence must be authenticated by the authoritative source; a self-declared `eligible=true` field is not proof by itself.

Run the deterministic builder for the verified source inventory:

```bash
python3 scripts/build-governance-rec-2-electorates.py --input <verified-eligibility-input.json> --output <candidate-proof-vectors.json>
```

The input schema is `420-civic-electorate-input-v1`, with `fixtureOnly=false`, a positive target `chainId`, `eligibilitySource.reference` and `eligibilitySource.snapshotHash`, and exactly `COMMUNITY` and `VALIDATOR` houses. Each house needs `totalWeight` equal to its independently verified unique-member count and a `members` list of nonzero `address` entries with source `evidence.reference`, `evidence.recordHash` and eligible status. An optional `expectedRoot` enforces comparison to an independent approval. The tool uses Ethereum Keccak-256 (not NIST SHA3), a numerically sorted address list, `keccak256(abi.encode(address))` leaves, sorted-pair inner hashing and promotion of odd nodes. It emits one membership proof per address and the canonical source-input SHA-256 digest. **This tool checks structural consistency and reproducible proofs, not whether external records are true.** The approved evidence and generator output must be independently reconciled before a release decision.

For the **legacy** mode only, copy independently approved Community/Validator roots and unique-member totals into the original five Genesis materialization fields, paired with the verified full chain-specific plan hash over the seven deployable components and code hashes. Re-run `scripts/generate-governance-audit-6-artifacts.py --write --check`, verify the frozen predeploy storage slots against the release approval, and require `scripts/verify-governance-audit-6.py --require-activation-ready` to pass. Never initialize release storage from `fixtureOnly=true` data.

**Legacy execution sequence:** After Genesis graph preflight and a successful one-shot schedule, any account can call `GovernanceTimelock.execute` on each fixed operation ID after its G1 timestamp floor. Indices 17 and 18 invoke `publishInitialCheckpoint` from the **real Timelock** to the two role-bound Merkle sources. Each initial checkpoint's `effectiveBlock` is computed as its **actual execution block + 1**, not when the operation was scheduled; it is not usable until the first proposal's snapshot at `block.number - 1` includes it. If either operation is missing, failed or not yet effective, `activateCanonicalCivic` must revert and leave the bootstrap authority unchanged. Execute any outstanding original operations, advance until both initial snapshots are effective, verify checkpoint count one, root, total weight and source revisions, and only then invoke the irreversible activation. Reverting activation is recoverable; an invalid committed operation requires discarding the candidate, not silently editing its commitments.

**First-vote proof:** Create a normal G3/G4 proposal only after activation, inspect the immutable Community and Validator `HouseSnapshot` values, and vote as actual eligible wallet addresses using the appropriate Merkle sibling paths. Invalid membership, replayed ballots, overweight tallies and votes outside the window must fail. Later electorate changes must go through an independently passed Civic proposal, be prospectively checkpointed and/or source-replaced by a Governor-queued Timelock batch; a previous proposal's source, root, total and revision remain immutable.

**Offline checks:**

```bash
python3 scripts/test-governance-rec-2-electorates.py
python3 scripts/build-governance-rec-2-electorates.py --input contracts/test/fixtures/governance-rec-2-members.json --output contracts/test/fixtures/governance-rec-2-vectors.json --check
```

Both bundled houses have two synthetic members solely to test the first real, authority-correct Governance voting path. No user or developer is required to impersonate the Timelock in that end-to-end test. Neither these fixtures nor offline Foundry passes assert that a public electorate exists.

## GOV-REC-6 strict release-candidate procedure

The detailed [cold-start runbook](cold-start.md) is the operator's execution-order reference for clean pinned build, authenticated electorate approval, all 19 actual Timelock bootstrap operations, checkpoint-effective-block preconditions, irreversible handoff, Wallet/Indexer smoke and recovery. The retained predeploy approval is **not materialized**; both `python3 scripts/verify-governance-rec-6.py --require-activation-ready` and the existing GOV-AUDIT-6 strict activation gate are intentionally expected to fail until real independently approved Genesis inputs exist. The ordinary non-strict verifier checks offline reproducibility, not membership legitimacy.

GOV-REC-6 source/version/security/manifest qualification is owned by `.github/workflows/governance-rec-6.yml` and the unchanged canonical Governance workflows. Do not infer a passing status from skipped/cancelled/non-executed jobs. Maintain exact head, retained Foundry and Indexer evidence, and independent checks of external deployment builds; no amount of local testing makes the current zero-commitment chain activation-ready.
