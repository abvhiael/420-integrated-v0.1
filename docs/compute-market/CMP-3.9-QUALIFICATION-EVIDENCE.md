# CMP-3.9 — Execution-key signed receipt qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.9 — Execution-key signed receipt**
- Qualification: **Level 1 + Level 2**
- Milestone: execution-key / signed-receipt worker integration boundary
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation/specification

- Evidence anchor SHA: `3f836d35caf7206d0b3cc6620c59f496547b4c72` (creation commit for this durable evidence record)

- Implementation/spec SHA: `ae2a3a8243a1c969857b8b06161badbcc2b0c3d7`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Current `main` at final qualification review: `b301bd27bee7f412589c36b7a8cdbcad6f69a7e8`
- Branch divergence at final qualification review: **147 ahead / 179 behind** current main
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The accumulated branch remains intentionally unreconciled during this milestone. Complete current-main reconciliation and comprehensive exact merge-candidate qualification remain CMP-3.14 Level 3 work.

## Current-main dependency review

Relevant shared receipt/signing dependencies were compared between current `main` and this branch and were blob-identical:

- `ComputeJobWorkerSnapshotEvidence420.sol` — `5d31bbf2d8e63b817712f9c0e460dc6bf60e07fd`;
- `ECDSA420.sol` — `56cbe9b51d86db0483b3bae9fbb8fc4f8b9962f7`;
- `CMP-0.9-SIGNED-RECEIPTS-AND-VERIFICATION.md` — `88a9a3da4d2d29ead3732ed554ce777d95b5ec6e`;
- `CMP-0.7-AUTHORIZED-JOB-LIFECYCLE.md` — `7f9421194e00d04d2c504c0adb3431df409f9cb8`;
- `CMP-1.3.9-EXECUTION-KEY-SIGNING-QUALIFICATION.md` — `34734d5412475709fd28740ecf7aed8dee70bf0e`.

No shared dependency drift requires early Level 3 reconciliation.

## Canonical definition and gap closed

CMP-3.9 is canonically named **Execution-key signed receipt**.

CMP-0.9 requires an attempt-level receipt to bind canonical chain/job/request/match/unit/attempt/provider/node/resource/signer/manifest/partition/metering/input/output/evidence/result/nonce context, to use a domain-separated standard-ABI Keccak payload commitment, and to use a distinct EIP-712 execution-receipt authorization signature.

Before CMP-3.9 the worker had CMP-3.8 unsigned result material but did not have:

- a frozen executable ReceiptV1 tuple;
- a canonical receipt-context resolver;
- an EIP-712 receipt assertion digest;
- an execution-key signing implementation;
- a persistent signed receipt;
- current worker-evidence result-digest compatibility material;
- pinned receipt/contract hash and signature vectors;
- receipt replay/conflict protections.

Those gaps are now implemented.

## Implementation

Qualification-relevant files include:

