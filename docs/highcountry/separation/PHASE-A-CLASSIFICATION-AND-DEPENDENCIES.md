# HC-SEP-01 Phase A — evidence and dependency disposition (partial, source-frozen)

**Immutable reference:** original `main` commit `78a4befa01bd08693aabfd576a6fe8fba2e2677b`. This documentation is on a branch *created at* that SHA. The document commit advances the branch, not the frozen source commit.

**Do not merge, close, delete, relocate or tag PR heads automatically.**

## What has been checked
- The main Genesis application catalogue and dApp contract map contain the shared **420 Gaming Protocol**; neither lists a separate HighCountry Genesis application.
- Github recent-open PR listing: first 100 open PRs reviewed; 62 title/branch-matched HighCountry entries saved in adjacent JSON, including exact listed heads. Additional older HC PRs exist beyond the 100-result cut-off (e.g. stacked R04 #609–#627, R05 #635–#643). **Inventory is not exhaustive.**
- Branch search for `hc` returned 146 names, with continuation cursor `MTQ2`. This searches branch *names*, not source history and not every HighCountry branch.
- 20 Old Town assets have registry paths, recorded Git blob SHAs and prior recorded SHA-256 values. **Image bytes were not downloaded/rehashed in this API session.** A full all-assets content-addressed checksum manifest remains open.
- A named-code search returned at most 100 matching paths. **Not a full git tree**, so full source closure and CI enumeration remains open.

## Confirmed dependency edges at source commit
| Source | Target | Relation | Migration consequence |
|---|---|---|---|
| `apps/highcountry-web/scripts/build.mjs` | `scripts/highcountry/build_seed_catalogue.mjs` | static import | bundle generator or change import roots |
| `apps/highcountry-web/scripts/build.mjs` | `services/highcountry-archive/src/scoped-a06.mjs` | static import | archive service must migrate or become versioned package |
| `apps/highcountry-web/scripts/build.mjs` | `deployments/highcountry/hc-world-06-port-alder-district-navigation.v1.json` | filesystem read | copy world registry and preserve source path semantics |
| `scripts/highcountry/build_seed_catalogue.mjs` | `services/highcountry-economy/src/seed-catalogue.js` | static import | economy library dependency |
| `scripts/highcountry/build_seed_catalogue.mjs` | `deployments/highcountry/{seed-catalog,common-cultivar-research,rare-parent-pairs,original-sixteen-archive}.v1.json` | filesystem reads | capture exact JSON catalogues |
| `services/420-gaming-player-profile/src/highcountry-cloud-http.js` | `./postgres-repository.js`, `./cloud-save-lifecycle.js` | static imports into shared gaming player-profile service | do **not** copy all shared identity authority; introduce narrowly scoped hosted/protocol adapter |
| `services/420-gaming-player-profile/src/highcountry-cloud-http.js` | `/highcountry/*` endpoints | HTTP routes | must version/scope API or move endpoint ownership deliberately |
| `contracts/src/highcountry/player/HighCountryGamingBridge420.sol` | shared gaming claim/identity components (documented) | contract boundary | retain shared Gaming Protocol; review ABIs, deployments and test claims before separation |

These are source-observed or explicitly documented edges, **not a claim of complete dependency graph**. Dynamic imports, workflow scripts, migration SQL and out-of-tree consumers remain to be enumerated via complete-tree checkout.

## PR classification — provisional and non-destructive
- **Stacked and dependency-sensitive:** R04 #609–#627 and R05 #635–#643. Distinct base branches must be preserved; no rebasing onto main or mass merge.
- **Old Town / map prototype — incomplete:** #930, #931, #932, #913, #909. Preserve original PNGs, snapshot branches, site registry and Tiled artifacts; do not promote provisional geometry or pretend 2:1 artwork qualification.
- **Art/placement under review:** #839, #843, #845, #849–#856, #859, #872, #877–#881, #890, #893, #900, #917, #928, #929. Preserve unique catalogue and modifier data; overlapping marketplace changes require diff reconciliation.
- **Economy / deployed evidence pending:** #803 and related HC-NEXT R04/R05 drafts. Local evidence is not substitute for deployed chain, signer, finality or PostgreSQL production acceptance.
- **Potentially reusable / migration-sensitive:** #819 (game-specific Genesis decoupling), shared services and core Gaming Protocol must remain subject to independent consumer audit.

A provisional class in JSON **does not** mean ready to merge, superseded or independently qualified; those categories require per-PR patch, review-thread and CI comparison.

## Qualification evidence retained, not rerun
- `docs/highcountry/qualification/R04.5-LEVEL1-EXACT-SHA.md`: Level 1 PASS recorded for executable SHA `d4cbee54fcc2c7a98706cc88cb54e1b8ccb1025e`, R04.5 internal BUDS ledger only.
- `docs/highcountry/HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`: explicitly distinguishes repository engineering from unpassed live testnet and external acceptance.
- R04 Level 2 PR #627 reports exact implementation evidence; **its independent run evidence has not yet been reverified in this Phase A pass**.
- No new qualification workflows dispatched. No obsolete CI-GUARD or global Level 3 invoked.

## Completion criteria still open for Phase A
1. Enumerate full `git ls-tree -r` at source SHA and compute SHA-256 for **every** HighCountry asset and key evidence blob; record path, blob SHA, file size, SHA256, source SHA, and asset role.
2. Enumerate complete open/closed HC PR history and capture *all* unmerged head SHAs, review threads, approvals, test links and dependency graph, including branches with non-HC names.
3. Resolve branch-search cursor and verify PR ancestry (base ancestry graph, not just branch-name guesses).
4. Run comprehensive static import/reference extraction over entire frozen tree and classify runtime consumers, shared protocols, contracts, SQL, deployment, CI, wallet, AppStore and Genesis paths.
5. Cross-check every cited Level 1/2 workflow run against its stated exact executable SHA; no rerun of already passing suites.
6. Preserve branch/tag archive refs of any unique PR head before any subsequent source migration or branch deletion. Snapshot current main is not itself an archive of all divergent PR histories.

**Status: PHASE A IN PROGRESS; first preservation artifact created, no destructive actions.**
