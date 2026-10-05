#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
guard = ROOT / "compute/worker/malicious_workload.go"
tests = ROOT / "compute/worker/malicious_workload_test.go"
sandbox = ROOT / "compute/worker/sandbox.go"
main = ROOT / "execution/cmd/node420-compute/main.go"
doc = ROOT / "docs/compute-market/CMP-3.12-MALICIOUS-WORKLOAD-PROTECTIONS.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for p in [guard, tests, sandbox, main, doc, roadmap, workflow]:
    if not p.is_file():
        errors.append(f"missing {p.relative_to(ROOT)}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

g = guard.read_text()
t = tests.read_text()
s = sandbox.read_text()
m = main.read_text()
d = doc.read_text()
r = roadmap.read_text()
w = workflow.read_text()

for token in [
    "MaliciousWorkloadPolicySchemaV1",
    "SecurityIncidentSchemaV1",
    "type MaliciousWorkloadPolicy struct",
    "MaxCommandBytes",
    "MaxArgumentBytes",
    "MaxViolations",
    "QuarantineDuration",
    "DenyImageDigests",
    "DenyCommandSHA256",
    "NewWorkloadSecurityGuard",
    "recoverState",
    "Preflight",
    "Observe",
    "persistIncident",
    "NewProtectedExecutionLifecycle",
    "ProtectedExecutionLifecycle) Execute",
    "ProtectedExecutionLifecycle) Resume",
]:
    if token not in g:
        errors.append(f"missing CMP-3.12 implementation token: {token}")

for token in [
    "CommandSHA256(request.Command)",
    "commandHash != auth.CommandSHA256",
    "request.Image != auth.SandboxImage",
    "ErrWorkloadQuarantined",
    "Authoritative: false",
    "OutputTruncated",
    "TimedOut",
]:
    if token not in g:
        errors.append(f"missing CMP-3.12 binding/containment token: {token}")

for forbidden in [
    "exec.Command(",
    "exec.CommandContext(",
    "net/http",
    "commitResult(",
    "recordResult(",
    "settlement",
    "slash",
]:
    if forbidden in g:
        errors.append(f"CMP-3.12 crossed forbidden authority/host-command boundary: {forbidden}")

for token in [
    '"--ipc", "none"',
    '"--ulimit", "core=0:0"',
    '"--ulimit", "nofile=1024:1024"',
    '"--network", "none"',
    '"--cap-drop", "ALL"',
    '"--security-opt", "no-new-privileges"',
    '"--pids-limit"',
    '"--memory"',
    '"--cpus"',
]:
    if token not in s:
        errors.append(f"sandbox malicious-workload hardening/isolation missing: {token}")

for token in [
    '"max-command-bytes"',
    '"max-argument-bytes"',
    '"max-workload-violations"',
    '"workload-quarantine"',
    '"deny-image"',
    '"deny-command-sha256"',
    "securityPolicy.Validate()",
]:
    if token not in m:
        errors.append(f"node420-compute missing CMP-3.12 flag/validation: {token}")

for token in [
    "TestMaliciousWorkloadPolicyValidation",
    "TestMaliciousWorkloadPreflightBindsCanonicalImageAndCommand",
    "TestMaliciousWorkloadPreflightEnforcesCommandBoundsAndDenyDigests",
    "TestSecurityGuardQuarantinesRepeatedAbuseAndPersistsAcrossRestart",
    "TestSecurityGuardRecoveryUsesLatestPostExpiryIncidentState",
    "TestSecurityIncidentEvidenceIsPrivateNonAuthoritativeAndPayloadFree",
    "TestSecurityGuardFailsClosedOnTamperedIncidentState",
    "TestProtectedExecutionLifecycleRejectsDeniedWorkloadBeforeSandbox",
    "TestProtectedExecutionLifecycleObservesSandboxAbuse",
    "TestSandboxIncludesMaliciousWorkloadHardeningFlags",
]:
    if token not in t:
        errors.append(f"missing CMP-3.12 test: {token}")

if "verify-cmp-3-12-malicious-workload-protections.py" not in w:
    errors.append("fast workflow does not run CMP-3.12 verifier")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in d
):
    errors.append("CMP-3.12 documentation status drift")
if "Next canonical step: **CMP-3.13 — Windows/Linux/macOS packaging**." not in d:
    errors.append("CMP-3.12 next-step boundary drift")
if "## CMP-3.12 — Malicious workload protections" not in r:
    errors.append("canonical CMP-3.12 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in r
    and "COMPLETE — Level 1 exact-head qualified" not in r
):
    errors.append("CMP-3.12 roadmap status missing or stale")

if errors:
    print("CMP-3.12 malicious workload protections verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.12 malicious workload protections: mechanically consistent")
