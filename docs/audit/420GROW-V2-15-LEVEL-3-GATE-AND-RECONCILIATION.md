# GROW-V2-15 — Phase reconciliation and Level 3 qualification

**Disposition:** COMPLETE / Level 3 — all six mandatory canonical workflows and required jobs passed on the reconciled implementation SHA. Optional coverage instrumentation failed as documented below; coverage percentages are not certified. Live production-equivalent acceptance remains GROW-V2-16.

## Exact reconciliation

- PR #582: `audit/420grow-v2-01-product-decision-20261008`.
- Reconciled implementation SHA: `d949475124c6fa07f11ec47ac8b5604e99cbab56`.
- Main reconciliation base: `0ec695481fc84e6066aeae50baf6e0fd3c7f8731`.
- Audit parent: `f82981a0c765cfcc3f2fa3b0eeda987ee0b652c9`; original common ancestor: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.
- Actual local `git merge --no-ff origin/main` used the ort three-way strategy and succeeded without conflicts. Its tree `7619b62fa5d058d4c56187eff1c2a1b6667ccf7e` exactly matched GitHub's fetched PR test-merge tree. The connector published that verified tree with audit/main parents and advanced only the audit ref with `force=false` and expected-head protection. No force push or main overwrite.
- Current main is an ancestor of the candidate; at reconciliation, divergence was 332 ahead / zero behind. Qualified Grow changes and all main-only Compute, Indexer, Commerce and CI changes were preserved.
- No implementation repair was needed after reconciliation. Earlier V2-14 implementation qualification remains historical evidence, not a substitute for this accumulated candidate.

## Exact-SHA canonical workflows

All jobs below verified their exact checkout; manual dispatch was used where audit path/branch policy otherwise skipped global gates. Each run URL is `https://github.com/abvhiael/420-integrated-v0.1/actions/runs/<run ID>`.

| Workflow | Run ID | Required jobs | Result |
| --- | --- | --- | --- |
| `contracts-foundry.yml` | 37894345957 | shards 0/1/2/3: 113702148743 / 113702148747 / 113702148763 / 113702148549; inventory/fixture 113717102269 | PASS — four shards, exact inventory and Decision #10 fixture |
| `genesis-address-authority.yml` | 37894383829 | cross-manifest-authority 113702273062 | PASS |
| `qualification.yml` | 37894412174 | fault-matrix 113702364099; geth-engine 113702364380; offline-core 113702364413; production-dependencies 113702364420 | PASS — all four jobs |
| `docs-qualify.yml` | 37894493542 | qualify 113702624780 | PASS |
| `420grow-v2-fast.yml` | 37894293237, attempt 2 | v2-app-qualification 113702530598 | PASS — every required stage |
| `420grow-fast.yml` | 37898098482 | canonical-definition 113714018308 | PASS — every required stage, direct candidate checkout |

The four CI shards each completed all 106 assigned test-source invocations (424 total; helper/mock sources are compiled even when they contain no runnable tests), with zero failed test files. Compilation and deployable runtime/initcode size checks passed. Shard inventories contain 261/261/260/260 units, totaling all 1,042 primary source/test/script units; the downstream exact equality/uniqueness comparison passed. CI fuzz uses 50,000 runs; invariants use 2,048 runs at depth 256. No coverage was weakened and no implementation changes were required.

| Diagnostic artifact | ID | SHA-256 digest |
| --- | --- | --- |
| Foundry shard 0 | 11601088018 | `6233720b009f84341e486a9427c4996d6dcdf941ac784787f3ef5c3664196a4a` |
| Foundry shard 1 | 11600987567 | `d9eb347ced0e25637957ab58c8b7ead3ea1565f8bded48b13f2cb7e227ac4cca` |
| Foundry shard 2 | 11601263827 | `9011894206df92a0c4538d43e8a22d978b53a725a3d2ea7ac39cb1e263bace21` |
| Foundry shard 3 | 11601521928 | `79f93cafa4e63cb059ffc4293cd0a98705c3154bf5c59c47fdb31e43792a3324` |
| Decision #10 fixture | 11602365032 | `03e0f750bb95b5218475650faf1b38403dd53ca400448b950647bad2c4b6bcec` |
| Genesis address consumers | 11599134848 | `2aecaabed193069c30d0b0c9098fc4ff7b09ccaae7b52b32e2d6d9a231b883b3` |

Artifact metadata reports expiration on 2026-10-16; run/job IDs, checksums and summarized outcomes are preserved here as durable evidence.

Decision #10 script executed successfully (gas 16,208,504); all fixture schema, IDs, rights revisions, pool amounts, treasury and 260 ETH vault-balance assertions passed. Fixture artifact 11602365032 was uploaded. Solidity run concluded **Success**, duration 58m35s; all five mandatory jobs succeeded.

