# R04 Level 2 — accumulated High Country integration review

## Disposition and exact candidate

**Disposition: Level 2 COMPLETE for accumulated repository app integration.** All required checks pass on the exact implementation SHA below. Level 3, deployed operational acceptance and production release remain separate.

Implementation candidate: `93655ca49f0e305f99cd0c13f53f88479b20b316`, branch `qualification/highcountry-r04-level2-integration`, draft PR #627. The candidate retains qualified R04.14 implementation `3503761ef5746064abfd7c3c1ed3cf9a6f6fe2e5` and evidence parent `7cbd375079a6187aa03bea8b79c8d131762456de`. All 14 development PRs remain draft/open/unmerged and their heads are ancestors of the qualification branch. No Level 3 or production release is asserted.

The canonical R04 sequence ends at R04.14. Required runtime integrations remain owned by R04.5–8 and R05.1/2/3/7; this milestone implements those scoped dependencies without renumbering work or certifying the complete R05 phase. R05.1 remains the next canonical phase step. No R04.15 is created.

## Accumulated scope and actual integration

| Canonical owner | Implemented acceptance | Preserved boundary |
|---|---|---|
| R04.1 | Typed Inventory/ResourceLedger conservation, explicit market-transfer consent, actual reserved custody | No second spendable off-chain balance after canonical delivery; fresh escrow required for resale |
| R04.2–4 | Actual completed manufacturing job → consumed catalogue output → single-use equipment issuance → owned placement on real land → lifecycle wear/repair → bounded cultivation effects → retirement/recycling | Reviewed immutable catalogues, independently revocable issuer/operator permissions; no wallet/stat multiplier |
| R04.5 | Integer BUDS, bounded source rewards, serializable holds, settlement/refunds and zero-fee full-fill market | No native $420/ERC20/cash conversion or player-key custody; no invented fee/partial-fill policy |
| R04.6–7 | Independent signed gameplay envelopes plus finalized canonical mission/progression state; claim/expiry/prerequisite/replay controls and bounded BUDS credit | Canonical completion and approved source key are independently required; raw saves/client flags confer no authority |
| R04.8 / R05 consumers | Signed sessions, durable wallet consent/nonces/epochs, real canonical Identity, code-hash-pinned RPC, PostgreSQL RLS, actual operator transaction submission and restarted-worker receipt reconciliation | Ambiguous execution remains reserved; refund only irreversible cancellation; durable chain parties preserve reconciliation after unlink/revocation |
| R04.9 | Real LandRegistry/PlantRegistry share CapabilityRegistry/Authorization/EmergencyState with rights/leases/licenses; admission restrictions, revocation/non-eviction and terminal-only occupancy clearance | Recorded fee/obligation metadata is not collected rent; external arbitration/payment acceptance remains separately owned |
| R04.10–11 | Membership/delegation/obligation consent, cooperative snapshot/quorum/timelocks, bounded executor; actual canonical Treasury policy/budget/authorization and GameIdentity gateway | No implicit treasury/right/upgrade escalation; gateway holds no funds and requires independently accepted vault-release provenance |
| R04.12–13 | Real immutable harvest registration/quality/owner/time and registration-block confirmation; optional shared entitlement adapter; actual bracket results, revalidation, one-time issuance and scoped shared attestation consumer | Configured verifier/adjudicator and deployment confirmation policy are explicit trust inputs; no monetary prize invented |
| R04.14 | Retained codehash review, independent reviewer, timelock/cancellation and replacement provenance; real capability-rooted council/domain enforcement, release veto/revocation and delayed recovery | Provenance does not swap implementations or silently rebind immutable consumers; replacement rehearsal remains R07.5 |
| Affected shared R02/R03 | Entire retained High Country Foundry inventory, including real source consumption, plant/lifecycle/harvest, capability and emergency dependencies | This is app-scoped qualification, not the repository-wide Foundry or Genesis-address inventory |

