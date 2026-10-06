#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
checkpoint = ROOT / "compute/worker/checkpoint.go"
tests = ROOT / "compute/worker/checkpoint_test.go"
resume_tests = ROOT / "compute/worker/checkpoint_resume_test.go"
integration = ROOT / "compute/worker/checkpoint_integration_test.go"
probe = ROOT / "compute/worker/testdata/checkpointprobe/main.go"
lifecycle = ROOT / "compute/worker/lifecycle.go"
doc = ROOT / "docs/compute-market/CMP-3.7-CHECKPOINTING-RESUME.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
fast = ROOT / ".github/workflows/compute-worker-fast.yml"
integration_wf = ROOT / ".github/workflows/compute-worker-integration.yml"

errors = []
for path in [checkpoint, tests, resume_tests, integration, probe, lifecycle, doc, roadmap, fast, integration_wf]:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

c = checkpoint.read_text()
t = tests.read_text()
rt = resume_tests.read_text()
it = integration.read_text()
p = probe.read_text()
l = lifecycle.read_text()
d = doc.read_text()
r = roadmap.read_text()
f = fast.read_text()
iw = integration_wf.read_text()

for token in [
    "CheckpointSchemaV1",
    'ResumeInputMagicV1      = "CMP420R1"',
    "type CheckpointMetadata struct",
    "AuthorizationCommitment",
    "CheckpointCommitment",
    "type CheckpointStore struct",
    "NewCheckpointStore",
    "func (s *CheckpointStore) Save",
    "func (s *CheckpointStore) LoadLatest",
    "func (s *CheckpointStore) OpenVerified",
    "sha256.New()",
    "io.LimitReader(payload, int64(s.maxBytes)+1)",
    "sequence != latest.Sequence+1",
    "os.CreateTemp",
    "tmp.Chmod(0o600)",
    "syncDirectory",
    "NewResumeInput",
    "ParseResumeInput",
]:
    if token not in c:
        errors.append(f"missing CMP-3.7 checkpoint implementation token: {token}")

for token in [
    'ExecutionResuming    ExecutionStatus = "resuming"',
    "func (l *ExecutionLifecycle) Resume",
    "record.Status != ExecutionInterrupted",
    "checkpoints.LoadLatest",
    "checkpoints.OpenVerified",
    "NewResumeInput(",
    "resume-authorization-expired",
    "resume-process-exited",
    "record.Status != ExecutionPrepared && record.Status != ExecutionResuming && record.Status != ExecutionRunning",
]:
    if token not in l:
        errors.append(f"missing CMP-3.7 lifecycle resume token: {token}")

for forbidden in [
    "exec.Command(",
    "exec.CommandContext(",
    "--privileged",
    "--volume",
    "--mount",
    "--device",
]:
    if forbidden in c:
        errors.append(f"checkpoint layer crosses host-execution boundary: {forbidden}")

for token in [
    "TestCheckpointStorePersistsContentAddressedPrivateState",
    "TestCheckpointSequenceIsStrictlyMonotonic",
    "TestCheckpointStoreRejectsOversizeEmptyAndTamperedPayload",
    "TestCheckpointStoreRejectsCrossAttemptOrExpiredAuthorization",
    "TestCheckpointStoreRejectsSymlinkPayloadAndMetadata",
    "TestResumeInputRoundTripAndBounds",
    "TestOpenVerifiedCheckpointReturnsExactBytes",
]:
    if token not in t:
        errors.append(f"missing checkpoint store test: {token}")

for token in [
    "TestExecutionResumeUsesExactVerifiedCheckpointAndWorkUnit",
    "TestExecutionResumeRejectsTerminalOrLiveLocalStates",
    "TestExecutionResumeRejectsTamperedCheckpointBeforeSandbox",
    "TestExecutionResumeRejectsTamperedWorkUnitBeforeSandbox",
    "TestExecutionResumeRequiresLiveSameCanonicalAuthorization",
    "TestExecutionResumeCancellationPersistsCancellation",
    "TestRestartDuringResumingReturnsToInterrupted",
]:
    if token not in rt:
        errors.append(f"missing checkpoint resume test: {token}")

for token in [
    "TestCheckpointResumeDockerIntegration",
    "CMP_CHECKPOINT_INTEGRATION_IMAGE",
    "lifecycle.Resume",
    "ErrAttemptReplay",
]:
    if token not in it:
        errors.append(f"missing real checkpoint integration token: {token}")

for token in [
    'const magic = "CMP420R1"',
    "binary.Read",
    "sha256.Sum256(work)",
    "sha256.Sum256(checkpoint)",
    "cmp-checkpoint-resume-ok",
]:
    if token not in p:
        errors.append(f"checkpoint probe missing resume assertion: {token}")

for token in [
    "Build local CMP-3.7 checkpoint resume probe image",
    "CMP_CHECKPOINT_INTEGRATION_IMAGE",
    "Test real Docker checkpoint resume",
    "TestCheckpointResumeDockerIntegration",
    "verify-cmp-3-1-worker-daemon.py",
    "verify-cmp-3-2-hardware-software-discovery.py",
    "verify-cmp-3-3-benchmarking-capability-evidence.py",
    "verify-cmp-3-4-secure-workload-sandbox.py",
    "verify-cmp-3-5-content-addressed-work-unit-download.py",
    "verify-cmp-3-6-execution-lifecycle.py",
    "verify-cmp-3-7-checkpointing-resume.py",
]:
    if token not in f:
        errors.append(f"Compute Worker fast workflow missing CMP-3.7 coverage: {token}")

if "cmp-worker-level2" not in iw or "contains(github.event.pull_request.labels.*.name" not in iw:
    errors.append("Level 2 worker workflow is not milestone-gated")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in d
):
    errors.append("CMP-3.7 documentation status drift")
if "Next canonical step: **CMP-3.8 — Result commitment**." not in d:
    errors.append("CMP-3.7 next-step boundary drift")
if "## CMP-3.7 — Checkpointing/resume" not in r:
    errors.append("canonical CMP-3.7 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in r
    and "COMPLETE — Level 1 exact-head qualified" not in r
):
    errors.append("CMP-3.7 roadmap status missing or stale")

if errors:
    print("CMP-3.7 checkpointing/resume verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.7 checkpointing/resume: mechanically consistent")