**Non-blocking existing coverage diagnostic limitation:** fixture job 113717102269, Coverage step, executed `FOUNDRY_PROFILE=coverage forge coverage --ir-minimum --report summary` and exited 1 with a Solc 0.8.24 Yul stack-depth exception (`Cannot swap Variable _7 with Variable expr_18412_component`, one slot too deep; memoryguard present). GitHub normalizes its conclusion under the existing `continue-on-error: true`; the raw log is authoritative for this failure. The variable names map to the large tuple in `AIComputeAdapter420.bindComputeRequest` (source-review inference). That source, Foundry configuration and canonical Solidity workflow are identical to the reconciliation main base. This is coverage-instrumentation compilation, not a failing CI-profile source build, test, invariant, deployment-size or fixture assertion. No coverage report was produced or counted as passing. Remediation belongs to the shared AI/Foundry coverage surface: reduce instrumented tuple stack pressure or validate compatible instrumentation/compiler settings without excluding sources/tests; any substantive change requires a fresh implementation SHA and applicable requalification. No required gate or existing coverage policy was weakened for this closeout.

The initial Grow V2 attempt, job 113701978918, failed at browser process startup before the DevTools endpoint existed (`browser-smoke.mjs:83`), after backend/SQL/frontend tests passed. One failed-job-only retry on the identical SHA passed the complete browser and V2-14 gates without code changes. This is recorded as a transient Chromium startup failure; the failed attempt is not passing evidence.

Retained Grow PR run 37894293364/job 113701979114 passed, but checked out GitHub merge commit `d05e483` rather than the direct candidate. It is supplemental, not canonical exact-SHA evidence. Manual dispatch from pinned branch `audit/420grow-v2-15-level3-d949475` supplies the direct-candidate run above without any implementation changes.

Integrated PR-triggered run 37894293360 and Docs PR-triggered run 37894293327 were skipped by audit policy and are NOT counted as qualification. Their explicitly dispatched complete runs above replace those missing gates. Solidity's PR classifier, compute-fast, PR-shards and main-only monolith are intentionally inapplicable to manual Level 3; its four full CI shards and downstream inventory/fixture are the required gate. Genesis runs no duplicate Foundry inventory.

## Integration, security, deployment and documentation scope

- Integrated `go test ./...` and consensus/execution builds passed on this candidate, covering the merged Go services including Indexer. Production dependencies and pinned Geth v1.17.5 engine payload acceptance passed; fault matrix and bounded soak passed.
- Retained Grow workflow passed affected SDK consumer, public Location/service, web/static/security checks, clean build/race integration and original deployment-stage readiness preflight.
- Accumulated V2 suite passed actual PostgreSQL ordered/checksum migrations, composite tenant FKs and forced RLS under non-superuser runtime roles; facility/zone scope, lifecycle/lineage, telemetry, equipment no-actuation/replay, cultivation, harvest planning/analytics, inventory ledger/reconciliation/exports, advice consent/revocation/human review and leased notification outbox checks.
- Private HTTP and real TLS client-CA/certificate identity enrollment/revocation tests, membership suspension, tenant/facility/zone denial, origin/CSRF/method/path negatives, database outage confidentiality, stable mutation idempotency, Go race/vet/build/format and Chromium mobile/desktop accessibility/XSS/session recovery passed. No unresolved security failure was reported by these suites; this does not certify untested live systems.
- Foundry lint reported `reentrancy-no-eth` at `ComputeStakeVerifierCollateral420.sol:457`. Source review found `entered = true` at line 423 before the vault release/claim calls, with reentry checks in stake, withdrawal, exit request and slash execution. Pre-guard hold queries are view/static calls; dependency binding is one-time and admin restricted. This inspected warning did not establish a defect; compiler/lint warnings remain visible in canonical diagnostics and are not represented as a clean static-analysis certification.
- Genesis passed frozen-address, manifest, namespace/collision and physical predeploy authority checks. Grow V2 adds no Genesis contract or address authority.
- Docs passed strict MkDocs/render, generated reference/version/link/navigation/search/publication safety and retained Compute evidence checks.
- Supplemental preservation checks on the exact local candidate: Compute ingestion syntax + 63 tests PASS; Compute website structural/security checks, build and 19 tests PASS. No new SDK/Search/RPC interface or deployment configuration changed through the merge; applicable retained consumer and global checks cover those unchanged boundaries. Live cross-service integration is not asserted.
- `grow/web/README.md` reconciles the public-directory versus private-workspace documentation, actual private-server configuration, certificate/session prerequisites, migration/runtime role separation and release boundaries. Earlier per-step/interim evidence files describe their historical candidate; this record and the current roadmap govern phase state.

## Remaining live/testnet acceptance — GROW-V2-16

Production-equivalent private HTTPS/PostgreSQL deployment and encrypted backups/PITR restore drills; real certificate issuance, enrollment, rotation and revocation operations; actual tenant/browser/device acceptance; monitoring and outage recovery; live 420Identity/Wallet/Registry/Location/Storage and Notifications recipient/subscription/delivery authority; verified 420AI/Compute provider/media sanitization/model acceptance; real sensor accuracy and equipment safety remain external release gates. Internal CSV exports are not certified regulatory filing adapters. Autonomous physical actuation is not authorized or enabled by this phase qualification.

**Next canonical step:** GROW-V2-16 — Live production-equivalent testnet deployment and acceptance.

Evidence-only documentation commits may inherit this exact implementation qualification only when they change no executable source, test, workflow, dependency, configuration, interface or substantive requirement. The exact evidence commit SHA and merge result are recorded in the PR closeout to avoid a self-referential commit hash in this file.
