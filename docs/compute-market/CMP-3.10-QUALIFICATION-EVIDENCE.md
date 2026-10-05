# CMP-3.10 — Result/evidence upload qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.10 — Result/evidence upload**
- Qualification level: **Level 1**
- Level 2: **not required**; CMP-3.9 was the preceding execution-key/signed-receipt integration milestone and CMP-3.10 adds only an app-scoped provider-neutral off-chain transport boundary.
- Level 3: deferred to **CMP-3.14 — Phase closeout**.

## Qualified implementation/specification

- Evidence anchor SHA: `8a72024fc27543f7754b624be2cada39d4b13849` (creation commit for this durable evidence record)

- Implementation/spec SHA: `356f8d77f3b4b6997f9f9d75e612a36d1a32a43f`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Current `main` at final qualification review: `d6779109b0f7dadca2ff3d10ca9c0c0aa3aff924`
- Branch divergence at final qualification review: **159 ahead / 184 behind** current main
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The accumulated branch remains intentionally unreconciled during this ordinary roadmap step. Complete current-main reconciliation and comprehensive exact merge-candidate qualification remain CMP-3.14 Level 3 work.

## Current-main dependency review

The controlling shared specifications and the relevant pre-existing storage upload implementation were blob-identical between current `main` and the qualified candidate:

- `CMP-0.9-SIGNED-RECEIPTS-AND-VERIFICATION.md` — `88a9a3da4d2d29ead3732ed554ce777d95b5ec6e`;
- `CMP-0.10-DISPUTES-PRIVACY-AND-SECURITY.md` — `0ff61a52c1586b1a9ef12d1c102f32f3757e30ab`;
- `CMP-0.11-CLIENT-NODE-AND-420AI-INTEGRATION.md` — `394602f274b31bbc31df6c139809e9b29e39b306`;
- `execution/storage/developer_upload.go` — `ad31266b5beb969ed6f85974de37b72b3bc7e1cb`.

Current `main` also contains a newer 420AI-specific provider runtime that is not present on this long-lived CMP-3 branch. That runtime is not made a general ComputeMarket dependency by CMP-3.10. General worker upload remains provider-neutral; integration with newer app-specific consumers is part of later reconciliation/integration work, not grounds to silently change the canonical CMP-3.10 boundary.

## Canonical definition and gap closed

The canonical roadmap names CMP-3.10 **Result/evidence upload**.

CMP-0.9 requires off-chain evidence to use immutable content-addressed references, accepted retrieval/privacy policy, retention and provenance; private data must not be published on-chain. CMP-0.10 requires access-controlled private evidence and explicit retention/privacy boundaries. CMP-0.11 requires provider-neutral client/node integration rather than an AI-only dependency.

Before CMP-3.10 the worker had:

- CMP-3.8 committed result material;
- CMP-3.9 execution-key signed ReceiptV1;
- CMP-3.9 contract-compatible result authorization signature.

It did not have:

- a frozen worker-side upload authorization;
- deterministic ordered evidence-root construction;
- a provider-neutral result/evidence transport interface;
- exact evidence size/digest staging before transport;
- deterministic transport idempotency;
- transport-receipt identity verification;
- durable nonsecret upload completion evidence.

Those gaps are now implemented.

## Implementation

Qualification-relevant files:

- `compute/worker/upload.go`;
- `compute/worker/upload_test.go`;
- `compute/worker/result.go`;
- `compute/worker/receipt.go`;
- `scripts/verify-cmp-3-10-result-evidence-upload.py`;
- `.github/workflows/compute-worker-fast.yml`;
- `docs/compute-market/CMP-3.10-RESULT-EVIDENCE-UPLOAD.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

### Canonical upload authorization

`CanonicalResultEvidenceUploadAuthority` resolves the exact accepted upload policy for one execution authorization.

The authorization binds:

- authorization reference;
- upload-policy ID;
- exact evidence root;
- maximum object bytes;
- maximum complete-upload bytes;
- exact ordered evidence requirements.

Each evidence requirement binds ordinal, kind, SHA-256, size, encrypted flag, access-policy ID, retention deadline and provenance commitment.

Missing, malformed, expired, zero, reordered or inconsistent values fail closed.

### Ordered evidence root

CMP-3.10 freezes:

`420/COMPUTE/EVIDENCE_SET/V1`

as the evidence-set domain.

The worker computes a deterministic Keccak-256 root over the exact ordered descriptor set and requires it to equal both the accepted upload authorization and the CMP-3.9 signed receipt evidence root.

Pinned retained vector:

`0xbf901f40e484816156836c5ca0d812b15d45235c922ad81b6d67e34964630599`.

### Upload object set

For one exact attempt, the worker uploads:

1. CMP-3.8 result material;
2. CMP-3.9 signed receipt;
3. versioned evidence manifest;
4. every accepted evidence object.

Every uploaded object is content-addressed as `sha256:<digest>`.

CMP-3.8 intentionally does not preserve arbitrary raw stdout. CMP-3.10 therefore does not fabricate a raw-output object from bounded diagnostics. Output/proof bytes are uploaded only when the accepted evidence policy explicitly includes them as content-addressed evidence.

### Integrity before side effects

Every evidence stream is privately staged under the worker state directory and checked for exact byte length and SHA-256 before the first remote upload.

The complete evidence set and complete upload byte ceiling are validated before transport side effects begin.

This prevents a malformed later evidence stream from causing result/receipt metadata to be uploaded first and then represented as a complete successful bundle.

### Provider-neutral transport

`ResultEvidenceTransport` is deliberately abstract and app-neutral.

A request binds exact chain/job/unit/attempt/receipt scope, upload policy, deterministic idempotency key and immutable object descriptor.

A returned transport receipt must reproduce the exact schema/idempotency/object descriptor and must remain non-authoritative.

Transport/retrieval references are provenance/routing metadata only and cannot replace canonical attempt identity or content commitments.

The repository has no frozen general ComputeMarket HTTP upload schema. CMP-3.10 therefore does not invent one.

### Retry and restart safety

Object idempotency is deterministically derived from a versioned domain plus:

- chain;
- job;
- unit;
- attempt;
- receipt nonce;
- upload policy;
- object kind/ordinal;
- object SHA-256.

A failed transport retry reuses the same object identity. A durable successful completion is returned without re-upload. Partial transport failure creates no durable completion record.

### Private durable completion evidence

Successful completion is atomically persisted under `<stateDir>/uploads/<attemptRef>.json` with mode `0600`.

The record binds exact attempt/policy/result/receipt/evidence-manifest/upload-receipt identities but persists no raw evidence bytes, raw work-unit input, raw sandbox output, private key or credential.

It explicitly remains:

- `authoritative=false`;
- `resultCorrectnessEvidence=false`;
- `canonicalResultCommitted=false`.

## Security/adversarial coverage

Committed tests cover:

- ordered/domain-separated evidence-root vector;
- evidence-order mutation;
- complete result/receipt/manifest/evidence object set;
- object digest and size verification;
- all-evidence validation before transport;
- canonical evidence-root drift;
- malformed transport receipt;
- durable idempotent replay;
- stable idempotency after partial transport failure;
- private `0600` upload record;
- absence of raw evidence/output persistence;
- staging cleanup;
- missing/zero upload policy;
- missing/zero evidence access policy;
- expired retention;
- object and total byte ceilings;
- cancellation before transport;
- authority non-escalation.

## Level 1 exact-head qualification

Required owner: **Compute Worker Fast Qualification**.

- Workflow run number: **#233**
- Run ID: `37261236505`
- Job ID: `111608720907`
- Exact implementation/spec SHA: `356f8d77f3b4b6997f9f9d75e612a36d1a32a43f`
- Result: **SUCCESS**

Passing steps included:

- exact qualification head verification;
- full worker runtime unit/adversarial tests;
- `node420-compute` package tests;
- Go vet;
- worker runtime build;
- real Docker CMP-3.4 sandbox integration regression;
- real Docker CMP-3.7 checkpoint/resume integration regression;
- real Docker CMP-3.8 result commitment integration regression;
- retained CMP-3.1 through CMP-3.9 mechanical verifiers;
- CMP-3.10 result/evidence upload verifier.

No required Level 1 check was skipped, cancelled, stale, missing or substituted.

A source-only checkpoint before final workflow/spec wiring also passed Fast #226 / run `37261028871`; it is diagnostic evidence only and is not the formal CMP-3.10 qualification because it predates the final CMP-3.10 verifier/workflow/roadmap candidate.

## Level 2 status

Compute Worker Integration Qualification #69 on the final SHA completed with **SKIPPED**, because the deliberate `cmp-worker-level2` milestone label was absent.

That skip is expected and is **not counted as passing evidence**.

No Level 2 run is required for CMP-3.10: this step adds an app-scoped provider-neutral off-chain transport coordinator and does not introduce a new shared contract, lifecycle authority, shared deployment, or cross-component milestone. CMP-3.9 was the preceding signed-receipt convergence milestone.

## Broad workflow disclosure

Broad repository workflows are not CMP-3.10 Level 1 owners under the active phase qualification policy.

`420Docs Qualification #5268` / run `37261236548` failed. Exact job-log inspection showed the failure was the same pre-existing Arbitration orphan-navigation debt:

