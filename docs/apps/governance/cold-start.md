# GOV-REC-6 — Canonical Governance cold-start and recovery

**This is a release operator runbook, not evidence of live approval.** The committed Genesis bootstrap commitment currently has seven zero-valued approval fields and therefore **cannot activate Governance**. Contract/Wallet/Indexer offline fixture tests exercise the identical execution order with synthetic electors; those fixtures are not real eligibility evidence.

## Fixed identities and build

- GovernanceTimelock: **0x0000000000000000000000000000000000000429**. Immutable bootstrapGovernor and initial scheduler point at **0x0437**; civicAuthorityActivated starts false.
- ProtocolRegistry: **0x0000000000000000000000000000000000000434**, v4, bound to the same Timelock. Civic components are Registry-resolved, not assigned new frozen addresses.
- Governance420 compatibility/bootstrap: **0x0000000000000000000000000000000000000437**, whose immutable Timelock points at **0x0429**.
- Solidity 0.8.24, Cancun EVM, optimizer 200, via-IR. Never silently upgrade these inputs. Wallet is an inspect-and-vote client, while proposal creation, queue and execution are developer/operator contract interfaces.

From a clean checkout at the **exact** qualified candidate SHA, run:

~~~sh
git status --porcelain
cd contracts
forge --version
forge clean
forge build src/governance
cd ..
python3 scripts/generate-governance-audit-6-artifacts.py --check --print
python3 scripts/verify-governance-rec-6.py
python3 scripts/verify-governance-audit-6.py --require-ready
python3 scripts/verify-governance-audit-7.py
python3 scripts/verify-genesis-canonical-addresses.py
python3 scripts/verify-genesis-predeploy-authority.py
python3 scripts/audit-genesis-address-collisions.py
git status --porcelain
~~~

The artifact generator's --check mode is **read-only**. Any runtime/ABI/storage/manifest drift is a release failure, not permission to regenerate and conceal differences. The independent GOV-REC-6 verifier checks all eight Governance code hashes, compiler pins, immutable slots, source Git blob hashes, initial storage slots, Indexer event descriptors and Registry identities against retained files.

## Authentic Genesis approval (current external blocker)

Before a genuine chain-specific testnet Genesis candidate can be activated, obtain the approved chain/genesis ID and seven graph addresses with their actual runtime hashes. **Legacy** approval requires authenticated Community and Validator owners at one Genesis snapshot; **GOV-PRE-06 deferred** approval requires independently approved on-chain eligibility sources, enrollment bytecode and constitutional authority, while the initial rosters remain authentically empty until real owners enroll. Both houses use one unique eligible owner = one vote; balances and stake amounts do not change voting weight. Reject duplicate, zero, ineligible and inactive-owner addresses. Independently corroborate every eligibility record; a self-asserted eligibility flag is not proof.

Use the deterministic membership builder **only on independently verified source records**:

~~~sh
python3 scripts/build-governance-rec-2-electorates.py \
  --input <approved-eligibility-source.json> \
  --output <candidate-electorate-proofs.json>
~~~

Require fixtureOnly=false, a positive and correct chainId, external eligibilitySource reference and snapshotHash, and each member's verifiable record reference/hash. The tool checks shape, Keccak roots and sorted-pair proofs; it does not authenticate external facts. Never substitute contracts/test/fixtures/governance-rec-2-* for live membership evidence.

Compute Governance420.canonicalBootstrapPlanHash from the **exact seven ordered graph addresses**, on the correct chain with actual extcodehashes and both verified roots/totals. Obtain independent approval for the plan hash. Only an authorized Genesis materialization may write the **seven fields** together in contracts/config/governance-deployment-v1.json under genesisBootstrapCommitment: approvedPlanHash, communityRoot, communityTotalWeight, validatorRoot, validatorTotalWeight. The generator maps these fields to Governance420's storage layout (no runtime setters). All seven absent is an explicitly fail-closed software-only candidate. Legacy uses the original five fully authenticated fields and two zero authority slots; deferred uses an approved plan hash plus two approved authority/enrollment addresses with all four initial-root/weight fields zero. Mixed and partial configurations are forbidden.

For a genuinely approved release (not for the current zero-valued repository):

~~~sh
python3 scripts/generate-governance-audit-6-artifacts.py --write --check
python3 scripts/verify-governance-rec-6.py --require-activation-ready
python3 scripts/verify-governance-audit-6.py --require-activation-ready
~~~

Both strict commands are **expected to fail with current committed zero fields**. Do not bypass them.

## Exact cold-start order