See [canonical integration specification](R04-LEVEL2-CANONICAL-INTEGRATION.md) and [deployment/trust contract](DEPLOYMENT-AND-TRUST.md) for constructors, immutable bindings, domain semantics, source roles and operational inputs.

## Required findings and disposition

| Finding | Resolution and acceptance |
|---|---|
| INT-R04-01 — canonical competition evidence | CanonicalCompetitionEvidence reads actual HarvestProductRegistry records and recorded registration block, verifies the real block hash/confirmation window and permanent revocation. CanonicalCompetitionEntitlement resolves actual grower/shared Identity/entitlements. Real harvest/Cup tests reject forged owner/quality/time/product/block, confirmation/submission/finalization/issuance replay, disputed semifinals, wrong scope/profile/attestation source and entitlement revocation. |
| INT-R04-02 — emergency consumers | New R04 constructors pin the canonical root and one-time capability-authorized controller binding. Each documented risk domain rejects new ingress; real tests retain manufacturing loss/refund, escrow cancellation, equipment recovery and canonical plant/lease/license exits. Catalogue deactivation no longer strands existing reserved resources. |
| INT-R04-03 — authenticated proof/financial runtime | Ed25519 session/source verification, EOA/ERC1271 link consent, durable one-use nonces and account/source epochs, canonical reward reads, bounded BUDS issuance, external scoped operator signing and durable settlement recovery are composed. Actual Anvil + PostgreSQL + authenticated HTTP journey and real least-privilege/RLS tests exercise the production adapters. |
| INT-R04-04 — authority/lifecycle consumers | ManufacturedEquipmentIssuer consumes actual completed-job output before issuance. EquipmentCultivationBridge uses real owned item/lifecycle/plant/land and canonical cultivation authorization. Lease/license journeys use actual shared authority. Treasury/Identity gateway checks independent capability, policy and budget atomically; scoped Cup consumer requires both canonical Cup and actual shared attestation. |
| INT-R04-05 — qualification baseline | Final exact-SHA evidence supersedes historical pending/retained-only results for its executed app scope. Historical Level 1 records remain intact and do not substitute for this Level 2 or future Level 3. |

**INT-R04-01 through INT-R04-05 are CLOSED for this repository app milestone** at the exact qualified implementation. Closure uses implemented adapters and real cross-component acceptance plus retained adversarial coverage, not programmable fixtures or earlier green suites alone.

## Deterministic defects and regression corrections

- The earlier retained cultivation invariant used an obsolete land mock after canonical parcel admission was introduced. It now uses real LandRegistry and original capacity/source/phenotype assertions.
- Competition finalization was refactored into bounded candidate validation after the compiler exposed a Yul stack-depth defect; current evidence/entitlement revalidation and tie-break rules are retained.
- Settlement previously depended on current wallet links even after broadcasting a transfer. Immutable verified chain parties now survive unlink/revocation for finalized settlement and proven refunds; new submission still requires current matching bindings and authorization epochs.
- Source revocation now advances beyond the configured epoch, including nonzero deployment epochs.
- Canonical on-chain inventory delivery no longer creates a duplicate spendable off-chain admission.
- Resource catalogue deactivation previously blocked existing reservation releases/cancellation losses. Recovery checks known resource identity while new risk still checks active catalogue state; actual cancellation/escrow/owner-recovery tests check conservation.
- Disposable runtime deployment initially contained Foundry dynamic test linking (`vm.deployCode`), unusable on Anvil. Its build explicitly disables that transformation and uses the canonical Cancun target. Only the oversized test-only factory is loaded separately; every application child is normally CREATE-deployed, and app build/size checks remain mandatory. Test fixture API/tuple and block-number assumptions were corrected against canonical interfaces and recorded product blocks.

## Exact-SHA gate

