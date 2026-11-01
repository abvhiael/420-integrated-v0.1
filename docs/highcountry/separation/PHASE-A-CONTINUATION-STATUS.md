# Phase A evidence continuation — 2026-10-31

Frozen source remains `78a4befa01bd08693aabfd576a6fe8fba2e2677b`. Nothing merged, closed, deleted or retested.

## Independent archive refs
Verified **63 / 63** identified open HighCountry PR heads now have distinct refs `hc-separation/archive/pr-<number>-20261031`, created from the recorded head commit SHA. All 63 refs were verified by branch listing. These refs are in the **original** integrated repository; they are not yet copied to the new HighCountry repository. Additional closed/unmerged PRs, unreferenced branches or differently named PRs remain outside this guarantee.

## PR history / reviews
Read all 63 current open HC PR changed-file inventories and inline review-thread collections through GitHub. Exact per-PR source paths and returned review threads committed as `reviews/PR-HEADS-01.json` through `PR-HEADS-08.json`. **0 inline review threads returned**. This is not proof that no conversation comments, approvals, unresolved external review feedback, or previously closed PRs exist. Provisional non-destructive disposition file: `PHASE-A-PR-DISPOSITIONS.json` (23 stacked, 4 prototype/supersession candidates, 16 implementation reconciliation, 15 catalogue review, 5 additional review). No candidate is closed/merged on this basis.

## Binary bytes / checksum coverage
Actual byte-level SHA-256 and Git blob SHA-1 were computed for **20 original Old Town PNGs** from the user's previously uploaded `HighCountry_OldTown_Tiled_Builder_v2_1.zip`, saved in conversation artifact `phase_a_oldtown_20_actual_byte_hashes.json`. Tested e.g. CR-01 Git blob SHA `a412ab390dab6c70ee0019f8caea91af401aeaca` and SHA-256 `9cdafd3fa60ddc783b492e22de148575ca7b0ec315a7650ea2e766ad0b71f820`, matching frozen registry recorded identity.

**Not complete:** the ZIP is a subset, not the entire source asset catalogue. The GitHub connector's binary blob fetch fails on PNG UTF-8 decoding. A full checkout with access to raw binary blobs is required to recompute/check each remaining SHA-256. Git tree SHAs are Git content identities, NOT SHA-256. Never label a recorded registry checksum as a new byte-derived verification.

## Observed cross-repository dependencies
- Web app build -> `scripts/highcountry/build_seed_catalogue.mjs` -> `services/highcountry-economy/src/seed-catalogue.js` and `deployments/highcountry/*.json`.
- Web app build -> `services/highcountry-archive/src/scoped-a06.mjs` and world navigation registries.
- `services/420-gaming-player-profile/src/highcountry-cloud-http.js` -> shared `postgres-repository.js` and `cloud-save-lifecycle.js`, exposing `/highcountry/*` endpoints; must not copy or delete common authority blindly.
- Contract boundary: `contracts/src/highcountry` distinct from shared `contracts/src/gaming`; maintain 420 Gaming Protocol.
- Git-tree path inventory includes 1,548 app/service/deployment/doc/script files plus shared-profile, contract and workflow HighCountry-related paths. These inventories make CI, wallet, AppStore, Genesis and deployment *audit targets*, not proof of a completed import/caller graph.

**Still open:** whole-source dependency graph of all imports, dynamic references, CI trigger uses, wallet/AppStore/Genesis config consumers, SQL migration cross-references and deployed service assumptions. No claim that moving HighCountry alone is safe yet.

## Exact SHA evidence
- R04.5 Level 1 original committed evidence states PASS at `d4cbee54fcc2c7a98706cc88cb54e1b8ccb1025e`, Actions run `38187379753`.
- R04 accumulated Level 2 PR #627 claims PASS for executable `93655ca49f0e305f99cd0c13f53f88479b20b316`, run `38358551332`, evidence-only PR head `1cd1a94eec5783e8cd59f3671efbc99d13c0560a`.
- Both run IDs returned HTTP 404 through current GitHub Actions GET (could be permission or retention). **Thus independent run status has NOT been reverified**. Retain historical signed or committed evidence without overwriting it or claiming live certification.

## Remaining acceptance before Phase A complete
1. Check out frozen source binary tree and hash every HighCountry asset byte (not only the 20).
2. Extract complete static/dynamic/CI/API/SQL import and consumer graph, including wallet/AppStore/Genesis, on frozen tree and preserved PR heads.
3. Review conversation comments, completed reviews, CI statuses and older/closed PR work; verify unique patch content and all historic passing runs where accessible.
4. Archive any additional closed-but-unmerged work and referenced branches beyond these 63 open PRs into independently immutable refs and transfer the chosen refs to new HighCountry repository before deleting anything.
