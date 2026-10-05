# CMP-3.12 — Malicious workload protections qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.12 — Malicious workload protections**
- Qualification level: **Level 1**
- Level 2: **not required**
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation/specification

- Evidence anchor SHA: `279c78a240f5a7223341bf4461978792812b44b3` (creation commit for this durable evidence record)

- Implementation/spec/workflow SHA: `691d6296756281bc8424c17d4ad8597bf0a034b6`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Current `main` at qualification review: `b3cfd359db5ac84aff6213119475ea3dc770642d`
- Qualified-candidate divergence: **202 ahead / 303 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The accumulated CMP-3 branch remains intentionally unreconciled during this ordinary step. Full current-main reconciliation and exact accumulated merge-candidate qualification remain CMP-3.14 Level 3 work.

## Current-main authoritative-source review

The controlling shared sources were blob-identical between current `main` and the qualified candidate:

- `docs/compute-market/CMP-0.4-SIGNED-EXECUTION-MANIFEST.md` — `62bee43c83d069a7825510d19c035c8c36fad859`;
- `docs/architecture/trust-boundary-model.md` — `0cd674a65f41cabda8f52a3f840a10132867e0e3`.

The CMP-3 roadmap itself differs because this branch contains the accumulated unmerged CMP-3 implementation/evidence. That divergence is expected and is not silently reconciled during Level 1.

## Canonical definition and boundary

The canonical roadmap names CMP-3.12 **Malicious workload protections** without prescribing a malware scanner, antivirus product, archive engine, kernel detector or image-signature service.

Repository authority establishes the relevant security boundary through:

- CMP-0.4 immutable signed execution manifests and canonical command/executable commitments;
- CMP-3.4 mandatory workload sandboxing;
- CMP-3.6 canonical attempt authorization;
- CMP-3.11 local resource controls;
- the system trust-boundary model.

CMP-3.12 therefore implements worker-local prevention, detection, containment and restart-safe quarantine without fabricating a new protocol authority or an unsupported malware product.

## Implementation summary

Qualification-relevant files:

- `compute/worker/malicious_workload.go`;
- `compute/worker/malicious_workload_test.go`;
- `compute/worker/sandbox.go`;
- `execution/cmd/node420-compute/main.go`;
- `scripts/verify-cmp-3-12-malicious-workload-protections.py`;
- `.github/workflows/compute-worker-fast.yml`;
- `docs/compute-market/CMP-3.12-MALICIOUS-WORKLOAD-PROTECTIONS.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

### Versioned local security policy

`MaliciousWorkloadPolicySchemaV1` binds:

- maximum total canonical argv bytes;
- maximum single argument bytes;
- maximum local violation count before quarantine;
- quarantine duration;
- immutable image-digest deny entries;
- canonical command-SHA256 deny entries;
- whether timeout, output-limit abuse and sandbox failure/interruption count as local violations.

Policy bounds fail closed.

### Canonical preflight

`WorkloadSecurityGuard.Preflight` validates the existing canonical `ExecutionAuthorization` and sandbox request.

It recomputes `CommandSHA256(request.Command)` and requires exact equality with the canonical authorization, plus exact immutable sandbox-image equality.

Deny/quarantine identity is therefore:

- immutable image digest;
- canonical command SHA-256.

It does not use display names, mutable URLs or text-content guesses as authority.

### Command-surface bounds

CMP-3.12 adds explicit per-argument and whole-argv byte ceilings on top of CMP-3.4's existing empty/NUL rejection and direct argv execution.

This bounds pathological engine/argument surfaces while preserving legitimate canonical argv semantics.

### Digest-bound deny policy

Operators may locally deny exact:

- immutable image digests;
- canonical command SHA-256 values.

No content scanner or malware-classification claim is fabricated.

### Runtime abuse observation

The guard can record these existing bounded runtime signals as **local security violations**:

- timeout;
- output truncation/output-limit abuse;
- sandbox failure/interruption.

These are containment signals only. They do not establish malicious intent, correctness failure, slashing eligibility, payment denial or settlement authority.

### Persistent quarantine

Violations are accumulated for one immutable image+command identity.

At the configured threshold, the identity is quarantined locally until a finite deadline.

Private incident records reconstruct the latest per-identity state across worker restart.

A dedicated post-expiry regression proves:

1. a threshold quarantine is enforced;
2. expiry clears local admission blocking;
3. a new post-expiry violation begins a new count;
4. restart reconstructs the latest post-expiry state rather than resurrecting the historical quarantine;
5. the next violation reaches threshold and quarantines again.

### Private incident evidence

Security incidents are atomically persisted under:

`<stateDir>/security-incidents/`

Properties:

- directory `0700`;
- files `0600`;
- regular-file/symlink/permission checks on recovery;
- schema validation;
- immutable image digest;
- command hash;
- authorization/attempt references;
- local reason/count/quarantine time;
- `authoritative=false`.

Records contain no raw command argv, raw work-unit bytes, stdout/stderr, customer input/output, credential or private key.

Malformed or unsafe persisted state fails guard construction rather than being ignored.

### Protected execution and resume

`ProtectedExecutionLifecycle` wraps both:

- fresh `Execute`;
- checkpoint `Resume`.

Both resolve canonical execution authorization and run local malicious-workload preflight **before** entering the inner execution/checkpoint path.

Dedicated adversarial tests prove denied fresh execution and denied resume never reach sandbox execution; denied resume is rejected before checkpoint access.

### OCI sandbox hardening

CMP-3.12 adds to the retained CMP-3.4 sandbox:

- `--ipc none`;
- `--ulimit core=0:0`;
- `--ulimit nofile=1024:1024`.

All prior mandatory controls remain:

- network `none`;
- read-only root;
- all capabilities dropped;
- no-new-privileges;
- non-root UID/GID;
- PID limit;
- memory limit;
- CPU limit;
- bounded noexec/nosuid/nodev tmpfs;
- timeout;
- bounded diagnostic output;
- no host mounts/devices/PID/IPC exposure.

### Operator CLI

`node420-compute` validates:

- `--max-command-bytes`;
- `--max-argument-bytes`;
- `--max-workload-violations`;
- `--workload-quarantine`;
- repeatable `--deny-image`;
- repeatable `--deny-command-sha256`.

The CLI validation surface does not claim the standby daemon is a live scheduler or malware service.

### CI efficiency repair

The Compute Worker Fast workflow gained same-branch concurrency:

- group: `compute-worker-fast-${{ github.head_ref || github.ref_name }}`;
- `cancel-in-progress: true`.

This cancels superseded Fast runs after later branch revisions, reducing redundant runner work while preserving exact-head qualification for the newest candidate.

The final PR-triggered Fast run is the authoritative evidence. The same-SHA push run #312 was cancelled by this policy and is **not** counted as passing evidence.

## Adversarial/security coverage

Committed tests cover:

- invalid malicious-workload policy bounds;
- canonical image substitution rejection;
- canonical command substitution rejection;
- single-argument byte ceiling;
- total command byte ceiling;
- immutable image denylist;
- command-hash denylist;
- repeated abuse quarantine;
- restart-persistent quarantine;
- post-expiry latest-state recovery;
- private non-authoritative payload-free incident evidence;
- tampered incident-state fail-closed startup;
- denied fresh execution before sandbox;
- denied resume before checkpoint/sandbox;
- output-abuse observation/quarantine;
- explicit IPC/core/nofile sandbox hardening;
- retained CMP-3.4 network/capability/PID/resource isolation.

## Superseded qualification history

### `30b2323fad31426d98950c051a2ae2c7d1e56221`

Compute Worker Fast Qualification #292 / run `37263882446` failed during `go test ./compute/worker`.

Exact diagnosis: **test compile defect** in `malicious_workload_test.go`; the security-incident test bound a `lifecycle` fixture variable that it did not use.

The unused binding was removed. No production semantics or safety assertion was weakened.

Because tests changed, that SHA is not qualification evidence.

### Intermediate quarantine recovery review

Before final qualification, restart recovery was changed from historical maximum-count reconstruction to **latest-incident reconstruction**. A dedicated post-expiry regression was added so old expired quarantine state cannot incorrectly dominate newer state after restart.

Those changes moved the implementation SHA and were requalified rather than being treated as evidence-only.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**.

- Workflow run number: **#313**
- Run ID: `37264388818`
- Job ID: `111618008159`
- Exact implementation/spec/workflow SHA: `691d6296756281bc8424c17d4ad8597bf0a034b6`
- Result: **SUCCESS**

Passing exact-head steps:

- checkout exact qualification head — PASS;
- verify exact qualification head — PASS;
- setup Go/Python — PASS;
- full worker runtime tests — PASS;
- `node420-compute` tests — PASS;
- Go vet — PASS;
- worker command build — PASS;
- real Docker CMP-3.4 sandbox integration — PASS;
- real Docker CMP-3.7 checkpoint/resume integration — PASS;
- real Docker CMP-3.8 result commitment integration — PASS;
- CMP-3.1 verifier — PASS;
- CMP-3.2 verifier — PASS;
- CMP-3.3 verifier — PASS;
- CMP-3.4 verifier — PASS;
- CMP-3.5 verifier — PASS;
- CMP-3.6 verifier — PASS;
- CMP-3.7 verifier — PASS;
- CMP-3.8 verifier — PASS;
- CMP-3.9 verifier — PASS;
- CMP-3.10 verifier — PASS;
- CMP-3.11 verifier — PASS;
- CMP-3.12 malicious-workload verifier — PASS.

No required CMP-3.12 Level 1 check was skipped, cancelled, missing, stale or substituted.

## Level 2 status

Compute Worker Integration Qualification **#106** on the exact qualified SHA completed **SKIPPED** because no `cmp-worker-level2` milestone label was present.

That skip is expected and is **not counted as passing evidence**.

CMP-3.12 changes only the worker-local security boundary and app-specific CI. It does not introduce a shared contract, canonical protocol transition, cross-component deployment, or new authority. Level 2 is therefore not required.

## Broad workflow disclosure

Broad workflows are not CMP-3.12 Level 1 owners.

`420Docs Qualification #5331` failed. Exact log inspection shows the only failure is unchanged pre-existing Arbitration orphan-navigation debt:

- `docs/apps/arbitration/deployment-operations.md`;
- `docs/apps/arbitration/threat-model.md`.

CMP-3.12 documentation passed the preceding governed documentation checks, including internal links.

Other broad workflows that were queued or in progress at closeout are not promoted to CMP-3.12 passing evidence.

## Exit-criterion disposition

1. Versioned/bounded local malicious-workload policy — **PASS**.
2. Preflight validates canonical execution authorization and sandbox request — **PASS**.
3. Immutable image exactly matches canonical authorization — **PASS**.
4. Recomputed command SHA-256 exactly matches canonical authorization — **PASS**.
5. Total argv bytes bounded — **PASS**.
6. Single argument bytes bounded — **PASS**.
7. Exact image-digest deny policy fails closed — **PASS**.
8. Exact command-digest deny policy fails closed — **PASS**.
9. Timeout can produce local violation — **PASS**.
10. Output-limit abuse can produce local violation — **PASS**.
11. Sandbox failure/interruption can produce local violation — **PASS**.
12. Violation threshold quarantines exact immutable image+command identity — **PASS**.
13. Quarantine survives worker restart — **PASS**.
14. Expired quarantine clears locally and latest post-expiry state recovers correctly — **PASS**.
15. Incident records private, atomic and non-authoritative — **PASS**.
16. Incident evidence excludes raw command/output/work-unit/private credentials — **PASS**.
17. Malformed/tampered persisted incident state fails closed — **PASS**.
18. Protected fresh execution preflights before sandbox — **PASS**.
19. Protected checkpoint resume uses same preflight/observation boundary — **PASS**.
20. Sandbox explicitly denies shared IPC — **PASS**.
21. Sandbox disables core dumps — **PASS**.
22. Sandbox bounds file descriptors — **PASS**.
23. Prior CMP-3.4 mandatory isolation remains intact — **PASS**.
24. Operator CLI validates complete CMP-3.12 local policy surface — **PASS**.
25. Local detection/quarantine gains no canonical job/correctness/slashing/payment/settlement authority — **PASS**.
26. CMP-3.1 through CMP-3.11 regressions green — **PASS**.
27. CMP-3.12 mechanical verifier — **PASS**.
28. Exact-head Compute Worker Fast Qualification — **PASS**.

