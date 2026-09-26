# EXP-0.3.3 — mandatory capability acceptance-test mapping

**Status:** acceptance-test map committed; exact-head CI qualification required before closeout.  
**Baseline:** merged EXP-0.2 `main` commit `c7cb5f4dac07eb9416cac4a11eeee31b6efb10f0`.  
**Machine-readable map:** `docs/audit/EXP-0.3.3-mandatory-acceptance-tests.json`.

## Objective

EXP-0.3.3 proves that every mandatory 420Explorer Genesis view has a concrete acceptance-test path.

The acceptance path is deliberately split into two evidence tiers:

1. **current automated tests** — repository tests that already exercise the implemented source path; and
2. **later qualification tests** — deployment, target-network, integration, UI/end-to-end, recovery, security or release-candidate evidence that source CI cannot legitimately prove.

A mapped test path is not the same thing as a passed Genesis acceptance criterion.

## Result

All ten mandatory required views have a complete acceptance-test path:

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

Every entry has:

- a stable test-map ID;
- traceability to EXP-0.3.1 requirement ID;
- traceability to EXP-0.2.1 capability ID;
- traceability to EXP-0.3.2 implementation-path ID;
- current source status;
- one or more current automated test files;
- explicit coverage statement for each current test source;
- one or more later qualification procedures;
- a named later milestone owner for every procedure;
- applicable EXP-0.2.5 findings;
- AC-1 through AC-10 mapping;
- complete later-owner mapping.

There are **zero orphaned mandatory acceptance paths**.

## Existing automated evidence

The map records existing repository coverage rather than inventing tests that do not exist. It includes, among others:

- block snapshot/finality/navigation and page-bound checks;
- transaction receipt/log/finality composition plus provenance mismatch failures;
- address snapshot/membership and malformed-address rejection;
- contract runtime bytecode/code-hash presentation and address mismatch rejection;
- asset snapshot/filter/membership tests and Indexer HTTP/storage tests;
- consensus validator/proposer/QC and committee-membership validation;
- Registry version projection and read-endpoint authority-boundary tests;
- network status healthy/wrong-chain/stale/degraded/inconsistent cases;
- shared Explorer→Indexer API-only consumption and canonical-authority rejection.

## Mandatory later evidence

Source CI cannot close all Genesis requirements. The map therefore preserves concrete future procedures for the known gaps, including:

- canonical target-network block/transaction/receipt/log comparisons;
- actual transaction-fee implementation and vectors;
- complete raw topic/data event rendering;
- deployed asset filtering and live decoder coverage;
- deployed consensus-provider wiring;
- historical block-to-producer attribution;
- epoch/rotation boundary evidence;
- ProtocolRegistry runtime code/publication verification at the frozen address;
- pinned Registry ABI/descriptor and historical-version decoding evidence;
- wrong-chain/stale/degraded/inconsistent production-equivalent behavior;
- deployed browser/end-to-end required-view witnesses;
- exact release-candidate qualification.

## Status discipline

EXP-0.3.3 preserves the source status from EXP-0.3.2:

- **6 `implemented_source`**
- **4 `partial_source`**

The partial capabilities remain:

- receipt/logs;
- token/asset activity;
- validator;
- epoch/rotation.

The map explicitly records:

`fully_genesis_accepted = 0`

This is required. EXP-0.3.3 defines the acceptance path; it does not satisfy the later evidence.

## Qualification gate

`scripts/verify-exp-0-3-3-acceptance-tests.py` fails closed unless:

1. exactly ten test-map entries exist;
2. entry names exactly match the dedicated Genesis `requiredViews`;
3. every entry maps to the matching mandatory EXP-0.3.1 requirement;
4. every entry maps to the matching mandatory EXP-0.2.1 capability;
5. every entry maps to the matching complete EXP-0.3.2 source path;
6. source status remains identical to EXP-0.3.2;
7. every current automated-test path exists;
8. every explicitly named Go test function exists in the referenced file;
9. every current test source has a non-empty coverage statement;
10. every capability has at least one current automated test source;
11. every capability has at least one later qualification procedure;
12. every later procedure has a valid EXP owner that is also in the capability's later-owner set;
13. every mapped EXP-0.2.5 finding exists;
14. acceptance criteria remain valid and exactly match the EXP-0.3.2 mapping;
15. known fee, raw-event, consensus-provider, historical-producer, Registry/deployment and live-network gaps remain mapped to concrete future procedures;
16. summary counts remain 10 mapped / 6 implemented / 4 partial / 0 orphaned / 0 fully Genesis accepted;
17. the qualification statement continues to distinguish test-path completeness from actual Genesis acceptance.

The verifier emits:

- `exp-0-3-3-evidence/summary.json`;
- `exp-0-3-3-evidence/acceptance-tests.tsv`.

## Completion condition

EXP-0.3.3 is qualified when the dedicated verifier and all retained Explorer/Indexer/repository qualification suites pass on the same exact PR head and the evidence artifact is uploaded.

Qualification means **every mandatory Genesis view has a concrete, owned and evidence-backed acceptance-test path**. It does not mean the mapped later procedures have already passed.
