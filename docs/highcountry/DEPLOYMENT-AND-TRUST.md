# High Country — R01.5 deployment and trust policy

Status: normative release policy, not deployment acceptance or acceptance of unresolved security risk. Sources: [scope](RELEASE-SCOPE.md), [architecture](ARCHITECTURE-AND-AUTHORITY.md), [migration](MIGRATION-BOUNDARIES.md), [session specification](HC-GP-4-SESSION-CAPABILITY.md), [operations guide](BUILD-AND-OPERATIONS.md), [audit](REPOSITORY-AUDIT-20261009.md). Preserve frozen addresses and existing ABI/storage. R02 implements enforcement, R07 packages/rehearses deployment, R09/R10 validate actual operation. R01.5 does not assign operator addresses, grant privileges or invent upgrade controllers.

## Deployment authority and acceptance

Resolve chain ID, canonical manifest/version, dependency addresses, expected runtime code/interface/version and registrars before deploying HC contracts. Verify `contracts/config/system-addresses.json`, `contracts/config/420gamingprotocol-genesis.json`, `contracts/config/genesis-dapp-contract-map.json` and `deployments/gaming/testnet.runtime.json`; no HC reserved address is invented. The runtime currently contains unresolved addresses/operators: template validation is not live acceptance.

Use the constructor-derived order in the operations guide. Deployment record must enumerate each constructor argument, transaction, code hash, component registration, action/scope grants, initial ruleset/root/module state, bootstrap authority and operational principal. Engine→coordinator/genome calls need explicit engine-principal grants; a user grant does not authorize an engine. Genesis ADMIN_SCOPE is keccak256("HC.GENESIS.ADMIN.V1"), not zero. Seed all required reproducible roots, founder loci, regions/land/rulesets and run readiness checks before irreversible finalize. Capture manifests and preflight verification; failure before finalization aborts, failure after finalization requires the replacement policy below.

Separate bootstrap, runtime gameplay, issuer, randomness provider, session-policy administrator, emergency restrict/release and deployment/release authorities by scoped grants and protected credentials. No production role is implied by a role name in this document. Record actual principals, custody/recovery owners, expiry and dual review in the R07 manifest. Revoke temporary deployment grants after handoff and verify revocation on-chain. No unreviewed wildcard component/action/scope or worker-wide asset-transfer authority. R02.2 selects explicit rejection: the view-only HC adapter and routine-session verifier reject grants when either periodLimit or periodSeconds is nonzero. Issue only nonperiodic HC grants with both fields zero; per-call limits/time/revocation remain enforced. Supporting cumulative budgets later requires a separately qualified interface/authority design.

## Privileged action families: powers, assumptions and recovery

The exact ActionIds catalogue follows below; every action belongs to these families. Caller checks and scopes remain source-authoritative and are not widened by this policy.

| Family | Trusted power / required boundary | Recovery and release condition |
|---|---|---|
| Genesis roots/finalize | Bootstrap capability holder chooses six roots; finalize irreversible | Verify manifests/ready dependencies first; revoke bootstrap; no reset or fake rollback |
| Regions/growers/land/public plots | Registrars define canonical objects; capability-authorized owner/occupancy changes may exceed intrinsic owner checks | Scope registration/transfer; preserve active occupancy/capacity; compromised role revoke/freeze, reconcile records; no discretionary confiscation guarantee claimed |
| Genome/seed/mother/clone/phenotype | Issuers create immutable lineage/assets; transfer/consume holders modify recorded ownership/budgets | Approved provenance and resource conservation mandatory; deny unverified sources; revoke compromised issuer; immutable bad records quarantine, never overwrite history |
| Randomness/breeding | Requester binds domain/context; provider can currently bias/withhold entropy; engine writes child genotype | Production verified adapter policy below; prevent duplicate child/reroll; approved timeout/cancel needed before release |
| Plant/cultivation | Capability holders create/advance/seal state; operator and canonical genome checks constrain some paths | Emergency/lifecycle/ruleset/resource enforcement R02; preserve last accepted state; deterministic replay/reconciliation without duplicate products |
| Ruleset/module | Administrators append/route rulesets and register/advance module state | Versioned audited rules, code/interface readiness, review and deployment record; changing registry does not change immutable engine dependencies |
| Guest migration | Account must own profile for object claims; service can receipt consumed shared claims | Approved-source/root issuance, exact source/claim scopes, durable uniqueness/outbox; quarantine mismatch/reorg; R01.4 governs |
| Bonus/event gates | Administrators choose optional gates/content/status | Never gate founding/core/base gameplay; resolve entitlement per player; revoke gate issuance/config role and restore verified catalogue |
| Session policy | Administrator classifies exact target+selector as routine | Initial production allowlist EMPTY; sensitive actions never routine; disable compromised entries and wallet grants/epochs; review new code before reenable |
| Emergency | Separate scoped restrict/release capabilities alter allowlisted flags | Restrict may stop new risk; release needs incident review and invariant smoke; no ownership/seizure or arbitrary call power |
| Shared Gaming operator | GameRegistry operator issues claims/entitlements/attestations; shared admin updates operator/status | Validate approved evidence/targets/content; revoke/rotate compromised authority via existing shared protocol; existing claim/entitlement cancellation/revocation rules remain source-bound |
| Service/database/cloud/indexing operators | Authenticate users, store saves, apply service-domain effects and derive projections | Least privilege, encrypted secrets/backups, scoped reads, durable audit/outbox; rotate credentials/revoke sessions; restore and reconcile canonical finality before writes |