- `docs/apps/arbitration/deployment-operations.md`;
- `docs/apps/arbitration/threat-model.md`.

The CMP-3.10 documentation passed front matter, version metadata, contextual checks and internal-links qualification before that unrelated orphan stage.

Other broad workflows that were queued or in progress during closeout are not promoted to CMP-3.10 passing evidence.

## Exit-criterion disposition

1. Versioned fail-closed upload authorization — **PASS**.
2. Evidence descriptors bind order/kind/SHA-256/size/privacy/retention/provenance — **PASS**.
3. Ordered domain-separated evidence root — **PASS**.
4. Evidence root equals canonical authorization and signed receipt — **PASS**.
5. Result material, signed receipt and evidence manifest uploaded content-addressed — **PASS**.
6. Every required evidence object uploaded content-addressed — **PASS**.
7. Raw sandbox output is not fabricated from bounded diagnostics — **PASS**.
8. Evidence staging is private and temporary — **PASS**.
9. Exact evidence size/SHA-256 checked before transport — **PASS**.
10. Complete evidence set validated before first transport side effect — **PASS**.
11. Per-object and complete-upload byte ceilings — **PASS**.
12. Transport request exact attempt/policy binding — **PASS**.
13. Transport receipt exact identity/non-authority validation — **PASS**.
14. Deterministic retry idempotency — **PASS**.
15. Durable successful replay avoids duplicate upload — **PASS**.
16. Partial transport failure creates no durable completion — **PASS**.
17. Private atomic successful completion record — **PASS**.
18. No raw evidence/output/private-key/credential persistence — **PASS**.
19. No correctness/canonical-state/payment/settlement authority escalation — **PASS**.
20. No invented network-specific or 420Storage economic authority — **PASS**.
21. CMP-3.1 through CMP-3.9 regressions remain green — **PASS**.
22. CMP-3.10 mechanical verifier — **PASS**.
23. Exact-head Compute Worker Fast Qualification — **PASS**.

## Intentionally deferred

- concrete live verifier/evidence-service endpoint binding;
- concrete 420Storage-backed adapter if selected by accepted policy;
- live retrieval availability and credential-revocation drills;
- actual `commitResult` / canonical `RUNNING -> RESULT_COMMITTED` submission;
- objective verification/correctness decision;
- dispute evidence disclosure/adjudication;
- payment and settlement;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections;
- CMP-3.13 Windows/Linux/macOS packaging;
- CMP-3.14 current-main reconciliation and comprehensive Level 3 phase closeout.

No live/testnet endpoint, upload, retrieval, deployment, transaction or verifier result is fabricated.

## Evidence-only closeout rule

Commits after the exact qualified implementation/spec SHA change only durable evidence/status bookkeeping. They do not change executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, generated/runtime artifacts or substantive requirements. They therefore reference the exact qualified SHA without recursively requiring another Level 1 run.

## Formal status

**CMP-3.10 — Result/evidence upload: COMPLETE.**

Next canonical step: **CMP-3.11 — Local resource controls**.