1. Materialize frozen Timelock at 0x0429 with initial scheduler=0x0437, inactive Civic authority; compatibility Governance420 at 0x0437 with the independently approved seven storage fields; and Registry at 0x0434 with all seven canonical Civic component revisions and Governance service version initially zero.
2. Deploy CivicConstitution420, CivicProposalRegistry420 and CivicElectorateRegistry420 bound to 0x0429, with initially empty rules/sources/authorities. Deploy distinct Community and Validator CivicMerkleElectorateSource420 with their frozen source types and **no checkpoints**.
3. Deploy CivicVoting420 bound to the exact Proposal/Electorate Registries, followed by CivicGovernor420 bound to the exact Constitution/Proposal/Electorate/Voting graph. Verify five component protocol versions=1, Registry protocol version=4, the actual runtime hashes, no mixed constructors and unchanged canonical predeploy state.
4. Recompute canonicalBootstrapPlanHash(address,address,address,address,address,address,address) for the ordered addresses (constitution, proposals, electorates, voting, governor, communitySource, validatorSource). It **must** equal the previously materialized approved hash **before** scheduling; a byte-identical module at a different address is not approved.
5. Invoke Governance420.scheduleCanonicalCivicBootstrap with those exact seven arguments. Any caller may invoke the one approved plan; no caller can choose a different plan, mutate approval, or gain scheduling authority. The call atomically schedules **19 G1 Timelock operations** (indices 0–18); record CivicBootstrapPlanScheduled, planHash and each bootstrapOperationId(plan,index).
6. After the G1 minimum **604800 seconds** (seven days), execute all original operation IDs **0 through 18** using permissionless GovernanceTimelock.execute(bytes32) on the real Timelock, not direct target calls. Operations 0–1 install both sources; 2–5 G1–G4 frozen rules; 6–8 bind the three authorities; 9–15 register the seven Civic components; 16 publishes the Governance service; 17–18 publish initial Community/Validator checkpoints.
7. Confirm both sources have exactly one initial checkpoint each, roots/totals/source revisions match Genesis, and checkpoint effectiveBlock = **actual checkpoint execution block + 1**. Advance until the prior-block proposal snapshot sees **both** effective checkpoints. Check source.snapshotAt(block.number-1), not just checkpoint[0].
8. Verify frozen revision-1 G1–G4, Proposal/Snapshot Registry bindings, seven Registry component resolutions, active v1 CivicGovernor service, Governance420.civicGovernor pointer and Timelock scheduler still at 0x0437.
9. **Only now** invoke Governance420.activateCanonicalCivic with the same ordered seven graph addresses. Verify Timelock.scheduler==CivicGovernor420, civicAuthorityActivated=true, bootstrapRetired=true. Activation, bootstrap scheduling, cancellation and arbitrary execution cannot be replayed; handoff is irreversible.

On a synthetic local EVM, this order is exercised by contracts/test/GovernanceRec4Lifecycle420.t.sol, especially testCleanDeploymentDualHouseAtomicExecutionAndIndexerEventProjection and the post-handoff stateful invariant. The suite executes actual Timelock operations and G3 dual-house votes, finalizes, queues and atomically executes a committed batch; it is **not** real Genesis approval.

## GOV-PRE-06 — post-Genesis real-electorate cold start (alternative to legacy steps 5–7)

**This is a separate approved Genesis mode, not a runtime escape hatch.** Keep all four initial electorate roots/weights exactly zero at Genesis. Pre-authorize the real chain-bound seven-module plan hash, a nonzero independently audited `CivicInitialElectorateEnrollment420` deployment, and the approved constitutional electorate authority in the new storage slots. The distinct plan hash commits actual codehashes for Identity420 at `0x0436`, ValidatorRegistry at `0x0423`, and the enrollment helper. No third-party caller can set or change these approvals after Genesis.

