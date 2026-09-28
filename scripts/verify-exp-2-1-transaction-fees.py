#!/usr/bin/env python3
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "exp-2-1-evidence"
errors = []

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def require(text, needle, label):
    if needle not in text:
        errors.append(f"{label}: missing {needle}")

model = read("indexer/model/model.go")
rpc = read("indexer/rpc/eth.go")
service = read("explorer/service/transactionviews.go")
rpc_tests = read("indexer/rpc/eth_fee_test.go")
service_tests = read("explorer/service/transactionviews_test.go")
indexer_api_tests = read("indexer/api/server_test.go")
explorer_api_tests = read("explorer/api/server_test.go")
gap = json.loads(read("docs/audit/EXP-0.2.5-genesis-gap-register.json"))
audit = json.loads(read("docs/audit/EXP-2.1-transaction-fee-api-qualification.json"))
primary = read(".github/workflows/420indexer.yml")
dedicated = read(".github/workflows/explorer-exp-2-1.yml")

for needle in ["EffectiveGasPriceWei", 'json:"effectiveGasPriceWei"', "ActualFeeWei", 'json:"actualFeeWei"']:
    require(model, needle, "receipt model")
for needle in ["EffectiveGasPrice", "receiptFeeWei", "effectiveGasPriceWei, actualFeeWei", "ActualFeeWei: actualFeeWei"]:
    require(rpc, needle, "RPC ingestion")
for needle in ["EffectiveGasPriceWei", "ActualFeeWei", "inconsistent actual fee", "valid effective gas price"]:
    require(service, needle, "Explorer service")
for needle in [
    "TestReceiptFeeWeiKnownVector",
    "TestReceiptFeeWeiZeroEdge",
    "TestReceiptFeeWeiIsOverflowSafe",
    "TestReceiptFeeWeiRejectsMissingPrice",
    "TestReceiptFeeWeiRejectsMalformedPrice",
]:
    require(rpc_tests, needle, "RPC fee tests")
for needle in [
    "TestTransactionDetailExposesAuthoritativeActualFee",
    "TestTransactionDetailSupportsZeroFee",
    "TestTransactionDetailRejectsInconsistentActualFee",
    "TestTransactionDetailRejectsMissingEffectiveGasPrice",
]:
    require(service_tests, needle, "Explorer service tests")
require(indexer_api_tests, "TestReceiptEndpointSerializesActualFeeFields", "Indexer API tests")
require(explorer_api_tests, 'ActualFeeWei != "21000000000000"', "Explorer API tests")

finding = next((x for x in gap.get("findings", []) if x.get("id") == "EXP-FIND-008"), None)
if not finding:
    errors.append("EXP-FIND-008 missing")
else:
    if finding.get("exp_2_disposition") != "REPOSITORY_FEE_MODEL_AND_API_IMPLEMENTATION_QUALIFIED_UI_WORKFLOW_PENDING":
        errors.append("EXP-FIND-008 EXP-2 disposition drift")
    if finding.get("post_exp_2_remaining_owners") != ["EXP-4"]:
        errors.append("EXP-FIND-008 remaining owner must be EXP-4")
    if finding.get("genesis_blocking") is not True:
        errors.append("EXP-FIND-008 must remain Genesis-blocking until UI qualification")

if audit.get("milestone") != "EXP-2.1":
    errors.append("audit milestone drift")
if audit.get("scope_boundary", {}).get("genesis_ready_claim") is not False:
    errors.append("audit overclaims Genesis readiness")

for workflow, label in [(primary, "420Indexer"), (dedicated, "EXP-2.1 dedicated")]:
    require(workflow, "verify-exp-2-1-transaction-fees.py", f"{label} workflow")
    require(workflow, "exp-2-1-transaction-fee-api", f"{label} workflow")
    require(workflow, "github.event.pull_request.head.sha || github.sha", f"{label} workflow")

head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
EVIDENCE.mkdir(exist_ok=True)
summary = {
    "schema": "420explorer-exp-2.1-evidence-v1",
    "milestone": "EXP-2.1",
    "exactHead": head,
    "status": "qualified_repository_scope" if not errors else "failed",
    "checks": {
        "authoritativeEffectiveGasPrice": True,
        "overflowSafeActualFee": True,
        "feeConsistencyFailClosed": True,
        "apiSerializationCoverage": True,
        "expFind008RemainsBlockedOnlyForUi": True,
    },
    "scopeBoundary": {
        "deployedUI": False,
        "liveTargetNetwork": False,
        "genesisReady": False,
    },
    "errors": errors,
}
(EVIDENCE / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
if errors:
    for error in errors:
        print("ERROR:", error, file=sys.stderr)
    sys.exit(1)
print(json.dumps(summary, indent=2))