Grant administrators can authorize some recorded asset transfers regardless of recorded owner; this is an unresolved implementation/trust exposure. Production policy prohibits discretionary asset-taking and requires reviewed owner/consent-bound paths before qualification. Merely documenting that policy does not enforce it or close the audit finding. Each principal's actual authority and recovery path must be verified in deployment tests.

## Account provenance and sessions

Trust only the chain-specific canonical wallet factory/account implementation and EntryPoint configured by the existing wallet protocol. Confirm factory address/code and account creation evidence, predicted identity where provided, runtime implementation/code and actual owner/recovery authorization; verify current account epoch/registry against canonical dependencies. Account-reported componentId/sessionScope/registry views are necessary checks, not deployment attestation. R02 must supply verifier/consumer wiring against actual factory semantics; no fabricated isAccount API is assumed.

Initial production routine selector catalogue is empty: every on-chain mutator escalates until explicitly reviewed. A future entry requires contract address+chain+code/version, exact ABI signature+selector, zero native value, bounded argument/state effects, capability scope/epoch/revocation and failure tests. Zero native value alone does not make an ERC20 transfer/approval safe. No asset transfer, native/token spend, allowance, marketplace settlement, genetics registration/licensing, reward claim, migration canonicalization, grant/configuration/ownership/upgrade/emergency action is routine. Even cultivation progression requires review of outcome/resource consequences before admission. UI convenience never overrides wallet/target enforcement.

Wallet owner/passkey grants exact sessions through the existing wallet; HC does not hold session signing material. Unknown/expired/revoked/stale/mismatched grants fail closed. Emergency recovery disables affected routine entries, revokes player sessions/rotates epochs under actual wallet authority and requires owner escalation. Wallet disconnect or service outage does not remove core/local gameplay.

## Randomness and external dependency trust

Production fairness-sensitive breeding/competition must use a reviewed 420Randomness/OIL adapter with verified request/game/chain/domain/context, provider identity, proof/finality and bounded availability. Current authorized arbitrary entropy is suitable only for explicitly labelled development testing; do not describe it as provably fair. Commit the adapter/provider mechanism and timeout before release; no random value from RPC timestamp/operator preference as fallback. A failed provider pauses the same operation; cancellation/resource recovery follows approved lifecycle, never permits repeated draws to select an outcome. Provider change applies only under a versioned policy preserving pending request provenance; ambiguous pending outcomes quarantine.

| External dependency | Assumption / failure behavior | Recovery |
|---|---|---|
| Capability registry | Canonical code/grant/revocation authority; no substitute oracle | Revoke compromised grants; halt protected writes; deployment replacement only if supported |
| Wallet factory/SmartAccount/EntryPoint | Canonical deployment/execution and signing semantics | Owner/recovery protocol; revoke sessions; fail closed on provenance mismatch |
| Shared Gaming registries | Exact profile/game/content/operator authorization, claim state, expiry/revocation | Canonical state recheck; issuer rotation and existing cancellation/revocation mechanisms |
| HC constructor dependencies | Correct immutable trusted implementations, not EOA/spoofed interface | Deployment preflight; halt/redeploy dependency closure on incompatible change |
| RPC/indexer/finality | Canonical chain/block/state; cache metadata is untrusted | Bounded retry, independent verification for high-risk reads, reorg rollback/cursor reconciliation |
| Save DB/cloud/auth service | Durable scoped integrity/privacy and unique application | Backup restore, session revoke/key rotation, transactional outbox replay and source preservation |
| Pay/native/token/rights integrations | Conditional exact asset/custody/authorization interfaces | Do not activate until settlement/revocation/refund tests and funded acceptance exist |

