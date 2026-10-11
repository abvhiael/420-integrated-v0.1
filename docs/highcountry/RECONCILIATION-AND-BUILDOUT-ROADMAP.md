# High Country — reconciliation and complete application buildout

## Basis and ordering

This roadmap is grounded in the audit of main `3de7a0d87600fa30ec6090c1351a11d36ba59de9` and the audit candidate in PR #593. Preserve existing HC-1..HC-6, HC-PA, HC-GP and HC-7 identifiers. The **HC-AUD-R01..R10** work packages below are remediation IDs, not replacements for those phases. Substeps remain stable; additional requirements are appended rather than renumbered.

The shared Gaming Protocol is the Genesis primitive. High Country is listed as a first-year browser game. Do not make a wallet a prerequisite for ordinary play, import its plant simulation into Budtender, or call protocol access-policy simulations full-game E2E. Do not put raw saves/conventional account identifiers or credentials on-chain. Existing implementations are the foundation; missing features require committed specifications before implementation, not invented behavior to pass an audit.

The five audit fixes are implemented in PR #593: usable nonzero Genesis capability scope, plant/genome equality at expression, nonzero migration grower/commitments, zero GenomeRegistry dependency rejection and trusted registry binding in session verification. Final evidence determines qualification; unresolved work below is not complete because that PR exists.

## R01 — canonical specification and reconciliation

R01.1 scope decision: the owner selected the full social economy launch, with wallet-optional core play and no protected-stat/scoring advantage. `RELEASE-SCOPE.md` assigns all 65 audit requirements; no launch requirement is deferred. Detailed mechanics and remaining R01 decisions remain open.

Dependencies: none. Category: specification, product/governance decisions, documentation.

| Substep | Deliverable | Acceptance |
|---|---|---|
| R01.1 | Canonical master roadmap, application scope and intended first release stage | Every audit requirement HC-AUD-001..065 mapped to a retained HC phase or explicit versioned deferral |
| R01.2 | Component/authority graph, local/service/canonical state schemas, API/contract catalogue | No wallet prerequisite for guest play; canonical provenance/transferable assets clearly separated from ordinary saves |
| R01.3 | Frozen type/enum/units reconciliation | Record mapping between GrowthStage/PlantState and PlantStage; centi-degree vs milli-degree representation; four contract vs three client access states; do not change legacy encodings silently |
| R01.4 | Two migration boundaries and trusted source issuance policy | Specify guest object manifest approvals versus shared target-consumed save claim; define eligible canonicalization and anti-cheat |
| R01.5 | Deployment/upgrade/emergency/operator trust policy | Decide direct redeployment/rebinding strategy, routine selector catalogue, entropy provider trust, ownership-transfer powers, spending/reward custody |
| R01.6 | HC-7 gameplay spec and later phase rules | Yield/grade/resources/equipment/economy/competition parameters and failure states must be reproducible; named constants are not specifications |
| R01.7 | R01 milestone qualification | Review accumulated documents against contracts, interfaces, tests and audit matrix; no unexplained contradictions or unmapped requirements; exact specification commit and durable Level 2 evidence |

Exit: canonical documents agree with the implemented boundaries and clearly identify planned features. Ambiguous product mechanics are resolved before their code phases.

R01.6 baseline specification is COMPLETE: the owner adopted the five HC-7/economy rules on 2026-10-09. `GAMEPLAY-SPECIFICATION.md` fixes these rules and retains later-module catalogue/implementation prerequisites. This is specification completion, not gameplay implementation. R01.7 is qualified through the exact-head Level 2 record in `qualification/R01.7-level2.json`; specification review and retained foundation integration do not qualify the full game.

R01.5 trust specification is `DEPLOYMENT-AND-TRUST.md`; no new grants or deployed readiness are claimed.

R01.4 migration specification is `MIGRATION-BOUNDARIES.md`; object-manifest and shared-save flows retain distinct permissions and replay/recovery boundaries.

R01.3 schema specification is `TYPES-AND-UNITS.md`; source ordinals and ABI remain unchanged, conversions reject ambiguity and preserve exact values.

R01.2 architecture specification is `ARCHITECTURE-AND-AUTHORITY.md`; it preserves existing canonical authority and explicitly separates the wallet-free internal market from the ecosystem asset market. Qualification evidence is recorded under `qualification/`.

