# REG-AUDIT-7 — Registry/Indexer/resident integration qualification

## Canonical definition

Source: `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`.

Qualify:

- Registry -> GenesisResidentAccess resolution;
- Registry -> Indexer event ingestion and historical reconstruction;
- bounded reorg/replay behavior;
- Explorer/Search/AppStore/Verify projections remain non-canonical;
- Developer Hub publication uses strict registered-service publication;
- direct chain reads disagreeing with projections fail closed appropriately.

**Exit:** integration evidence tied to exact candidate SHA.

## Gap analysis and implementation

Repository inspection found that Registry ABI decoding, historical catalogue logic, reorg handling, resident resolution, and non-authoritative consumer boundaries already existed independently. The blocking integration defect was that production `indexer420` created its API backend with an empty Registry catalogue and never rebuilt that catalogue from ingested canonical Registry logs.

REG-AUDIT-7 closes that seam by:

1. deterministically rebuilding the Registry catalogue from the current canonical indexed block/log history;
2. validating chain/block/log provenance while rebuilding;
3. rebuilding after initial catch-up and every later successful catch-up/reorg, then atomically replacing the API catalogue;
4. proving an actual FileStore non-finalized fork removes orphaned Registry logs/history and reconstructs the replacement branch;
5. adding an optional canonical Registry reader comparison seam that fails closed on direct-read errors or any projection disagreement;
6. retaining the existing GenesisResidentAccess real-Registry resolution, lifecycle and runtime-code-hash failure coverage;
7. reconciling the Indexer Registry release descriptor with the final REG-AUDIT-5/6 ProtocolRegistry source blob;
8. mechanically preserving Explorer, Search, AppStore and Verify as non-canonical projections;
9. mechanically enforcing Developer Hub's `publishRegisteredService` governance handoff and rejecting legacy publication methods as the application publication path.

## Authority and deployment boundary

This step qualifies repository integration/rebuild semantics. It does **not** claim a live target-network Registry deployment. The canonical-reader comparison seam is executable and fail-closed, while actual target-network direct RPC/Registry binding remains part of REG-AUDIT-8 production-equivalent testnet deployment.

## Durable qualification

- verifier: `scripts/verify-reg-audit-7-integration.py`
- workflow: `.github/workflows/registry-reg-audit-7.yml`
- machine evidence: `docs/audit/REG-AUDIT-7-INTEGRATION-QUALIFICATION.json`

**Status:** IMPLEMENTED — exact-head CI qualification pending.
