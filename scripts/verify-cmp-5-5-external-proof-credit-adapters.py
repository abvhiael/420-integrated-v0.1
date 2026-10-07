#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-5.5-external-proof-credit-adapters.json"
SRC=ROOT/"contracts/src/compute/ComputeExternalProofCreditAdapter420.sol"
TEST=ROOT/"contracts/test/ComputeExternalProofCreditAdapter420.t.sol"
DOC=ROOT/"docs/compute-market/CMP-5.5-EXTERNAL-PROOF-CREDIT-ADAPTERS.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW=ROOT/".github/workflows/compute-market.yml"

def fail(message):
    raise SystemExit("CMP-5.5 verification failed: "+message)

for path in (CFG,SRC,TEST,DOC,ROADMAP,WORKFLOW):
    if not path.is_file():
        fail(f"missing {path.relative_to(ROOT)}")

cfg=json.loads(CFG.read_text())
if cfg.get("step")!="CMP-5.5" or cfg.get("canonical_definition")!="External proof/credit adapters":
    fail("canonical definition drift")
q=cfg.get("qualification",{})
if q.get("level")!=1 or q.get("level_2_required_now") is not True:
    fail("qualification milestone drift")
if "second CMP-5 integration milestone" not in q.get("milestone",""):
    fail("Level 2 milestone identity drift")
if q.get("level_3_deferred_to")!="CMP-5.8 — Phase closeout":
    fail("Level 3 boundary drift")
if cfg.get("next_canonical_step")!="CMP-5.6 — Double-reward prevention":
    fail("next step drift")
if len(cfg.get("exit_criteria",[]))!=10:
    fail("exit criteria drift")
for key,value in cfg.get("authority_boundaries",{}).items():
    if value is not False:
        fail(f"authority boundary widened: {key}")

src=SRC.read_text()
for token in (
    "contract ComputeExternalProofCreditAdapter420",
    "struct ExternalSource","struct ProofRecord","struct CreditRecord",
    "SOURCE_BINDING_DOMAIN","PROOF_ID_DOMAIN","PROOF_RECORD_DOMAIN",
    "CREDIT_ID_DOMAIN","CREDIT_RECORD_DOMAIN","PROTOCOL_DOMAIN",
    "function sourceBinding(","function proofId(","function proofRecordCommitment(",
    "function creditId(","function creditRecordCommitment(",
    "function normalizeProof(","function normalizeCredit(",
    "record.expiresAt != 0 && record.expiresAt < record.observedAt",
    "record.creditAmount == 0"
):
    if token not in src:
        fail(f"source missing {token}")

for forbidden in (
    "recordVerification(","recordSettlement(","reserve(","release(","refund(","slash(",
    "reward(","onlyGovernance","transferFrom(","assignWorker(","validateCredential(",
    "markRewarded(","attestResult("
):
    if forbidden in src:
        fail(f"unexpected authority surface {forbidden}")

test=TEST.read_text()
for token in (
    "testNormalizesProofAndCreditDeterministically",
    "testSourceBindingRejectsSubstitution",
    "testProofRecordBindsSchemeIssuerProofTimingExpiryAndEvidence",
    "testCreditRecordBindsSchemeIssuerUnitAmountTimeAndEvidence",
    "testRejectsMissingSourceAndRequiredProofCreditBindings",
    "testProofExpiryAndObservationBoundariesFailClosed",
    "testFourAdapterFamiliesProduceDistinctExternalSourceBindings"
):
    if token not in test:
        fail(f"test missing {token}")

doc=DOC.read_text()
for token in (
    "# CMP-5.5 — External proof/credit adapters",
    "second CMP-5 Level 2 milestone",
    "CMP-5.6",
    "CMP-5.7",
    "CMP-5.6 — Double-reward prevention"
):
    if token not in doc:
        fail(f"documentation missing {token}")

road=ROADMAP.read_text()
if "## CMP-5.5 — External proof/credit adapters" not in road or "## CMP-5.6 — Double-reward prevention" not in road:
    fail("roadmap sequence drift")

workflow=WORKFLOW.read_text()
if "Verify CMP-5.5 External proof/credit adapters" not in workflow or "verify-cmp-5-5-external-proof-credit-adapters.py" not in workflow:
    fail("Compute Market workflow ownership missing")

print("CMP-5.5 External proof/credit adapters: mechanically consistent")