## R02 — reconcile and harden existing foundations

Dependencies: R01; audit fixes retained. Category: code, real contract integration, security.

| Substep | Required work | Proof required |
|---|---|---|
| R02.1 | Qualify five audit fixes and production CapabilityRegistry component/grant wiring | Real registry Genesis setup/finalize/revocation; negative scope/principal/action tests; zero-grower and forged-registry regressions |
| R02.2 | Define and enforce cumulative capability budget consumption or explicitly disallow finite-period HC grants | Repeated calls cannot bypass intended budgets; authority to consume belongs to the actual component; expiry/revocation boundary tests use real registry semantics |
| R02.3 | Integrate public-plot allocation with plant admission/capacity/release | Allocated grower can cultivate; private+public occupancy cannot overbook; allocation cannot be released/reallocated while plants still consume it |
| R02.4 | Tie plant creation to actual seed/clone eligibility/consumption | Owner/operator/genome/source consistency; duplicate use denied; failure rollback preserves resources |
| R02.5 | Atomically consume mother cuttings during clone issuance | Exhausted/retired/wrong-genome/wrong-owner mothers denied under agreed authority model; failed clone registration does not lose cutting |
| R02.6 | Replace opaque provenance anchors with canonical plant/breeding/expression validation | Invalid source IDs, unrelated genome and fabricated phenotype rejected; previous immutable records preserved |
| R02.7 | Verify ruleset identity/version and plant lifecycle at environment/expression boundaries | Unknown/wrong ruleset, terminated plant mutation and reroll denied; defined permitted sealing stage |
| R02.8 | Make EmergencyState effective in mutating engines | Restricted entry/mutation stops; allowed exit/refund/resource recovery still works; release resumes safely; no authority bypass |
| R02.9 | Reserve pending breeding child identities and implement timeout/cancel/recovery | Two events cannot claim same child; withheld entropy/cancel/failure does not strand resources; no reroll after consumed/finalized |
| R02.10 | Verify trusted randomness provider/OIL integration | Exact request/domain/context/proof; stale/failed/malicious provider paths; no unverifiable fairness claim |
| R02.11 | Reconcile bonus/event access to per-player entitlement resolution and actual consumers | Multiple players with their own entitlements work; revoked/wrong profile/content denied; founding regions and base events remain ungated |
| R02.12 | Validate module code/interface/version/ruleset and active-state consumers | No EOA/invalid/inactive module accepted as executable; scheduled activation and emergency rules agree |
| R02.13 | Bind canonical SmartAccount deployment provenance and reviewed routine selectors | Forged account views do not authorize execution; native value, assets, fees, grants and sensitive operations escalate |

R02.5 implements one-time mother/clone binding and exact same-transaction consumption of a registered mother cutting during clone issuance. It requires matching mother owner and genome, scoped mother consume authority and retirement at exhausted capacity; source-less cutting burns fail closed. Policy: `R02.5-MOTHER-CLONE-CONSUMPTION.md`; targeted qualification: `qualification/R02.5-level1.json` once executed.

R02.4 implements owner-approved source-backed admission, seed quantity conservation, one-time clone consumption and atomic rollback. Policy: `R02.4-PLANT-SOURCE-CONSUMPTION.md`; evidence: `qualification/R02.4-level1.json`. Mother cutting issuance remains R02.5; canonical breeding/phenotype anchors remain R02.6.

R02.3 implements reciprocal one-time binding, private/public reservation accounting, allocated nonowner admission and terminal-only release. Policy: `R02.3-PUBLIC-PLANT-CAPACITY.md`; exact-head evidence: `qualification/R02.3-level1.json`. R02.4 subsequently adds source consumption.

R02.2 selects enforced nonperiodic-only grants; both periodLimit and periodSeconds must be zero. Policy/evidence: `R02.2-CAPABILITY-BUDGET-POLICY.md`, `qualification/R02.2-level1.json`. Cumulative budget support is not claimed.

R02.1 qualification and verified registrar/component/grant/handoff procedure: `R02.1-CAPABILITY-WIRING.md`, exact-head evidence `qualification/R02.1-level1.json`. No live production deployment or cumulative budget enforcement is claimed.

