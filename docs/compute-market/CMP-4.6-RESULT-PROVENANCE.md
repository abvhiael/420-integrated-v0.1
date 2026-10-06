# CMP-4.6 — Result provenance

Status: **COMPLETE — LEVEL 1 + FIRST CMP-4 LEVEL 2 EXACT-HEAD QUALIFIED ON `01824d6488a14d74d86ea6f1c6c8a4ecbd45d878`.**

Canonical roadmap step: **CMP-4.6 — Result provenance**.

CMP-4.6 gives each verified scientific result an immutable provenance record that links the exact CMP-4.1 scientific work-unit commitment to the canonical worker result, result-bearing attempt, receipt-bound execution evidence, output schema, verifier and canonical verification decision.

## 1. Canonical sources

CMP-4.6 does not create a second result or verifier authority.

`ComputeScientificResultSource420` is a read-only adapter over:

- `ComputeJobRegistry420`, which owns canonical job/result/verification references; and
- `ComputeJobWorkerSnapshotEvidence420.verdictContext`, which owns the exact result-bearing attempt, worker, result commitment and execution-evidence commitment.

The source rejects mismatched unit/job identity, missing result state, empty canonical commitments and disagreement between JobRegistry and worker evidence.

## 2. Receipt and execution linkage

The existing worker result commitment already binds the receipt hash and output commitment. The existing `executionEvidenceCommitment` returned by `verdictContext` additionally binds the result-bearing attempt, worker snapshot, receipt hash, result commitment and result-commit time.

CMP-4.6 therefore stores those canonical commitments rather than copying raw receipt bytes, output bytes, signatures, credentials or private evidence on chain.

## 3. Scientific work-unit reconstruction

At provenance registration the contract independently reconstructs the exact CMP-4.1 `ScientificWorkUnitV1` commitment using:

- canonical unit ID;
- research-project commitment;
- canonical accepted manifest hash;
- exact execution-environment commitment;
- canonical job input commitment;
- parameters commitment;
- resource class;
- canonical output schema;
- canonical accepted verification-policy commitment;
- canonical deadline;
- canonical funding reference.

The caller must provide the expected scientific work-unit commitment and it must match the reconstructed value exactly. Cross-unit or altered scientific bindings fail closed.

## 4. Provenance identity

`provenanceId` is domain-separated and binds:

- chain ID;
- provenance registry and canonical source;
- job/unit;
- scientific work-unit commitment;
- exact result-bearing attempt and attempt number;
- worker;
- canonical result commitment;
- canonical execution/receipt evidence commitment;
- verifier;
- canonical verification decision reference;
- output schema.

One canonical result produces one immutable provenance identity. Byte-identical duplicate recording is idempotent; conflicting provenance for a job fails.

## 5. Verification boundary

CMP-4.6 requires a nonzero canonical verifier and verification decision before provenance can be recorded.

That requirement is a provenance gate, **not a new correctness decision**. The registry does not evaluate outputs, select verifiers, turn FAIL into PASS, settle funds, reward workers or slash stake. It only records the already-canonical verification reference.

`isCanonical` re-reads canonical source context and detects drift; it does not re-run scientific verification.

## 6. Privacy and retention

Canonical state contains commitments/references only. Raw outputs, raw receipts, dataset bytes, private evidence, credentials, secrets and unrestricted locators remain off-chain under existing privacy/access rules.

CMP-4.8 owns publication and retention semantics.

## 7. Security / adversarial behavior

Required fail-closed behavior covers:

- zero or malformed scientific bindings;
- scientific-work-unit commitment mismatch;
- cross-unit commitment replay;
- missing canonical verification;
- JobRegistry/worker-result disagreement;
- missing attempt/worker/result/execution-evidence commitments;
- canonical-source drift after recording;
- duplicate/conflicting provenance;
- attempts to interpret provenance as correctness, settlement, reward, slash, access or governance authority.

## 8. Qualification and milestone

CMP-4.6 is **Level 1 + the first CMP-4 Level 2 integration milestone**.

CMP-4.1 explicitly deferred the first app integration milestone until multiple scientific objects converged. At CMP-4.6, scientific unit, project, dataset/environment commitments, worker result/receipt evidence and verifier decision converge for the first time.

Required qualification on one exact SHA:

- affected Compute contracts compile;
- dedicated `ComputeScientificResultProvenance420.t.sol` tests pass;
- retained CMP-4.1–CMP-4.5 verifiers remain compatible;
- CMP-4.6 mechanical verifier passes;
- retained full Compute Market Solidity suite passes as the app-focused Level 2 integration suite;
- exact-head Compute Market Qualification passes.

No repository-wide Level 3 inventory is required. Level 3 remains CMP-4.10.

## 9. Intentionally deferred

- scientific metadata and lineage — CMP-4.7;
- publication / retention policy — CMP-4.8;
- research dashboard — CMP-4.9;
- comprehensive scientific-framework closeout — CMP-4.10;
- SDK/API/indexer expansion — CMP-7;
- user-facing Compute application — CMP-8;
- live scientific workload demonstration — CMP-9.13.

## 10. Qualification evidence

- qualified implementation/closeout SHA: `01824d6488a14d74d86ea6f1c6c8a4ecbd45d878`;
- qualification base/main at run time: `f32a9c322e085634e47f20b84861338811198454`;
- Compute Market Qualification: **#418** / run `37418605649` / job `112122702586` — **SUCCESS**;
- exact-head checkout and SHA verification — PASS;
- Compute Market contracts build — PASS;
- retained `Compute*.t.sol` suite — PASS;
- verification-script compilation — PASS;
- retained CMP-4.1–CMP-4.5 verifiers — PASS;
- CMP-4.6 result-provenance verifier — PASS;
- Level 1 — PASS;
- first CMP-4 Level 2 integration milestone — PASS;
- Level 3 — deferred to CMP-4.10.

Durable evidence: [CMP-4.6 qualification evidence](CMP-4.6-QUALIFICATION-EVIDENCE.md).

## 11. Next canonical step

**CMP-4.7 — Scientific metadata and lineage**
