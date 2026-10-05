# CMP-3.10 — Result/evidence upload

Status: **COMPLETE — Level 1 exact-head qualified on `356f8d77f3b4b6997f9f9d75e612a36d1a32a43f`.**

## Canonical definition

**Result/evidence upload.**

The canonical CMP-3 roadmap places this step after CMP-3.9 execution-key signed receipt and before CMP-3.11 local resource controls.

Controlling requirements come from CMP-0.9 signed receipts/evidence integrity, CMP-0.10 privacy/security, CMP-0.11 provider-neutral client/node integration, and the qualified CMP-3.8/CMP-3.9 result and signed-receipt objects.

CMP-3.10 implements the worker-side off-chain upload boundary. It does not implement verifier correctness, canonical `RESULT_COMMITTED`, settlement, payment, dispute adjudication, or a network-specific upload service.

## Repository-state gap

Before this step, the worker could create:

- a deterministic CMP-3.8 `ResultMaterial` commitment;
- a CMP-3.9 signed ReceiptV1 assertion;
- a CMP-3.9 contract-compatible result authorization signature.

It could not:

- materialize a canonical ordered evidence set from accepted policy;
- prove that evidence bytes match the receipt `evidenceRoot`;
- upload result/receipt/evidence objects through an idempotent transport boundary;
- verify transport receipts against exact object identity;
- retain durable nonsecret upload evidence across restart/retry.

The existing 420Storage developer upload coordinator is not directly reused because it requires storage agreement/capacity/commitment preconditions that the ComputeMarket receipt does not canonically own. CMP-3.10 therefore defines a provider-neutral transport interface that a later qualified 420Storage, verifier service, or other accepted evidence transport may implement without granting that transport protocol authority.

Likewise, the 420AI provider runtime's `submitReceipt` path is AI-specific and is not made a prerequisite for general ComputeMarket workers.

## Canonical upload authorization

`CanonicalResultEvidenceUploadAuthority` supplies one accepted upload policy for the exact execution authorization.

`ResultEvidenceUploadAuthorization` binds:

- exact authorization reference;
- versioned nonzero upload-policy ID;
- exact receipt evidence root;
- maximum individual object bytes;
- maximum complete upload bytes;
- the exact ordered evidence requirements.

Every accepted evidence requirement binds:

- contiguous ordinal;
- evidence kind;
- SHA-256 content digest;
- exact byte length;
- whether the evidence is encrypted;
- nonzero access-policy ID;
- future retention deadline;
- nonzero provenance commitment.

The worker does not infer missing evidence requirements from local filenames, logs, transport URLs, or provider metadata.

## Evidence root

CMP-3.10 freezes `EvidenceRootDomainV1 = 420/COMPUTE/EVIDENCE_SET/V1`.

The root is a domain-separated Keccak-256 commitment to the exact ordered evidence descriptor set. Each descriptor commitment binds ordinal, Keccak-256 kind hash, exact SHA-256 content digest, size, encrypted flag, access-policy ID, retention deadline and provenance commitment.

Order is canonical and significant. Duplicate/missing/noncontiguous ordinals fail closed.

The computed root must exactly equal both:

- the canonical upload authorization evidence root; and
- the CMP-3.9 signed receipt `evidenceRoot`.

Pinned fixture root for the retained two-object test vector:

`0xbf901f40e484816156836c5ca0d812b15d45235c922ad81b6d67e34964630599`.

## Uploaded object set

For each completed attempt CMP-3.10 uploads:

1. the committed CMP-3.8 result-material JSON;
2. the CMP-3.9 signed-receipt JSON;
3. a versioned evidence-manifest JSON;
4. every evidence object required by the accepted evidence policy.

Every object is content-addressed by SHA-256 as `sha256:<digest>`.

CMP-3.8 intentionally does not persist raw sandbox stdout. CMP-3.10 therefore does not fabricate or reconstruct a raw-output object from truncated diagnostics. The canonical result upload is the committed `ResultMaterial`; any output/proof bytes required by the accepted verification profile must appear explicitly in the canonical evidence set and match its accepted digest/root.

## Privacy and staging

All evidence streams are staged in private temporary files under `<stateDir>/upload-staging` solely to verify exact size and SHA-256 before transport.

Properties:

- staging directory mode `0700`;
- staging file mode `0600`;
- exact size and digest validated before any remote upload;
- all accepted evidence is validated before the first transport side effect;
- temporary files are removed after success or failure;
- durable upload records do not contain raw evidence bytes, raw work-unit bytes, raw sandbox output, access credentials or private keys.

Private evidence confidentiality remains defined by the accepted policy. CMP-3.10 preserves `Encrypted` and `AccessPolicyID` bindings but does not invent encryption keys or silently encrypt/decrypt evidence under an unapproved scheme.

## Transport boundary

`ResultEvidenceTransport` is provider-neutral.

The transport receives an immutable request containing exact chain/job/unit/attempt/receipt scope, upload policy, deterministic idempotency key, and one content-addressed object descriptor.

The transport returns a delivery receipt that must reproduce:

- schema version;
- idempotency key;
- complete object descriptor.

`TransportRef` and `RetrievalRef` are route/provenance metadata only. They never replace canonical job/unit/attempt IDs or immutable content commitments.

A transport receipt with changed digest, size, object identity, policy context, or `Authoritative=true` fails closed.

No HTTP wire format is invented by this roadmap step because the repository has no canonical general ComputeMarket upload endpoint/schema. A concrete transport adapter must implement this exact interface and preserve these invariants.

