#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
ADV=ROOT/"hz"/"config"/"gca-phase1-adversarial-review-v1.json"
CONS=ROOT/"hz"/"config"/"gca-architecture-consolidation-v1.json"
THREAT=ROOT/"hz"/"config"/"gca-threat-model-v1.json"
API=ROOT/"hz"/"config"/"gca-api-interface-contracts-v1.json"
REC=ROOT/"hz"/"config"/"gca-failure-recovery-v1.json"
MOD=ROOT/"hz"/"config"/"gca-moderation-dispute-v1.json"
VOTE=ROOT/"hz"/"config"/"gca-nomination-voting-policy-v1.json"
CHART=ROOT/"hz"/"config"/"gca-charts-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
ECON=ROOT/"hz"/"config"/"gca-generation-economics-v1.json"
STORE=ROOT/"hz"/"config"/"gca-storage-retention-v1.json"
RIGHTS=ROOT/"hz"/"config"/"gca-rights-consent-v1.json"
PRIV=ROOT/"hz"/"config"/"gca-privacy-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.19-PHASE1-ADVERSARIAL-REVIEW.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [ADV,CONS,THREAT,API,REC,MOD,VOTE,CHART,COMM,ECON,STORE,RIGHTS,PRIV,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    adv=json.loads(ADV.read_text())
    cons=json.loads(CONS.read_text())
    threat=json.loads(THREAT.read_text())
    api=json.loads(API.read_text())
    rec=json.loads(REC.read_text())
    mod=json.loads(MOD.read_text())
    vote=json.loads(VOTE.read_text())
    chart=json.loads(CHART.read_text())
    comm=json.loads(COMM.read_text())
    econ=json.loads(ECON.read_text())
    store=json.loads(STORE.read_text())
    rights=json.loads(RIGHTS.read_text())
    priv=json.loads(PRIV.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(adv.get("schema")=="420hz-gca-phase1-adversarial-review-v1","adversarial schema drift")
    need(adv.get("version")==1,"adversarial version drift")
    need(adv.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(adv.get("workPackage")=="HZ-GCA-1.19","work package drift")
    need(adv.get("level")==1,"HZ-GCA-1.19 must remain Level 1")
    need(adv.get("milestoneRequired") is False,"HZ-GCA-1.19 must not become Level-2 milestone")

    expected_wps=[f"HZ-GCA-1.{i}" for i in range(1,19)]
    need(adv.get("reviewedArchitecture")==expected_wps,"reviewed architecture range/order drift")
    need(cons.get("workPackage")=="HZ-GCA-1.18","HZ-GCA-1.18 prerequisite drift")
    need(cons.get("unresolvedAuthorityDuplication")==[],"consolidation has unresolved authority duplication")

    cm=adv.get("currentMainReview",{})
    need(cm.get("sha")=="dbe29983986fefb77a4e78ff96a3689c8589f956","current-main review SHA drift")
    need("CMP-7 SDK/API/CLI/Indexer" in cm.get("materialSharedChange",""),"current-main CMP-7 review missing")
    need(len(cm.get("reviewedFiles",[]))==4,"current-main reviewed-file set drift")
    need("No HZ-GCA authority contradiction found" in cm.get("conclusion",""),"current-main contradiction disposition missing")
    need("authoritative:false" in cm.get("conclusion",""),"current-main derived Compute projection check missing")

    methods=" ".join(adv.get("reviewMethod",[]))
    for token in [
      "lower-authority or derived source",
      "visibility widening",
      "idempotency/replay",
      "rights/consent",
      "quote/funding/earned/paid/refund",
      "storage/recovery",
      "Community/Charts/Awards",
      "Awards determinism",
      "moderation/Arbitration",
      "dependency failure/restart",
      "current main shared-dependency"
    ]:
        need(token in methods,f"review method missing: {token}")

    cases=adv.get("cases",[])
    need(len(cases)==40,f"expected 40 adversarial cases, found {len(cases)}")
    ids=[x.get("id") for x in cases]
    for i in range(1,41):
        need(f"HZGCA-ADV-{i:03d}" in ids,f"missing adversarial case HZGCA-ADV-{i:03d}")
    for case in cases:
        need(case.get("disposition")=="PASS",f"{case.get('id')} is not PASS")
        need(bool(case.get("attack")) and bool(case.get("expectedOutcome")),f"{case.get('id')} missing attack/outcome")
        need(isinstance(case.get("sources"),list) and len(case["sources"])>=1,f"{case.get('id')} missing controlling sources")
        need(bool(case.get("residualRisk")),f"{case.get('id')} missing residual risk")
        for source in case.get("sources",[]):
            need(source in expected_wps or source=="CURRENT_MAIN_CMP7",f"{case.get('id')} unknown controlling source: {source}")

    categories={x.get("category") for x in cases}
    for cat in ["AUTHORITY","AI_PROVIDER","RIGHTS","CONSENT","PRIVACY","STORAGE","ECONOMICS","REPLAY","COMMUNITY","CHARTS","AWARDS","MODERATION","ARBITRATION","DERIVED_STATE","RECOVERY","CONFUSED_DEPUTY","DEPENDENCY_FAILURE","MAIN_DRIFT","AUTHORITY_DUPLICATION"]:
        need(cat in categories,f"adversarial category missing: {cat}")

    findings=adv.get("findings",{})
    for key in ["criticalOpen","highOpen","mediumOpen","lowOpen","architectureContradictions","unresolvedAuthorityDuplication"]:
        need(findings.get(key)==0,f"open finding blocks completion: {key}={findings.get(key)}")
    need(findings.get("disposition")=="PASS","phase adversarial disposition must be PASS")

    residual=" ".join(adv.get("acceptedResidualRisks",[]))
    for token in ["probabilistic","Wallet-one-account-one-vote","social collusion","evidence availability","anti-bot","legal/personality"]:
        need(token in residual,f"accepted residual risk missing: {token}")

    deferred=" ".join(adv.get("deferredRuntimeAdversarialEvidence",[]))
    for token in ["AI worker sandbox","media scanner","idempotency","settlement/refund","storage backup/restore","qualified-play","unique-human","moderation privilege","Arbitration","public-testnet"]:
        need(token in deferred,f"deferred runtime adversarial evidence missing: {token}")

    completion=" ".join(adv.get("completionRules",[]))
    for token in ["criticalOpen and highOpen must be zero","architectureContradictions and unresolvedAuthorityDuplication must be zero","every case must cite","deferred runtime attacks","HZ-GCA-1.20 Level-2 milestone"]:
        need(token in completion,f"completion rule missing: {token}")

    # Cross-policy guards: adversarial review must be backed by already-qualified source rules.
    need(api.get("workPackage")=="HZ-GCA-1.16","API prerequisite drift")
    need(rec.get("workPackage")=="HZ-GCA-1.17","recovery prerequisite drift")
    need(threat.get("workPackage")=="HZ-GCA-1.15","threat-model prerequisite drift")
    need(mod.get("arbitrationIntegration",{}).get("adopted")=="OPTIONAL_EXPLICIT_ONLY","Arbitration optional/explicit guard drift")
    need(vote.get("policyModes",{}).get("voterEligibility")==["WALLET_ONE_ACCOUNT_ONE_VOTE","IDENTITY_UNIQUE_ONE_VOTE","JURY_ONE_MEMBER_ONE_VOTE"],"Awards voter modes drift")
    need(chart.get("authority",{}).get("chartState")=="DERIVED_PROJECTION_ONLY","Charts derived-state guard drift")
    need(econ.get("feePolicy",{}).get("hidden420HzSurcharge")=="forbidden","hidden fee guard drift")
    need(priv.get("classes") is not None,"privacy classes missing")
    need(len(store.get("invariants",[]))==18,"storage invariants drift")
    need(len(rights.get("invariants",[]))==18,"rights/consent invariants drift")
    need(len(comm.get("invariants",[]))==18,"Community invariants drift")

    chart_sep=" ".join(chart.get("chartAwardsCommunitySeparation",[]))
    need("AwardVote is never a chart signal" in chart_sep,"AwardVote/chart separation drift")
    anti=" ".join(vote.get("antiSybilRules",[]))
    need("ballot-scoped nullifier" in anti,"unique-human anti-Sybil nullifier guard missing")
    modrules=" ".join(mod.get("moderatorRules",[]))
    need("cannot directly alter a finalized AwardResult" in modrules,"moderator/AwardResult guard missing")
    reprinciples=" ".join(rec.get("recoveryPrinciples",[]))
    need("reconcile canonical/source authority before retrying" in reprinciples,"canonical-first recovery guard missing")
    api_rules=" ".join(api.get("idempotencyReplayRules",[]))
    need("changed payload" in api_rules and "stable eventId" in api_rules,"API replay guards missing")

    for source in adv.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing adversarial-review source: {source}")

    doc_tokens=[
      "**PASS**",
      "Critical: 0",
      "High: 0",
      "Unresolved authority duplication: 0",
      "HZGCA-ADV-001 through HZGCA-ADV-040",
      "Wallet-only mode described as one-person-one-vote",
      "RAW_PLAY becoming QUALIFIED_PLAY",
      "ordinary report auto-opening Arbitration",
      "No HZ-GCA authority contradiction was identified.",
      "authoritative:false",
      "HZ-GCA-1.20 — HZ-GCA-1 Level-2 milestone qualification"
    ]
    for token in doc_tokens:
        need(token in doc,f"adversarial report token missing: {token}")

    need("HZ-GCA-1.19 — Phase-1 adversarial review" in roadmap,"roadmap HZ-GCA-1.19 missing")
    need("machine-readable adversarial matrix" in roadmap,"roadmap adversarial deliverable missing")
    need("final ordinary HZ-GCA-1 architecture substep" in roadmap,"roadmap milestone relationship missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.19 Phase-1 adversarial review",
  "level":1,
  "cases":0 if errors else len(adv.get("cases",[])),
  "criticalOpen":None if errors else adv.get("findings",{}).get("criticalOpen"),
  "highOpen":None if errors else adv.get("findings",{}).get("highOpen"),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
