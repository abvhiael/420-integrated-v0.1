#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ethereum = ROOT / "compute/worker/ethereum.go"
receipt = ROOT / "compute/worker/receipt.go"
tests = ROOT / "compute/worker/receipt_test.go"
result = ROOT / "compute/worker/result.go"
doc = ROOT / "docs/compute-market/CMP-3.9-EXECUTION-KEY-SIGNED-RECEIPT.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"
integration = ROOT / ".github/workflows/compute-worker-integration.yml"

errors = []
for p in [ethereum, receipt, tests, result, doc, roadmap, workflow, integration]:
    if not p.is_file():
        errors.append(f"missing {p.relative_to(ROOT)}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

e = ethereum.read_text()
r = receipt.read_text()
t = tests.read_text()
d = doc.read_text()
rm = roadmap.read_text()
w = workflow.read_text()
iw = integration.read_text()

for token in [
    "Secp256k1ExecutionKey",
    "NewSecp256k1ExecutionKey",
    "SignDigest",
    "VerifyDigest",
    "secp256k1HalfN",
    "newRFC6979",
    "keccak256",
    "sig[64] = byte(27 + recid)",
]:
    if token not in e:
        errors.append(f"missing execution-key crypto token: {token}")

for token in [
    "ReceiptAuthorizationSchemaV1",
    "ReceiptSchemaVersionV1",
    "ReceiptNonceV1",
    "ReceiptTypeStringV1",
    "type ReceiptV1 struct",
    "type SignedReceipt struct",
    "CanonicalReceiptAuthority",
    "NewReceiptStore",
    "ValidateReceiptAuthorization",
    "receiptDigests",
    "receiptABIWords",
    "contractResultDigest",
    "ReceiptPayloadDomainLabelV1",
    "ReceiptResultDomainLabelV1",
    "ReceiptSigningPolicyLabelV1",
    "OutputSourceSHA256",
    "OutputCommitment",
    "ContractResultSignature",
    "ErrConflictingReceipt",
    "syncDirectory(s.root)",
]:
    if token not in r:
        errors.append(f"missing signed-receipt implementation token: {token}")

canonical_fields = [
    "ReceiptSchemaVersion", "ChainID", "VerifyingRegistry", "JobID", "RequestID",
    "MatchID", "UnitID", "AttemptID", "ProviderID", "NodeID", "ResourceID",
    "WorkerSigner", "SignerGrantID", "ManifestHash", "PartitionPlanHash",
    "PartitionIndex", "ReplicaIndex", "AttemptNonce", "ExecutionStartedAt",
    "ExecutionEndedAt", "MeteringProfileID", "MeteringProfileVersion",
    "MeasuredUnits", "MeasurementCommitment", "InputSliceCommitment",
    "OutputCommitment", "EvidenceRoot", "ResultCode", "ReceiptNonce",
]
for token in canonical_fields:
    if token not in r:
        errors.append(f"ReceiptV1 missing canonical field: {token}")

for forbidden in [
    "commitResult(",
    "recordResult(",
    "settlement.execute",
    "ACTION_VERIFY_RESULT",
    "uploadResult",
    "http.Post(",
]:
    if forbidden in r:
        errors.append(f"CMP-3.9 crosses deferred authority/transport boundary: {forbidden}")

for token in [
    "TestEthereumPrimitivesKnownVectors",
    "TestReceiptV1PinnedABIEIP712AndSignatureVector",
    "TestSignedReceiptBindsCanonicalResultAndExecutionKey",
    "TestSignedReceiptIsIdempotentAndConflictsFailClosed",
    "TestSignedReceiptRejectsWrongSignerAndOutputSourceDrift",
    "TestSignedReceiptAllowsProfileDefinedOutputCommitment",
    "TestSignedReceiptTamperingAndCrossContextFailVerification",
    "TestSignedReceiptPrivatePersistenceContainsNoKeyOrRawOutput",
    "TestReceiptAuthorizationRejectsZeroCriticalBindingsAndUint256Overflow",
    "3462fa3dc5c82d7974ffe95e535314d5661aa9b03a1e2b3e65d0b99f8f69c4ac",
    "98be775ebe6ab11d88a18bd7f1454be7b61786909caec45e2e0751c894c7a79c",
    "bf2f31026a9d7151263915c68efb47078e96f83c22d405cd41be9ed6d40673d0",
]:
    if token not in t:
        errors.append(f"missing CMP-3.9 test/vector token: {token}")

if "verify-cmp-3-9-execution-key-signed-receipt.py" not in w:
    errors.append("fast workflow does not run CMP-3.9 verifier")
if "cmp-worker-level2" not in iw:
    errors.append("worker integration workflow lost Level 2 label gate")

if (
    "Status: **IMPLEMENTED / LEVEL 1 + LEVEL 2 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 + Level 2 exact-head qualified" not in d
):
    errors.append("CMP-3.9 documentation status drift")
if "Next canonical step: **CMP-3.10 — Result/evidence upload**." not in d:
    errors.append("CMP-3.9 next-step boundary drift")
if "## CMP-3.9 — Execution-key signed receipt" not in rm:
    errors.append("canonical CMP-3.9 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 + Level 2 qualification pending" not in rm
    and "COMPLETE — Level 1 + Level 2 exact-head qualified" not in rm
):
    errors.append("CMP-3.9 roadmap status missing or stale")

if errors:
    print("CMP-3.9 execution-key signed receipt verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.9 execution-key signed receipt: mechanically consistent")
