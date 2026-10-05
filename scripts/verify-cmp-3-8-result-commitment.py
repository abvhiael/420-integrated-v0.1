#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sandbox = ROOT / "compute/worker/sandbox.go"
sandbox_tests = ROOT / "compute/worker/sandbox_test.go"
lifecycle = ROOT / "compute/worker/lifecycle.go"
result = ROOT / "compute/worker/result.go"
tests = ROOT / "compute/worker/result_test.go"
integration = ROOT / "compute/worker/result_integration_test.go"
probe = ROOT / "compute/worker/testdata/resultprobe/main.go"
doc = ROOT / "docs/compute-market/CMP-3.8-RESULT-COMMITMENT.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for path in [sandbox, sandbox_tests, lifecycle, result, tests, integration, probe, doc, roadmap, workflow]:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

s = sandbox.read_text()
st = sandbox_tests.read_text()
l = lifecycle.read_text()
r = result.read_text()
t = tests.read_text()
i = integration.read_text()
p = probe.read_text()
d = doc.read_text()
rm = roadmap.read_text()
w = workflow.read_text()

for token in [
    "StdoutSHA256",
    "StdoutBytes",
    "newHashingWriter",
    "sha256.New()",
    "stdout := newHashingWriter(output)",
    "s.runner.Run(ctx, s.policy.Engine, args, input, stdout, output)",
]:
    if token not in s:
        errors.append(f"missing complete stdout hashing token: {token}")

if "TestSandboxHashesCompleteStdoutBeyondDiagnosticCapture" not in st:
    errors.append("missing full-stdout-vs-diagnostic-capture regression")

for token in [
    'StdoutSHA256         string',
    'StdoutBytes          uint64',
    "record.StdoutSHA256 = sandboxResult.StdoutSHA256",
    "record.StdoutBytes = sandboxResult.StdoutBytes",
    "ResumeCheckpointCommitment",
]:
    if token not in l:
        errors.append(f"execution record missing result commitment anchor: {token}")

for token in [
    "ResultMaterialSchemaV1",
    'ResultMaterialDomainV1 = "420/COMPUTE/WORKER_LOCAL_RESULT/V1"',
    "type ResultMaterial struct",
    "type ResultStore struct",
    "NewResultStore",
    "func (s *ResultStore) Commit",
    "VerifyResultMaterial",
    "OutputSHA256",
    "OutputHash",
    'OutputHash: "0x" + record.StdoutSHA256',
    "OutputBytes",
    "Authoritative",
    "Signed",
    "ResultCorrectnessEvidence",
    "CanonicalResultCommitted",
    "ErrConflictingResult",
    "syncDirectory(s.root)",
]:
    if token not in r:
        errors.append(f"missing CMP-3.8 implementation token: {token}")

for forbidden in [
    "executionSignature",
    "receiptHash",
    "ACTION_SUBMIT_RECEIPT",
    "recordResult(",
    "settlement",
    "Verified",
]:
    if forbidden in r:
        errors.append(f"CMP-3.8 crosses deferred authority boundary: {forbidden}")

for token in [
    "TestResultCommitmentBindsDurableSuccessfulExecution",
    "TestResultCommitmentIsIdempotentForSameAttempt",
    "TestResultCommitmentRejectsInMemoryOutputSubstitution",
    "TestResultCommitmentRejectsFailedOrNonzeroExecution",
    "TestResultCommitmentBindsResumeCheckpoint",
    "TestResultMaterialTamperingFailsVerification",
    "TestResultStoreRejectsUnsafePersistedRecord",
    "TestResultCommitmentAcceptsLegitimateEmptyStdout",
    "TestResultCommitmentConflictingDurableAttemptFailsClosed",
    "TestResultCommitmentRejectsMutatedCanonicalAuthorizationSnapshot",
]:
    if token not in t:
        errors.append(f"missing result commitment test: {token}")

for token in [
    "TestResultCommitmentDockerIntegration",
    "CMP_RESULT_INTEGRATION_IMAGE",
    "OutputTruncated",
    "StdoutSHA256",
    "ResultCorrectnessEvidence",
    "CanonicalResultCommitted",
]:
    if token not in i:
        errors.append(f"missing real result integration token: {token}")

for token in [
    "const outputBytes = 96 << 10",
    "os.Stdout.Write(payload)",
    "cmp-result-probe-diagnostic",
]:
    if token not in p:
        errors.append(f"result probe missing output assertion: {token}")

for token in [
    "Build local CMP-3.8 result commitment probe image",
    "CMP_RESULT_INTEGRATION_IMAGE",
    "Test real Docker result commitment",
    "TestResultCommitmentDockerIntegration",
    "verify-cmp-3-1-worker-daemon.py",
    "verify-cmp-3-2-hardware-software-discovery.py",
    "verify-cmp-3-3-benchmarking-capability-evidence.py",
    "verify-cmp-3-4-secure-workload-sandbox.py",
    "verify-cmp-3-5-content-addressed-work-unit-download.py",
    "verify-cmp-3-6-execution-lifecycle.py",
    "verify-cmp-3-7-checkpointing-resume.py",
    "verify-cmp-3-8-result-commitment.py",
]:
    if token not in w:
        errors.append(f"Compute Worker fast workflow missing CMP-3.8 coverage: {token}")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in d
):
    errors.append("CMP-3.8 documentation status drift")
if "Next canonical step: **CMP-3.9 — Execution-key signed receipt**." not in d:
    errors.append("CMP-3.8 next-step boundary drift")
if "## CMP-3.8 — Result commitment" not in rm:
    errors.append("canonical CMP-3.8 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in rm
    and "COMPLETE — Level 1 exact-head qualified" not in rm
):
    errors.append("CMP-3.8 roadmap status missing or stale")

if errors:
    print("CMP-3.8 result commitment verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.8 result commitment: mechanically consistent")
