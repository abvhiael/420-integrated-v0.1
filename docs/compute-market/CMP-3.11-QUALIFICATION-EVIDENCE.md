# CMP-3.11 — Local resource controls qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.11 — Local resource controls**
- Canonical scope: **CPU/GPU percentage, idle-only mode, thermal ceilings, bandwidth and schedule controls**
- Qualification level: **Level 1**
- Level 2: **not required**
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation/specification

- Implementation/spec/workflow SHA: `56893c5b814d14138eaafec71f1b784d4b110189`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Current `main` at qualification review: `b3cfd359db5ac84aff6213119475ea3dc770642d`
- Branch divergence at qualification review: **180 ahead / 303 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The accumulated CMP-3 branch remains intentionally unreconciled. Current-main reconciliation and comprehensive exact merge-candidate qualification remain CMP-3.14 Level 3 work.

## Canonical definition and gap closed

The canonical roadmap definition is intentionally terse:

> CPU/GPU percentage, idle-only mode, thermal ceilings, bandwidth and schedule controls.

CMP-3.4 already provided a hard OCI CPU quota and deliberately denied GPU device exposure by default, explicitly deferring operator-configurable GPU/resource policy to CMP-3.11.

Before this step the worker lacked:

- one versioned local resource-policy schema;
- operator CPU-percentage -> sandbox-quota translation;
- an explicit fail-closed GPU-share enforcement boundary;
- idle-only admission;
- continuous thermal/schedule cancellation;
- actual worker download/upload bandwidth shaping;
- concrete host telemetry;
- operator CLI controls for the complete canonical control set.

Those gaps are now implemented.

## Implementation summary

Qualification-relevant files:

- `compute/worker/resource_controls.go`;
- `compute/worker/resource_probe_linux.go`;
- `compute/worker/resource_controls_test.go`;
- `compute/worker/download.go`;
- `compute/worker/upload.go`;
- `execution/cmd/node420-compute/main.go`;
- `scripts/verify-cmp-3-5-content-addressed-work-unit-download.py`;
- `scripts/verify-cmp-3-11-local-resource-controls.py`;
- `.github/workflows/compute-worker-fast.yml`;
- `docs/compute-market/CMP-3.11-LOCAL-RESOURCE-CONTROLS.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

### CPU percentage

`ApplyLocalResourcePolicy` converts the configured CPU percentage into an absolute OCI CPU quota using logical CPU count and the already-qualified CMP-3.4 bound.

`NewControlledExecutionLifecycle` applies that quota automatically to its sandbox before execution, preventing callers from accidentally enabling resource admission checks while omitting the hard CPU quota.

The retained test verifies the resulting production sandbox command contains the expected `--cpus` value.

### GPU percentage

Generic Docker/Podman does not provide a portable trustworthy GPU-percent hard limit.

CMP-3.11 therefore introduces `GPUShareEnforcer`.

If `GPUPercent > 0`:

- controller construction requires a real enforcer;
- admission acquires a lease for the exact configured percentage;
- execution does not proceed if enforcement is unavailable;
- the lease is released at execution completion.

No unrestricted GPU device exposure or advisory-only percentage is silently accepted.

A hardware/platform-specific enforcer remains packaging/platform work under CMP-3.13 and must be independently qualified before claiming a production GPU percentage backend.

### Idle-only

Idle-only mode requires known CPU-utilization telemetry.

The policy binds:

- CPU utilization threshold;
- minimum continuous idle duration.

Where trusted idle-duration telemetry is present it may be used. Otherwise the controller tracks continuous low-utilization time across admission checks. A busy sample resets the local idle timer.

Missing CPU utilization fails closed.

### Thermal ceilings

CPU and GPU ceilings are checked at admission and continuously while a resource lease is active.

Configured missing telemetry fails closed.

Reaching a configured ceiling records a local resource violation and cancels the controlled execution context. It does not mutate canonical protocol state.

### Schedule controls

Schedule windows are:

- weekly;
- timezone-aware through an IANA timezone;
- strict non-overlapping individual `start < end` windows;
- parsed from operator syntax `DDD@HH:MM-HH:MM`.

Outside all configured windows, admission fails closed.

### Bandwidth

`ByteRateLimiter` provides deterministic byte-rate shaping with explicit rate and burst.

CMP-3.11 integrates the limiter into actual:

- work-unit HTTPS downloads;
- result/evidence uploads.

The same limiter can be shared across these paths to enforce one local aggregate worker I/O ceiling.

Cancellation interrupts throttled reads and the limiter does not alter payload bytes or commitments.

### Linux telemetry

`LinuxHostResourceProbe` reads only:

- `/proc/stat`;
- thermal sysfs;
- hwmon sysfs;
- recognized local GPU device presence.

It does not execute host shell commands.

It provides logical CPU count, delta-based aggregate CPU utilization, CPU thermal telemetry, GPU thermal telemetry and GPU presence.

The first CPU sample remains unknown rather than fabricating utilization without a prior counter sample.

### Controlled execution

`ControlledExecutionLifecycle` wraps both:

- fresh `Execute`;
- checkpoint `Resume`.

It acquires local resource policy before the underlying canonical execution lifecycle and monitors the active lease. Resource violations cancel execution locally without acquiring canonical job/correctness/payment authority.

### Operator CLI

`node420-compute` now exposes and validates:

- `--cpu-percent`;
- `--gpu-percent`;
- `--idle-only`;
- `--idle-cpu-threshold-percent`;
- `--min-idle`;
- `--max-cpu-temp-c`;
- `--max-gpu-temp-c`;
- `--bandwidth-bytes-per-second`;
- `--bandwidth-burst-bytes`;
- `--resource-timezone`;
- repeatable `--resource-window`;
- `--resource-poll`.

## Security/adversarial results

Committed tests prove:

- invalid CPU/GPU percentages rejected;
- malformed idle/thermal/bandwidth/schedule policy rejected;
- CPU percentage produces the expected OCI quota;
- controlled lifecycle automatically applies CPU quota;
- timezone/week schedule decisions;
- malformed schedule strings rejected;
- idle-only busy-host rejection;
- continuous low-utilization idle tracking;
- busy sample resets idle eligibility;
- missing thermal/idle telemetry fails closed;
- CPU thermal admission rejection;
- active thermal violation cancels the lease;
- GPU percentage cannot be enabled without a share enforcer;
- exact GPU percentage is supplied to the enforcer and lease release occurs;
- deterministic bandwidth limiting;
- bandwidth cancellation;
- bandwidth is actually wired into downloader bytes;
- bandwidth is actually wired into uploader bytes;
- Linux CPU/thermal/GPU telemetry fixtures;
- no host-shell command path is introduced for resource telemetry.

## Superseded qualification history

### Source checkpoint `bf30e0a5d58da572589e4b2b78e89b0bce5a5869`

Compute Worker Fast Qualification #249 / run `37262036320` failed at the worker test stage.

Root cause was a **test-harness defect**: the TLS test server's HTTP client had `Timeout=0`, while the qualified CMP-3.5 downloader correctly requires every HTTP client to have a finite timeout.

The fixture was corrected to use a bounded timeout. No downloader safety requirement was weakened.

### Source checkpoint `174f37ce761b36799b6bb568ccc94f5d380560da`

Compute Worker Fast Qualification #259 / run `37262214987` passed:

- worker tests;
- real Docker sandbox;
- checkpoint/resume;
- result commitment;
- CMP-3.1 through CMP-3.4 verifiers.

It then failed the retained CMP-3.5 mechanical verifier.

Root cause was a **stale verifier expectation**, not protocol behavior. The verifier hard-coded:

`io.LimitReader(response.Body, ...)`

CMP-3.11 correctly changed the path to:

`response.Body -> bandwidth limiter -> io.LimitReader`

The same exact size bound, digest validation, HTTPS policy, redirect rejection and atomic persistence remain intact.

CMP-3.5's verifier was updated to accept either the original direct-body path or the rate-limited intermediate path while still requiring the response-body path to terminate in the same size bound.

That verifier correction changed workflow-relevant qualification state, so a new exact SHA was qualified.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**.

- Workflow run number: **#272**
- Run ID: `37262445914`
- Job ID: `111612318856`
- Exact SHA: `56893c5b814d14138eaafec71f1b784d4b110189`
- Result: **SUCCESS**

Passing exact-head checks:

- exact-head checkout — PASS;
- exact SHA verification — PASS;
- full compute worker tests — PASS;
- `node420-compute` tests — PASS;
- Go vet — PASS;
- worker build — PASS;
- real Docker CMP-3.4 sandbox regression — PASS;
- real Docker CMP-3.7 checkpoint/resume regression — PASS;
- real Docker CMP-3.8 result-commitment regression — PASS;
- CMP-3.1 verifier — PASS;
- CMP-3.2 verifier — PASS;
- CMP-3.3 verifier — PASS;
- CMP-3.4 verifier — PASS;
- reconciled CMP-3.5 verifier — PASS;
- CMP-3.6 verifier — PASS;
- CMP-3.7 verifier — PASS;
- CMP-3.8 verifier — PASS;
- CMP-3.9 verifier — PASS;
- CMP-3.10 verifier — PASS;
- CMP-3.11 local-resource-controls verifier — PASS.

No required CMP-3.11 Level 1 check was skipped, cancelled, missing, stale or substituted.

## Level 2 status

Compute Worker Integration Qualification #87 on the exact qualified SHA completed **SKIPPED** because the `cmp-worker-level2` milestone label was absent.

That skip is expected and is **not counted as passing evidence**.

CMP-3.11 remains an ordinary app-scoped Level 1 step. It adds no shared protocol authority, shared contract, canonical lifecycle transition or cross-component deployment. A platform-specific GPU backend under CMP-3.13 may create a later integration requirement, but it is not fabricated here.

## Broad workflow disclosure

Broad repository workflows are not CMP-3.11 Level 1 owners under the active phase policy.

`420Docs Qualification #5291` failed. Exact job-log inspection shows the failure is unchanged pre-existing Arbitration orphan-navigation debt:

- `docs/apps/arbitration/deployment-operations.md`;
- `docs/apps/arbitration/threat-model.md`.

CMP-3.11 documentation passed preceding documentation validation including internal links.

Other broad queued/in-progress workflows are not promoted to CMP-3.11 passing evidence.

## Exit-criterion disposition

1. CPU percentage bounded and automatically applied as hard sandbox CPU quota — **PASS**.
2. GPU percentage bounded and unavailable without explicit qualified share enforcer — **PASS**.
3. Exact GPU share percentage acquired/released through lease — **PASS**.
4. Idle-only requires known utilization and minimum continuous idle duration — **PASS**.
5. Busy sample resets local idle eligibility — **PASS**.
6. CPU thermal ceiling fails closed before execution — **PASS**.
7. GPU thermal/presence requirements fail closed when unavailable/exceeded — **PASS**.
8. Active resource/thermal/schedule violations can cancel execution lease — **PASS**.
9. Weekly schedule windows strict/timezone-aware/fail-closed — **PASS**.
10. Bandwidth rate/burst policy bounded and internally consistent — **PASS**.
11. Work-unit download bandwidth limiting wired — **PASS**.
12. Result/evidence upload bandwidth limiting wired — **PASS**.
13. Bandwidth cancellation fail-closed without payload mutation — **PASS**.
14. Linux telemetry uses proc/sysfs/device discovery without host shell — **PASS**.
15. First CPU sample does not fabricate utilization — **PASS**.
16. Controlled fresh execution and resume share resource guard — **PASS**.
17. CMP-3.4 mandatory sandbox isolation remains intact — **PASS**.
18. Operator CLI exposes/validates every canonical control class — **PASS**.
19. Local policy gains no canonical job/correctness/payment/settlement authority — **PASS**.
20. CMP-3.1 through CMP-3.10 regressions green — **PASS**.
21. CMP-3.11 mechanical verifier — **PASS**.
22. Exact-head Compute Worker Fast Qualification — **PASS**.

## Intentionally deferred / limitations

- No production hardware-specific GPU percentage backend is claimed. A nonzero GPU percentage requires a separately supplied qualified `GPUShareEnforcer` and otherwise fails closed.
- Windows/macOS host telemetry and platform service integration remain CMP-3.13.
- CMP-3.12 owns broader malicious-workload protections beyond resource ceilings.
- CMP-3.13 owns Windows/Linux/macOS packaging and platform-specific backend qualification.
- CMP-3.14 owns current-main reconciliation and comprehensive Level 3 phase closeout.
- No live/testnet GPU hardware, platform service, deployment or operational evidence is fabricated.

## Evidence-only closeout rule

Commits after the exact qualified SHA change only durable evidence/status bookkeeping. They do not change executable code, tests, workflows, dependencies, configuration, interfaces, deployment state, generated/runtime artifacts or substantive requirements. They therefore reference the exact qualified implementation/spec/workflow SHA without recursive qualification.

## Formal status

**CMP-3.11 — Local resource controls: COMPLETE.**

Next canonical step: **CMP-3.12 — Malicious workload protections**.
