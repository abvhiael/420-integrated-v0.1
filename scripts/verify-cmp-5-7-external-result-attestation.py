#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-5.7-external-result-attestation.json"
SRC=ROOT/"contracts/src/compute/ComputeExternalResultAttestation420.sol"
TEST=ROOT/"contracts/test/ComputeExternalResultAttestation420.t.sol"
ADAPTER=ROOT/"contracts/src/compute/ComputeExternalProofCreditAdapter420.sol"
GUARD=ROOT/"contracts/src/compute/ComputeExternalDoubleRewardGuard420.sol"
DOC=ROOT/"docs/compute-market/CMP-5.7-EXTERNAL-RESULT-ATTESTATION.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW=ROOT/".github/workflows/compute-market.yml"

def fail(msg):
    raise SystemExit("CMP-5.7 verification failed: "+msg)

for p in (CFG,SRC,TEST,ADAPTER,GUARD,DOC,ROADMAP,WORKFLOW):
    if not p.is_file():
        fail(f"missing {p.relative_to(ROOT)}")

cfg=json.loads(CFG.read_text())
if cfg.get("step")!="CMP-5.7" or cfg.get("canonical_definition")!="External-result attestation":
    fail("canonical definition drift")
q=cfg.get("qualification",{})
if q.get("level")!=1 or q.get("level_2_required_now") is not True:
    fail("qualification milestone drift")
if "fourth CMP-5 integration milestone" not in q.get("milestone",""):
    fail("Level 2 milestone identity drift")
if q.get("level_3_deferred_to")!="CMP-5.8 — Phase closeout":
    fail("Level 3 boundary drift")
if cfg.get("next_canonical_step")!="CMP-5.8 — Phase closeout":
    fail("next step drift")
if len(cfg.get("exit_criteria",[]))!=10:
    fail("exit criteria drift")

bounds=cfg.get("authority_boundaries",{})
if bounds.get("external_result_attestation") is not True or bounds.get("canonical_work_mapping") is not True:
    fail("required attestation authority missing")
for key in (
    "reward_amount_authority","reward_eligibility_authority","vault_or_settlement_authority",
    "stake_or_slash_authority","proof_verification_authority","credit_issuance_authority",
    "duplicate_consumption_authority"
):
    if bounds.get(key) is not False:
        fail(f"authority boundary widened: {key}")

src=SRC.read_text()
for token in (
    "contract ComputeExternalResultAttestation420",
    "SystemAccess",
    "ComputeExternalProofCreditAdapter420",
    "ATTESTATION_DOMAIN",
    "EXTERNAL_RESULT_DOMAIN",
    "EVIDENCE_BINDING_DOMAIN",
    "struct ResultClaim",
    "struct Attestation",
    "trustedAttester",
    "canonicalWorkForSource",
    "canonicalWorkForExternalResult",
    "canonicalWorkForEvidence",
    "function setAttester(",
    "function attest(",
    "function revoke(",
    "function isAcceptable(",
    "function resolve(",
    "proofCreditAdapter.sourceBinding(claim.source)",
    "ConflictingAttestation"
):
    if token not in src:
        fail(f"source missing {token}")

for forbidden in (
    "AssetVault420",
    "createObligation(",
    "releaseObligation(",
    "transferFrom(",
    "function reward(",
    "function slash(",
    "consume("
):
    if forbidden in src:
        fail(f"unexpected authority surface {forbidden}")

test=TEST.read_text()
for token in (
    "testTrustedAttesterResolvesCanonicalExternalWork",
    "testEquivalentSourceWrappersMayMapToSameCanonicalWork",
    "testSourceCannotEquivocateAcrossCanonicalWork",
    "testEvidenceCannotEquivocateAcrossCanonicalWork",
    "testIdenticalAttestationIsIdempotent",
    "testUntrustedAttesterCannotPublish",
    "testOnlyGovernanceCanManageAttesters",
    "testRevocationMakesAttestationUnacceptable",
    "testTrustWithdrawalMakesAttestationUnacceptable",
    "testAtLeastOneNormalizedProofOrCreditCommitmentRequired",
    "testCreditOnlyEvidenceIsAccepted",
    "testInvalidAndZeroBindingsFailClosed",
    "testTimingBoundariesFailClosed",
    "testAttesterCannotRevokeAnotherAttestersRecord"
):
    if token not in test:
        fail(f"test missing {token}")

doc=DOC.read_text()
for token in (
    "# CMP-5.7 — External-result attestation",
    "fourth CMP-5 Level 2 milestone",
    "CMP-5.6 remains the owner of one-time consumption",
    "CMP-6 remains the useful-computation reward-economics",
    "canonical external-work commitment"
):
    if token not in doc:
        fail(f"documentation missing {token}")

road=ROADMAP.read_text()
if "## CMP-5.7 — External-result attestation" not in road or "## CMP-5.8 — Phase closeout" not in road:
    fail("roadmap sequence drift")

workflow=WORKFLOW.read_text()
if "Verify CMP-5.7 External-result attestation" not in workflow or "verify-cmp-5-7-external-result-attestation.py" not in workflow:
    fail("Compute Market workflow ownership missing")

print("CMP-5.7 External-result attestation: mechanically consistent")