## Explicit limitations / intentionally deferred

CMP-3.12 does **not** claim:

- antivirus/EDR integration;
- malware signature databases;
- archive/decompression scanning;
- container-layer vulnerability scanning;
- signed-image provenance beyond immutable executable digest binding;
- behavioral malware classification;
- eBPF/kernel detection;
- custom seccomp/AppArmor profile management;
- canonical slashing/dispute/correctness authority;
- Windows/macOS packaging/security adapters;
- a live deployed worker fleet.

CMP-3.13 owns Windows/Linux/macOS packaging and platform integration.

CMP-3.14 owns complete current-main reconciliation and Level 3 app-phase closeout.

## Evidence-only closeout rule

Commits after the exact qualified implementation/spec/workflow SHA modify only durable evidence/status bookkeeping. They change no executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, generated/runtime artifacts or substantive requirements. They therefore reference the exact qualified SHA without recursive Level 1 qualification.

## Post-closeout exact-head confirmation

After the original implementation qualification and evidence-only closeout, the branch advanced only through documentation/evidence commits:

- original qualified implementation/spec/workflow SHA: `691d6296756281bc8424c17d4ad8597bf0a034b6`;
- later evidence-only HEAD confirmed: `cd00caca2c80b44c2b1e80520f7955e471968fdb`;
- diff from the original qualified SHA to that confirmation SHA changes only:
  - `docs/compute-market/CMP-3.12-MALICIOUS-WORKLOAD-PROTECTIONS.md`;
  - `docs/compute-market/CMP-3.12-QUALIFICATION-EVIDENCE.md`;
  - `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

No executable source, tests, workflows, dependencies, configuration, interfaces, deployment state or generated/runtime artifacts changed in those four commits.

Even though recursive qualification was not required by the evidence-only rule, the evidence-only HEAD itself subsequently passed the complete required fast suite:

- Compute Worker Fast Qualification **#321**;
- run ID: `37265054068`;
- job ID: `111619987237`;
- exact checked SHA: `cd00caca2c80b44c2b1e80520f7955e471968fdb`;
- result: **SUCCESS**.

That exact-head confirmation again passed worker tests, command tests, Go vet/build, real Docker sandbox/checkpoint/result regressions, all CMP-3.1–CMP-3.11 retained verifiers, and the CMP-3.12 malicious-workload verifier.

Compute Worker Integration Qualification **#110** on the same evidence-only HEAD completed **SKIPPED** because no Level 2 milestone label was present. That skip remains expected and is not counted as passing evidence.

Current-main refresh at post-closeout confirmation:

- current `main`: `5367722febee6e5df18b1c0c45a142c59ea9f905`;
- branch divergence: **206 ahead / 306 behind**;
- merge base remains `2280fb6f9915b849560d9d4d5a95d999c4adc669`;
- CMP-0.4 signed execution manifest blob remains identical between current main and branch;
- system trust-boundary model blob remains identical between current main and branch.

Therefore no controlling CMP-3.12 dependency drift was introduced by newer main history; accumulated reconciliation remains CMP-3.14 Level 3 work.

420Docs Qualification **#5335** on `cd00caca...` failed only at the unchanged pre-existing Arbitration orphan-navigation check for:

- `docs/apps/arbitration/deployment-operations.md`;
- `docs/apps/arbitration/threat-model.md`.

CMP-3.12 documentation passed the preceding documentation checks, including internal links. This broad failure remains unrelated to the CMP-3.12 Level 1 gate.

## Formal status

**CMP-3.12 — Malicious workload protections: COMPLETE, with post-closeout exact-head confirmation on `cd00caca2c80b44c2b1e80520f7955e471968fdb`.**

Next canonical step: **CMP-3.13 — Windows/Linux/macOS packaging**.
