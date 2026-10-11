# High Country R03 — Level 3 exact-SHA CI certification record

**Scope:** R02/R03 accumulated contract/app phase, reconciled against main. **Disposition:** Level 3 automated CI qualification PASS; live deployment and operational acceptance NOT asserted.

- Repository: `abvhiael/420-integrated-v0.1`
- PR: #608 (draft certification merge candidate); predecessor PRs #593 (R02) and #607 (R03)
- Qualified executable/workflow candidate SHA: `c83d11cf40fde9e152ca495ec5339ecd491d5638`
- Reconciliation: main `6d2932deb243328e1956619e10ef250a8bcc1d88`; R02/R03 accumulated head `629bb0136190016f36c2bf1430613247a68784c2`; two-parent merge `37da12c4fd9f4ecd3d50e3bdc0f4ec6c0a90e56e`
- Complete recursive Git-tree comparison: 452 main-side changed blobs, 220 High Country-side changed blobs, zero concurrent edits relative to ancestor `e7614af49336f70e6ff0eda55aba41fdd3fc6ab3`. No truncated tree inputs. Final merge branch includes all 220 cumulative High Country-side changes and is a descendant of reconciled main.
- Qualification policy: canonical full Foundry inventory belongs to Solidity Contracts. Genesis runs separate address/namespace/predeploy authority checks, not a duplicate full Foundry inventory.
- Evidence-only record is committed after the qualified SHA, without changing executable contracts, tests, workflows, interfaces or configuration. An actual merge commit on main, if distinct, needs its tree verified identical to the already-qualified tree.

## Completed CI workflows

All 23 below completed successfully on qualified SHA `c83d11cf40fde9e152ca495ec5339ecd491d5638`. GitHub Actions URLs are `https://github.com/abvhiael/420-integrated-v0.1/actions/runs/<run id>`.

| Workflow | Run ID | Conclusion |
|---|---:|---|
| High Country R02.5 | 38109686580 | PASS |
| EXP-1.9 | 38109686548 | PASS |
| EXP-1.10 | 38109686623 | PASS |
| 420Docs | 38109686592 | PASS |
| High Country R02.4 | 38109686558 | PASS |
| High Country R03.2 | 38109686571 | PASS |
| Genesis Address Authority | 38109686531 | PASS |
| High Country R02.12 | 38109686579 | PASS |
| High Country R03.5 | 38109686510 | PASS |
| High Country R02 Level 2 | 38109686498 | PASS |
| 420Indexer | 38109686513 | PASS |
| High Country R03.4 | 38109686607 | PASS |
| High Country R03.1 | 38109686611 | PASS |
| High Country R03.3 | 38109686596 | PASS |
| High Country R02.11 | 38109686496 | PASS |
| High Country R02.8 | 38109686656 | PASS |
| High Country R02.10 | 38109686561 | PASS |
| High Country R02.13 | 38109686576 | PASS |
| High Country R02.7 | 38109686578 | PASS |
| High Country R02.9 | 38109686506 | PASS |
| High Country R02.6 | 38109686613 | PASS |
| 420Oracle | 38109686591 | PASS |
| Solidity Contracts | 38109686560 | PASS |

## Solidity Contracts Level 3 job evidence

Run 38109686560: `level3-shards (0)`, `(1)`, `(2)`, `(3)` all completed SUCCESS. `level3-fixture` completed SUCCESS and validates assembled shard inventory/coverage. The four ordinary PR shards also PASS. Conditional `foundry` and `compute-fast` jobs are SKIPPED by design and are not substituted for Level 3 work. `classify-pr` PASS.

## R03 exit scope, limitations and testnet deferrals

- R03.1 READY single-use harvest admission, R03.2 scoring, R03.3 canonical immutable harvest/product provenance and issuance-only accounting, R03.4 private/public exactly-once plant capacity release and cancellation/restricted paths, and R03.5 retained adversarial journeys are covered by the five PASS step workflows plus R02 Level 2.
- Genesis Address Authority, Docs qualification, Indexer, Oracle, EXP integration checks, and comprehensive Solidity compilation and partitioned tests passed on the same exact SHA.
- **Explicitly deferred to testnet/R07 deployment acceptance:** actual deploy addresses and code-hash validation, real custodian/issuer grants and revocation after bootstrap, live binding to deployed Seed/Clone/PublicCultivationAccess/PlantRegistry instances, post-deployment address/manifest parity, live operator secrets, real multi-service RPC/indexer integration, live emergency operations and recovery, end-to-end browser/player/backend sessions and load/soak, funded monetary settlement, and rollback/migration acceptance. These cannot be truthfully marked complete from static/CI evidence. Existing High Country deployment documentation assigns actual addresses and role custodians to R07. Any material new on-chain authority or shared dependency requires qualification at the appropriate stage.
- **Security caveat:** green Foundry/authorization/regression suites establish implemented CI coverage, not a production penetration test or externally witnessed live authority acceptance; production launch remains gated by the testnet/deployment roadmap. R04.1 InventoryRegistry/ResourceLedger remains future scope and is not misrepresented as an R03 completed ledger.

## Certification decision

The exact-SHA **automated Level 3 phase qualification is PASS**. This is not a statement that High Country is deployed or live-operation qualified. Before merging into main, check branch ancestry/tree parity and GitHub merge gates; after merge, record the actual main SHA and ensure its source/config tree exactly matches the qualified candidate (apart from this evidence-only Markdown). Do not call external/testnet blockers discharged.
