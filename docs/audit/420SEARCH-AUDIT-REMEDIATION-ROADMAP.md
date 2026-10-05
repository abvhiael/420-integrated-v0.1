# 420Search audit remediation roadmap

Stable requirement IDs for the complete repository audit. IDs must not be renumbered.

1. **SEARCH-AUDIT-1 — canonical definition and inventory** — reconcile Genesis profile, roadmap, service identity, privacy/authority model, required domains, files, previous SEARCH-0..10 evidence and PR history.
2. **SEARCH-AUDIT-2 — implementation/build/test/security qualification** — exact-head verifier, gofmt, `go test ./search/...`, `go vet ./search/...`, runtime/smoke/live-validator builds, production Docker build, direct-RPC/authority-drift rejection.
3. **SEARCH-AUDIT-3 — integration/readiness reconciliation** — verify current 420Indexer v1 consumer contract, Registry/Names/Identity/assets/validators/public ecosystem adapters, UI/API trust presentation, and distinguish repository qualification from live deployment.
4. **SEARCH-AUDIT-4 — durable repository closeout** — retain exact SHA/workflow evidence, complete requirement matrix and formal repository readiness determination.
5. **SEARCH-AUDIT-5 — production-equivalent public testnet qualification** — **BLOCKED until an approved live 420Indexer/testnet deployment and Search endpoint exist.** Run `searchsmoke` and `searchlivevalidate`, seeded probes for all required domains, restart/rebuild/reorg/freshness/wrong-chain/failure drills, and retain exact release/deployment evidence.
6. **SEARCH-AUDIT-6 — Genesis/production closeout** — after SEARCH-AUDIT-5, bind final public URLs/configuration, operations/monitoring/rate-limit/rollback evidence, final cross-app live integration and exact-release qualification; separately declare Genesis and production readiness.