No direct mandatory dependency on unrelated AI/Compute/Bridge/Stake services is invented. R01.2 lists conditional integrations. External-call reverts must roll back EVM changes; off-chain effects use reconciliation, not assumed atomicity. Provider compromise is a release incident, not accepted silent trust.

## Emergency policy

Current EmergencyState allows 13 domains: CULTIVATION, BREEDING, MANUFACTURING, MARKET, LEASE, LICENSE, RIGHTS, ORGANIZATION_GOVERNANCE, COOPERATIVE_GOVERNANCE, RANDOMNESS_REQUEST, COMPETITION_ENTRY, MISSION_ACTIVATION, MODULE_ACTIVATION. Restriction flags currently do not stop engines. R02 must enforce before claiming emergency protection.

Restriction blocks new entries/commitments and mutations increasing domain risk. It must preserve reads, local/core play and separately reviewed safe cancellation/refund/expiry/reconciliation exits; those exits cannot bypass asset/accounting/replay checks. Define each engine's safe-exit selector and timeout in its implementation spec; absent engine means no implemented exit is claimed. No global arbitrary transfer, override of frozen rules or general wallet lock. A suspected exploit triggers scoped restriction plus affected service-write stop, evidence capture, role/key revocation, canonical reconciliation and operator/user incident communication. Resume only after repair qualification, accounting/invariant checks and independent incident review; all restriction/release actions emit retained audit evidence.

## Upgrade, replacement and rebinding policy

Current direct HC contracts have immutable dependencies, no proxy/delegatecall upgrade path, and ModuleRegistry cannot replace an existing module implementation. Its PROPOSED→QUALIFIED→SCHEDULED→ACTIVE→DRAINING→RETIRED lifecycle (or early REJECTED) is metadata, not a call router or enforced delay. No in-place upgrade is assumed.

Approved baseline strategy is explicit versioned replacement of the affected dependency closure: qualify replacement source/ABI/schema, publish code/manifests/authority diff, drain or freeze old writes without unsafe exits, snapshot finalized state, use reviewed one-time migration/reconciliation, deploy/verify/grant new instances, switch explicit service/SDK configuration and revoke old roles. Canonical object IDs remain deployment-qualified; old immutable records remain addressable. One-to-one profile claims/bindings cannot be silently reset; transfer/rebinding needs a new authorized migration design and user consent. Replacement must not violate shared frozen addresses; changing shared protocol dependencies follows their own authority rules.

Rollback means revert configuration only before incompatible effects; afterward use forward repair or separately qualified compensating migration. Never reset replay keys, rerun Genesis, erase consumption or double-create balances to simulate rollback. Pending randomness, claims, assets, occupancy and market obligations require a drain/migration plan and no double execution. UpgradeCoordinator/SecurityCouncilController remain future modules requiring R04.14 implementation; this policy creates no executable admin backdoor.

## Custody and economic boundaries

Existing HC foundations hold no monetary custody, token approvals, bridge messages or price-oracle balances. Internal BUDS are game-domain accounting, not native $420; R01.6 fixes zero-decimal internal BUDS without conversion and zero-fee ordinary full-fill trading. Detailed reward catalogues and optional canonical settlement fees remain required under R04.5/R04.8 before acceptance. Wallet/service linking never delegates general spend. Service workers hold no player keys and cannot consume target-wallet claims.

Before monetary modules activate: specify custody asset/owner/refund destination, conservation and fee rounding, approvals/spend limits, cancellations/expiry, external-call/reentrancy handling and emergency exits. Prefer explicit player-signed settlement and bounded asset-specific authority; no unlimited background approvals or implicit service custody. Real token/Pay/rights integration tests and funded acceptance are required; no unfunded rewards marketed. Bridge/price-oracle dependencies are conditional; stale data or unverifiable messages fail closed if introduced. This is a mandatory design boundary, not a claim that missing economic contracts are secure.

## Qualification and delivery

R01.5 exit: account provenance, routine selector admission/default deny, randomness trust/availability, every privileged action family, emergency restrict/release/exits, immutable replacement/rebinding and conditional custody all have explicit trust and recovery rules. Actual addresses/role custodians/provider parameters are R07 deployment inputs, not invented here. Enforcement gaps remain R02/R04/R05; no unresolved risk is accepted solely by this document. Level 2 remains R01.7; broad Level 3 at accumulated app-phase closeout. Next: R01.6 — Gameplay specifications.