## Idempotency and restart behavior

Each object idempotency key is SHA-256 over a versioned domain plus exact chain/job/unit/attempt/receipt nonce, upload-policy ID, object kind/ordinal and content digest.

Consequences:

- retrying a failed transport uses the same object idempotency identity;
- a completed durable upload is returned without re-upload on restart/retry;
- conflicting durable completion state fails closed;
- provider transport ticket IDs cannot create a second attempt, result, receipt or entitlement.

Transport failure may leave already accepted content-addressed objects remotely present, but no local completion record is created until the complete required set succeeds. Safe retry relies on the stable idempotency key and immutable object digest.

## Durable upload evidence

After every required upload receipt verifies, the worker atomically stores `<stateDir>/uploads/<attemptRef>.json` with mode `0600`.

The record binds:

- authorization/job/unit/attempt/receipt identity;
- upload policy;
- evidence root;
- CMP-3.8 result commitment;
- CMP-3.9 receipt hash;
- evidence-manifest SHA-256;
- verified transport receipts;
- completion timestamp.

It explicitly records:

- `authoritative=false`;
- `resultCorrectnessEvidence=false`;
- `canonicalResultCommitted=false`.

Upload success is therefore delivery evidence only.

## Authority separation

CMP-3.10 does not:

- call `commitResult` or `recordResult`;
- mutate ComputeJobRegistry state;
- certify result correctness;
- select or impersonate a verifier;
- create payment entitlement;
- release Vault funds;
- settle/refund a job;
- change accepted evidence/verification policy;
- grant storage economics or 420AI authority;
- publish private evidence on-chain.

## Adversarial coverage

Tests cover:

- pinned ordered evidence-root vector;
- order-sensitive root changes;
- complete result/receipt/manifest/evidence upload set;
- exact object SHA-256/size validation by transport;
- all evidence staged and validated before any transport side effect;
- canonical evidence-root drift rejection;
- transport-receipt identity mismatch rejection;
- durable idempotent replay without re-upload;
- stable idempotency identity across transport failure/retry;
- private `0600` upload record;
- no raw evidence/output persistence;
- staging cleanup;
- zero upload-policy/access-policy rejection;
- expired retention rejection;
- object/total byte ceilings;
- cancellation before transport;
- no correctness/canonical-state authority escalation.

## Qualification evidence

- Implementation/spec SHA: `356f8d77f3b4b6997f9f9d75e612a36d1a32a43f`
- Compute Worker Fast Qualification: **#233**
- Run ID: `37261236505`
- Job ID: `111608720907`
- Evidence anchor: `8a72024fc27543f7754b624be2cada39d4b13849`
- Durable evidence: [CMP-3.10 qualification evidence](CMP-3.10-QUALIFICATION-EVIDENCE.md)
- Level 2: not required; Integration #69 skipped as expected with no milestone label and is not counted as passing evidence.
- Level 3: deferred to CMP-3.14.

## Qualification level

CMP-3.10 is an **ordinary app-scoped Level 1 step**.

CMP-3.9 already served as the execution-key/signed-receipt Level 2 convergence milestone. CMP-3.10 adds a provider-neutral off-chain transport coordinator without changing shared contracts, canonical lifecycle authority or a deployed shared service. Therefore no new Level 2 run is required unless later repository evidence shows a concrete cross-component adapter became part of this step.

Level 3 remains deferred to CMP-3.14.

## Exit criteria

CMP-3.10 is complete only when one exact implementation/spec SHA proves:

1. accepted upload authorization is versioned and fail-closed;
2. evidence descriptors bind order, kind, SHA-256, size, encryption/access policy, retention and provenance;
3. ordered evidence root is deterministic and domain-separated;
4. computed evidence root equals canonical authorization and signed receipt;
5. result material, signed receipt and evidence manifest are content-addressed and uploaded;
6. every required evidence object is content-addressed and uploaded;
7. raw sandbox output is not fabricated from bounded diagnostics;
8. evidence bytes are staged privately only for integrity validation;
9. every evidence object passes exact size/SHA-256 validation before transport;
10. the entire evidence set is validated before the first transport side effect;
11. per-object and complete-upload byte ceilings fail closed;
12. transport requests bind exact attempt and policy scope;
13. transport receipts must reproduce exact object identity and remain non-authoritative;
14. deterministic per-object idempotency survives retry;
15. durable successful replay performs no duplicate upload;
16. partial transport failure creates no durable completion record;
17. successful completion persists a private atomic nonsecret upload record;
18. raw evidence/output/private keys/credentials are not durably persisted by CMP-3.10;
19. upload success grants no correctness/canonical job/payment/settlement authority;
20. no network-specific or 420Storage economic authority is invented;
21. CMP-3.1 through CMP-3.9 regressions remain green;
22. CMP-3.10 mechanical verifier passes;
23. exact-head Compute Worker Fast Qualification passes.

## Intentionally deferred

- concrete live verifier/evidence service endpoint binding;
- concrete 420Storage-backed adapter if later selected by accepted policy;
- retrieval-service live availability and credential-revocation drills;
- actual canonical `commitResult` / `RUNNING -> RESULT_COMMITTED` submission;
- objective verifier decision;
- dispute evidence disclosure/adjudication;
- payment/settlement;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- CMP-3.14 full current-main reconciliation and Level 3 closeout.

No live/testnet transport endpoint, deployment, transaction or retrieval claim is fabricated.

Next canonical step: **CMP-3.11 — Local resource controls**.