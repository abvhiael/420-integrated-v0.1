#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
THREAT=ROOT/"hz"/"config"/"gca-threat-model-v1.json"
MOD=ROOT/"hz"/"config"/"gca-moderation-dispute-v1.json"
VOTE=ROOT/"hz"/"config"/"gca-nomination-voting-policy-v1.json"
CHART=ROOT/"hz"/"config"/"gca-charts-v1.json"
ECON=ROOT/"hz"/"config"/"gca-generation-economics-v1.json"
STORE=ROOT/"hz"/"config"/"gca-storage-retention-v1.json"
RIGHTS=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.6-RIGHTS-CONSENT-BOUNDARIES.md"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.15-THREAT-MODEL.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [THREAT,MOD,VOTE,CHART,ECON,STORE,RIGHTS,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    t=json.loads(THREAT.read_text())
    mod=json.loads(MOD.read_text())
    vote=json.loads(VOTE.read_text())
    chart=json.loads(CHART.read_text())
    econ=json.loads(ECON.read_text())
    store=json.loads(STORE.read_text())
    rights=RIGHTS.read_text()
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(t.get("schema")=="420hz-gca-threat-model-v1","threat schema drift")
    need(t.get("version")==1,"threat version drift")
    need(t.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(t.get("workPackage")=="HZ-GCA-1.15","work package drift")
    need(t.get("level")==1,"HZ-GCA-1.15 must remain Level 1")
    need(t.get("milestoneRequired") is False,"HZ-GCA-1.15 must not become Level-2 milestone")

    need(mod.get("workPackage")=="HZ-GCA-1.14","HZ-GCA-1.14 prerequisite drift")
    need(vote.get("workPackage")=="HZ-GCA-1.13","HZ-GCA-1.13 prerequisite drift")
    need(chart.get("workPackage")=="HZ-GCA-1.11","HZ-GCA-1.11 prerequisite drift")
    need(econ.get("workPackage")=="HZ-GCA-1.9","HZ-GCA-1.9 prerequisite drift")
    need(store.get("workPackage")=="HZ-GCA-1.8","HZ-GCA-1.8 prerequisite drift")

    assets=t.get("protectedAssets",[])
    for token in ["Wallet/session actor authority","private generation prompts","provider credentials","generation provenance","canonical Creative","community follow/favorite/playlist","Award season/category","moderation reports","storage integrity hashes","service configuration"]:
        need(any(token in x for x in assets),f"protected asset missing: {token}")

    bounds=t.get("trustBoundaries",[])
    for token in ["Wallet/SmartAccount","420AI/Compute Market","Creative Protocol / 420 Rights","Storage/Resource","Community source state -> Charts","Wallet/Identity eligibility -> Awards","optional 420Arbitration","operator/CI/deployment credentials"]:
        need(any(token in x for x in bounds),f"trust boundary missing: {token}")

    adversaries=t.get("adversaries",[])
    for token in ["Sybil Wallet","prompt/tool/provider injection","reference-audio uploader","voice/persona","AI worker/provider","storage gateway/provider","chart manipulator","collusive nominator","compromised moderator","compromised operator"]:
        need(any(token in x for x in adversaries),f"adversary class missing: {token}")

    threats=t.get("threatCatalogue",[])
    need(len(threats)==24,f"expected 24 threats, found {len(threats)}")
    ids=[x.get("id") for x in threats]
    for i in range(1,25):
        need(f"HZGCA-THREAT-{i:03d}" in ids,f"threat ID missing HZGCA-THREAT-{i:03d}")
    for x in threats:
        need(bool(x.get("name")) and bool(x.get("surface")) and bool(x.get("risk")),"threat missing identity/surface/risk")
        need(len(x.get("mitigations",[]))>=3,f"{x.get('id')} has insufficient mitigations")
        need(bool(x.get("residual")) ,f"{x.get('id')} missing residual-risk disposition")

    names=" ".join(x.get("name","") for x in threats)
    for token in [
      "Prompt/tool injection","Provider/result spoofing","Malicious media/metadata","Unsafe URL/HTML schemes",
      "Unauthorized reference audio","Unconsented voice/persona","Derivative-rights bypass",
      "Private draft/prompt leakage","Secrets/provider-token leakage","Generation spam/resource exhaustion",
      "Wallet/session replay or domain substitution","Storage hash mismatch/resurrection","Stale/reorged derived state",
      "Chart manipulation","Collusive nominations","Vote stuffing/Sybil voting","Moderation/report bypass or abuse",
      "Arbitration authority escalation","Cross-component confused deputy"
    ]:
        need(token in names,f"canonical threat class missing: {token}")

    accepted=" ".join(t.get("acceptedDesignRisks",[]))
    for token in ["probabilistic","Wallet-one-account-one-vote","social collusion","evidence availability","runtime/testnet evidence","legal rights/personality"]:
        need(token in accepted,f"accepted design risk missing: {token}")

    closed=" ".join(t.get("failClosedRules",[]))
    for token in ["actor, chain, domain","provider/result mismatch","reference/voice/derivative","private/unlisted","stale/unverified","hash/integrity","quote/funding/accepted-price","Awards policy","Arbitration","service identity/version"]:
        need(token in closed,f"fail-closed rule missing: {token}")

    inv=t.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-THREAT-INV-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-THREAT-INV-{i:03d} "),f"invariant numbering drift at {i}")

    deferred=" ".join(t.get("deferredRuntimeEvidence",[]))
    for token in ["AI worker sandbox","media scanner","edge rate limiting","secret manager","qualified-play","unique-human","evidence host","public-testnet","incident response"]:
        need(token in deferred,f"deferred runtime evidence missing: {token}")

    need("transformation permission" in rights and "training" in rights,"rights/training separation prerequisite missing")
    need(any("24h" in x for x in store.get("retentionSchedule",[]) if isinstance(x,str)) or "24h" in json.dumps(store),"provider retention prerequisite missing")
    need(econ.get("feePolicy",{}).get("hidden420HzSurcharge")=="forbidden","generation economics hidden-fee guard drift")
    need(chart.get("authority",{}).get("chartState")=="DERIVED_PROJECTION_ONLY","Charts derived-authority prerequisite drift")
    need(vote.get("policyModes",{}).get("voterEligibility")==["WALLET_ONE_ACCOUNT_ONE_VOTE","IDENTITY_UNIQUE_ONE_VOTE","JURY_ONE_MEMBER_ONE_VOTE"],"Awards voter-mode prerequisite drift")
    need(mod.get("arbitrationIntegration",{}).get("adopted")=="OPTIONAL_EXPLICIT_ONLY","Arbitration adoption prerequisite drift")

    for source in t.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing threat source: {source}")

    for token in [
      "Model prose is never authority.",
      "Wallet connection alone is not approval.",
      "A raw play is not automatically a qualified play.",
      "Wallet-only mode is explicitly account uniqueness, not human uniqueness.",
      "Opening a case is not a ruling.",
      "Dependency failure never falls back to guessed authority.",
      "HZ-GCA-1.16 — API/event/interface contracts"
    ]:
        need(token in doc,f"normative threat-model token missing: {token}")

    need("HZ-GCA-1.15 — Threat model" in roadmap,"roadmap HZ-GCA-1.15 missing")
    need("machine-readable threat manifest" in roadmap,"roadmap threat-model deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.15 threat model",
  "level":1,
  "threats":0 if errors else len(t.get("threatCatalogue",[])),
  "invariants":0 if errors else len(t.get("invariants",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
