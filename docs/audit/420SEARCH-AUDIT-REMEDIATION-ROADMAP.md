# 420Search audit remediation roadmap

Stable requirement IDs for the complete repository audit. IDs must not be renumbered.

1. **SEARCH-AUDIT-1 — canonical definition and inventory** — reconcile Genesis profile, roadmap, service identity, privacy/authority model, required domains, files, previous SEARCH-0..10 evidence and PR history.
2. **SEARCH-AUDIT-2 — implementation/build/test/security qualification** — exact-head verifier, gofmt, `go test ./search/...`, `go vet ./search/...`, runtime/smoke/live-validator builds, production Docker build, direct-RPC/authority-drift rejection.
3. **SEARCH-AUDIT-3 — integration/readiness reconciliation** — verify current 420Indexer v1 consumer contract, Registry/Names/Identity/assets/validators/public ecosystem adapters, UI/API trust presentation, and distinguish repository qualification from live deployment.
4. **SEARCH-AUDIT-4 — durable repository closeout** — retain exact SHA/workflow evidence, complete requirement matrix and formal repository readiness determination.
5. **SEARCH-AUDIT-5 — production-equivalent public testnet qualification** — **BLOCKED until an approved live 420Indexer/testnet deployment and Search endpoint exist.** Run `searchsmoke` and `searchlivevalidate`, seeded probes for all required domains, restart/rebuild/reorg/freshness/wrong-chain/failure drills, and retain exact release/deployment evidence.
6. **SEARCH-AUDIT-6 — Genesis/production closeout** — after SEARCH-AUDIT-5, bind final public URLs/configuration, operations/monitoring/rate-limit/rollback evidence, final cross-app live integration and exact-release qualification; separately declare Genesis and production readiness.

## Current audit status

- **SEARCH-AUDIT-1 — COMPLETE.**
- **SEARCH-AUDIT-2 — COMPLETE.** Repository implementation/build/test/security qualification passed on exact implementation SHA `34b1f64b90443ef6808eaa37391b9fe57f4b316e` in 420Search audit qualification run #12 (`37255163213`).
- **SEARCH-AUDIT-3 — COMPLETE.** Integration/readiness reconciliation passed at Level 1 on exact implementation SHA `e013430252106c533e9bc5c54b3339cbdea98681` in 420Search audit qualification run #14 (`37255553537`), job `111591724193`. Search is recorded as a repository-qualified 420Indexer v1 consumer while live Search/Indexer binding remains explicitly deferred to SEARCH-AUDIT-5.
- **SEARCH-AUDIT-4 — COMPLETE.** Durable repository closeout retained in `docs/audit/420SEARCH-COMPLETE-AUDIT-20261004.md`; qualified implementation SHA `e013430252106c533e9bc5c54b3339cbdea98681`, evidence-head revalidation SHA `724b7e19acb24d6409401932aea58f8f2b0f1027`, A4 closeout evidence commit `ee955ed2dd86b319d40133caac507da5f2278fab`.
- **SEARCH-AUDIT-5 — NEXT / BLOCKED ON LIVE TESTNET.** Requires approved production-equivalent testnet, qualified live 420Indexer endpoint and public 420Search endpoint.
- **SEARCH-AUDIT-6 — DEFERRED UNTIL SEARCH-AUDIT-5.**
