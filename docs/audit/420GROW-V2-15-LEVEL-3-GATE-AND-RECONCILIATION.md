# GROW-V2-15 — Phase closeout reconciliation and Level 3 gate

**Canonical roadmap step:** GROW-V2-15 — Documentation, exact-SHA phase reconciliation and complete Level 3.
**Disposition:** **IN PROGRESS / BLOCKED ON EXACT MAIN RECONCILIATION AND QUALIFICATION. NOT COMPLETE.**

## Repository state and qualified prerequisite

- PR [#582](https://github.com/abvhiael/420-integrated-v0.1/pull/582); draft, unmerged; branch `audit/420grow-v2-01-product-decision-20261008`.
- Last app-audit Level 1 implementation SHA: `e6049e4d3ef134afabcc43af1438ba9350c5a801` (V2-14).
- V2-14 exact-SHA V2 fast **SUCCESS**: run 37892233748/job 113695496169; retained Grow **SUCCESS**: run 37892233870.
- Branch pre-V2-15 HEAD: `89e203df52d89e2bb9ffe39eedd6db54e2224eb5` (V2-14 evidence only after implementation SHA).
- Main at initial V2-15 inspection: `0ec695481fc84e6066aeae50baf6e0fd3c7f8731`.
- Common ancestor/original PR base: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
- Divergence at inspection: **329 commits ahead / 84 behind**; branch changes affect 115 paths (82 `grow/`, 27 `docs/`, Go module, scripts, Grow workflow); zero direct `contracts/` source changes. Main-only updates affect 109 paths (98 added, 11 modified), including `.github/workflows/contracts-foundry.yml`, Compute Market, Indexer and project documentation; **no identical path overlaps in compared changed-file sets**. This is a path-level diagnostic, **not** proof of semantic compatibility or a merged tree.
- PR reported GitHub mergeability `true`, but no actual merge candidate has been generated or tested.

## Phase-closeout authority and required exact-SHA work

1. Perform an actual **non-forced, non-destructive three-way merge of current main into the Grow audit branch**; resolve any conflicts and reconcile changed shared Go dependencies, CI, Indexer, docs and app behavior. Do not synthesize a Git merge merely by declaring two parent SHAs or overwriting main files.
2. Freeze and record the exact accumulated implementation/merge-candidate SHA **after** reconciliation. Any subsequent implementation, test, workflow, dependency, configuration or material requirement change invalidates it.
3. Run the canonical **Solidity Contracts** full repository Foundry inventory **once** against that exact SHA. The checked `contracts-foundry.yml` owns full inventory; its existing classifier distinguishes Compute-only scope. Favor its canonical approximately four balanced shards. Full source/test/script coverage, static/security/invariant and bytecode-size coverage cannot be reduced for this phase boundary.
4. Run **Genesis Address Authority** separately, verifying predeploy, frozen-address/namespace/collision/manifest and consumers. Current canonical `genesis-address-authority.yml` is explicitly address-only: do **not** duplicate Solidity Foundry.
5. Run `qualification.yml` (420 Integrated global) and `docs-qualify.yml` (Docs/global) against the same exact SHA, including their required client/service/static/deployment checks.
6. Run `420grow-v2-fast.yml` and retained `420grow-fast.yml` against the same candidate, including actual PostgreSQL non-superuser tenant/facility/zone checks, certificate-authenticated TLS, Go race/vet/build/gofmt, Chromium mobile/recovery, privacy, mutation, review, export and V2-14 adversarial tests. Requalify directly affected Indexer/RPC/SDK/client integrations if the main merge touches shared interfaces.
7. Verify **real workflow run IDs, exact checkout SHA, every required job conclusion, all classified/sharded coverage and retained artifacts**. Skipped, untriggered, queued, cancelled or failed gates are **not PASS**; this branch's changed paths do not by themselves trigger the PR Solidity or Genesis workflow under their current path filters. Explicit authenticated dispatch (or a narrowly approved closeout trigger change) is required for those canonical phase gates.
8. Preserve one Level 3 evidence file and the canonical roadmap with all results and relevant artifacts, and only then close/merge if all gates pass. Evidence-only commits after qualified candidate may inherit only if they do not change executable source/tests/workflows/dependencies/configuration/interfaces or substantive requirements.

## Outstanding blocker and nonclaims

At evidence creation, the connected GitHub actions exposed through this chat do **not** include a safe server-side three-way merge/update-branch operation, authenticated workflow-dispatch operation, or a read Git-tree primitive needed to construct and check an exact reconciled tree. As a result **no exact merge-candidate SHA exists**, and **no canonical Level 3 workflow has been launched against one**. The earlier app audit tests do not satisfy comprehensive Level 3.

No repo-wide Foundry inventory, Genesis address authority, 420 Integrated global, Docs global, or qualified accumulated merged tree is claimed here. Do not mark V2-15 COMPLETE or merge PR #582 without those explicit results.

**Next canonical roadmap step once V2-15 passes:** GROW-V2-16 — Live production-equivalent testnet deployment and acceptance.
