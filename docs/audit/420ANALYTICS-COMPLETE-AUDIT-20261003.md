# 420Analytics complete audit — 2026-10-03

Base repository: `abvhiael/420-integrated-v0.1`  
Audit base: `main` @ `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`

## Canonical determination

420Analytics is a Genesis user application and a contract-free, non-authoritative derived-data service. Its chain-derived data source is the qualified 420Indexer public API. It must not crawl node420 RPC, own canonical ingestion/finality/reorg authority, write protocol state, or treat forecasts/rankings as canonical truth.

## Repository state

The historical implementation branches `feature/gen10-4-420analytics-v1` and `feature/420analytics-genesis-v1` are both fully behind `main` with zero commits ahead and are stale archival branches. The implementation is merged to `main`.

The canonical roadmap and readiness records agree that repository implementation is complete through ANALYTICS-8 and that the active gate is ANALYTICS-9 live testnet qualification.

## Implemented architecture

Present on `main`:

- qualified 420Indexer client boundary;
- metric/snapshot/provenance model;
- network, validator, protocol/application and economic metrics;
- methodology registry and deterministic time-series support;
- cohorts/rankings and predictive anomaly/forecast separation;
- privacy admission controls;
- reorg/finality/freshness handling;
- bounded HTTP API and abuse/resource controls;
- user-facing dashboard presentation;
- `analytics420` runtime;
- graceful shutdown and operational probes;
- non-root container packaging;
- live testnet validator `analytics/cmd/analyticslivevalidate`;
- explicit ANALYTICS-9 readiness and qualification manifests.

No Analytics smart contract is required by the frozen Genesis architecture.

## Audit gap repaired in this branch

A dedicated app-specific exact-head Analytics CI gate was not present on current `main`. This branch adds `.github/workflows/analytics-audit.yml` to qualify:

1. clean exact checked-out SHA;
2. `go test ./analytics/...`;
3. `go test -race ./analytics/...`;
4. `go vet ./analytics/...`;
5. builds for `analytics420` and `analyticslivevalidate`;
6. Genesis profile verifier;
7. fail-closed assertion that ANALYTICS-9 remains live-evidence pending.

This closes the repository-local exact-head qualification gap only. It does not manufacture live testnet evidence.

## Requirement matrix

| Requirement | Current implementation | Tests/docs | Status | Required remediation |
|---|---|---|---|---|
| canonical authority boundary | contract-free, derived only | profile, architecture, invariants | COMPLETE | none |
| smart contracts | not required | Genesis application inventory | NOT APPLICABLE | none |
| qualified Indexer-only source | implemented | indexerclient/runtime tests and docs | COMPLETE | live binding still requires ANALYTICS-9 |
| metric/provenance model | implemented | model/metrics tests and docs | COMPLETE | none |
| methodology/versioning | implemented | methodology docs/tests | COMPLETE | none |
| time series/snapshots | implemented | deterministic snapshot/series design | COMPLETE | live rebuild evidence pending |
| cohorts/rankings | implemented | documented non-canonical semantics | COMPLETE | live seeded evidence pending where required |
| anomaly/forecast separation | implemented | predictive/non-canonical controls | COMPLETE | none |
| privacy exclusions | implemented | admission tests/docs | COMPLETE | none |
| reorg/finality/freshness | implemented | repository tests/docs | COMPLETE | live reorg/restart qualification pending |
| HTTP API | implemented | API docs/tests | COMPLETE | live endpoint qualification pending |
| abuse/resource controls | implemented | bounded controls/tests/docs | COMPLETE | production load evidence not yet live-qualified |
| dashboard | implemented | dashboard tests/docs | COMPLETE | live browser/deployment evidence pending |
| runtime/container | implemented | runtime tests + Dockerfile | COMPLETE | live deployment pending |
| application documentation | user/developer/security/troubleshooting docs present | docs package | COMPLETE | final Genesis closeout after ANALYTICS-9 |
| exact-head app CI | added by this audit branch | analytics-audit workflow | PARTIAL | must pass on exact branch head |
| live testnet qualification | validator/manifests ready, no live evidence | ANALYTICS-9 contract | BLOCKED | production-equivalent testnet + qualified 420Indexer |
| Genesis closeout | not yet allowed | ANALYTICS-10 | BLOCKED | complete ANALYTICS-9 first |
| production deployment | not evidenced | deployment docs only | BLOCKED | production endpoint/DNS/ops evidence |

## Readiness

- CODE COMPLETE: YES for the repository-defined ANALYTICS-0 through ANALYTICS-8 scope.
- BUILD COMPLETE: pending exact-head CI added by this audit.
- CONTRACT COMPLETE: YES / NOT APPLICABLE — Analytics is intentionally contract-free.
- TEST COMPLETE: NO — repository suites exist, but exact-head audit CI and live ANALYTICS-9 evidence are still required.
- DOCUMENTATION COMPLETE: YES for current repository scope; ANALYTICS-10 closeout record remains future work.
- INTEGRATION COMPLETE: NO — live 420Indexer-backed testnet binding is not yet evidenced.
- SECURITY QUALIFIED: PARTIAL — repository authority/privacy/resource boundaries are implemented; live operational qualification remains.
- TESTNET READY: YES, specifically `LIVE_QUALIFICATION_READY`.
- GENESIS READY: NO — ANALYTICS-9 and ANALYTICS-10 remain.
- PRODUCTION READY: NO — live deployment, monitoring/recovery and production evidence remain.

## Remediation roadmap

1. **ANALYTICS-AUDIT-1 — exact-head repository qualification**
   - pass the dedicated audit workflow on the exact branch head;
   - record workflow run/job IDs and exact SHA.

2. **ANALYTICS-AUDIT-2 — durable repository audit evidence**
   - retain this audit, exact-head CI evidence and any corrections;
   - do not mark live gates complete.

3. **ANALYTICS-9 — production-equivalent testnet qualification**
   - deploy qualified 420Indexer and `analytics420`;
   - set `ANALYTICS_LIVE_URL`;
   - execute the live validator;
   - retain seeded metric, restart/rebuild, non-safe reorg and safe-height-regression evidence.

4. **ANALYTICS-10 — Genesis closeout**
   - run the full ANL invariant audit;
   - finalize readiness/documentation matrix;
   - reconcile with then-current `main`;
   - perform exact-head closeout qualification.

5. **Production qualification**
   - deploy public production endpoint/DNS;
   - retain monitoring, incident/recovery and operational evidence;
   - do not infer production readiness from testnet success alone.
