#!/usr/bin/env python3
from pathlib import Path
import json, subprocess

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"hz"/"config"/"gca-level2-milestone-v1.json"
CONS=ROOT/"hz"/"config"/"gca-architecture-consolidation-v1.json"
ADV=ROOT/"hz"/"config"/"gca-phase1-adversarial-review-v1.json"
API=ROOT/"hz"/"config"/"gca-api-interface-contracts-v1.json"
REC=ROOT/"hz"/"config"/"gca-failure-recovery-v1.json"
VOTE=ROOT/"hz"/"config"/"gca-nomination-voting-policy-v1.json"
MOD=ROOT/"hz"/"config"/"gca-moderation-dispute-v1.json"
CHART=ROOT/"hz"/"config"/"gca-charts-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.20-LEVEL2-MILESTONE.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
COMPUTE_API=ROOT/"services"/"compute-api"/"src"/"job-api.ts"
COMPUTE_READ=ROOT/"420-indexer"/"src"/"compute-read-model.ts"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [M,CONS,ADV,API,REC,VOTE,MOD,CHART,COMM,DOC,ROADMAP,COMPUTE_API,COMPUTE_READ]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    m=json.loads(M.read_text())
    cons=json.loads(CONS.read_text())
    adv=json.loads(ADV.read_text())
    api=json.loads(API.read_text())
    rec=json.loads(REC.read_text())
    vote=json.loads(VOTE.read_text())
    mod=json.loads(MOD.read_text())
    chart=json.loads(CHART.read_text())
    comm=json.loads(COMM.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()
    capi=COMPUTE_API.read_text()
    cread=COMPUTE_READ.read_text()

    need(m.get("schema")=="420hz-gca-level2-milestone-v1","milestone schema drift")
    need(m.get("workPackage")=="HZ-GCA-1.20","milestone work package drift")
    need(m.get("qualificationLevel")==2,"HZ-GCA-1.20 must be Level 2")
    need(m.get("milestone") is True,"HZ-GCA-1.20 milestone flag missing")

    expected=[f"HZ-GCA-1.{i}" for i in range(1,20)]
    need(m.get("accumulatedRange")==expected,"accumulated HZ-GCA-1 range drift")

    main_sha=m.get("reconciledMainSha")
    need(main_sha=="0993ff5b5b3b213a0768dbde90e4734df5ab4cc0","reconciled main SHA drift")
    try:
        rc=subprocess.run(["git","merge-base","--is-ancestor",main_sha,"HEAD"],cwd=ROOT,check=False).returncode
        need(rc==0,"reconciled main is not an ancestor of exact qualification HEAD")
    except Exception as e:
        errors.append(f"unable to prove main ancestry: {e}")

    ci=m.get("currentMainIntegration",{})
    need(ci.get("disposition")=="RECONCILED_BEFORE_LEVEL2","current-main disposition drift")
    for x in ["Compute SDK","Compute API","Compute Indexer"]:
        need(x in ci.get("materialOverlap",[]),f"missing reconciled shared dependency: {x}")

    suite=m.get("retainedSuite",[])
    for token in ["all HZ-GCA-1.1 through HZ-GCA-1.19 targeted verifiers","420Hz web verifier","420AI Compute integration verifier","420AI provider runtime verifier","Compute SDK retained test suite","Compute API retained test suite","Compute Indexer retained test suite","HZ-GCA-1.20 milestone integration verifier"]:
        need(token in suite,f"retained Level-2 suite item missing: {token}")

    assertions=" ".join(m.get("requiredIntegrationAssertions",[]))
    for token in ["one owner per canonical domain","Generate lifecycle","Community source relations","RAW_PLAY","Wallet-only voting","moderation remains application scoped","actor/domain/resource/idempotency","timeouts/retries/restarts","private/unlisted","authoritative:false"]:
        need(token in assertions,f"Level-2 integration assertion missing: {token}")

    for forbidden in ["canonical full Solidity inventory","Genesis/address-authority full qualification","420 Integrated/global qualification","Geth/global fault/soak qualification","unrelated app audits","production deployment/config closeout"]:
        need(forbidden in m.get("forbiddenLevel3Work",[]),f"Level-3 exclusion missing: {forbidden}")

    need(cons.get("unresolvedAuthorityDuplication")==[],"authority duplication reappeared")
    findings=adv.get("findings",{})
    need(findings.get("criticalOpen")==0 and findings.get("highOpen")==0,"critical/high adversarial finding remains")
    need(findings.get("architectureContradictions")==0,"architecture contradiction remains")
    need(findings.get("unresolvedAuthorityDuplication")==0,"adversarial authority duplication remains")

    need(chart.get("authority",{}).get("chartState")=="DERIVED_PROJECTION_ONLY","Charts ceased to be derived")
    need("AwardVote is never a chart signal" in " ".join(chart.get("chartAwardsCommunitySeparation",[])),"AwardVote/chart separation drift")
    need(vote.get("policyModes",{}).get("voterEligibility")==["WALLET_ONE_ACCOUNT_ONE_VOTE","IDENTITY_UNIQUE_ONE_VOTE","JURY_ONE_MEMBER_ONE_VOTE"],"voter eligibility mode drift")
    need("ballot-scoped nullifier" in " ".join(vote.get("antiSybilRules",[])),"unique-human replay guard drift")
    need(mod.get("arbitrationIntegration",{}).get("adopted")=="OPTIONAL_EXPLICIT_ONLY","Arbitration optional/explicit guard drift")
    need("reconcile canonical/source authority before retrying" in " ".join(rec.get("recoveryPrinciples",[])),"canonical-first recovery guard drift")
    need("changed payload" in " ".join(api.get("idempotencyReplayRules",[])),"changed-payload idempotency guard drift")
    need("eligible PUBLIC read queries may omit actorRef/idempotencyKey" in " ".join(api.get("requestEnvelope",{}).get("rules",[])),"anonymous-read/API mutation separation drift")

    need("READY_FOR_WALLET_AUTHORIZATION" in capi,"reconciled Compute API lost unsigned Wallet-authorization status")
    need("canonicalState: false" in capi,"reconciled Compute API canonical-state negative flag missing")
    need("secretMaterialManaged: false" in capi,"reconciled Compute API secret-management negative flag missing")
    need("authoritative:false" in cread,"reconciled Compute Indexer projections are not explicitly non-authoritative")

    for token in [
      "CMP-7 SDK/API/CLI/Indexer materially overlapped",
      "The active HZ-GCA branch was therefore reconciled with current main before Level-2 qualification.",
      "every HZ-GCA-1.1 through HZ-GCA-1.19 verifier",
      "420AI current Compute integration verification",
      "Compute SDK retained tests",
      "Compute API retained tests",
      "Compute Indexer retained tests",
      "HZ-GCA-2 — Generation job and provider abstraction"
    ]:
        need(token in doc,f"milestone document token missing: {token}")

    need("HZ-GCA-1.20 — HZ-GCA-1 Level-2 milestone qualification" in roadmap,"roadmap HZ-GCA-1.20 missing")
    need("Level 2 — app integration milestone" in roadmap,"roadmap Level-2 classification missing")
    need(m.get("nextCanonicalStep")=="HZ-GCA-2 — Generation job and provider abstraction","next canonical step drift")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.20 Level-2 integration milestone",
  "qualificationLevel":2,
  "reconciledMain":None if errors else m.get("reconciledMainSha"),
  "accumulatedSteps":0 if errors else len(m.get("accumulatedRange",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
