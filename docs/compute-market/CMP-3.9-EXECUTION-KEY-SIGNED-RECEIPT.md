# CMP-3.9 — Execution-key signed receipt

Status: **COMPLETE — Level 1 + Level 2 exact-head qualified on `ae2a3a8243a1c969857b8b06161badbcc2b0c3d7`.**

## Canonical definition

**Execution-key signed receipt.**

The canonical CMP-3 roadmap places this step after CMP-3.8 result commitment and before CMP-3.10 result/evidence upload.

The normative requirements come from CMP-0.9 signed execution receipts, CMP-0.7 lifecycle, CMP-0.4 signed manifests, CMP-1.3.9 execution-key signing, and `ComputeJobWorkerSnapshotEvidence420`.

CMP-3.9 implements the worker-side cryptographic receipt boundary. It does not implement verifier correctness, result/evidence upload, canonical receipt transport, settlement, or payment.

## Canonical authority source

CMP-0.9 requires receipt fields to be read from canonical accepted state rather than copied into a second editable worker policy database.

The existing CMP-3.6 `ExecutionAuthorization` does not contain all receipt fields, and the repository does not currently provide a deployed dedicated `ComputeReceipt420` registry implementation.

CMP-3.9 therefore introduces `CanonicalReceiptAuthority`. The resolver must provide the accepted request/match, verifying registry, frozen signer and grant, partition identity, metering context, input-slice commitment, profile-defined output commitment, evidence root, result code, result-adapter address, snapshot commitment and worker revision.

The worker fails closed if any required canonical binding is absent, zero, malformed or inconsistent with the CMP-3.8 result material. No live address, registry publication or deployment fact is fabricated.

## Frozen ReceiptV1 schema

CMP-3.9 freezes this ordered static tuple:

1. `uint32 receiptSchemaVersion`
2. `uint256 chainId`
3. `address verifyingRegistry`
4. `bytes32 jobId`
5. `bytes32 requestId`
6. `bytes32 matchId`
7. `bytes32 unitId`
8. `bytes32 attemptId`
9. `bytes32 providerId`
10. `bytes32 nodeId`
11. `bytes32 resourceId`
12. `address workerSigner`
13. `bytes32 signerGrantId`
14. `bytes32 manifestHash`
15. `bytes32 partitionPlanHash`
16. `uint32 partitionIndex`
17. `uint32 replicaIndex`
18. `uint64 attemptNonce`
19. `uint64 executionStartedAt`
20. `uint64 executionEndedAt`
21. `bytes32 meteringProfileId`
22. `uint32 meteringProfileVersion`
23. `uint256 measuredUnits`
24. `bytes32 measurementCommitment`
25. `bytes32 inputSliceCommitment`
26. `bytes32 outputCommitment`
27. `bytes32 evidenceRoot`
28. `bytes32 resultCode`
29. `uint64 receiptNonce`

Version 1 uses `receiptNonce = 1` for the one admissible signed receipt for one exact attempt. A conflicting second receipt for the same attempt fails closed.

The exact EIP-712 type string is frozen in `ReceiptTypeStringV1`.

## Receipt payload commitment

The receipt payload commitment is `keccak256(abi.encode(RECEIPT_PAYLOAD_DOMAIN_V1, ReceiptV1 fields in frozen order))`, where `RECEIPT_PAYLOAD_DOMAIN_V1 = keccak256("420/COMPUTE/RECEIPT_PAYLOAD/V1")`.

All values use standard 32-byte ABI words. Packed encoding and JSON hashing are prohibited for this commitment.

The resulting `receiptHash` is intended for the existing worker-evidence result path.

## EIP-712 receipt signature

The receipt assertion is separately signed under name `420Integrated Compute Receipt`, version `1`, actual chain ID, and the canonical `verifyingRegistry` returned by the authority resolver.

The EIP-712 struct hash uses the exact frozen `ComputeReceiptV1(...)` type string and ordered typed fields. The final digest is `keccak256(0x1901 || domainSeparator || structHash)`.

A manifest/request signature is not reused as a receipt signature.

## Execution-key implementation

`compute/worker/ethereum.go` provides dependency-free secp256k1 signing with private-scalar validation, Ethereum-address derivation, deterministic RFC6979 nonces, canonical low-s signatures, v restricted to 27/28, legacy Keccak-256 and local ECDSA verification.

Private-key bytes are never persisted by the receipt store.

Pinned vectors include Keccak-256 empty string, private key 1 -> `0x7e5f4552091a69125d5dfcb7b8c2659029395bdf`, ReceiptV1 payload/struct/domain/signing hashes, deterministic receipt signature, and current contract result digest/signature.

## Existing contract-result compatibility

The current `ComputeJobWorkerSnapshotEvidence420.commitResult` verifies a separate execution-key signature over its frozen `RESULT_EXECUTION_DOMAIN_V1` digest rather than the full ReceiptV1 EIP-712 digest.

CMP-3.9 therefore produces two distinct execution-key signatures:

1. EIP-712 ReceiptV1 assertion signature;
2. current contract-compatible result-authorization signature.

They are not interchangeable.

The contract-compatible digest binds result domain, chain, worker-evidence adapter address, execution-signing policy, job/request/manifest, attempt, snapshot, worker ID/revision, attempt number, receipt hash and profile-defined output hash.

## Output commitment boundary

