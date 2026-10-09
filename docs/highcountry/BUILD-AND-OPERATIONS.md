# High Country foundation developer/operator guide

## Scope

This guide covers the implemented HC-1..HC-6, HC-PA and HC-GP foundations. It is not a user guide for a playable released game. Read `REPOSITORY-AUDIT-20261009.md` before deployment. Core game play must remain wallet-free; wallet linking is a deliberate optional ownership/content boundary.

## Local development and tests

Use a clean checkout of the qualified commit. Install Foundry on a networked host using `scripts/setup-foundry.sh`, inspect `contracts/foundry.toml`, and use Node 22 (Node 20 is also present in some gaming workflows). No npm dependency installation is required for HC access or shared Gaming SDK/native test packages. Do not infer a frontend build from `npm test`.

From repository root:

```sh
node --test clients/highcountry-access-v1/test/*.test.js packages/420-gaming-sdk/test/*.test.js
node --test packages/420-gaming-client-hardening/test/*.test.js packages/420-gaming-cross-game-qualification/test/*.test.js
node --test services/420-gaming-player-profile/test/*.test.js services/420-gaming-query/test/*.test.js
node scripts/gaming/verify-runtime-manifest.mjs deployments/gaming/testnet.runtime.json
```

From `contracts/`:

```sh
forge build src/highcountry --sizes
forge test --match-path 'test/highcountry/**/*.t.sol' -vv
forge fmt --check src/highcountry test/highcountry
```

The canonical Solidity CI owns the complete inventory; local HC checks are component qualification. Select profiles explicitly for a milestone (e.g. `FOUNDRY_PROFILE=pr`); never label PR/default test runs as CI/hardening runs. The shared live harness is a separate package with its own dependency installation and protected secrets. Runtime-template validation can pass while live acceptance remains blocked.

## Contract/API map

The file inventory records names/interfaces/tests. Key calls:

- `GenesisRegistry.setRoots/finalizeGenesis/roots`: six immutable-on-finalization commitment roots. `ADMIN_SCOPE = keccak256("HC.GENESIS.ADMIN.V1")` is the exact nonzero capability scope for both Genesis admin actions. Do not issue zero-scope grants: the real registry rejects them.
- `RulesetRegistry.registerRuleset/deriveRulesetId/getRuleset`, `RulesetRouter.setRulesetFor/rulesetFor`: content-hash identity and domain routes.
- `ModuleRegistry.registerModule/setModuleState/getModule/implementationOf`: proposed→qualified→scheduled→active→draining→retired; rejection allowed before active. This records lifecycle; it is not a proxy or execution router.
- `EmergencyState.setRestricted/isRestricted`: stores an allowlisted domain bit; current game engines do not automatically stop because a bit changes.
- `RegionRegistry.registerFoundingRegion/getRegion/foundingRegionsReady`: IDs 1..3 only before game Genesis finalization. `WorldGenesisReadiness.worldReady` is a narrow boolean, not complete deployment acceptance.
- `GrowerProfileRegistry.createProfile/getProfile/profileIdOf`: one profile/account, valid home region, finalized game Genesis and capability required.
- `LandRegistry.registerGenesisParcel/genesisLeaf/registerParcel/transferOwner/setOccupancy/clearOccupancy`: founding parcels require sorted-pair Merkle proof against landRoot; ordinary parcels require finalized Genesis. Effective operator is occupant if present, otherwise owner.
- `PublicCultivationAccess.bindPlantRegistry/registerPublicPlot/allocate/release`: one-time authorized reciprocal plant binding; parcel reservations exclude private occupancy; per-caller allocations cannot release while occupied. See R02.3-PUBLIC-PLANT-CAPACITY.md.
- `GenomeRegistry.registerFoundingGenome/registerGenome/getGenome`: 28 fixed loci, founding IDs 1..16, pre/post-finalization distinction.
- `SeedRegistry.registerSeedLot/transfer`, `MotherRegistry.registerMother/consumeCutting/transfer`, `CloneRegistry.registerClone/transfer`, `PhenotypeRegistry.registerPhenotype`: typed append-only identities. Source-backed plant admission consumes an owner-approved seed unit or clone atomically; clone issuance still needs mother-cutting integration under R02.5.
- `RandomnessCoordinator.request/fulfill/consume/getRequest`: one authorized provider fulfillment; consuming requester/domain/context must match. Authorized provider entropy is trusted, not verified VRF.
- `BreedingEngine.requestBreeding/finalizeBreeding/getBreedingEvent`: two distinct existing parents, bound request, deterministic recombination and one-time child registration. Needs separate grants for the engine's calls to coordinator/genome registry.
- `PlantRegistry.registerPlantFromSource/advanceStage/syncOfflineGrowth/getPlant/genomeOf/nextStageAt` (source-less legacy methods now reject): private operator-bound and allocated public plants share reserved parcel capacity; 1/2/7/7-day growth stages. Termination releases active capacity. READY does not create harvest products.
- `CultivationEngine.updateEnvironment/deriveScores/expressPhenotype/getState`: temperature 1000..4000 centi-degrees; five other values 0..10000. Ideal bands and integer rounding are in source. Stress is the floor of the six-dimension mean; quality=10000-stress. Seal uses the plant's canonical genome and nonzero supplied ruleset; actual ruleset validity remains a deployment/integration gap.
- `HighCountryGamingBridge420.bindGrowerProfile/bindConsumedMigrationClaim/hasScopedEntitlement`: shared profile belongs to caller; claims consumed by target wallet; exact game/profile/type/content checks.
- `HighCountryMigration420.isReadyToApply/markApplied`: requires nonzero grower/commitments and consumed bound shared claim; one receipt per claim. This is not an atomic off-chain database migration transaction.
- `GuestProfileMigration.claimProfile/consumeObject/migrationLeaf`: object-manifest provenance boundary separate from shared save claims; approved-source issuance and downstream asset minting still require wiring.
- `HighCountrySessionAccess420.setRoutineCall/isRoutineSessionAuthorized`: exact selector, zero native value, current epoch/grant; account-reported registry must match HC authorization's trusted registry. This is a policy verifier, not execution, custody, or a wallet-factory attestation.
- `HighCountryCrossGame420.hasScopedAttestation`: specific subject/type/payload/game/profile only; no canonical wallet-wide history API.

