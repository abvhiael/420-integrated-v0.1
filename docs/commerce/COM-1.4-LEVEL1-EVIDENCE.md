# COM-1.4 — Targeted Level 1 evidence

**Step:** COM-1.4 — Data storage and event-indexing architecture  
**Implementation SHA:** `ce723e5f5636651de020bf218461777a5fc63803`  
**Base main SHA:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`  
**Branch / PR:** `commerce/com-1-architecture-reconciliation` / #588  
**Status:** architecture delivered, 15/15 targeted source checks PASS; required CI workflow conclusion pending.

## Changed files

- `docs/commerce/COM-1.4-DATA-STORAGE-AND-EVENT-INDEXING.md` (new architecture)
- `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md` (step reconciliation)

No executable source, contract, ABI, configuration, workflow, build, tests, deployed address or migration changed. Canonical custody, inventory and payment authority remain unmodified.

## Targeted verification

Authenticated exact-SHA source reads checked the changed docs plus existing indexer ingestion, event stream and frozen Market V1 model. **15/15 PASSED**: correct step, roadmap reference, canonical Market boundary, Commerce logical data entities, full event provenance, noncanonical indexer status, idempotent event keys, reorg recovery, checkpoint progression, outbox, private PII and upload controls, Market-exclusive stock authority, fail-closed finality, deferred actual migrations, next COM-1.5 step. Branch compare to main at this implementation commit: ahead 10, behind 0.

## CI exact-head observation

- 420Docs Qualification run `37868573478`: QUEUED at observation; not PASS.
- 420Oracle audit qualification run `37868573509`: QUEUED at observation; unrelated to Commerce architecture and not independently required for this step.

A passing source-consistency check is not a substitute for any mandatory CI conclusion. Review Docs result for exact implementation SHA. No full Foundry/Genesis/global reruns are required for this docs-only step.

## Deferred work

Actual database schema migrations, service implementation, event replay integration and adversarial reorg tests belong to COM-3. Level 2 is deferred to an app integration milestone; Level 3 belongs to COM-1.8. COM-8 testnet and COM-9 mainnet are live/authorization handoffs. No live service is claimed.

**Next canonical step:** COM-1.5 — 420Pay/Wallet/Registry/Identity/Swap integration design.
