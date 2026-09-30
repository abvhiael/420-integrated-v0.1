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

**Status:** EVIDENCE RECORDED — final evidence-head exact-SHA requalification pending.

## Substantive exact-head qualification

Implementation SHA `910638991946eada016ce16445034f7a55ba996c` was zero-behind `main` `04f6200c2ae78db7d15db86b482fa6fa732017a6` and passed all triggered qualification workflows:

- 420Registry REG-AUDIT-7 — `36749500698`;
- 420 Integrated Qualification — `36749500728`;
- 420Docs Qualification — `36749500559`;
- 420Indexer — `36749500564` and `36749500835`;
- 420Explorer EXP-NEXT.1 Registry Descriptor Provenance — `36749500693`;
- EXP-1.7 Cross-Layer Traceability Qualification — `36749500521`;
- EXP-1.8 Runtime Negative Divergence Qualification — `36749500741`;
- EXP-1.6 Historical Producer Qualification — `36749500748`;
- EXP-1.10 Phase Closeout Qualification — `36749500647`;
- 420Explorer EXP-NEXT.2 Fee and Raw Event Browser — `36749500588`;
- 420Explorer EXP-2.1 — `36749501148`.

The dedicated REG-AUDIT-7 run passed the mechanical roadmap/integration verifier, retained Registry descriptor verifier, Registry/resident Foundry regressions, full Go Indexer tests and vet, Explorer/Search tests and vet, TypeScript Indexer descriptor tests, and Developer Hub tests.

Because recording this durable evidence changes the branch SHA, the retained exact-head suite must run again on the resulting evidence-recording head before REG-AUDIT-7 can be marked COMPLETE.
