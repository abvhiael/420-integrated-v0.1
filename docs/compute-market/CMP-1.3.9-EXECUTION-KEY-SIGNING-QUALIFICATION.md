# CMP-1.3.9 — Independent execution-key authorization and replay-safe worker signing

Status: **CANDIDATE GREEN — evidence-recording head requalification pending**

## Canonical definition

CMP-1.3.9 turns the worker execution key from registration/rotation possession evidence into an independently usable execution authority for policy-bound accepted work.

Required by the controlling roadmap:

- chain/contract/job/worker/revision/attempt domain-separated digests;
- execution-key signatures for accepted-work and result/receipt actions where the bound policy requires them;
- preserved separation between operator account and execution key;
- safe rotation without rewriting accepted jobs;
- rejection of cross-chain, cross-job, cross-worker, stale-revision, duplicate-attempt, and retired-key replay;
- execution-key authority grants no custody, correctness, matching, settlement, governance, or lifecycle mutation authority.

Exit: accepted execution can be authenticated by the frozen execution key without conflating that key with the worker operator account.

## Authority and baseline

Implementation branch point:

`25321f2af15b02d2940704225b854c5d33984111`

That exact CMP-1.3.8 closeout head passed:

- Solidity Contracts #3259 — SUCCESS, 16/16 PR shards;
- 420 Integrated Qualification #5866 — SUCCESS;
- 420Docs Qualification #3249 — SUCCESS.

CMP-1.3.9 therefore starts only after CMP-1.3.8 was durably and exactly qualified.

Audited repository authorities:

- `docs/compute-market/CMP-1-IMPLEMENTATION-ROADMAP.md`;
- `docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md`;
- `docs/compute-market/CMP-1.3.0-WORKER-REGISTRY-BASELINE-AND-INTEGRATION-DESIGN.md`;
- `ComputeWorkerRegistry420`;
- `ComputeAuthorization420`;
- `ComputeJobWorkerSnapshotEvidence420`;
- `ComputeJobRegistry420`;
- accepted-match runtime and retained snapshot tests;
- frozen CMP-INV-001 through CMP-INV-030.

## Pre-step gap analysis

### Already satisfied

- WorkerRegistry stores a distinct execution signer and versioned key commitment.
- Registration and key rotation require proof of possession.
- Accepted-job snapshot freezes exact worker revision, resource revision, execution signer, execution-key commitment, capability, Trust, and stake context.
- Accepted work already requires canonical match/resource/operator binding and scoped `ACTION_EXECUTE_ATTEMPT`.
- Result submission already requires scoped `ACTION_SUBMIT_RECEIPT`.
- Assignment/result commitments already include chain/contract/job context and prevent ordinary duplicate assignment/result state mutation.
- Key rotation creates a new WorkerRegistry revision and preserves historical revisions.

### Missing before CMP-1.3.9

- assignment acceptance authenticated `msg.sender == worker.operator`, not the execution key;
- result submission authenticated `msg.sender == assignment.operator`, not the frozen execution key;
- no independently signable accepted-work digest existed;
- no independently signable result/receipt digest existed;
- no explicit versioned execution-signing policy was frozen into accepted work;
- no consumed-signature/digest replay record existed;
- no relayer-safe path separated transaction sender from operator capability and execution signer;
- cross-chain/cross-job/cross-worker execution-signature replay was not directly tested;
- rotation semantics were not tested for “old key valid only for already-frozen work, invalid for new work.”

## Implementation

### Bound signing policy

`ComputeJobWorkerSnapshotEvidence420` now exposes:

- `EXECUTION_SIGNING_POLICY_V1`;
- `ACCEPT_EXECUTION_DOMAIN_V1`;
- `RESULT_EXECUTION_DOMAIN_V1`.

The V1 snapshot path binds `EXECUTION_SIGNING_POLICY_V1` into the immutable snapshot and requires the execution-key signature for both assignment acceptance and result submission.

This is intentionally strict: the canonical V1 snapshot execution path has an explicit signing policy rather than a caller-controlled optional flag that could silently disable authentication.

### Accepted-work signature

`assignmentExecutionDigest(...)` produces the exact digest the frozen/current execution signer must sign.

The digest binds:

- action-specific domain;
- chain ID;
- snapshot contract address;
- signing-policy version;
- job ID;
- accepted match ID and acceptance reference;
- expected job revision;
- worker ID and worker revision;
- resource ID and resource revision;
- execution-key commitment;
- attempt number;
- full snapshot commitment.

`acceptAssignment(..., executionSignature)`:

1. verifies canonical accepted job state and exact live worker revision;
2. verifies match/resource against the canonical worker operator;
3. verifies the canonical operator still holds `ACTION_EXECUTE_ATTEMPT`;
4. verifies capability/Trust/stake admission references;
5. verifies the execution signature against the worker revision's execution signer;
6. rejects an already-consumed execution digest;
7. freezes the assignment and passes the canonical operator—not the relayer—to `ComputeJobRegistry420`.

The transaction sender is therefore only a relayer. It does not become worker identity or economic authority.

### Result/receipt signature

`resultExecutionDigest(jobId, receiptHash, outputHash)` derives a result authorization from the immutable assignment.

It binds:

- result-specific domain;
- chain ID and contract;
- signing policy;
- job/request/manifest;
- assignment and snapshot commitments;
- worker ID/revision;
- resource ID/revision;
- frozen execution-key commitment;
- attempt number;
- receipt and output commitments.