Exit: resolve HC-SEC-06..10 and 14..17; document accepted trust assumptions; all repaired cross-contract journeys tested with real dependencies, not only configurable mocks.

## R03 — HC-7 harvest and product resolution

Dependencies: R01 HC-7 spec, R02 cultivation/resource/provenance rules. Category: code.

1. **R03.1:** implement specified ready-plant harvest acceptance and single-use resolution; bind plant/genome/expression/ruleset/grower/parcel.
2. **R03.2:** implement deterministic yield/quality/grade units, integer rounding and environmental/genetic inputs; define zero/min/max output.
3. **R03.3:** register canonical harvest/product provenance and update inventory/resource accounting under the agreed authority split.
4. **R03.4:** terminate/release cultivation capacity exactly once; cancellation/failure/restricted-mode paths conserve resources.
5. **R03.5:** test duplicate harvest, unauthorized grower/operator, wrong phenotype/ruleset, early/terminated plants, arithmetic boundaries, event reconciliation and resource conservation.

Exit: a real cultivation→harvest→product journey exists. READY alone is not harvest completion.

## R04 — complete gameplay and economy phases

Dependencies: R01 specifications, R02 foundations, R03 products. Category: code plus per-module specification.

| Substep | Missing system / existing vocabulary | Required boundary |
|---|---|---|
| R04.1 | InventoryRegistry, ResourceLedger | Typed inventory/resources, acquisition/consumption/conservation, local versus canonical representation |
| R04.2 | EquipmentRegistry | Defined types, placement/ownership and protected statistics; wallet never grants raw-stat advantage |
| R04.3 | ManufacturingEngine | Recipes/jobs/inputs/outputs, bounded queue, failure/cancel/consumption; no duplicate completion |
| R04.4 | EquipmentLifecycleEngine | Degradation/breakage/retirement/recycling and reversible recovery per specification |
| R04.5 | BudsLedger, EconomicSettlement | Freeze internal BUDS versus native $420 semantics; conservation, fees/splits/refunds/cancellation and custody only where actually required |
| R04.6 | SkillRegistry, ResearchRegistry, DiscoveryRegistry | Progression/research/discovery eligibility, provenance and bounded rewards; no fabricated local-state promotion |
| R04.7 | MissionEngine | Eligibility→activation→completion→claim/failure/expiry; duplicate claims and replay denied |
| R04.8 | Market | Listings/trading, actual assets/settlement, expiry/cancel/partial fill if specified; owner/approval/reentrancy/MEV/fee/refund paths |
| R04.9 | LeaseRegistry, LicenseRegistry, RightsRegistry | Land/asset rights, expiry/revocation/transfer, occupancy and active-plant consequences, dispute boundary |
| R04.10 | OrganizationRegistry, OrganizationAuthority | Membership, bounded delegated authority and treasury permissions |
| R04.11 | CooperativeRegistry, CooperativeGovernance, GovernanceExecutor | Voting/execution/quorum/timelocks only as specified; no alternate permission escalation |
| R04.12 | SeasonRegistry, CompetitionTemplateRegistry, CompetitionEngine | Event lifecycle/scoring eligibility/anti-cheat, base wallet-free events and optional entitlement events |
| R04.13 | Global420Cup | Actual tournament eligibility/results/prize rules, canonical result provenance and scoped cross-game issuance |
| R04.14 | UpgradeCoordinator, SecurityCouncilController | Implement only the approved upgrade/emergency authority design; no arbitrary implementation swap or backdoor |

For every substep: commit specification, implementation/interfaces/events, unit/negative/boundary tests, meaningful invariants, integration tests and developer/operator docs. Define all monetary and external-call behavior before introducing custody. Features outside the chosen release remain explicitly PLANNED, not COMPLETE.

## R05 — shared authenticated and durable runtime

Dependencies: R01 authority/schema, R02 migration/session correctness; R04 modules as consumers. Category: shared protocol/service code, infrastructure.