CMP-3.8 provides complete raw-stdout SHA-256. CMP-0.9 makes canonical receipt `outputCommitment` profile-defined.

CMP-3.9 requires `CanonicalReceiptAuthority` to provide both `OutputSourceSHA256`, which must equal the CMP-3.8 source digest, and the accepted profile-defined `OutputCommitment`.

The two may differ. This proves raw-output SHA-256 is not silently promoted to a universal receipt commitment.

## Replay and conflict semantics

Repeated signing of identical canonical material is byte-identical because RFC6979 is deterministic and is idempotently returned from private storage.

A changed canonical receipt for the same attempt produces different commitment/signatures and is rejected as `ErrConflictingReceipt`.

Cross-chain and cross-registry EIP-712 digests differ. The contract-result digest separately binds chain, adapter, job, request, manifest, attempt, worker revision, receipt and output commitment.

## Private signed-receipt store

Signed receipts are written under `<stateDir>/receipts/<attemptRef>.json` with directory mode `0700`, file mode `0600`, validated attempt-derived filenames, private temp file, fsync, atomic rename and directory sync. Symlinks/non-regular/unsafe-mode records fail closed.

The store persists signatures and commitments, but not execution private-key bytes, raw work-unit bytes, raw sandbox output or bearer credentials.

## Authority separation

Every `SignedReceipt` records `signed=true`, `authoritative=false`, `resultCorrectnessEvidence=false`, and `canonicalResultCommitted=false`.

The execution-key signature proves attribution only. It does not grant verifier/correctness, matching, WorkerRegistry lifecycle, Vault, settlement, refund, governance, validator, bridge or wallet authority.

CMP-3.9 does not call `commitResult` or `recordResult`. Submission/transport remains later work.

## Adversarial coverage

Tests cover known Keccak/secp256k1 vectors; deterministic low-s signatures; exact 29-word ABI layout; pinned ReceiptV1 and EIP-712 vectors; pinned current contract-result digest/signature; exact result/attempt/worker binding; profile-defined output commitment; source-drift and wrong-key rejection; tampering; cross-chain/cross-registry separation; idempotency; conflicting second receipt; zero critical bindings; uint256 overflow; private persistence; no key/raw-data persistence; and no correctness/canonical-state escalation.

## Qualification evidence

- Implementation/spec SHA: `ae2a3a8243a1c969857b8b06161badbcc2b0c3d7`
- Level 1 Compute Worker Fast Qualification: **#211**
- Level 1 run ID: `37259468746`
- Level 1 job ID: `111603436703`
- Level 2 Compute Worker Integration Qualification: **#59**
- Level 2 run ID: `37259517488`
- Level 2 job ID: `111603579940`
- Evidence anchor: `3f836d35caf7206d0b3cc6620c59f496547b4c72`
- Durable evidence: [CMP-3.9 qualification evidence](CMP-3.9-QUALIFICATION-EVIDENCE.md)

## Qualification level and milestone

CMP-3.9 introduces the first worker-side execution-key receipt-signing authority boundary.

Therefore Level 1 is required through Compute Worker Fast Qualification and Level 2 is required through retained Compute Worker Integration Qualification on the same exact implementation/spec SHA.

This is a meaningful app integration milestone because CMP-3.8 result material, canonical receipt authority, execution-key cryptography and existing contract signing semantics converge here.

Level 3 remains deferred to CMP-3.14.

## Exit criteria

CMP-3.9 is complete only when one exact implementation/spec SHA proves:

1. canonical CMP-0.9 ReceiptV1 field order and widths frozen;
2. all required receipt fields come from canonical receipt authority and fail closed when invalid;
3. receipt bound to exact CMP-3.8 result and worker identity;
4. profile-defined output commitment bound to exact CMP-3.8 source digest;
5. payload commitment uses domain-separated standard ABI Keccak-256;
6. EIP-712 domain/type/struct/signing digest frozen and deterministic;
7. real secp256k1 signing yields Ethereum-compatible 65-byte canonical low-s signatures;
8. signer address equals canonical frozen receipt signer;
9. current contract-compatible result digest reconstructed exactly;
10. distinct execution-key signature produced for contract result digest;
11. receipt and contract-result signatures remain distinct;
12. exact duplicate signing idempotent;
13. conflicting second receipt fails closed;
14. chain and verifying-registry replay separation proven;
15. malformed/zero critical IDs, addresses and uint256 overflow fail closed;
16. signed receipt persistence private and atomic;
17. execution private key and raw customer input/output not persisted;
18. signing grants no correctness, canonical job-state, payment or settlement authority;
19. no result/evidence upload introduced before CMP-3.10;
20. CMP-3.1 through CMP-3.8 regressions remain green;
21. CMP-3.9 mechanical verifier passes;
22. exact-head Level 1 fast qualification passes;
23. exact-head Level 2 worker integration qualification passes.

## Intentionally deferred

- CMP-3.10 result/evidence upload and transport;
- live/deployed receipt registry publication;
- actual RPC submission to `commitResult`;
- canonical `RUNNING -> RESULT_COMMITTED` relay;
- objective verification/correctness decision;
- settlement/payment;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 platform packaging;
- full current-main reconciliation and comprehensive Level 3 qualification at CMP-3.14.

No fabricated deployment address, transaction, block, registry publication or testnet evidence is claimed.

Next canonical step: **CMP-3.10 — Result/evidence upload**.