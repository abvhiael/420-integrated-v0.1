#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
upload = ROOT / "compute/worker/upload.go"
tests = ROOT / "compute/worker/upload_test.go"
receipt = ROOT / "compute/worker/receipt.go"
result = ROOT / "compute/worker/result.go"
doc = ROOT / "docs/compute-market/CMP-3.10-RESULT-EVIDENCE-UPLOAD.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for p in [upload, tests, receipt, result, doc, roadmap, workflow]:
    if not p.is_file():
        errors.append(f"missing {p.relative_to(ROOT)}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

u = upload.read_text()
t = tests.read_text()
d = doc.read_text()
rm = roadmap.read_text()
w = workflow.read_text()

for token in [
    "ResultEvidenceUploadAuthorizationSchemaV1",
    "EvidenceManifestSchemaV1",
    "ResultEvidenceUploadRecordSchemaV1",
    "EvidenceRootDomainV1",
    "UploadIdempotencyDomainV1",
    "type EvidenceRequirement struct",
    "CanonicalResultEvidenceUploadAuthority",
    "type ResultEvidenceTransport interface",
    "type EvidenceManifest struct",
    "type ResultEvidenceUploadRecord struct",
    "NewResultEvidenceUploader",
    "ValidateResultEvidenceUploadAuthorization",
    "evidenceRoot",
    "stageEvidence",
    "uploadIdempotencyKey",
    "UploadObjectResultMaterial",
    "UploadObjectSignedReceipt",
    "UploadObjectEvidenceManifest",
    "UploadObjectEvidence",
    "Authoritative: false",
    "ResultCorrectnessEvidence: false",
    "CanonicalResultCommitted: false",
]:
    if token not in u:
        errors.append(f"missing CMP-3.10 implementation token: {token}")

for forbidden in [
    "commitResult(",
    "recordResult(",
    "settlement.execute",
    "ACTION_VERIFY_RESULT",
    "http.NewRequest",
    "net/http",
    "DeveloperUploadCoordinator",
]:
    if forbidden in u:
        errors.append(f"CMP-3.10 crossed deferred/shared authority boundary: {forbidden}")

for token in [
    "TestEvidenceRootIsOrderedDomainSeparatedAndStable",
    "TestResultEvidenceUploadUploadsResultReceiptManifestAndEvidence",
    "TestResultEvidenceUploadStagesAllEvidenceBeforeAnyTransport",
    "TestResultEvidenceUploadRejectsCanonicalRootDriftBeforeTransport",
    "TestResultEvidenceUploadRejectsTransportReceiptMismatch",
    "TestResultEvidenceUploadIsIdempotentAfterDurableSuccess",
    "TestResultEvidenceUploadRetryUsesStableIdempotencyAfterTransportFailure",
    "TestResultEvidenceUploadRecordIsPrivateAndDoesNotPersistEvidenceBytes",
    "TestResultEvidenceUploadAuthorizationFailsClosed",
    "TestResultEvidenceUploadCompleteByteLimitIncludesMetadata",
    "TestResultEvidenceUploadCancellationHasNoDurableCompletion",
    "bf901f40e484816156836c5ca0d812b15d45235c922ad81b6d67e34964630599",
]:
    if token not in t:
        errors.append(f"missing CMP-3.10 test/vector token: {token}")

if "verify-cmp-3-10-result-evidence-upload.py" not in w:
    errors.append("fast workflow does not run CMP-3.10 verifier")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in d
):
    errors.append("CMP-3.10 documentation status drift")
if "Next canonical step: **CMP-3.11 — Local resource controls**." not in d:
    errors.append("CMP-3.10 next-step boundary drift")
if "## CMP-3.10 — Result/evidence upload" not in rm:
    errors.append("canonical CMP-3.10 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in rm
    and "COMPLETE — Level 1 exact-head qualified" not in rm
):
    errors.append("CMP-3.10 roadmap status missing or stale")

if errors:
    print("CMP-3.10 result/evidence upload verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.10 result/evidence upload: mechanically consistent")