## Exact capability action catalogue

Each source action is listed once; family policy above applies. Scope hashes and amount remain the actual requesting function's definition. These identifiers are not new grants.

- GROWER_PROFILE_CREATE: `HC.ACTION.GROWER_PROFILE_REGISTRY.CREATE`
- REGION_REGISTER: `HC.ACTION.REGION_REGISTRY.REGISTER`
- BONUS_REGION_REGISTER: `HC.ACTION.REGION_REGISTRY.BONUS_REGION_REGISTER`
- BONUS_REGION_SET_STATUS: `HC.ACTION.REGION_REGISTRY.BONUS_REGION_SET_STATUS`
- SESSION_POLICY_REVIEW_ROUTINE_CALL: `HC.ACTION.GAMING_SESSION_POLICY.REVIEW_ROUTINE_CALL`
- SESSION_POLICY_SET_ROUTINE_CALL: `HC.ACTION.GAMING_SESSION_POLICY.SET_ROUTINE_CALL`
- GUEST_MIGRATION_APPLY: `HC.ACTION.GUEST_MIGRATION.APPLY`
- OPTIONAL_COMPETITION_REGISTER: `HC.ACTION.COMPETITION_ENGINE.OPTIONAL_COMPETITION_REGISTER`
- OPTIONAL_COMPETITION_SET_STATUS: `HC.ACTION.COMPETITION_ENGINE.OPTIONAL_COMPETITION_SET_STATUS`
- LAND_REGISTER: `HC.ACTION.LAND_REGISTRY.REGISTER`
- LAND_GENESIS_REGISTER: `HC.ACTION.LAND_REGISTRY.GENESIS_REGISTER`
- LAND_TRANSFER: `HC.ACTION.LAND_REGISTRY.TRANSFER`
- LAND_SET_OCCUPANCY: `HC.ACTION.LAND_REGISTRY.SET_OCCUPANCY`
- LAND_CLEAR_OCCUPANCY: `HC.ACTION.LAND_REGISTRY.CLEAR_OCCUPANCY`
- PUBLIC_PLOT_REGISTER: `HC.ACTION.PUBLIC_CULTIVATION_ACCESS.REGISTER`
- PUBLIC_PLOT_ALLOCATE: `HC.ACTION.PUBLIC_CULTIVATION_ACCESS.ALLOCATE`
- PUBLIC_PLOT_RELEASE: `HC.ACTION.PUBLIC_CULTIVATION_ACCESS.RELEASE`
- GENOME_REGISTER: `HC.ACTION.GENOME_REGISTRY.REGISTER`
- FOUNDING_GENOME_REGISTER: `HC.ACTION.GENOME_REGISTRY.REGISTER_FOUNDING`
- SEED_REGISTER: `HC.ACTION.SEED_REGISTRY.REGISTER`
- SEED_TRANSFER: `HC.ACTION.SEED_REGISTRY.TRANSFER`
- CLONE_REGISTER: `HC.ACTION.CLONE_REGISTRY.REGISTER`
- CLONE_TRANSFER: `HC.ACTION.CLONE_REGISTRY.TRANSFER`
- MOTHER_BIND_CLONES: `HC.ACTION.MOTHER_REGISTRY.BIND_CLONES`
- MOTHER_REGISTER: `HC.ACTION.MOTHER_REGISTRY.REGISTER`
- MOTHER_TRANSFER: `HC.ACTION.MOTHER_REGISTRY.TRANSFER`
- MOTHER_CONSUME_CUTTING: `HC.ACTION.MOTHER_REGISTRY.CONSUME_CUTTING`
- PHENOTYPE_BIND_PROVENANCE: `HC.ACTION.PHENOTYPE_REGISTRY.BIND_PROVENANCE`
- PHENOTYPE_REGISTER: `HC.ACTION.PHENOTYPE_REGISTRY.REGISTER`
- RANDOMNESS_REQUEST: `HC.ACTION.RANDOMNESS_COORDINATOR.REQUEST`
- RANDOMNESS_BIND_BREEDING: `HC.ACTION.RANDOMNESS_COORDINATOR.BIND_BREEDING`
- RANDOMNESS_FULFILL: `HC.ACTION.RANDOMNESS_COORDINATOR.FULFILL`
- BREEDING_REQUEST: `HC.ACTION.BREEDING_ENGINE.REQUEST`
- BREEDING_CANCEL: `HC.ACTION.BREEDING_ENGINE.CANCEL`
- BREEDING_FINALIZE: `HC.ACTION.BREEDING_ENGINE.FINALIZE`
- PLANT_REGISTER: `HC.ACTION.PLANT_REGISTRY.REGISTER`
- PLANT_ADVANCE: `HC.ACTION.PLANT_REGISTRY.ADVANCE`
- CULTIVATION_BIND_RULESETS: `HC.ACTION.CULTIVATION_ENGINE.BIND_RULESETS`
- CULTIVATION_UPDATE: `HC.ACTION.CULTIVATION_ENGINE.UPDATE`
- PHENOTYPE_EXPRESS: `HC.ACTION.CULTIVATION_ENGINE.EXPRESS_PHENOTYPE`
- GENESIS_SET_ROOTS: `HC.ACTION.GENESIS_REGISTRY.SET_ROOTS`
- GENESIS_FINALIZE: `HC.ACTION.GENESIS_REGISTRY.FINALIZE`
- RULESET_REGISTER: `HC.ACTION.RULESET_REGISTRY.REGISTER`
- RULESET_ROUTE: `HC.ACTION.RULESET_ROUTER.ROUTE`
- MODULE_APPROVE_ARTIFACT: `HC.ACTION.MODULE_REGISTRY.APPROVE_ARTIFACT`
- MODULE_EXECUTE: `HC.ACTION.MODULE_REGISTRY.EXECUTE`
- MODULE_BIND_RULESETS: `HC.ACTION.MODULE_REGISTRY.BIND_RULESETS`
- MODULE_BIND_EMERGENCY: `HC.ACTION.MODULE_REGISTRY.BIND_EMERGENCY`
- MODULE_REGISTER: `HC.ACTION.MODULE_REGISTRY.REGISTER`
- MODULE_SET_STATE: `HC.ACTION.MODULE_REGISTRY.SET_STATE`
- PLANT_BIND_EMERGENCY: `HC.ACTION.PLANT_REGISTRY.BIND_EMERGENCY`
- CULTIVATION_BIND_EMERGENCY: `HC.ACTION.CULTIVATION_ENGINE.BIND_EMERGENCY`
- BREEDING_BIND_EMERGENCY: `HC.ACTION.BREEDING_ENGINE.BIND_EMERGENCY`
- RANDOMNESS_BIND_EMERGENCY: `HC.ACTION.RANDOMNESS_COORDINATOR.BIND_EMERGENCY`
- EMERGENCY_RESTRICT: `HC.ACTION.EMERGENCY_STATE.RESTRICT`
- EMERGENCY_RELEASE: `HC.ACTION.EMERGENCY_STATE.RELEASE`

