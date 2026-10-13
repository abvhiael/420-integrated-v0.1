# R04 Level 2 — accumulated High Country integration review

## Disposition and candidate

**Milestone disposition: NOT COMPLETE.** Passing retained CI qualifies only its executed repository scope. Open integration prerequisites below must not be turned into testnet deferrals or inferred from Level 1 PASS.

Reviewed executable candidate: `700d52f771fe15d5f58f88e7d92bc444e6bcee54`, qualification PR #627, branch `qualification/highcountry-r04-level2-integration`. Verified main: `bc0faa5dafecda3de0620a9581f9953b89cd95fb`. PR #627 targets the unmerged R04.14 branch; R04.14 PR #626 remains draft at evidence SHA `7cbd375079a6187aa03bea8b79c8d131762456de`. GitHub comparison confirms the candidate descends from qualified R04.14 implementation `3503761ef5746064abfd7c3c1ed3cf9a6f6fe2e5`. No main reconciliation or Level 3 is claimed.

## Scope, implementation and integration evidence

| Steps | Repository implementation and retained tests | Boundary / outstanding acceptance |
|---|---|---|
| R04.1 | InventoryRegistry/ResourceLedger typed units, available/reserved/consumed conservation, explicit market-transfer consent; inventory and escrow tests | Canonical issuance and receipts require reviewed grants and chain/account binding; reserved balance is not proof of transferable off-chain custody |
| R04.2–4 | EquipmentRegistry, ManufacturingEngine and EquipmentLifecycleEngine use actual inventory/resource accounting for reservation, completion, cancellation loss/refund, repairs and single-use recycling | Equipment land fixtures are configurable mocks; catalogue/earned-event verifiers and authenticated gameplay consumption remain open. Manufacturing output resources do not automatically authorize equipment issuance |
| R04.5 | Internal integer BUDS and serializable available/reserved/issued/burned state; service regression and actual PostgreSQL job | No native $420, ERC20 or cash conversion. Production authenticated authority and approved reward/proof catalogue remain separate |
| R04.6–7 | Separate skill/research/discovery proof namespaces and mission activation/completion/claim/replay controls | Trusted verifier attestations and metadata rewards do not establish actual source-proof validation or BUDS issuance. R05 must compose authenticated gameplay source/reward consumers |
| R04.8 | Fixed-price full-fill zero-fee internal market, canonical InventoryRegistry reserved-transfer escrow, durable BUDS intent/receipt settlement and worker/reader adapters | A SQL transaction cannot atomically execute an EVM transfer. Signed transaction composition, finalized receipt/reorg validation, account/address binding and deployable service/client composition remain open under R04.8/R05/R07 |
| R04.9 | Rights/leases/licenses, owner/issuer/occupancy/term checks, canonical LandRegistry/PlantRegistry gate and actual active-plant count | Dedicated gate test still uses a plant-count fixture; retained canonical cultivation journey now uses real LandRegistry. Actual lease/license-to-plant source admission and exit must retain their production wiring acceptance |
| R04.10–11 | Organization membership/delegation/obligation consent, separately approved treasury metadata, cooperative snapshot/quorum/timelock and bounded executor | No implicit treasury/wallet/right/upgrade authority. Actual Treasury/Identity adapter and Indexer consumers remain R05 integration prerequisites; obligation metadata cannot prove discharged debt |
| R04.12–13 | Season/template/competition and Cup consume actual cross-contract competition results; semifinal/final provenance, one-time scoped prestige and quality-only scoring | Competition harvest evidence and entitlements in retained tests are programmable fixtures. Independently specified canonical harvest/finality and optional entitlement adapters plus scoped cross-game consumer verification are open engineering prerequisites, not merely unavailable live deployments |
| R04.14 | UpgradeCoordinator codehash/review/timelock/cancellation and SecurityCouncilController allowlisted dual-officer enforcement | New R04AuthorityIntegration test uses real CapabilityRegistry420, HighCountryAuthorization, EmergencyState and RandomnessCoordinator. Tests exact controller principal/domain, denied/revoked release rollback, veto, delayed recovery, replay, and provenance that does not rebind immutable consumers |
| Shared R02/R03 | Entire retained High Country Foundry inventory, including source consumption, lifecycle, harvest, capability authority and emergency recovery | Retained app scope only; independent Genesis address qualification and full repository Foundry remain Level 3 |

## Deterministic regression corrected

Initial Level 2 run #38342023181 at `541b1c0f44da294dd94bf08e484c0a1825acdf12` passed build/size but reported 289 tests passed and one failing `CultivationInvariantTest.setUp()`; verifier skipped. R04.9 private admission calls canonical `LandRegistry.getParcel`, absent in the old land mock. The fixture now deploys actual LandRegistry, registers the parcel through scoped authority and transfers operator ownership through its real API. The invariant still checks full capacity, sealed phenotype and resource identity; no production check was relaxed.

## Workflow reconciliation

`.github/workflows/highcountry-r04-level2.yml` is registered as workflow ID 382785044. PR-triggered run #38345072933 evaluates executable SHA `700d52f771fe15d5f58f88e7d92bc444e6bcee54`. All three jobs check out and assert the same PR head SHA:

1. retained-app: High Country-only build/bytecode, all retained unit/integration/adversarial/fuzz/invariant tests, canonical verifier;
2. economy-service: full retained BUDS/market/runtime security regression suite;
3. postgres-integration: disposable PostgreSQL 16 with actual serializable contention, replay, persistence and settlement tests.

