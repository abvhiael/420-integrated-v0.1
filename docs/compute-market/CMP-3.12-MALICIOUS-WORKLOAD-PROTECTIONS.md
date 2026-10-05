# CMP-3.12 — Malicious workload protections

Status: **COMPLETE — Level 1 exact-head qualified on `691d6296756281bc8424c17d4ad8597bf0a034b6`.**

## Canonical definition

**Malicious workload protections.**

The canonical roadmap names this step without prescribing a malware engine, antivirus product, archive scanner or content classifier. Repository authority instead establishes the relevant execution-security boundary through CMP-0.4 signed execution manifests, CMP-3.4 sandbox isolation, CMP-3.6 canonical execution authorization, CMP-3.11 local resource controls and the system trust-boundary model.

CMP-3.12 therefore implements worker-local prevention, detection, containment and restart-safe quarantine for hostile or repeatedly abusive workloads without redefining canonical job authority or correctness.

## Existing protections preserved

CMP-3.12 composes with and does not weaken:

- immutable image digests;
- exact command commitments;
- canonical job/unit/attempt authorization;
- private content-addressed work-unit storage;
- non-root execution;
- read-only root filesystem;
- dropped capabilities;
- no-new-privileges;
- no host mounts/devices;
- network disabled;
- bounded PIDs, memory, CPU, tmpfs, timeout and output;
- local CPU/GPU/thermal/bandwidth/schedule controls.

## Versioned malicious-workload policy

`420-compute-worker-malicious-workload-policy-v1` binds local security policy for:

- maximum total canonical argv bytes;
- maximum single argument bytes;
- maximum local violation count before quarantine;
- quarantine duration;
- immutable image-digest deny entries;
- canonical command-SHA256 deny entries;
- whether timeouts, output-limit abuse and sandbox failures count as local security violations.

Invalid or unbounded policy values fail closed.

## Canonical binding

Preflight always resolves and validates the canonical `ExecutionAuthorization` and existing sandbox request.

The worker recomputes canonical `CommandSHA256(request.Command)` and requires:

- exact match with the canonical authorization command hash;
- exact immutable image match with the canonical authorization image.

Local deny/quarantine state therefore keys on immutable execution identity rather than display names, free-form labels or mutable URLs.

## Command-surface bounds

CMP-3.4 already rejects empty/NUL command arguments and passes argv directly without host-shell interpolation.

CMP-3.12 additionally rejects:

- any argument above the local single-argument byte bound;
- a complete argv above the local command byte bound.

This prevents pathological argument-memory/engine surfaces without forbidding legitimate shell interpreters or attempting unreliable string-based malware classification.

## Digest-bound deny policy

Operators may deny:

- exact immutable image digests;
- exact canonical command SHA-256 values.

The policy does not inspect arbitrary workload text, guess intent, or claim malware classification.

## Runtime abuse observation

After execution the local guard may classify these already-observable worker events as local violations:

- timeout;
- output limit exceeded/truncated;
- sandbox failure/interruption.

These signals are containment evidence only. They do not prove malicious intent, result incorrectness, slashing eligibility, payment denial or protocol fault.

## Persistent quarantine

Violation state is keyed by:

- immutable image digest;
- canonical command SHA-256.

When the configured cumulative violation threshold is reached, that exact local workload identity is quarantined for the configured duration.

Quarantine survives worker restart because private incident records are reconstructed at guard startup.

Once the quarantine duration expires, the local entry is cleared and the workload may be admitted again if all canonical and local policies still pass.

Benign execution does not erase prior abuse history before quarantine expiry.

## Private security evidence

Each observed violation creates a private JSON security incident under:

`<stateDir>/security-incidents/`

Properties:

- directory mode `0700`;
- incident file mode `0600`;
- atomic temp-file + fsync + rename persistence;
- exact authorization reference;
- exact attempt reference;
- immutable image digest;
- canonical command hash;
- local reason;
- observation time;
- local violation count;
- quarantine deadline if reached;
- `authoritative=false`.

The incident record does not persist raw work-unit bytes, raw command arguments, stdout/stderr, private input/output, credentials or keys.

Tampered/malformed/unsafe incident state fails closed during guard startup rather than being ignored.

## Protected execution lifecycle

`ProtectedExecutionLifecycle` wraps both fresh execution and checkpoint resume.

Flow:

1. resolve canonical execution authorization;
2. run malicious-workload preflight;
3. reject denied/quarantined/oversized/mismatched workload before sandbox execution;
4. execute through the existing qualified lifecycle/sandbox;
5. observe bounded runtime security signals;
6. persist local violation evidence/quarantine state.

The wrapper never creates a new attempt, retries implicitly, changes canonical state or bypasses existing lifecycle validation.

## Additional OCI hardening

CMP-3.12 extends the existing sandbox command with:

- `--ipc none` to avoid a shared IPC namespace;
- `--ulimit core=0:0` to disable core dumps;
- `--ulimit nofile=1024:1024` to bound file-descriptor abuse.

All prior CMP-3.4 mandatory controls remain present.

## Operator CLI

`node420-compute` now validates:

- `--max-command-bytes`;
- `--max-argument-bytes`;
- `--max-workload-violations`;
- `--workload-quarantine`;
- repeatable `--deny-image` immutable digest entries;
- repeatable `--deny-command-sha256` entries.

The current daemon remains a standby foundation; CLI validation does not fabricate a live scheduler or production malware service.

## Explicit non-goals

CMP-3.12 does not claim:

- antivirus/EDR integration;
- content-signature databases;
- archive/decompression scanning;
- vulnerability scanning of container layers;
- image provenance/signature verification beyond the already-required immutable executable digest;
- behavioral malware classification;
- kernel eBPF detection;
- seccomp/AppArmor custom-profile management;
- canonical slashing/dispute/correctness decisions;
- platform packaging.

Those capabilities require separately specified implementations and qualification if later adopted.

## Qualification evidence

- Implementation/spec/workflow SHA: `691d6296756281bc8424c17d4ad8597bf0a034b6`
- Compute Worker Fast Qualification: **#313**
- Run ID: `37264388818`
- Job ID: `111618008159`
- Evidence anchor: `279c78a240f5a7223341bf4461978792812b44b3`
- Durable evidence: [CMP-3.12 qualification evidence](CMP-3.12-QUALIFICATION-EVIDENCE.md)
- Level 2: not required; Integration #106 skipped as expected and is not counted as passing evidence.
- Level 3: deferred to CMP-3.14.

## Qualification model

CMP-3.12 is an **ordinary Level 1 app-scoped security step**.

It hardens the local worker and does not alter shared contracts, canonical lifecycle authority, protocol state or a cross-component deployment. Required qualification is the app-specific Compute Worker Fast workflow.

Level 2 is not required at this step.

Level 3 remains CMP-3.14.

## Exit criteria

CMP-3.12 is complete only when one exact implementation/spec/workflow SHA proves:

1. local malicious-workload policy is versioned and bounded;
2. preflight validates canonical execution authorization and sandbox request;
3. immutable image must exactly match canonical authorization;
4. recomputed command SHA-256 must exactly match canonical authorization;
5. total argv bytes are bounded;
6. individual argument bytes are bounded;
7. exact image-digest deny policy fails closed;
8. exact command-digest deny policy fails closed;
9. timeout may produce a local violation;
10. output-limit abuse may produce a local violation;
11. sandbox failure/interruption may produce a local violation;
12. violation threshold quarantines the exact immutable image+command identity;
13. quarantine survives worker restart;
14. expired quarantine clears locally rather than becoming permanent protocol authority;
15. security incident records are private, atomic and non-authoritative;
16. incident evidence stores no raw command/output/work-unit/private credential material;
17. malformed/tampered persisted incident state fails closed;
18. protected fresh execution performs preflight before sandbox execution;
19. protected checkpoint resume performs the same preflight/observation path;
20. sandbox explicitly denies shared IPC;
21. sandbox disables core dumps;
22. sandbox bounds file descriptors;
23. all prior CMP-3.4 mandatory isolation controls remain intact;
24. operator CLI validates the complete CMP-3.12 local policy surface;
25. no local detection/quarantine outcome gains canonical job/correctness/slashing/payment/settlement authority;
26. CMP-3.1 through CMP-3.11 regressions remain green;
27. CMP-3.12 mechanical verifier passes;
28. exact-head Compute Worker Fast Qualification passes.

## Intentionally deferred

- production malware/EDR integrations;
- signed-image provenance systems beyond immutable digest binding;
- platform-specific kernel/security profiles;
- Windows/macOS packaging/security adapters;
- CMP-3.13 packaging;
- CMP-3.14 current-main reconciliation and Level 3 closeout.

Next canonical step: **CMP-3.13 — Windows/Linux/macOS packaging**.