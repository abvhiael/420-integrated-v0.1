# GROW-V2-15 — Phase reconciliation and Level 3 qualification

**Disposition:** IN PROGRESS — canonical full Solidity gate still running. No phase completion or PR merge is asserted until every mandatory gate passes.

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
| `contracts-foundry.yml` | 37894345957 | shards 0/1/2/3: 113702148743 / 113702148747 / 113702148763 / 113702148549; inventory/fixture job follows shards | RUNNING |
| `genesis-address-authority.yml` | 37894383829 | cross-manifest-authority 113702273062 | PASS |
| `qualification.yml` | 37894412174 | fault-matrix 113702364099; geth-engine 113702364380; offline-core 113702364413; production-dependencies 113702364420 | PASS — all four jobs |
| `docs-qualify.yml` | 37894493542 | qualify 113702624780 | PASS |
| `420grow-v2-fast.yml` | 37894293237, attempt 2 | v2-app-qualification 113702530598 | PASS — every required stage |
| `420grow-fast.yml` | 37894293364 | canonical-definition 113701979114 | PASS — every required stage |

The initial Grow V2 attempt, job 113701978918, failed at browser process startup before the DevTools endpoint existed (`browser-smoke.mjs:83`), after backend/SQL/frontend tests passed. One failed-job-only retry on the identical SHA passed the complete browser and V2-14 gates without code changes. This is recorded as a transient Chromium startup failure; the failed attempt is not passing evidence.

Integrated PR-triggered run 37894293360 and Docs PR-triggered run 37894293327 were skipped by audit policy and are NOT counted as qualification. Their explicitly dispatched complete runs above replace those missing gates. Solidity's PR classifier, compute-fast, PR-shards and main-only monolith are intentionally inapplicable to manual Level 3; its four full CI shards and downstream inventory/fixture are the required gate. Genesis runs no duplicate Foundry inventory.

## Integration, security, deployment and documentation scope

- Integrated `go test ./...` and consensus/execution builds passed on this candidate, covering the merged Go services including Indexer. Production dependencies and pinned Geth v1.17.5 engine payload acceptance passed; fault matrix and bounded soak passed.
- Retained Grow workflow passed affected SDK consumer, public Location/service, web/static/security checks, clean build/race integration and original deployment-stage readiness preflight.
- Accumulated V2 suite passed actual PostgreSQL ordered/checksum migrations, composite tenant FKs and forced RLS under non-superuser runtime roles; facility/zone scope, lifecycle/lineage, telemetry, equipment no-actuation/replay, cultivation, harvest planning/analytics, inventory ledger/reconciliation/exports, advice consent/revocation/human review and leased notification outbox checks.
- Private HTTP and real TLS client-CA/certificate identity enrollment/revocation tests, membership suspension, tenant/facility/zone denial, origin/CSRF/method/path negatives, database outage confidentiality, stable mutation idempotency, Go race/vet/build/format and Chromium mobile/desktop accessibility/XSS/session recovery passed. No unresolved security failure was reported by these suites; this does not certify untested live systems.
- Genesis passed frozen-address, manifest, namespace/collision and physical predeploy authority checks. Grow V2 adds no Genesis contract or address authority.
- Docs passed strict MkDocs/render, generated reference/version/link/navigation/search/publication safety and retained Compute evidence checks.
- Supplemental preservation checks on the exact local candidate: Compute ingestion syntax + 63 tests PASS; Compute website structural/security checks, build and 19 tests PASS. No new SDK/Search/RPC interface or deployment configuration changed through the merge; applicable retained consumer and global checks cover those unchanged boundaries. Live cross-service integration is not asserted.
- `grow/web/README.md` reconciles the public-directory versus private-workspace documentation, actual private-server configuration, certificate/session prerequisites, migration/runtime role separation and release boundaries. Earlier per-step/interim evidence files describe their historical candidate; this record and the current roadmap govern phase state.

## Remaining live/testnet acceptance — GROW-V2-16

Production-equivalent private HTTPS/PostgreSQL deployment and encrypted backups/PITR restore drills; real certificate issuance, enrollment, rotation and revocation operations; actual tenant/browser/device acceptance; monitoring and outage recovery; live 420Identity/Wallet/Registry/Location/Storage and Notifications recipient/subscription/delivery authority; verified 420AI/Compute provider/media sanitization/model acceptance; real sensor accuracy and equipment safety remain external release gates. Internal CSV exports are not certified regulatory filing adapters. Autonomous physical actuation is not authorized or enabled by this phase qualification.

**Next canonical step after all Level 3 gates pass:** GROW-V2-16 — Live production-equivalent testnet deployment and acceptance.

Evidence-only documentation commits may inherit this exact implementation qualification only when they change no executable source, test, workflow, dependency, configuration, interface or substantive requirement. The exact evidence commit SHA and merge result are recorded in the PR closeout to avoid a self-referential commit hash in this file.