- PUBLIC_PLOT_BIND_PLANTS: `HC.ACTION.PUBLIC_CULTIVATION_ACCESS.BIND_PLANTS`

Historical R02.3 wiring (superseded by R02.4 six-argument constructor and resource bindings): R02.3 adds deployment-only PUBLIC_PLOT_BIND_PLANTS at PublicCultivationAccess.BIND_SCOPE(); binding is one-time, reciprocal and capability-authorized. Deploy public access before PlantRegistry, supply its new fourth constructor argument, bind before reservations/admission, verify canonical code and revoke the bootstrap grant. Public allocations are not intrinsic PLANT_REGISTER authority. See R02.3-PUBLIC-PLANT-CAPACITY.md for accounting, additive ABI and immutable replacement policy.

- SEED_BIND_PLANTS: `HC.ACTION.SEED_REGISTRY.BIND_PLANTS`
- SEED_CONSUME: `HC.ACTION.SEED_REGISTRY.CONSUME`
- CLONE_BIND_PLANTS: `HC.ACTION.CLONE_REGISTRY.BIND_PLANTS`
- CLONE_CONSUME: `HC.ACTION.CLONE_REGISTRY.CONSUME`

R02.4 requires explicit seed/clone owner approval for the plant/parcel/plot and atomic scoped resource consumption. Source-less admission rejects; PlantRegistry now requires both resource registries in its constructor and all three reciprocal bindings before admission. Transfer invalidates approvals; termination never refunds the resource. See [source policy](R02.4-PLANT-SOURCE-CONSUMPTION.md). Clone cutting issuance and fabricated lineage/phenotype prevention remain R02.5/R02.6.
