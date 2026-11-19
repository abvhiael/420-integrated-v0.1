# TREASURY-REC-7 — Indexer, Explorer and Analytics reconciliation evidence

## Scope and provenance

- Original implementation: PR #1229; exact implementation SHA `cf0b38f38d337de9f5009ff63e0e7c8f4c5ecb8e`; merged main `d72cd7275745abd88a704934bb68e0a708658088`.
- Runtime and consumer reconciliation: PR #1230; exact executable SHA `3d655c47a674bf4e2e1fadaf19973c6129deea24`.
- This record qualifies repository/local behavior, not a live deployment or independent Vault payment proof.

## Retained original qualification

[Run 44597319428](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44597319428), job 135819007525: compiled ABI and seven event descriptors verified; TypeScript Treasury tests 31/31 including PostgreSQL interruption and recovery; SDK 1/1; affected Go read consumers passed. Original evidence is retained at its original SHA. The runtime follow-up does not change those Solidity, TypeScript or SDK implementations.

## Runtime and consumer corrections

- Shared ABI descriptor embedded in the Go Indexer; canonical checkpoint-bound durable history read with block/transaction/successful-receipt provenance, strict event decoding, emitter checks, policy revision, accounting invariant, canonical disbursement identity and terminal replay handling.
- Budget, disbursement and asset-policy routes work through the actual Go HTTP server. Explorer and Analytics consume the same read-only model; Explorer supports the Treasury route and refuses authority or verified-release claims.
- Local tests exercise durable store, real Indexer HTTP server, Explorer and Analytics clients, checkpoint interruption/reopen, rollback and replacement branch, failed receipt, wrong genesis and missing deployment binding. Negative service tests independently reject authority and wrong chain.
- Explorer inventory reconciled to 15 mappings (7 core + 8 supplemental). Initial follow-up run 44610619315 exposed an outdated capability-list assertion; corrected without weakening coverage.
- EXP-1.7 and EXP-1.8 configuration fixtures now supply isolated nonproduction Engine URL and ephemeral JWT for Compose validation. Rights audit builds the unchanged exact import closure using original Foundry profiles and unchanged security gates, avoiding unrelated global fixture compilation.

## Exact-head qualification

| Gate | Evidence | Result |
| --- | --- | --- |
| Affected Go regression, Treasury runtime/consumer integration, race qualification, vet and inventory | [44610899469](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44610899469), job 135866903702 | PASS; 307 top-level tests, 354 including subtests; 21 test packages; 15/15 inventory mappings |
| Explorer runtime cross-layer traceability | [44610899503](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44610899503) | PASS |
| Explorer negative/divergence qualification | [44610899980](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44610899980) | PASS |
| Rights audit (both original profiles and static gate) | [44610899864](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44610899864) | PASS; 15/15 full suite, 15/15 hardening, 20/20 TypeScript, no high-severity Rights findings |
| Explorer API route qualification EXP-2.2 | [44610899851](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44610899851) | PASS |
| Explorer EXP-2.3/2.4/2.5/2.6 and EXP-NEXT.1/2/3 | Exact-head workflow runs | PASS |

Executed commands include `go test -v ./indexer/... ./explorer/... ./analytics/indexerclient ./analytics/metrics -count=1`, affected Treasury race checks, and Go vet. The direct store/API package Treasury-name filter has no standalone matching tests; the real store and HTTP server are exercised by the Explorer API integration tests, including under race detection.

The broader automatic Indexer workflow [44610899592](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44610899592) is tracked separately; no conclusion is inferred from the targeted pass.

## Boundary and remaining work

The runtime requires `INDEXER_TREASURY_DEPLOYMENT` with chain ID 420, verified genesis hash and the three distinct verified Treasury deployment addresses. No fixed address is invented. Missing configuration fails closed; local fixture addresses are not live evidence. Actual deployment materialization and Registry/constructor binding belong to REC-8/AUDIT-8. Live testnet receipt/finality/reorg correlation and external security review remain deferred; REC-5 security closeout remains open. A Treasury release commitment remains completion evidence only, not independent proof of payment.

This closes REC-7 local implementation and directly affected qualification scope; the following documentation-only evidence commit does not alter executable code, test fixtures or workflow configuration.
