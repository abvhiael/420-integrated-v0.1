#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-5.1-folding-at-home-adapter.json"
SRC=ROOT/"contracts/src/compute/ComputeFoldingAtHomeAdapter420.sol"
TEST=ROOT/"contracts/test/ComputeFoldingAtHomeAdapter420.t.sol"
DOC=ROOT/"docs/compute-market/CMP-5.1-FOLDING-AT-HOME-ADAPTER.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW=ROOT/".github/workflows/compute-market.yml"

def fail(message):
    raise SystemExit("CMP-5.1 verification failed: "+message)

for path in (CFG,SRC,TEST,DOC,ROADMAP,WORKFLOW):
    if not path.is_file():
        fail(f"missing {path.relative_to(ROOT)}")

cfg=json.loads(CFG.read_text())
if cfg.get("step")!="CMP-5.1" or cfg.get("canonical_definition")!="Folding@home adapter":
    fail("canonical definition drift")
q=cfg.get("qualification",{})
if q.get("level")!=1 or q.get("level_2_required_now") is not False:
    fail("qualification level drift")
if q.get("level_3_deferred_to")!="CMP-5.8 — Phase closeout":
    fail("Level 3 boundary drift")
if cfg.get("next_canonical_step")!="CMP-5.2 — BOINC adapter":
    fail("next canonical step drift")
if len(cfg.get("exit_criteria",[]))!=10:
    fail("exit criteria drift")
bounds=cfg.get("authority_boundaries",{})
for key in (
    "queries_folding_at_home","external_truth_attestation","canonical_verifier_authority",
    "reward_authority","vault_or_settlement_authority","stake_or_slash_authority",
    "double_reward_prevention"
):
    if bounds.get(key) is not False:
        fail(f"authority boundary widened: {key}")

src=SRC.read_text()
for token in (
    "contract ComputeFoldingAtHomeAdapter420",
    "ADAPTER_KIND","EXTERNAL_SYSTEM_ID","CONTRIBUTION_DOMAIN","RECORD_DOMAIN","PROTOCOL_DOMAIN",
    "struct FoldingRecord","function protocolCommitment()","function contributionId(",
    "function recordCommitment(","function normalize(","InvalidFoldingRecord",
    "record.completedAt < record.assignedAt","record.creditedPoints == 0"
):
    if token not in src:
        fail(f"source missing {token}")

for forbidden in (
    "recordVerification(","recordSettlement(","reserve(","release(","refund(","slash(",
    "reward(","onlyGovernance","transferFrom(","assignWorker("
):
    if forbidden in src:
        fail(f"unexpected authority surface {forbidden}")

test=TEST.read_text()
for token in (
    "testNormalizesCanonicalRecordDeterministically",
    "testContributionIdentityBindsProjectWorkUnitDonorAndAssignment",
    "testRecordCommitmentBindsResultTeamCreditTimeAndEvidence",
    "testRejectsZeroRequiredBindings",
    "testRejectsInvalidTimeAndZeroCredit",
    "testTeamIdentityIsOptionalButStillCommittedWhenPresent"
):
    if token not in test:
        fail(f"test missing {token}")

doc=DOC.read_text()
for token in (
    "# CMP-5.1 — Folding@home adapter",
    "non-authoritative",
    "CMP-5.6 — Double-reward prevention",
    "CMP-5.7 — External-result attestation",
    "CMP-5.2 — BOINC adapter"
):
    if token not in doc:
        fail(f"documentation missing {token}")

road=ROADMAP.read_text()
if "## CMP-5.1 — Folding@home adapter" not in road:
    fail("roadmap step missing")
if "## CMP-5.2 — BOINC adapter" not in road:
    fail("next roadmap step missing")

workflow=WORKFLOW.read_text()
if "Verify CMP-5.1 Folding@home adapter" not in workflow or "verify-cmp-5-1-folding-at-home-adapter.py" not in workflow:
    fail("Compute Market Level 1 workflow ownership missing")

print("CMP-5.1 Folding@home adapter: mechanically consistent")
