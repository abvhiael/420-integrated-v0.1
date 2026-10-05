#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
impl = ROOT / "compute/worker/lifecycle.go"
tests = ROOT / "compute/worker/lifecycle_test.go"
integration = ROOT / "compute/worker/lifecycle_integration_test.go"
sandbox = ROOT / "compute/worker/sandbox.go"
doc = ROOT / "docs/compute-market/CMP-3.6-EXECUTION-LIFECYCLE.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
fast = ROOT / ".github/workflows/compute-worker-fast.yml"
level2 = ROOT / ".github/workflows/compute-worker-integration.yml"

errors=[]
for p in [impl,tests,integration,sandbox,doc,roadmap,fast,level2]:
    if not p.is_file(): errors.append(f"missing {p.relative_to(ROOT)}")
if errors:
    print("\n".join(errors)); sys.exit(1)

s=impl.read_text(); t=tests.read_text(); i=integration.read_text(); sb=sandbox.read_text()
d=doc.read_text(); r=roadmap.read_text(); f=fast.read_text(); l2=level2.read_text()

for token in [
    "ExecutionAuthorizationSchemaV1","type ExecutionAuthorization struct",
    "type CanonicalExecutionAuthority interface","type ExecutionLifecycle struct",
    "ResolveExecutionAuthorization","ValidateExecutionAuthorization",
    "CommandSHA256","openVerifiedArtifact","ExecutionPrepared","ExecutionRunning",
    "ExecutionExited","ExecutionFailed","ExecutionCancelled","ExecutionExpired",
    "ExecutionInterrupted","recoverInterrupted","ErrAttemptReplay","ErrAttemptInProgress",
]:
    if token not in s: errors.append(f"missing lifecycle token: {token}")

for token in [
    "auth.ChainID != id.ChainID","auth.AttemptNonce == 0",
    "plan.Artifact.SchemaVersion != WorkUnitDownloadSchemaV1",
    "plan.Sandbox.Image != auth.SandboxImage","commandHash != auth.CommandSHA256",
    "artifact integrity changed after download","context.WithDeadline",
]:
    if token not in s: errors.append(f"missing authorization/integrity boundary: {token}")

for forbidden in ["exec.Command(","exec.CommandContext(","RESULT_COMMITTED","VERIFIED","SETTLED"]:
    if forbidden in s: errors.append(f"lifecycle crosses canonical/execution boundary: {forbidden}")

for token in [
    "RunWithInput","cmd.Stdin = stdin",'args = append(args, "--interactive")'
]:
    if token not in sb: errors.append(f"sandbox input integration missing: {token}")

for token in [
    "TestExecutionLifecycleRunsVerifiedArtifactThroughSandbox",
    "TestExecutionLifecycleRequiresCanonicalAuthorityAndExactBindings",
    "TestExecutionLifecycleRevalidatesArtifactImmediatelyBeforeRun",
    "TestExecutionLifecycleRejectsExpiredOrInvalidLease",
    "TestExecutionLifecycleDoesNotReplayFinalizedAttempt",
    "TestExecutionLifecycleCancellationPersistsTerminalLocalState",
    "TestExecutionLifecycleRestartMarksRunningAttemptInterrupted",
    "TestExecutionLifecycleFailureIsLocalEvidenceNotCorrectness",
]:
    if token not in t: errors.append(f"missing lifecycle test: {token}")

for token in [
    "TestExecutionLifecycleDockerIntegration","NewWorkUnitDownloader",
    "NewExecutionLifecycle","OSCommandRunner{}","ErrAttemptReplay"
]:
    if token not in i: errors.append(f"missing Level 2 integration token: {token}")

for token in [
    "verify-cmp-3-1-worker-daemon.py","verify-cmp-3-2-hardware-software-discovery.py",
    "verify-cmp-3-3-benchmarking-capability-evidence.py","verify-cmp-3-4-secure-workload-sandbox.py",
    "verify-cmp-3-5-content-addressed-work-unit-download.py","verify-cmp-3-6-execution-lifecycle.py"
]:
    if token not in f: errors.append(f"fast qualification missing regression/verifier: {token}")

for token in [
    "Compute Worker Integration Qualification","Checkout exact qualification head",
    "Verify exact qualification head","CMP_SANDBOX_INTEGRATION_IMAGE",
    "CMP_LIFECYCLE_INTEGRATION_IMAGE","Run retained worker integration suite",
    "go test ./compute/worker -count=1"
]:
    if token not in l2: errors.append(f"Level 2 integration workflow missing: {token}")

if (
    "Status: **IMPLEMENTED / LEVEL 1 + LEVEL 2 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 + Level 2 exact-head qualified" not in d
):
    errors.append("CMP-3.6 documentation status drift")
if "Next canonical step: **CMP-3.7 — Checkpointing/resume**." not in d:
    errors.append("CMP-3.6 next-step drift")
if "## CMP-3.6 — Execution lifecycle" not in r:
    errors.append("canonical CMP-3.6 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 + Level 2 qualification pending" not in r
    and "COMPLETE — Level 1 + Level 2 exact-head qualified" not in r
):
    errors.append("CMP-3.6 roadmap status missing or stale")

if errors:
    print("CMP-3.6 execution lifecycle verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)
print("CMP-3.6 execution lifecycle: mechanically consistent")