- `compute/worker/ethereum.go`;
- `compute/worker/receipt.go`;
- `compute/worker/receipt_test.go`;
- `compute/worker/result.go` and retained CMP-3.8 result material;
- `scripts/verify-cmp-3-9-execution-key-signed-receipt.py`;
- `.github/workflows/compute-worker-fast.yml`;
- `.github/workflows/compute-worker-integration.yml`;
- `docs/compute-market/CMP-3.9-EXECUTION-KEY-SIGNED-RECEIPT.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

### Frozen ReceiptV1

The implementation freezes the exact 29-field CMP-0.9 typed ordering:

`receiptSchemaVersion, chainId, verifyingRegistry, jobId, requestId, matchId, unitId, attemptId, providerId, nodeId, resourceId, workerSigner, signerGrantId, manifestHash, partitionPlanHash, partitionIndex, replicaIndex, attemptNonce, executionStartedAt, executionEndedAt, meteringProfileId, meteringProfileVersion, measuredUnits, measurementCommitment, inputSliceCommitment, outputCommitment, evidenceRoot, resultCode, receiptNonce`.

Version 1 uses one receipt slot for one exact attempt (`receiptNonce = 1`). Identical re-signing is idempotent; conflicting canonical material for the same attempt fails closed.

### Canonical receipt authority

`CanonicalReceiptAuthority` supplies accepted receipt context that does not exist in CMP-3.6 execution authorization.

The worker rejects missing, zero, malformed or mismatched canonical context rather than inventing:

- verifying registry;
- signer grant;
- partition/metering context;
- evidence root;
- profile-defined output commitment;
- result-adapter address;
- frozen snapshot/worker revision.

No live deployment address, transaction, block or registry-publication evidence is fabricated.

### Output commitment

CMP-3.8 raw stdout SHA-256 remains the source-content commitment.

CMP-3.9 separately accepts the profile-defined canonical receipt `outputCommitment` while requiring `OutputSourceSHA256` to match the exact CMP-3.8 result source digest.

The profile-defined commitment may differ from raw-output SHA-256.

### Execution-key cryptography

`ethereum.go` implements:

- secp256k1 private-scalar validation;
- public-key and Ethereum-address derivation;
- legacy Keccak-256;
- deterministic RFC6979 HMAC-SHA256 signing;
- canonical low-`s` enforcement;
- Ethereum `v = 27/28` signatures;
- local ECDSA verification.

Private-key bytes are not persisted.

### Two distinct signed digests

CMP-3.9 produces two separate execution-key signatures:

1. the full EIP-712 ReceiptV1 assertion signature;
2. the current `ComputeJobWorkerSnapshotEvidence420.resultExecutionDigest` compatible result-authorization signature.

They are intentionally not interchangeable.

CMP-3.9 does not call `commitResult` or `recordResult` and does not transition canonical job state.

### Private receipt persistence

Signed receipt records are stored under `<stateDir>/receipts/<attemptRef>.json` with:

- results directory mode `0700`;
- record mode `0600`;
- validated attempt-derived filename;
- private temp file;
- fsync;
- atomic rename;
- directory sync;
- unsafe/symlink/non-regular record rejection.

Persisted receipt material contains no execution private key, raw work-unit input or raw sandbox output.

## Pinned cryptographic vectors

Independent fixture values retained in tests:

- Keccak-256(empty): `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`;
- private key 1 Ethereum address: `0x7e5f4552091a69125d5dfcb7b8c2659029395bdf`;
- ReceiptV1 payload hash: `0x3462fa3dc5c82d7974ffe95e535314d5661aa9b03a1e2b3e65d0b99f8f69c4ac`;
- EIP-712 struct hash: `0x5f6f06631f2c74b4aecc13dffd923cbbd8a75ae1c1ae5da1bd57fa07d938c3ae`;
- EIP-712 domain separator: `0x363e7a10ea9b0cbf244fed3b76a3cd3baeaadb0d3a105fe973592e06951cb624`;
- receipt signing digest: `0x98be775ebe6ab11d88a18bd7f1454be7b61786909caec45e2e0751c894c7a79c`;
- deterministic receipt signature: `0x3558519636a779174dad39912e26b1464a5e2bdab1bab5a084afe930b73cfbf7249a059c52d06e4f0e4a355479e704b37c476973ce245a8d3e23c2856bd3a3171c`;
- current contract result digest: `0xbf2f31026a9d7151263915c68efb47078e96f83c22d405cd41be9ed6d40673d0`;
- deterministic contract-result signature: `0xf7c7a19efffb933bc91d8acfe4ad0b7fd34566553630dcd54451e7568d2b463c3c8e46bda8cdc62c8f7aa1058bc44ab5b74f5012a49e25cc409b5ab615ee07fb1b`.

## Security/adversarial coverage

Committed tests cover:

- known Keccak and secp256k1 address vectors;
- deterministic canonical low-s signatures;
- exact 29-word ABI receipt layout;
- pinned payload/struct/domain/signing hashes;
- pinned receipt and contract-result signatures;
- exact CMP-3.8 result/attempt/worker binding;
- profile-defined output commitment differing from source digest;
- output-source drift rejection;
- wrong execution-key rejection;
- receipt field tampering rejection;
- cross-chain domain separation;
- cross-registry domain separation;
- byte-identical duplicate idempotency;
- conflicting second receipt rejection;
- zero critical binding rejection;
- uint256 overflow rejection;
- private `0600` persistence;
- no private-key/raw-input/raw-output persistence;
- no correctness/canonical-state authority escalation.

## Level 1 exact-head qualification

Required owner: **Compute Worker Fast Qualification**.

- Run number: **#211**
- Run ID: `37259468746`
- Job ID: `111603436703`
- Exact SHA: `ae2a3a8243a1c969857b8b06161badbcc2b0c3d7`
- Result: **SUCCESS**

Passing steps:

- exact-head checkout/verification;
- worker runtime unit/adversarial/vector tests;
- `node420-compute` tests;
- Go vet;
- worker runtime build;
- CMP-3.4 real Docker sandbox build/test;
- CMP-3.7 real Docker checkpoint/resume build/test;
- CMP-3.8 real Docker result commitment build/test;
- CMP-3.1 through CMP-3.8 retained mechanical verifiers;
- CMP-3.9 execution-key signed receipt verifier.

No required Level 1 check was skipped, cancelled, stale, missing or substituted.

## Level 2 exact-head qualification

CMP-3.9 is a meaningful app integration milestone because result material, canonical receipt context, execution-key cryptography and current worker-evidence signing semantics converge.

The temporary PR label `cmp-worker-level2` was applied to trigger the retained app-specific milestone suite, then removed after successful qualification so future ordinary commits do not repeatedly run Level 2.

- Workflow: **Compute Worker Integration Qualification #59**
- Run ID: `37259517488`
- Job ID: `111603579940`
- Exact SHA: `ae2a3a8243a1c969857b8b06161badbcc2b0c3d7`
- Result: **SUCCESS**

Passing Level 2 steps:

- exact-head checkout/verification;
- real CMP-3 integration image builds;
- retained worker integration suite;
- `node420-compute` package tests;
- Go vet;
- worker runtime build.

An earlier Integration #58 run on the same SHA was skipped before the milestone label was applied. That expected skip is not counted as evidence.

## Broad workflow disclosure

Broad repository workflows are not required CMP-3.9 Level 1/2 owners under the active phase policy.

`420Docs Qualification #5237` / run `37259468666` failed. Exact log inspection showed the failure was unrelated pre-existing Arbitration orphan-navigation debt only:

- `docs/apps/arbitration/deployment-operations.md`;
- `docs/apps/arbitration/threat-model.md`.

The CMP-3.9 documentation passed the preceding governed-document checks, including front matter, version metadata, registry/routing validation and internal links.

Queued/in-progress unrelated broad workflows are not promoted to passing evidence.

## Exit-criterion disposition

1. CMP-0.9 ReceiptV1 order/widths frozen — **PASS**.
2. Canonical receipt fields supplied through fail-closed authority resolver — **PASS**.
3. Receipt bound to exact CMP-3.8 result/worker identity — **PASS**.
4. Profile output commitment bound to exact source SHA-256 — **PASS**.
5. Payload commitment uses domain-separated standard ABI Keccak-256 — **PASS**.
6. EIP-712 domain/type/struct/signing digest frozen/deterministic — **PASS**.
7. Ethereum-compatible secp256k1 low-s 65-byte signing — **PASS**.
8. Canonical frozen worker signer enforced — **PASS**.
9. Current contract-compatible result digest reconstructed — **PASS**.
10. Distinct execution-key contract-result signature produced — **PASS**.
11. Receipt and contract-result signatures remain distinct — **PASS**.
12. Exact duplicate signing idempotent — **PASS**.
13. Conflicting second receipt fails closed — **PASS**.
14. Chain/verifying-registry replay separation — **PASS**.
15. Zero/malformed/overflow inputs fail closed — **PASS**.
16. Signed receipt persistence private and atomic — **PASS**.
17. Execution private key/raw customer data not persisted — **PASS**.
18. No correctness/canonical-state/payment/settlement authority escalation — **PASS**.
19. No CMP-3.10 upload/transport introduced — **PASS**.
20. CMP-3.1 through CMP-3.8 regressions remain green — **PASS**.
21. CMP-3.9 mechanical verifier — **PASS**.
22. Exact-head Level 1 Fast qualification — **PASS**.
23. Exact-head Level 2 Integration qualification — **PASS**.

## Intentionally deferred

- CMP-3.10 result/evidence upload and transport;
- live/deployed receipt-registry publication;
- actual RPC submission to `commitResult`;
- canonical `RUNNING -> RESULT_COMMITTED` relay;
- objective verification/correctness decision;
- settlement/payment;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 platform packaging;
- full current-main reconciliation and comprehensive Level 3 qualification at CMP-3.14.

No live/testnet evidence is fabricated. The worker-side signed-receipt step itself has no live-testnet blocker.

## Evidence-only closeout rule

Commits after the exact qualified implementation/spec SHA change only durable evidence/status bookkeeping. They do not change executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, artifacts or substantive requirements. They therefore reference the exact qualified SHA without recursively requiring another Level 1/2 qualification.

## Formal status

**CMP-3.9 — Execution-key signed receipt: COMPLETE.**

Next canonical step: **CMP-3.10 — Result/evidence upload**.