`commitResult(..., executionSignature)` verifies:

- the immutable assignment and running job;
- the frozen canonical operator's `ACTION_SUBMIT_RECEIPT` capability;
- the frozen execution signer's signature;
- digest replay has not occurred.

It intentionally does not re-read current WorkerRegistry/resource/policy state, preserving the existing rule that later rotation or suspension cannot rewrite or strand already accepted work.

### Replay state

`usedExecutionAuthorization[digest]` records consumed accepted-work/result signature digests.

State writes remain atomic with the downstream job transition: if the transaction reverts, the replay marker reverts as well.

## Authority separation

CMP-1.3.9 deliberately separates three identities:

1. **operator account** — canonical provider/node/worker operator whose scoped ComputeAuthorization grant is required;
2. **execution signer** — key frozen into the worker revision/assignment and required to sign execution actions;
3. **transaction relayer** — arbitrary caller that can submit a valid signed action but gains no canonical identity or entitlement.

Execution-key possession alone cannot:

- mutate WorkerRegistry lifecycle;
- create/revoke capabilities;
- spend or withdraw Vault funds;
- prove result correctness;
- act as verifier;
- accept/broaden a match;
- settle a job;
- govern the protocol;
- act as validator/bridge/wallet authority.

## Adversarial and boundary coverage

The retained snapshot suite is extended to cover:

- valid relayed assignment signed by the execution key;
- valid relayed result signed by the frozen execution key;
- wrong execution key rejection;
- cross-chain replay rejection;
- cross-job replay rejection;
- cross-worker replay rejection;
- stale worker-revision rejection;
- duplicate assignment/attempt replay rejection;
- duplicate result rejection;
- post-acceptance key rotation preserving the old frozen key for the already-running job;
- retired old key rejection for newly accepted work after rotation;
- operator submit-capability revocation still blocking a cryptographically valid result signature;
- execution-key address alone gaining no WorkerRegistry lifecycle authority;
- later worker/resource suspension not stranding already accepted signed execution.

## Frozen invariant mapping

Directly exercised or strengthened:

- **CMP-INV-002/003** — worker/job/resource identities remain distinct and stable.
- **CMP-INV-005** — execution identity grants no custody/governance/validator/bridge/wallet authority.
- **CMP-INV-008** — accepted snapshot/signing semantics cannot silently change after acceptance.
- **CMP-INV-012/013** — signatures do not provide arbitrary job-state mutation or terminal reopening.
- **CMP-INV-014** — execution/result signatures are domain-separated and replay-safe.
- **CMP-INV-016** — a worker signature remains a signed claim, not correctness proof.
- **CMP-INV-020** — later suspension cannot confiscate or strand already accepted valid work.
- **CMP-INV-023** — execution signing remains separate from Trust/custody/settlement authority.
- **CMP-INV-026** — execution identity and signed commitments are reconstructable.
- **CMP-INV-028/029** — resource/key changes do not rewrite accepted execution semantics.

CMP-1.3.9 does not add receipt metering chains or settlement semantics; cumulative receipt chaining remains outside this step.

## Deployment/publication boundary

This step changes the runtime code hash of `ComputeJobWorkerSnapshotEvidence420`. The historical CMP-1.3.7 deployment hashes therefore remain historical only.

The canonical roadmap assigns the final release-candidate wiring/runtime-hash/publication refresh to CMP-1.3.15. CMP-1.3.9 does not fabricate deployment addresses, transaction hashes, blocks, or ProtocolRegistry publication evidence.

## Qualification evidence

Candidate exact SHA: `b36a713e4ebb8dc2a73fa9f59bbde7aaccaa2bac`

Candidate qualification:

- Solidity Contracts #3262 — **SUCCESS**, all 16/16 `pr-shards` successful. The aggregate `foundry` wrapper was skipped by workflow design and is not counted as a passing gate.
- 420 Integrated Qualification #5879 — **SUCCESS**:
  - `offline-core` — success
  - `production-dependencies` — success
  - `fault-matrix` — success
  - `geth-engine` — success
- 420Docs Qualification #3262 — **SUCCESS**.

A prior candidate head `26a65180b5a5bb0e09a48bea5c4f8d8cf3545760` failed Solidity Contracts #3261 in two newly-added replay tests. Root cause was a test harness error in `_acceptedJob()`: one-shot `vm.prank(OWNER)` was consumed by the external `matchEvidence.matchId()` getter during Solidity argument evaluation, so `jobs.recordMatch` correctly saw the test contract and reverted `Unauthorized`. The fix resolves `matchId` before the prank; no production authorization check was weakened.

Current `main` at evidence recording: `f437378664059a51f854d45bf48594930f070f6f`.
PR #389 remains stacked on qualified CMP-1.3.8 base `25321f2af15b02d2940704225b854c5d33984111` and was mergeable when this evidence was recorded.

Required final exact-head gates after this evidence commit:

- Solidity Contracts, all required PR shards;
- 420 Integrated Qualification;
- 420Docs Qualification;
- any additional workflow triggered for the exact evidence head;
- no failed/cancelled/missing required gate may be treated as passing.

The candidate results above qualify only `b36a713e4ebb8dc2a73fa9f59bbde7aaccaa2bac`. This evidence update creates a new branch head and that new SHA must itself pass the retained suite before COMPLETE.

## Completion

**NOT YET COMPLETE** until the exact evidence-recording head passes the retained qualification suite and every canonical exit criterion is individually verified.