1. **R05.1:** datastore schemas/migrations and repositories for accounts, game profiles, cloud-save references, consent and migration records. Retain strict game/account scope and privacy.
2. **R05.2:** authenticated HTTP/service API, account/session proof, signed wallet linking with domain/nonce/expiry/replay protection, consent/unlink/recovery policy. Caller-supplied wallet strings are not proof.
3. **R05.3:** durable migration unique key, transactional save application and outbox/receipt reconciliation across processes; crash/restart/concurrent worker/reorg tests. Do not rely on process-local Maps.
4. **R05.4:** real GameClaims issuance/read adapters, target-wallet consumption, grower binding and exact payload validation. Service never holds player private keys.
5. **R05.5:** cloud-save provider/local-save schema/versioning, backup/restore/conflict resolution, limits and retention/deletion controls.
6. **R05.6:** HC/shared Gaming event ingestion, durable cursors/deduplication/reorg rollback/finality recovery and scoped query APIs; exact schema agreement with emitted events.
7. **R05.7:** require canonical RPC/finality checks for high-risk entitlement/claim/ownership/reward/attestation reads; malicious adapter `finalized:true` cannot establish canonicality.
8. **R05.8:** real SDK transports/ABI generation/bindings, configured addresses/network detection, bounded retries and explicit failure states.
9. **R05.9:** rate limits/abuse protection/anti-cheat, observability and secret management; no wallet-wide history API or raw saves on-chain.

Exit: resolve HC-SEC-11..13 and prove durable, authenticated service behavior under multi-instance restart and hostile inputs.

## R06 — playable browser application

Dependencies: R03/R04 chosen release loop, R05 APIs/SDK; art specifications. Category: frontend, user documentation, browser/device verification.

| Substep | Deliverable | Acceptance |
|---|---|---|
| R06.1 | Real application package, routes, game shell and network configuration | Clean documented install/build/serve; no production API/RPC mocked silently |
| R06.2 | Guest local-save loop | Start→plant→manage environment→offline return→harvest/product→progress without account/wallet |
| R06.3 | Optional registered account/cloud-save/recovery | Guest can defer registration; authenticated save/recovery/conflict states |
| R06.4 | Deliberate wallet linking and optional features | Correct chain; scoped profile/entitlement/ownership/market/reward/cross-game flows; unlink/disconnect preserves core play |
| R06.5 | Transaction lifecycle and recovery | Awaiting signature/submitted/pending/finalized/reverted/reorged; duplicate-click protection; honest RPC/indexer unavailable/empty/loading states |
| R06.6 | Safe routine sessions and escalation | Reviewed zero-value routine actions only; sensitive calls require wallet/passkey; revocation/expiry fails closed |
| R06.7 | Branding/game assets and accessible responsive UI | Required art/logo/icons present; keyboard/focus/labels/contrast; desktop/mobile layouts and performance |
| R06.8 | Real-stack browser E2E and user guide | Actual service/contract transports, saves, play, failures, optional access and anti-pay-to-win outcomes; device evidence where needed |

Exit: playable application rather than access-policy library. Do not substitute a cosmetic landing page for gameplay completion.

## R07 — deployment and operator acceptance package

Dependencies: complete candidate and trust decisions. Category: deploy code, governance configuration, infrastructure.

1. **R07.1:** environment manifests with trusted code/address/chain IDs, dependency order, constructor args, operator/component authorities and exact grants. Preserve frozen chain system addresses; do not invent High Country reserved addresses.
2. **R07.2:** reproducible Genesis six-root manifests, actual three-region metadata/climates/rulesets, 16-founder loci/metadata and founding land proofs; complete-world prefinalization check.
3. **R07.3:** deployment/seed/registration scripts, shared High Country game/operator registration, module verification, trusted randomness/provider configuration and routine selector catalogue.
4. **R07.4:** post-deploy verification/smoke scripts, registrar/admin handoff, revoke temporary grants, verify absence of unintended capabilities.
5. **R07.5:** direct-contract replacement/rebinding/save migration and rollback/recovery rehearsal. ModuleRegistry alone is not an upgrade router.
6. **R07.6:** API/cloud-save/indexer/worker hosting, container definitions if required, frontend environment, URLs/DNS/TLS, dashboards/alerts/logging/backups and incident runbooks.

Exit: independently executable deploy-and-verify instructions; no placeholder/null address accepted as deployment evidence.