1. Deploy the exact approved enrollment helper, constructed with Governance420 at `0x0437` on the actual testnet chain ID. Verify its runtime codehash matches the approved plan, and that Identity420 and ValidatorRegistry are real version-3 predeploys bound to Timelock `0x0429`.
2. Call `scheduleCanonicalCivicBootstrap` once with the seven signed component addresses. In this mode it schedules initialization indices `0..16` and one extra **G1** issuer-authorization operation `19` only. No initial Community/Validator Merkle checkpoint can be scheduled yet.
3. Wait at least 604800 seconds and execute the unchanged original operations `0..16` plus `19` through `GovernanceTimelock.execute(bootstrapOperationId(plan,index))`. Operation 19 invokes `Identity420.setIssuer` with the fixed `INITIAL_ELECTORATE_ISSUER` ID, controller equal to the approved constitutional electorate authority, and VERIFIED trust. This is the only bootstrap grant for new members; no fabricated wallet is inserted.
4. Real residents/owners create or use active 420Identity profiles. The independent issuer reviews eligibility and signs two **house-specific** 420Identity credentials (`420/CIVIC/COMMUNITY_ELECTORATE/V1` or `420/CIVIC/VALIDATOR_ELECTORATE/V1`, each Keccak-hashed for `credentialType`). Validator membership additionally requires the live, eligible `ValidatorRegistry.ownerValidatorId` and `retirementOwnerStatus` ownership state. Each account calls `enroll(house, profileId, credentialId)` itself. Capture evidence of actual issuers and member proofs; do not use test fixture owners. Invalid/expired/suspended enrollments can be withdrawn or pruned with on-chain verification **before** sealing.
5. After both houses have genuine voters, the **approved Genesis electorate authority alone** calls `Governance420.schedulePostGenesisInitialElectorates()`. The one-way enrollment helper verifies each member and computes sorted-address, sorted-pair Merkle commitments. Governance schedules indices `17` and `18` under the **same** G1 Timelock delay. Both roots, totals and snapshot source identities are retained on-chain; no ad-hoc root injection is possible.
6. Wait the second G1 delay, permissionlessly execute indices `17`/`18`, then advance until both checkpoint effective blocks are included in the preceding-block proposal snapshot. The Community and Validator merkle sources must each have exactly one matching initial checkpoint and positive equal-vote totals. `activateCanonicalCivic` rechecks live credentials/ValidatorRegistry eligibility and atomically transfers Timelock scheduler to CivicGovernor. The helper cannot be reopened or rescheduled after the seal.
7. Prove a new G3 dual-house vote with independently verified Merkle proofs for both houses, confirm one voter/one ballot and exact frozen rule thresholds, finalize only after voteEnd, then queue and execute the exact committed action batch after its class Timelock delay. Preserve chain receipts, block numbers, roots/proofs and signer evidence.

Recovery: before the seal a registrant may withdraw or any caller may prune a **provably ineligible** record; a new valid independently issued credential can re-enroll that owner. A valid record cannot be censored by arbitrary third parties. After seal, invalidated live credentials prevent activation until release policy is reconciled; there is **no** reopen setter, fake root, Timelock impersonation or shortcut. Never replay operations after activation.

The current repository still has **zero signed plan/authority data**. An offline pass proves capability only and is not permission to release an unapproved chain.

## Post-handoff smoke and consumer checks

Create and inspect a G3/G4 dual-house proposal through its developer/operator contract surface, verify frozen rule/electorate snapshots and exact action commitment, cast FOR/AGAINST/ABSTAIN from eligible owners, reject already-cast, ineligible, wrong-window and replay attempts. Finalize only after inclusive voteEnd; queue only the exact committed action batch, wait its Timelock delay, and execute through the real Timelock. The Indexer must reconstruct ACTIVE → PASSED → QUEUED → EXECUTED from actual Civic events; replay, reorg and duplicate records remain non-authoritative. Wallet must independently verify Registry service/runtime identities before requesting user signing. Search, Explorer and Notifications never gain votes, tallies or execution authority.

## Failure recovery and no-go gates

| Incident | Correct recovery |
|---|---|
| Missing approved chain, graph or authentic electorate | **Stop pre-activation.** No synthetic membership, guessed addresses or external setter |
| Unexpected artifact, ABI, immutable, predeploy slot, source hash or Registry identity | Stop candidate; reproduce from pinned source; do not patch active state |
| Scheduled bootstrap operation immature/missing | After its original delay execute the **same original operation ID**; do not reschedule a competing plan |
| Wrong/unrecoverable fixed operation or corrupted Genesis input | Discard unreleased candidate; no arbitrary cancel forwarding, key or emergency bypass |
| Missing or ineffective initial electorate checkpoint | Execute remaining original checkpoint operation(s), advance blocks, recheck before activation |
| Activated runtime mismatch | Never restore compatibility scheduling authority; diagnose using immutable chain evidence and ordinary Civic governance |
| Reverting queued target | Entire batch is atomic; preserve exact committed actions and retry the mature original operation only when safe |
| Stale Wallet/Indexer/Search/Explorer/Notifications projection | Refresh verified chain state and replay/reorg-derived projections; never change protocol state from a projection |
| Missing/skipped/cancelled required exact-SHA CI or critical/high finding | No software qualification, no merge and no release |

## Evidence required

Preserve exact Git SHA, clean-worktree check, toolchain version, eight code hashes, immutable/storage layout records, approved roots/totals/provenance, chain ID, seven addresses and codehashes, all 19 legacy operation IDs (or indices 0–19 for the deferred mode) and receipts, checkpoint effective blocks, source revisions, approval/handoff proof, contract/Wallet/Indexer/Genesis/Treasury/Vault/repository qualification workflow IDs and their **actual** conclusions, and a specific outstanding-finding ledger.

The current seven-field all-zero approval remains deliberately **fail-closed**; this document neither claims public chain launch nor satisfies GOV-AUDIT-9, the next production-equivalent testnet stage.
