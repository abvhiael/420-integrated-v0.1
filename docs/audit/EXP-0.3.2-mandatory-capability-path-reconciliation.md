# EXP-0.3.2 — mandatory capability implementation-path reconciliation

**Status:** implementation-path matrix committed; exact-head CI qualification required before closeout.  
**Baseline:** merged EXP-0.2 `main` commit `c7cb5f4dac07eb9416cac4a11eeee31b6efb10f0`.  
**Machine-readable matrix:** `docs/audit/EXP-0.3.2-mandatory-capability-paths.json`.

## Objective

EXP-0.3.2 proves that every mandatory Genesis **required view** identified in EXP-0.3.1 has a concrete implementation path through the actual repository.

For each view the matrix traces:

`frontend route/function → Explorer API route/handler → Explorer service operation → Explorer Indexer client → 420Indexer API → Indexer backend/model/store projection → canonical authority`.

This is a source-path qualification milestone. It does not convert partial capabilities into complete capabilities and it does not substitute for later deployment or runtime qualification.

## Results

All ten mandatory views have a complete repository implementation path:

1. block;
2. transaction;
3. receipt/logs;
4. address;
5. contract;
6. token/asset activity;
7. validator;
8. epoch/rotation;
9. protocol service/version;
10. network status.

There are **zero orphaned mandatory view paths**.

Current source status is preserved from EXP-0.3.1:

- **6 implemented_source**
- **4 partial_source**

The four partial views remain:

- receipt/logs;
- token/asset activity;
- validator;
- epoch/rotation.

Their path is complete, but later qualification/remediation remains necessary.

## Known gaps preserved

The matrix explicitly carries forward existing gaps rather than hiding them behind path completeness:

- transaction path exists, but actual transaction-fee inspection remains a Genesis blocker;
- receipt/log path exists, but complete raw event topic/data presentation remains a qualification gap;
- asset path exists, but UI filtering and live decoder coverage remain incomplete/unqualified;
- validator/epoch paths exist, but deployed consensus-provider wiring remains unverified;
- historical block→validator attribution remains absent;
- Registry paths exist, but target-network ProtocolRegistry runtime/publication and ABI/descriptor provenance remain unverified;
- network-status path exists, but production-equivalent target-network binding/freshness remains unverified.

## Qualification gate

`scripts/verify-exp-0-3-2-capability-paths.py` fails closed unless:

1. exactly ten capability paths exist;
2. the path names exactly match the dedicated Genesis `requiredViews` order;
3. every entry points to the matching mandatory EXP-0.3.1 requirement and EXP-0.2.1 capability;
4. every entry remains `complete_source_path`;
5. capability status exactly matches the authoritative EXP-0.3.1 requirement status;
6. all referenced source files exist;
7. frontend functions listed in the matrix exist in the frontend source;
8. Explorer API handlers and routes exist in `explorer/api/server.go`;
9. Explorer service operations exist in their referenced service files;
10. Indexer client operations exist in their referenced client files;
11. 420Indexer API routes exist in `indexer/api/server.go`;
12. referenced model/store/backend paths exist;
13. every capability names a canonical authority and authority evidence;
14. all mandatory paths map to later owners and valid AC-1 through AC-10 criteria;
15. the known fee, raw-event, consensus-provider, historical-producer and Registry/runtime gaps remain represented;
16. the status summary remains 6 implemented / 4 partial / 0 orphaned;
17. path completeness is never described as deployment/live/Genesis qualification.

The verifier writes:

- `exp-0-3-2-evidence/summary.json`;
- `exp-0-3-2-evidence/capability-paths.tsv`.

## Completion condition

EXP-0.3.2 is qualified when its dedicated verifier and the retained Explorer/Indexer/repository qualification suites all pass on the same exact PR head and the evidence artifact is uploaded.

Qualification means that every mandatory Genesis view has a concrete, non-orphaned implementation path and a named canonical authority. It does **not** mean all ten views are feature-complete or live-qualified.
