#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sandbox = ROOT / "compute/worker/sandbox.go"
tests = ROOT / "compute/worker/sandbox_test.go"
integration = ROOT / "compute/worker/sandbox_integration_test.go"
probe = ROOT / "compute/worker/testdata/sandboxprobe/main.go"
doc = ROOT / "docs/compute-market/CMP-3.4-SECURE-WORKLOAD-SANDBOX.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for path in [sandbox, tests, integration, probe, doc, roadmap, workflow]:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

s = sandbox.read_text()
t = tests.read_text()
i = integration.read_text()
p = probe.read_text()
d = doc.read_text()
r = roadmap.read_text()
w = workflow.read_text()

required_impl = [
    "type SandboxPolicy struct",
    "type SandboxRequest struct",
    "type SandboxResult struct",
    "type CommandRunner interface",
    "type OSCommandRunner struct",
    "exec.CommandContext",
    "DefaultSandboxPolicy",
    "ValidateSandboxRequest",
    "NewSandbox",
    'p.Engine != "docker" && p.Engine != "podman"',
    '"--network", "none"',
    '"--read-only"',
    '"--cap-drop", "ALL"',
    '"--security-opt", "no-new-privileges"',
    '"--pids-limit"',
    '"--memory"',
    '"--cpus"',
    '"--user"',
    '"/tmp:rw,noexec,nosuid,nodev,size="',
    '"rm", "-f", name',
    "newLimitedBuffer",
]
for token in required_impl:
    if token not in s:
        errors.append(f"missing sandbox implementation token: {token}")

for forbidden in [
    '"--privileged"',
    '"--device"',
    '"--volume"',
    '"--mount"',
    '"host"',
    "syscall.Exec",
]:
    if forbidden in s:
        errors.append(f"sandbox implementation contains forbidden host-escape surface: {forbidden}")

for token in [
    "TestSandboxPolicyMandatoryControlsFailClosed",
    "TestSandboxRejectsUnpinnedOrMutableImages",
    "TestSandboxCommandHasMandatoryIsolationFlagsAndNoHostMounts",
    "TestSandboxArgumentsDoNotUseShellInterpolation",
    "TestSandboxTimeoutTriggersBestEffortForcedCleanup",
    "TestSandboxOutputIsBounded",
    "TestSandboxRejectsNULAndEmptyCommands",
    "TestSandboxRunnerFailureIsVisible",
]:
    if token not in t:
        errors.append(f"missing CMP-3.4 unit/adversarial test: {token}")

for token in [
    "TestSandboxDockerIntegration",
    "CMP_SANDBOX_INTEGRATION_IMAGE",
    "OSCommandRunner{}",
    "cmp-sandbox-probe-ok",
]:
    if token not in i:
        errors.append(f"missing real Docker integration token: {token}")

for token in [
    "os.Geteuid() == 0",
    'os.WriteFile("/cmp-host-root-write"',
    'os.WriteFile("/tmp/cmp-sandbox-probe"',
    '"NoNewPrivs:\\t1"',
    '"CapEff:"',
    'net.DialTimeout("tcp", "1.1.1.1:53"',
    "cmp-sandbox-probe-ok",
]:
    if token not in p:
        errors.append(f"sandbox probe missing isolation assertion: {token}")

for path in list((ROOT / "compute/worker").glob("*.go")) + list((ROOT / "execution/cmd/node420-compute").glob("*.go")):
    text = path.read_text()
    if ("exec.Command(" in text or "exec.CommandContext(" in text) and path.name != "sandbox.go":
        errors.append(f"unrestricted OS command path outside sandbox backend: {path.relative_to(ROOT)}")

for token in [
    "Build local CMP-3.4 sandbox probe image",
    "FROM scratch",
    "docker build --network=none",
    "docker image inspect",
    "CMP_SANDBOX_INTEGRATION_IMAGE",
    "Test real Docker sandbox isolation",
    "TestSandboxDockerIntegration",
    "verify-cmp-3-1-worker-daemon.py",
    "verify-cmp-3-2-hardware-software-discovery.py",
    "verify-cmp-3-3-benchmarking-capability-evidence.py",
    "verify-cmp-3-4-secure-workload-sandbox.py",
]:
    if token not in w:
        errors.append(f"Compute Worker fast workflow missing CMP-3.4 coverage: {token}")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in d
):
    errors.append("CMP-3.4 documentation status drift")
if "Next canonical step: **CMP-3.5 — Content-addressed work-unit download**." not in d:
    errors.append("CMP-3.4 next-step boundary drift")
if "## CMP-3.4 — Secure workload sandbox" not in r:
    errors.append("canonical CMP-3.4 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in r
    and "COMPLETE — Level 1 exact-head qualified" not in r
):
    errors.append("CMP-3.4 roadmap status missing or stale")

if errors:
    print("CMP-3.4 secure workload sandbox verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.4 secure workload sandbox: mechanically consistent")