The registered dedicated workflow `.github/workflows/highcountry-r04-level2.yml` (ID 382785044) checks out/asserts one implementation SHA in every job: retained-app (build/size, all app unit/integration/adversarial/fuzz/invariant tests and canonical verifier), economy-service, actual PostgreSQL 16 and actual local-chain runtime-canonical integration. [Run #38358551332](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38358551332) completed SUCCESS: 304 Foundry tests across 65 suites, 35 Node tests, actual PostgreSQL and actual local-chain runtime; build/size and canonical verifier PASS. Zero Foundry/Node failures or skipped tests. Every required job/step passes at `93655ca49f0e305f99cd0c13f53f88479b20b316`. Results and links belong to [exact-SHA evidence](qualification/R04-LEVEL2-EXACT-SHA.md).

No broad Solidity/Genesis/global/Docs workflow was explicitly dispatched. Existing PR filters enqueue other workflows; they are not substituted for this gate. Separate Level 3 must reconcile main and qualify the complete Foundry inventory through its sole Solidity owner, approximately four balanced shards, independent Genesis address/manifest checks, and required global/Docs/app/security/client/service/deployment acceptance on one merge-candidate SHA.

## Main and ancestry continuity

Main advanced from `bc0faa5dafecda3de0620a9581f9953b89cd95fb` to observed `81c21541acdc1b900b9a15c6f6b75ff2d7c2b5d9`. The comparison contains unrelated BnB changes and global workflow qualification wiring, with no changed High Country or imported shared contract/service implementation. No reconciliation or merge has been performed. Evidence records the observation separately from the qualified branch SHA; Level 3 must refresh/reconcile main again.

## Independent deployment and future-phase acceptance

Repository app acceptance does not certify deployed addresses/code/grants, finality/quorum/reorg/network policy, real officers/session/gameplay/catalogue/signing credentials, funded Treasury/vault receipts, independently approved cross-game consumers, TLS/secret rotation, backups/failover/monitoring, live security approval, or R07.5 drain/migration/replacement/rollback rehearsal. These operational gates remain OPEN in [testnet work roadmap](HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md).

Full R05 cloud-save/migration, provider/Indexer/SDK/client, abuse/observability and privacy acceptance remain future canonical engineering work. They are not blanket testnet deferrals and this scoped runtime integration does not mark the R05 phase complete. Recorded metadata is never promoted to funded payment or deployed approval.

## Historical evidence

Earlier retained-only run #38345072933 at `700d52f771fe15d5f58f88e7d92bc444e6bcee54` passed 293 Foundry tests, 26 Node tests and PostgreSQL, but the accumulated milestone remained NOT COMPLETE. That historical result is preserved, not retroactively relabeled. Current corrected-source qualification replaces it only after the complete gate passes.

R04.1 head `c9a6dd8dd640b8a8db61cf32049c9703a3ec8f93`: run #38164232629 SUCCESS. R04.2 `5f9152e20efdfdf4d04394b3f8e6072bd8bdaba6`: #38166402389 SUCCESS. R04.3: committed R04.3-LEVEL1-EXACT-SHA record, `9d2a6a8eb1566573f5be928984849066411ad8c6`, #38168131666. R04.4 `5f8bc642bf7b7e2d07b549ca48af7c4e34a1d4b2`: #38170743306 Level 1 and #38170743202 equipment milestone SUCCESS. R04.5: committed record `d4cbee54fcc2c7a98706cc88cb54e1b8ccb1025e`, #38187379753. R04.6 `221437e59b9d0af7463d3093546ddbaae5a4e95e`: #38205888421 SUCCESS. R04.7 `36cc621a82e66dc79254dae4426822010c8d80dc`: #38208858303, job 114678306438 SUCCESS. R04.9 `9bab4c97d5c063a500e2bc4a72ace5e73a2ec8a8`: #38312661742, job 115021841085 SUCCESS. The recovered R04.1/2/4/6/7/9 historical jobs have no failed or skipped steps. Latest R04.1/R04.8 custody/economy record qualifies `71bbe72d7b05065611a3f13d2a4d0cba0a9eea25` with actual PostgreSQL #38292018046. R04.10–14 exact qualifications remain in their committed records under `qualification/`.