No explicit broad Solidity/Genesis/global/Docs dispatch was requested. Existing repository PR path filters automatically enqueue other workflows; those runs are not substituted for this milestone.

## Open integration findings

- **INT-R04-01 — canonical competition evidence:** define/implement independently reviewed HarvestProductRegistry-to-competition provenance/finality adapter and actual optional entitlement consumer; verify forged owner/quality/time, revocation, dispute and Cup propagation against real sources. Testnet is not needed to write or locally test the adapter. A programmable `verifiedFlower` fixture is insufficient production evidence.
- **INT-R04-02 — emergency domain consumers:** EmergencyState allows MANUFACTURING, MARKET, LEASE, LICENSE, RIGHTS, ORGANIZATION_GOVERNANCE, COOPERATIVE_GOVERNANCE, COMPETITION_ENTRY and MISSION_ACTIVATION, but allowing a domain does not bind or restrict its corresponding R04 mutator. ManufacturingEngine has no EmergencyState dependency. Approve exact restricted mutation/recovery semantics from the canonical trust specification, implement missing consumer enforcement and prove cancellation/refund/exit accounting before claiming complete R04 emergency integration. The real RANDOMNESS_REQUEST regression proves only that specific implemented consumer path.
- **INT-R04-03 — service/proof/financial composition:** retain actual authenticated account/chain mapping, trusted gameplay reward proofs, signed settlement worker composition, finality/reorg/outbox ownership and production-like database permissions under canonical R04.8/R05. Library interfaces and mocked readers do not close these obligations.
- **INT-R04-04 — authority and lifecycle consumers:** retain actual equipment earning/use source, land/lease/license admission/exit integration, Treasury/Identity and cross-game consumer acceptance under their existing canonical owners. Metadata-only governance and obligation records never confer monetary authority.
- **INT-R04-05 — qualification baseline:** earlier R04 source documents sometimes say candidate/pending although later passing workflow/evidence exists. Preserve chronology; latest exact source/job evidence supersedes older pending status only for its executed scope, never for production integration.

These findings are not new R04 substeps and do not waive canonical acceptance. No R04.15 is introduced. Repository-side Level 2 cannot be marked COMPLETE solely because retained tests pass.

## Genuine deployment/testnet dependencies

Actual chain/deployment addresses and hashes; independent Genesis grants and officer credentials; funded operators; canonical finality/reorg/network drills; deployed PostgreSQL TLS/secrets/backup/failover; real user signatures/sessions and external identity/treasury/cross-game approvals; operational security acceptance. R07.5 owns drain/snapshot/migration/config publication, old-grant revocation, replay preservation and replacement rollback rehearsal. UpgradeCoordinator records acceptance provenance, not an actual deployment replacement.

## Historical qualifications retrieved from repository

R04.1 head `c9a6dd8dd640b8a8db61cf32049c9703a3ec8f93`: run #38164232629 SUCCESS. R04.2 `5f9152e20efdfdf4d04394b3f8e6072bd8bdaba6`: #38166402389 SUCCESS. R04.3: committed R04.3-LEVEL1-EXACT-SHA record, `9d2a6a8eb1566573f5be928984849066411ad8c6`, #38168131666. R04.4 `5f8bc642bf7b7e2d07b549ca48af7c4e34a1d4b2`: #38170743306 Level 1 and #38170743202 equipment milestone SUCCESS. R04.5: committed record `d4cbee54fcc2c7a98706cc88cb54e1b8ccb1025e`, #38187379753. R04.6 `221437e59b9d0af7463d3093546ddbaae5a4e95e`: #38205888421 SUCCESS. R04.7 `36cc621a82e66dc79254dae4426822010c8d80dc`: #38208858303, job 114678306438 SUCCESS. R04.9 `9bab4c97d5c063a500e2bc4a72ace5e73a2ec8a8`: #38312661742, job 115021841085 SUCCESS. The recovered R04.1/2/4/6/7/9 historical jobs have no failed or skipped steps. Latest R04.1/R04.8 custody/economy record qualifies `71bbe72d7b05065611a3f13d2a4d0cba0a9eea25` with actual PostgreSQL #38292018046. R04.10–14 exact qualifications remain in their committed records under `qualification/`.

## Next gate

Inspect all jobs of the exact candidate, record actual results and keep the accumulated milestone OPEN until required integration findings are resolved or explicitly dispositioned under canonical phase ownership without misrepresenting completion. Keep all audit PRs open/unmerged. Separate Level 3 will reconcile current main, qualify the complete canonical Foundry inventory under Solidity Contracts (approximately four balanced shards), independent Genesis addresses without duplicate Foundry, required global/Docs/app/security/deployment gates on one reconciled SHA. R05.1 remains the next canonical development step and has not started.

## Terminal CI result

[Run #38345072933](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38345072933) completed SUCCESS at executable SHA `700d52f771fe15d5f58f88e7d92bc444e6bcee54`. Retained-app job 115124467953 passed 293 tests in 62 suites, zero failures/skips, build/size and canonical verifier. Economy-service job 115124468026 passed all 26 tests. PostgreSQL job 115124467722 passed real serializable reservation, replay, market settlement and persistence. All required steps passed on the same checkout SHA.

**Executed CI scope: PASS. Accumulated integration milestone: NOT COMPLETE** because INT-R04-01 through INT-R04-04 remain open. This evidence update changes no executable/workflow/config input and inherits the passing implementation SHA; it does not waive an integration requirement. All 14 R04 development PR heads were compared to the candidate and confirmed to be ancestors (ahead, zero behind).
