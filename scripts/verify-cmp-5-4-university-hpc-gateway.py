#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-5.4-university-hpc-gateway.json"
IFACE=ROOT/"contracts/src/compute/IComputeExternalContributionAdapter420.sol"
SRC=ROOT/"contracts/src/compute/ComputeUniversityHpcGateway420.sol"
TEST=ROOT/"contracts/test/ComputeUniversityHpcGateway420.t.sol"
INTEGRATION=ROOT/"contracts/test/ComputeExternalContributionAdapters420.t.sol"
DOC=ROOT/"docs/compute-market/CMP-5.4-UNIVERSITY-HPC-GATEWAY.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW=ROOT/".github/workflows/compute-market.yml"

def fail(message):
    raise SystemExit("CMP-5.4 verification failed: "+message)

for path in (CFG,IFACE,SRC,TEST,INTEGRATION,DOC,ROADMAP,WORKFLOW):
    if not path.is_file():
        fail(f"missing {path.relative_to(ROOT)}")

cfg=json.loads(CFG.read_text())
if cfg.get("step")!="CMP-5.4" or cfg.get("canonical_definition")!="University/HPC gateway":
    fail("canonical definition drift")
q=cfg.get("qualification",{})
if q.get("level")!=1 or q.get("level_2_required_now") is not False:
    fail("qualification level drift")
if q.get("previous_level_2_milestone")!="CMP-5.2 — BOINC adapter":
    fail("previous milestone drift")
if q.get("level_3_deferred_to")!="CMP-5.8 — Phase closeout":
    fail("Level 3 boundary drift")
if cfg.get("next_canonical_step")!="CMP-5.5 — External proof/credit adapters":
    fail("next step drift")
if len(cfg.get("exit_criteria",[]))!=10:
    fail("exit criteria drift")

for key,value in cfg.get("authority_boundaries",{}).items():
    if value is not False:
        fail(f"authority boundary widened: {key}")

src=SRC.read_text()
for token in (
    "contract ComputeUniversityHpcGateway420",
    "IComputeExternalContributionAdapter420",
    "ADAPTER_KIND","EXTERNAL_SYSTEM_ID","CONTRIBUTION_DOMAIN","RECORD_DOMAIN","PROTOCOL_DOMAIN",
    "struct HpcRecord","institutionIdentityCommitment","gatewayIdentityCommitment",
    "schedulerIdentityCommitment","accountIdentityCommitment","researchProjectCommitment",
    "workloadCommitment","allocationCommitment","queueOrPartitionCommitment",
    "resultCommitment","submittedAt","startedAt","completedAt",
    "resourceUsageCommitment","accountingCommitment","evidenceCommitment",
    "function contributionId(","function recordCommitment(","function normalize(",
    "record.startedAt < record.submittedAt","record.completedAt < record.startedAt"
):
    if token not in src:
        fail(f"source missing {token}")

for forbidden in (
    "recordVerification(","recordSettlement(","reserve(","release(","refund(","slash(",
    "reward(","onlyGovernance","transferFrom(","assignWorker(","validateCredential("
):
    if forbidden in src:
        fail(f"unexpected authority surface {forbidden}")

test=TEST.read_text()
for token in (
    "testNormalizesCanonicalHpcRecordDeterministically",
    "testContributionIdentityBindsInstitutionGatewaySchedulerAccountProjectWorkloadAllocation",
    "testRecordCommitmentBindsPartitionResultLifecycleUsageAccountingAndEvidence",
    "testRejectsMissingRequiredBindings",
    "testRejectsImpossibleLifecycleOrdering",
    "testAllowsOptionalQueueOrPartitionCommitment"
):
    if token not in test:
        fail(f"test missing {token}")

integration=INTEGRATION.read_text()
for token in (
    "ComputeFoldingAtHomeAdapter420","ComputeBoincAdapter420",
    "ComputeResearchClusterAdapter420","ComputeUniversityHpcGateway420",
    "hpcSurface.adapterKind()","hpcSurface.externalSystemId()","hpcSurface.protocolCommitment()"
):
    if token not in integration:
        fail(f"cross-adapter regression missing {token}")

doc=DOC.read_text()
for token in (
    "# CMP-5.4 — University/HPC gateway",
    "ordinary **Level 1** step",
    "CMP-5.2 remains the most recent CMP-5 Level 2 integration milestone",
    "CMP-5.6","CMP-5.7","CMP-5.5 — External proof/credit adapters"
):
    if token not in doc:
        fail(f"documentation missing {token}")

road=ROADMAP.read_text()
if "## CMP-5.4 — University/HPC gateway" not in road or "## CMP-5.5 — External proof/credit adapters" not in road:
    fail("roadmap sequence drift")

workflow=WORKFLOW.read_text()
if "Verify CMP-5.4 University/HPC gateway" not in workflow or "verify-cmp-5-4-university-hpc-gateway.py" not in workflow:
    fail("Compute Market workflow ownership missing")

print("CMP-5.4 University/HPC gateway: mechanically consistent")
