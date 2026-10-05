# CMP-3.11 — Local resource controls

Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**

## Canonical definition

**Local resource controls.**

The canonical roadmap requires exactly: **CPU/GPU percentage, idle-only mode, thermal ceilings, bandwidth and schedule controls.**

CMP-3.11 adds operator-local controls without changing canonical ComputeMarket authority. It composes with CMP-3.4 sandboxing, CMP-3.5 downloads, CMP-3.6/3.7 execution, and CMP-3.10 uploads.

## Security boundary

Local resource policy may narrow whether/how a worker participates, but cannot:

- create or mutate a canonical job/attempt;
- change payer/provider/beneficiary/economics;
- claim result correctness;
- create payment/settlement authority;
- weaken CMP-3.4 isolation;
- expose GPU devices without an enforcement backend;
- turn missing telemetry into permission to run.

Missing required telemetry or enforcement capability fails closed.

## LocalResourcePolicy

`420-compute-worker-local-resource-policy-v1` binds:

- CPU percentage `(0,100]`;
- GPU percentage `[0,100]`;
- idle-only flag;
- idle CPU threshold and minimum continuous idle duration;
- CPU thermal ceiling;
- GPU thermal ceiling;
- bandwidth bytes/second and burst;
- IANA timezone;
- repeatable weekly schedule windows;
- telemetry polling interval.

Invalid percentages, temperatures, byte-rate pairs, timezones, windows or polling intervals are rejected.

## CPU percentage

CMP-3.4 already enforces an OCI `--cpus` limit.

`ApplyLocalResourcePolicy` converts the operator percentage into an absolute quota using the local logical CPU count, clamps only to the already-qualified sandbox bound, and preserves every other mandatory sandbox control.

`NewControlledExecutionLifecycle` applies this hard quota automatically. A caller cannot construct the controlled lifecycle while silently leaving the old CPU quota unchanged.

## GPU percentage

Generic Docker/Podman does not provide a portable trustworthy GPU-percentage limit.

CMP-3.11 therefore defines `GPUShareEnforcer`. If `GPUPercent > 0`, construction fails unless a qualified platform-specific enforcer is supplied. Admission then acquires an explicit GPU-share lease for the exact percentage and releases it when execution ends.

This is deliberately fail-closed. CMP-3.11 does not pretend that an environment variable, telemetry reading or unrestricted `--gpus all` device mapping is a hard percentage control.

Platform packaging/backends remain CMP-3.13 work.

## Idle-only mode

Idle-only admission requires known CPU-utilization telemetry and a configured low-utilization threshold.

If the probe supplies a trusted idle duration it is used directly. Otherwise the controller tracks continuous low-utilization time itself across admission checks. Any busy sample resets the idle timer.

Missing CPU utilization never counts as idle.

## Thermal ceilings

CPU and GPU thermal ceilings are checked before admission and continuously while a controlled execution lease is active.

If a configured ceiling is reached, the resource lease cancels its execution context. Missing required thermal telemetry fails closed rather than assuming a safe temperature.

## Schedule controls

Weekly windows are evaluated in the configured IANA timezone.

Operator CLI syntax is strict: `DDD@HH:MM-HH:MM`, for example `Mon@18:00-23:00`.

Outside every configured window, admission is rejected. With no windows, schedule admission is unrestricted.

## Bandwidth control

`ByteRateLimiter` implements deterministic byte-rate shaping with a configured burst.

The same limiter can be shared across worker I/O paths to provide an aggregate local ceiling.

CMP-3.11 wires bandwidth limiting into:

- HTTPS work-unit download reads;
- result/evidence upload reads.

Cancellation interrupts throttled I/O. The limiter does not alter bytes or content commitments.

## Linux host telemetry

`LinuxHostResourceProbe` uses only local `/proc`, sysfs and device presence. It does not shell out.

It provides:

- logical CPU count;
- aggregate CPU utilization from `/proc/stat` deltas;
- CPU/host thermal readings from thermal/hwmon sysfs;
- GPU thermal readings from recognized GPU hwmon names;
- GPU presence from recognized hwmon/device nodes.

The first CPU sample does not fabricate utilization because no delta exists yet.

Other platforms may return unavailable telemetry until CMP-3.13 supplies qualified packaging/platform adapters.

## Continuous execution guard

`ControlledExecutionLifecycle` wraps both fresh execution and checkpoint resume.

Before execution it acquires the local resource lease. While execution is active, the controller periodically rechecks schedule, idle/thermal policy and GPU availability. A violation cancels the inner lifecycle context, while canonical protocol state remains untouched.

## Operator CLI

`node420-compute` now exposes:

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

The existing `--check` path validates this resource policy along with worker identity/configuration.

## Adversarial coverage

Tests cover:

- invalid CPU/GPU percentages;
- invalid idle/thermal/bandwidth/schedule policy;
- CPU percentage -> actual OCI `--cpus` argument;
- controlled lifecycle automatic CPU quota application;
- timezone/week-window admission;
- strict schedule parsing;
- idle-only busy rejection and continuous-idle timer reset;
- missing telemetry fail-closed behavior;
- CPU thermal admission rejection;
- continuous thermal cancellation;
- GPU percentage rejection without a qualified enforcer;
- exact GPU percentage lease acquisition/release;
- deterministic bandwidth throttling and cancellation;
- real downloader bandwidth integration;
- result/evidence uploader bandwidth integration;
- Linux CPU/thermal/GPU telemetry fixtures without host command execution.

## Qualification model

CMP-3.11 is an **ordinary Level 1 app-scoped step**.

It is runtime/security-significant but changes no shared protocol authority, contract, deployment or canonical lifecycle. The app-specific fast workflow is the required owner.

Level 2 is not required unless later repository evidence introduces a concrete cross-component resource-control milestone.

Level 3 remains CMP-3.14.

## Exit criteria

CMP-3.11 is complete only when one exact implementation/spec SHA proves:

1. CPU percentage is bounded and automatically applied as a hard sandbox CPU quota;
2. GPU percentage is bounded and cannot run without an explicit qualified share enforcer;
3. GPU share leases use the exact configured percentage and are released;
4. idle-only mode requires known utilization and minimum continuous idle duration;
5. a busy sample resets local idle eligibility;
6. configured CPU thermal ceiling fails closed before execution;
7. configured GPU thermal ceiling/GPU presence fail closed when unavailable or exceeded;
8. thermal/schedule/resource violations can cancel an active execution lease;
9. weekly schedule windows are strict, timezone-aware and fail closed outside allowed periods;
10. bandwidth rate/burst policy is bounded and internally consistent;
11. bandwidth limiting is applied to work-unit download bytes;
12. bandwidth limiting is applied to result/evidence upload bytes;
13. bandwidth cancellation fails closed without changing payload bytes/commitments;
14. Linux telemetry uses `/proc`/sysfs/device discovery without host-shell execution;
15. first CPU sample never fabricates utilization;
16. controlled fresh execution and resume both use the same resource guard;
17. CMP-3.4 mandatory sandbox isolation remains intact;
18. operator CLI exposes and validates all canonical CMP-3.11 control classes;
19. no local resource policy gains canonical job/correctness/payment/settlement authority;
20. CMP-3.1 through CMP-3.10 regressions remain green;
21. CMP-3.11 mechanical verifier passes;
22. exact-head Compute Worker Fast Qualification passes.

## Intentionally deferred

- platform-specific production GPU share backends and service packaging;
- Windows/macOS telemetry implementations;
- platform install/service integration;
- malicious workload protections beyond resource limits (CMP-3.12);
- full platform packaging qualification (CMP-3.13);
- current-main reconciliation and Level 3 closeout (CMP-3.14).

No GPU hardware, platform adapter or live deployment is claimed where repository evidence does not exist.

Next canonical step: **CMP-3.12 — Malicious workload protections**.