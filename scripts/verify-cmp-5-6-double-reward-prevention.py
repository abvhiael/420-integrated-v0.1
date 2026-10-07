#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-5.6-double-reward-prevention.json"
SRC=ROOT/"contracts/src/compute/ComputeExternalDoubleRewardGuard420.sol"
TEST=ROOT/"contracts/test/ComputeExternalDoubleRewardGuard420.t.sol"
ADAPTER=ROOT/"contracts/src/compute/ComputeExternalProofCreditAdapter420.sol"
DOC=ROOT/"docs/compute-market/CMP-5.6-DOUBLE-REWARD-PREVENTION.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
WORKFLOW=ROOT/".github/workflows/compute-market.yml"

def fail(message):
    raise SystemExit("CMP-5.6 verification failed: "+message)

for path in (CFG,SRC,TEST,ADAPTER,DOC,ROADMAP,WORKFLOW):
    if not path.is_file():
        fail(f"missing {path.relative_to(ROOT)}")

cfg=json.loads(CFG.read_text())
if cfg.get("step")!="CMP-5.6" or cfg.get("canonical_definition")!="Double-reward prevention":
    fail("canonical definition drift")
q=cfg.get("qualification",{})
if q.get("level")!=1 or q.get("level_2_required_now") is not True:
    fail("qualification milestone drift")
if "third CMP-5 integration milestone" not in q.get("milestone",""):
    fail("Level 2 milestone identity drift")
if q.get("level_3_deferred_to")!="CMP-5.8 — Phase closeout":
    fail("Level 3 boundary drift")
if cfg.get("next_canonical_step")!="CMP-5.7 — External-result attestation":
    fail("next step drift")
if len(cfg.get("exit_criteria",[]))!=10:
    fail("exit criteria drift")

bounds=cfg.get("authority_boundaries",{})
for key,value in bounds.items():
    if key=="claim_consumer_authorization_only":
        if value is not True:
            fail("consumer authorization boundary missing")
    elif value is not False:
        fail(f"authority boundary widened: {key}")

src=SRC.read_text()
for token in (
    "contract ComputeExternalDoubleRewardGuard420",
    "SystemAccess",
    "ComputeExternalProofCreditAdapter420",
    "CLAIM_DOMAIN",
    "struct ClaimRecord",
    "consumerCodeHash",
    "function setConsumer(",
    "function claimKeyFor(",
    "function consume(",
    "function claimRecord(",
    "function consumed(",
    "proofCreditAdapter.sourceBinding(source)",
    "if (_claims[claimKey].exists) revert Replay()",
    "msg.sender.codehash != expectedCodeHash"
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
    "recordVerification(",
    "attestResult("
):
    if forbidden in src:
        fail(f"unexpected authority surface {forbidden}")

test=TEST.read_text()
for token in (
    "testAuthorizedConsumerConsumesCanonicalWorkExactlyOnce",
    "testAlternateProofCreditEvidenceCannotRewardSameWorkTwice",
    "testCrossSourceWrapperCannotRewardSameCanonicalWorkTwice",
    "testDistinctCanonicalWorkCanBeConsumedIndependently",
    "testUnauthorizedCallerCannotBurnClaim",
    "testConsumerAuthorizationAndRevocationFailClosed",
    "testClaimKeyIsIndependentOfSourceAndRewardEvidence",
    "testZeroAndInvalidBindingsFailClosed",
    "testOnlyGovernanceCanAuthorizeOrRevokeConsumers",
    "testCannotAuthorizeEOAOrZeroCodeConsumer"
):
    if token not in test:
        fail(f"test missing {token}")

doc=DOC.read_text()
for token in (
    "# CMP-5.6 — Double-reward prevention",
    "third CMP-5 Level 2 milestone",
    "CMP-5.7 owns **external-result attestation",
    "CMP-6 owns **useful-computation reward economics",
    "front-running",
    "canonical external-work commitment"
):
    if token not in doc:
        fail(f"documentation missing {token}")

road=ROADMAP.read_text()
if "## CMP-5.6 — Double-reward prevention" not in road or "## CMP-5.7 — External-result attestation" not in road:
    fail("roadmap sequence drift")

workflow=WORKFLOW.read_text()
if "Verify CMP-5.6 Double-reward prevention" not in workflow or "verify-cmp-5-6-double-reward-prevention.py" not in workflow:
    fail("Compute Market workflow ownership missing")

print("CMP-5.6 Double-reward prevention: mechanically consistent")