## R08 — accumulated repository qualification

Dependencies: selected release code complete, all local integration gaps resolved. Category: tests/security/documentation/CI.

- **R08.1:** clean-checkout build, dependency/version/lock validation, ABI/binding reproducibility, frontend/backend/SDK compilation, formatting/lint/static analysis.
- **R08.2:** all app unit/negative/authorization/replay/boundary/cancel/refund/failure tests; real contract/service integration, meaningful fuzz/invariants and actual browser-stack E2E.
- **R08.3:** security review of authority, custody/approvals/external calls, fairness, spoofed identity, privacy/reorg/idempotency and abuse; explicit resolved/mitigated/accepted/unresolved findings.
- **R08.4:** developer/user/operator/API/events/config/build/deploy/recovery docs consistent with actual source and manifests; every matrix requirement mapped to specific evidence.
- **R08.5:** exact candidate SHA/tree, clean worktree, main divergence and conflict reconciliation, canonical workflow **job** conclusions and logs. A success run with skipped test jobs does not qualify.

Qualification cadence: app-specific Level 1 per implementation step, Level 2 at logical milestones, single Level 3 at the actual phase/release closeout. Solidity owns the comprehensive Foundry inventory; Genesis checks addresses/manifests without duplicating it. Do not repeat global/docs/Foundry inventories after each ordinary step. Evidence-only records preserve the qualified implementation SHA; changed implementation must qualify its new SHA. Any final-head evidence must accurately state what actually executed.

Exit: code/build/contract/test/docs/integration/security repository gates satisfied for the selected release. Live readiness remains separate.

## R09 — deployed testnet qualification

Dependencies: R07 package, R08 repository acceptance, running chain/shared protocol/runtime. Category: testnet, infrastructure, secrets, external services, devices.

1. **R09.1:** resolve shared Gaming and HC chain/contracts/operators/metadata manifest using actual receipts and provide protected RPC/player/operator secrets.
2. **R09.2:** deploy/seed and verify code/dependencies/grants/founders/regions/land/module states; one-way Genesis acceptance and role transfer.
3. **R09.3:** real player journeys through registration/profile, optional entitlements/revocation, target-consumed migration/binding/application, routine sessions/recovery and scoped cross-game attestations.
4. **R09.4:** actual full game/harvest/economy/market/competition journeys and funded reward/payout paths only where specified; real randomness/provider integration.
5. **R09.5:** outages/timeouts/stale RPC/reorg/restart/multi-instance duplicate delivery, abuse/anti-cheat/performance/device tests and monitoring response.
6. **R09.6:** attach exact deployed artifact/code hashes/network and receipts, close every testnet blocker. Template validator success never substitutes for live acceptance.

Exit: TESTNET READY may be YES only for a working selected release with genuine deployed integration evidence.

## R10 — intended production release acceptance

Dependencies: R09, final security/trust decisions. Category: production deployment, external service/infrastructure, human acceptance.

- **R10.1:** production chain/API/indexer/cloud/save/provider URLs, keys/roles/permissions, DNS/TLS and release artifacts verified.
- **R10.2:** backup/restore, retention/privacy, monitoring/alerts/incident response, operator recovery and permitted upgrade procedures rehearsed.
- **R10.3:** independent security review where required, resolve accepted risks, validate user-facing claims and real-browser/device acceptance.
- **R10.4:** publish complete user/developer/operator documentation and actual deployment record; freeze release scope and qualify exact release head/artifacts.

Exit: PRODUCTION READY only when selected release requirements and operations pass. The game need not be called chain-Genesis-ready to ship as the first-year app described by the repository; any Genesis claim requires an explicit canonical requirement and its own deployment acceptance.

## Current readiness and next action

All ten whole-application readiness flags remain **NO**: code, builds, contracts, tests, documentation, integration, security, testnet, Genesis and production. Implemented foundations and targeted passing tests can be qualified separately without claiming missing systems.

**Next canonical step after R01.7 is R02.1 — Qualify five audit fixes and production CapabilityRegistry component/grant wiring, followed by remaining R02 and the existing HC-7 phase.** Live testnet is not a prerequisite for writing these specifications, repairing local integration or building the remaining game; it is a later deployment-evidence gate.
