#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-5.2-boinc-adapter.json"
IFACE=ROOT/"contracts/src/compute/IComputeExternalContributionAdapter420.sol"
BOINC=ROOT/"contracts/src/compute/ComputeBoincAdapter420.sol"
FOLD=ROOT/"contracts/src/compute/ComputeFoldingAtHomeAdapter420.sol"
TEST=ROOT/"contracts/test/ComputeBoincAdapter420.t.sol"
INTEGRATION=ROOT/"contracts/test/ComputeExternalContributionAdapters420.t.sol"
DOC=ROOT/"docs/compute-market/CMP-5.2-BOINC-ADAPTER.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW=ROOT/".github/workflows/compute-market.yml"

def fail(message):
    raise SystemExit("CMP-5.2 verification failed: "+message)

for path in (CFG,IFACE,BOINC,FOLD,TEST,INTEGRATION,DOC,ROADMAP,WORKFLOW):
    if not path.is_file():
        fail(f"missing {path.relative_to(ROOT)}")

cfg=json.loads(CFG.read_text())
if cfg.get("step")!="CMP-5.2" or cfg.get("canonical_definition")!="BOINC adapter":
    fail("canonical definition drift")
q=cfg.get("qualification",{})
if q.get("level")!=1 or q.get("level_2_required_now") is not True:
    fail("Level 1/Level 2 milestone drift")
if q.get("milestone")!="first CMP-5 external-adapter family convergence":
    fail("milestone identity drift")
if q.get("level_3_deferred_to")!="CMP-5.8 — Phase closeout":
    fail("Level 3 boundary drift")
if cfg.get("next_canonical_step")!="CMP-5.3 — Research-cluster adapter":
    fail("next step drift")
if len(cfg.get("exit_criteria",[]))!=10:
    fail("exit criteria drift")

for key,value in cfg.get("authority_boundaries",{}).items():
    if value is not False:
        fail(f"authority boundary widened: {key}")

iface=IFACE.read_text()
for token in ("interface IComputeExternalContributionAdapter420","adapterKind()","externalSystemId()","protocolCommitment()"):
    if token not in iface:
        fail(f"shared interface missing {token}")

boinc=BOINC.read_text()
for token in (
    "contract ComputeBoincAdapter420",
    "IComputeExternalContributionAdapter420",
    "ADAPTER_KIND","EXTERNAL_SYSTEM_ID","CONTRIBUTION_DOMAIN","RECORD_DOMAIN","PROTOCOL_DOMAIN",
    "struct BoincRecord","projectIdentityCommitment","applicationCommitment","workUnitCommitment",
    "participantIdentityCommitment","hostIdentityCommitment","assignmentCommitment","resultCommitment",
    "issuedAt","reportDeadline","reportedAt","grantedCredit","evidenceCommitment",
    "function contributionId(","function recordCommitment(","function normalize(",
    "record.reportDeadline < record.issuedAt","record.reportedAt < record.issuedAt"
):
    if token not in boinc:
        fail(f"BOINC source missing {token}")

fold=FOLD.read_text()
for token in ("IComputeExternalContributionAdapter420","function adapterKind()","function externalSystemId()"):
    if token not in fold:
        fail(f"Folding adapter convergence missing {token}")

for source_name,source in (("BOINC",boinc),("Folding",fold)):
    for forbidden in (
        "recordVerification(","recordSettlement(","reserve(","release(","refund(","slash(",
        "reward(","onlyGovernance","transferFrom(","assignWorker("
    ):
        if forbidden in source:
            fail(f"{source_name} adapter unexpected authority surface {forbidden}")

test=TEST.read_text()
for token in (
    "testNormalizesCanonicalRecordDeterministically",
    "testContributionIdentityBindsProjectWorkUnitParticipantHostAndAssignment",
    "testRecordCommitmentBindsApplicationResultTimingCreditAndEvidence",
    "testRejectsMissingRequiredBindings",
    "testRejectsImpossibleTimeOrdering",
    "testAllowsOptionalHostAndZeroCreditWithoutClaimingRewardEligibility"
):
    if token not in test:
        fail(f"BOINC test missing {token}")

integration=INTEGRATION.read_text()
for token in (
    "testExternalAdapterFamiliesExposeCommonIdentitySurfaceAndRemainDomainSeparated",
    "testSharedSurfaceDoesNotCreateCrossAdapterNormalizationAuthority",
    "IComputeExternalContributionAdapter420",
    "ComputeFoldingAtHomeAdapter420",
    "ComputeBoincAdapter420"
):
    if token not in integration:
        fail(f"integration test missing {token}")

doc=DOC.read_text()
for token in (
    "# CMP-5.2 — BOINC adapter",
    "first CMP-5 Level 2 integration milestone",
    "CMP-5.6",
    "CMP-5.7",
    "CMP-5.3 — Research-cluster adapter"
):
    if token not in doc:
        fail(f"documentation missing {token}")

road=ROADMAP.read_text()
if "## CMP-5.2 — BOINC adapter" not in road or "## CMP-5.3 — Research-cluster adapter" not in road:
    fail("roadmap step sequence drift")

workflow=WORKFLOW.read_text()
if "Verify CMP-5.2 BOINC adapter" not in workflow or "verify-cmp-5-2-boinc-adapter.py" not in workflow:
    fail("Compute Market workflow ownership missing")

print("CMP-5.2 BOINC adapter: mechanically consistent")