Read event declarations in the exact committed contract/interface for indexing. Each canonical object emits a keyed registration/transition event. There is no HC durable indexer yet; clients must not mistake emitted events or unfinalized indexed metadata for accepted ownership/rewards. Private raw saves/account credentials must remain off-chain. Public chain events are public, and a lookup-only API does not make public on-chain activity confidential.

## Deployment order and configuration requirements

No HC deployment script or release-ready manifest currently exists. This is a dependency order derived from constructors, not proof that deployment has occurred:

1. Resolve trusted CapabilityRegistry420 and registrar/component authorities; deploy HighCountryAuthorization against it.
2. Deploy GenesisRegistry, RulesetRegistry, RulesetRouter, ModuleRegistry and EmergencyState with their required auth/registry dependencies.
3. Deploy RegionRegistry, then GrowerProfileRegistry, WorldGenesisReadiness and LandRegistry against correct Genesis/region references; PublicCultivationAccess depends on land.
4. Deploy GenomeRegistry, SeedRegistry, MotherRegistry, CloneRegistry and PhenotypeRegistry; deploy RandomnessCoordinator and BreedingEngine; deploy PlantRegistry(auth, genomes, land, publicAccess, seeds, clones), grant the deployment-only PUBLIC_PLOT_BIND_PLANTS action at publicAccess.BIND_SCOPE(), bind its reciprocal PlantRegistry once, verify the binding and revoke the bootstrap grant, bind SeedRegistry and CloneRegistry using their deployment-only BIND_PLANTS actions/scopes, verify reciprocal references and revoke bootstrap grants, then deploy CultivationEngine. Issue source-specific engine CONSUME grants and obtain holder approval before admission. See R02.4-PLANT-SOURCE-CONSUMPTION.md. Plot registration and plant admission fail closed until bound.
5. Resolve shared Gaming Protocol's GamingAuthorization/GameRegistry/GameIdentity/GameEntitlements/GameClaims/CrossGameRegistry via its own deployment order in `docs/gaming/420GP-9-RUNTIME-WIRING.md`.
6. Deploy HighCountryGamingBridge against shared identity/claims/entitlements and grower registry; then migration, cross-game, bonus/event gates and session access; GuestProfileMigration depends on auth/growers.
7. Register HC module component IDs with canonical CapabilityRegistry registrar, assign explicitly governed authorities and issue exact principal/action/scope grants. Set Genesis admin grants using `ADMIN_SCOPE`; breeding engine needs RANDOMNESS_REQUEST and GENOME_REGISTER grants scoped to each request/child identity. R02.2 rejects any HC grant with nonzero periodLimit or periodSeconds, including routine-session grants. Both fields must be zero; cumulative budgets are not supported. Per-call limits, expiry and revocation still apply.
8. Register actual rulesets/routes, founding region content, founding genome data, Genesis land proofs and modules. Review the whole acceptance manifest before finalizing game Genesis. Calling finalize too early permanently blocks founding region/genome/parcel setup.
9. Register shared High Country game ID `keccak256("420/GAMING/GAME/HIGH_COUNTRY/V1")` with real operator/metadata; resolve runtime manifest. Never use invented or sample EVM addresses as deployed records.
10. Verify code/constructor dependencies, roots, regions, 16 founders, land, component authorities/grants, shared operator registration and fresh receipts; revoke/transfer deployment authority under an approved handoff plan. No script currently proves this sequence.

