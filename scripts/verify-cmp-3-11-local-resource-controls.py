#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
controls = ROOT / "compute/worker/resource_controls.go"
probe = ROOT / "compute/worker/resource_probe_linux.go"
tests = ROOT / "compute/worker/resource_controls_test.go"
sandbox = ROOT / "compute/worker/sandbox.go"
download = ROOT / "compute/worker/download.go"
upload = ROOT / "compute/worker/upload.go"
main = ROOT / "execution/cmd/node420-compute/main.go"
doc = ROOT / "docs/compute-market/CMP-3.11-LOCAL-RESOURCE-CONTROLS.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for p in [controls, probe, tests, sandbox, download, upload, main, doc, roadmap, workflow]:
    if not p.is_file():
        errors.append(f"missing {p.relative_to(ROOT)}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

c = controls.read_text()
p = probe.read_text()
t = tests.read_text()
s = sandbox.read_text()
d = download.read_text()
u = upload.read_text()
m = main.read_text()
doc_text = doc.read_text()
rm = roadmap.read_text()
w = workflow.read_text()

for token in [
    "LocalResourcePolicySchemaV1",
    "type LocalResourcePolicy struct",
    "CPUPercent",
    "GPUPercent",
    "IdleOnly",
    "MaxCPUTemperatureC",
    "MaxGPUTemperatureC",
    "BandwidthBytesPerSecond",
    "ScheduleWindow",
    "ParseScheduleWindow",
    "GPUShareEnforcer",
    "NewLocalResourceController",
    "ApplyLocalResourcePolicy",
    "NewControlledExecutionLifecycle",
    "ControlledExecutionLifecycle) Execute",
    "ControlledExecutionLifecycle) Resume",
    "ByteRateLimiter",
    "ResourceBandwidthLimiter",
]:
    if token not in c:
        errors.append(f"missing resource-control token: {token}")

for token in [
    'base.CPUs = cpus',
    'c.gpu.Acquire(parent, c.policy.GPUPercent)',
    'snapshot.CPUTemperatureC >= c.policy.MaxCPUTemperatureC',
    'snapshot.GPUTemperatureC >= c.policy.MaxGPUTemperatureC',
    'snapshot.CPUUtilizationPercent > c.policy.IdleCPUThresholdPercent',
    'lease.cancel()',
]:
    if token not in c:
        errors.append(f"missing enforcement token: {token}")

for token in [
    "LinuxHostResourceProbe",
    "/proc/stat",
    "/sys/class/thermal",
    "/sys/class/hwmon",
    "readCPUTimes",
    "CPUUtilizationKnown",
    "GPUTemperatureKnown",
    "gpuDevicePresent",
]:
    if token not in p:
        errors.append(f"missing Linux telemetry token: {token}")

for forbidden in ["exec.Command(", "exec.CommandContext(", "os/exec"]:
    if forbidden in c or forbidden in p:
        errors.append(f"resource controls introduced forbidden host command path: {forbidden}")

for token in [
    "NewWorkUnitDownloaderWithBandwidth",
    "d.bandwidth.WrapReader(ctx, body)",
]:
    if token not in d:
        errors.append(f"download bandwidth integration missing: {token}")

for token in [
    "NewResultEvidenceUploaderWithBandwidth",
    "u.bandwidth.WrapReader(ctx, reader)",
]:
    if token not in u:
        errors.append(f"upload bandwidth integration missing: {token}")

if '"--cpus"' not in s and '"--cpus", ' not in s:
    errors.append("CMP-3.4 sandbox lost hard CPU quota")

for token in [
    '"cpu-percent"',
    '"gpu-percent"',
    '"idle-only"',
    '"idle-cpu-threshold-percent"',
    '"min-idle"',
    '"max-cpu-temp-c"',
    '"max-gpu-temp-c"',
    '"bandwidth-bytes-per-second"',
    '"bandwidth-burst-bytes"',
    '"resource-timezone"',
    '"resource-window"',
    '"resource-poll"',
    "resourcePolicy.Validate()",
]:
    if token not in m:
        errors.append(f"node420-compute missing resource flag/validation: {token}")

for token in [
    "TestLocalResourcePolicyValidation",
    "TestApplyLocalResourcePolicySetsSandboxCPUQuota",
    "TestControlledExecutionLifecycleAutomaticallyAppliesCPUQuota",
    "TestParseScheduleWindow",
    "TestScheduleControlsUseConfiguredTimezone",
    "TestIdleOnlyTracksContinuousLowUtilizationWhenProbeHasNoIdleClock",
    "TestIdleOnlyAndThermalControlsFailClosed",
    "TestGPUPercentageRequiresAndUsesQualifiedEnforcer",
    "TestContinuousThermalMonitorCancelsLease",
    "TestByteRateLimiterDeterministicallyThrottlesReader",
    "TestByteRateLimiterCancellationFailsClosed",
    "TestWorkUnitDownloaderUsesConfiguredBandwidthLimiter",
    "TestResultEvidenceUploaderUsesConfiguredBandwidthLimiter",
    "TestLinuxHostResourceProbeReadsCPUAndThermalsWithoutShell",
]:
    if token not in t:
        errors.append(f"missing CMP-3.11 test: {token}")

if "verify-cmp-3-11-local-resource-controls.py" not in w:
    errors.append("fast workflow does not run CMP-3.11 verifier")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in doc_text
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in doc_text
):
    errors.append("CMP-3.11 documentation status drift")
if "Next canonical step: **CMP-3.12 — Malicious workload protections**." not in doc_text:
    errors.append("CMP-3.11 next-step boundary drift")
if "## CMP-3.11 — Local resource controls" not in rm:
    errors.append("canonical CMP-3.11 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in rm
    and "COMPLETE — Level 1 exact-head qualified" not in rm
):
    errors.append("CMP-3.11 roadmap status missing or stale")

if errors:
    print("CMP-3.11 local resource controls verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.11 local resource controls: mechanically consistent")