Required runtime values: expected chainId/RPC, all deployed contract addresses/code hashes, shared and HC operator/component authorities, Genesis six roots, actual ruleset hashes, founder metadata/loci, land manifest/proofs, approved routine selector catalogue, resolved game metadata and finality policy. The shared gaming testnet template is intentionally null/unresolved. There are no HC-specific production `.env` names or DNS requirements to quote as established configuration.

Live harness secret names already in the shared workflow: `GAMING_TESTNET_RPC_URL`, `GAMING_TESTNET_PLAYER_PRIVATE_KEY`, `GAMING_TESTNET_HIGH_COUNTRY_OPERATOR_PRIVATE_KEY`. Supply through protected runtime/CI secrets only, never commit or log them. Actual cloud-save/database/auth/HTTP/DNS/TLS/monitoring configuration must be defined when those components exist.

## Recovery and troubleshooting

- Genesis action denied with otherwise valid authority: inspect nonzero `ADMIN_SCOPE`, principal/module/action binding and real registry grant windows/revocation.
- Plant registration denied: verify genome/parcel exists, grower is effective parcel operator, capacity available, exact plant scope capability. Public-plot allocation alone currently does not satisfy this path.
- Breeding finalize fails: verify entropy fulfilled, exact domain/context/requester, child does not already exist and engine has child registration authority. Transaction revert rolls back consumption; no timeout/cancel recovery is implemented.
- Phenotype seal denied: check existing environment, canonical genome equality, nonzero ruleset and exact capability; sealed environments cannot be changed. Ruleset validity is not currently checked.
- Migration denied: target wallet consumes shared claim, grower binds it, exact commitments match, nonzero grower and not already applied. Off-chain stores need durable claim-key idempotency plus crash/reorg recovery before using apply-then-receipt in production.
- Optional access denied: inspect exact game/profile/type/content/entitlement status, connectivity and active gate. Stored single entitlement IDs are not a general catalogue for every player.
- Session denied: routine target/selector, zero value, canonical account scope/component, current account/key epoch, trusted registry and exact live grant must match. Escalate via canonical wallet rather than bypassing capability checks.
- Live testnet exit 2: unresolved runtime is an intentional blocker, not a passing deployed qualification.

Current direct contracts have immutable dependency pointers and no proxy upgrade procedure. Do not assume changing ModuleRegistry redirects existing engines. An approved replacement/rebinding/migration strategy and deployment rehearsal are outstanding. Monitoring/backups and production incident recovery cannot be certified until actual services and deployments exist.

## Exact-head evidence runner

The repository includes `scripts/highcountry/qualify.py` to rerun current foundation gates and record the actual commit, tree, tool versions, profile, commands, exits and log hashes. Run after committing, with a clean checkout and an output directory outside the repository:

```sh
python scripts/highcountry/qualify.py --expected-sha "$(git rev-parse HEAD)" --output ../highcountry-evidence
```

It executes HC contract build/size checks, HC unit/integration/invariant tests, immediate shared Gaming contract tests, formatter, access/SDK/shared service tests and runtime validation. Exit 2 from the unresolved live harness is recorded as BLOCKED, never deployed success. Its foundation-pass result explicitly cannot certify missing full-game components. Preserve output and exact SHA in the PR qualification record; do not treat a subsequent implementation change as covered by those results.

The evidence runner scopes Solidity compilation roots to all High Country source/tests and imports every required dependency under the committed compiler settings. Shared Gaming tests use byte-identical copies of the three canonical test files with the repository source tree and original Foundry configuration. This avoids compiling unrelated application tests while preserving the app/dependency inventory; it does not replace the canonical complete-repository Solidity owner at a Level 3 closeout.

SeedLot.quantity is original issuance; use remainingQuantity for spendable inventory and consumedQuantity/seedLotForPlant for history. consumedByPlant makes a clone unavailable. Transfers invalidate destination approvals by ownership epoch; exhausted sources cannot transfer.
