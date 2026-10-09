#!/usr/bin/env python3
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"hz"/"config"/"gca-compute-execution-adapter-v1.json"
ADAPTER=ROOT/"hz"/"generate"/"src"/"compute-adapter.js"
TEST=ROOT/"hz"/"generate"/"test"/"compute-adapter.test.js"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-3-COMPUTE-EXECUTION-ADAPTER.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
H2=ROOT/"hz"/"config"/"gca-generation-provider-abstraction-v1.json"
AI=ROOT/"contracts"/"src"/"ai"/"AIComputeAdapter420.sol"
SDK=ROOT/"packages"/"420-sdk"/"src"/"compute-client.ts"
API=ROOT/"services"/"compute-api"/"src"/"job-api.ts"
RUNTIME=ROOT/"services"/"420ai-provider"/"src"/"runtime.js"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [M,ADAPTER,TEST,DOC,ROADMAP,H2,AI,SDK,API,RUNTIME]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    m=json.loads(M.read_text())
    adapter=ADAPTER.read_text()
    tests=TEST.read_text()
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()
    h2=json.loads(H2.read_text())
    ai=AI.read_text()
    sdk=SDK.read_text()
    api=API.read_text()
    runtime=RUNTIME.read_text()

    need(m.get("schema")=="420hz-gca-compute-execution-adapter-v1","manifest schema drift")
    need(m.get("version")==1,"manifest version drift")
    need(m.get("canonicalStep")=="HZ-GCA-3","canonical step drift")
    need(m.get("qualificationLevel")==1,"HZ-GCA-3 must remain Level 1")
    need(m.get("milestoneRequired") is False,"HZ-GCA-3 must not silently become Level 2")
    need(h2.get("canonicalStep")=="HZ-GCA-2","HZ-GCA-2 prerequisite drift")

    dep=m.get("dependsOn",{})
    need(dep.get("priorStep")=="HZ-GCA-2","prior-step dependency drift")
    need(dep.get("canonicalAIAdapter")=="contracts/src/ai/AIComputeAdapter420.sol","AI adapter dependency drift")
    need(dep.get("canonicalComputeSdk")=="packages/420-sdk/src/compute-client.ts","Compute SDK dependency drift")
    need(dep.get("computeApi")=="services/compute-api/src/job-api.ts","Compute API dependency drift")
    need(dep.get("providerRuntime")=="services/420ai-provider/src/runtime.js","provider runtime dependency drift")

    a=m.get("adapter",{})
    need(a.get("class")=="ComputeMarketGenerationProvider420","adapter class drift")
    need(a.get("developmentClient")=="DeterministicDevelopmentComputeClient420","development client drift")
    need(a.get("workloadClass")=="MUSIC_GENERATION","workload class drift")
    need(a.get("providerIdentity")=="420ai-compute-market","provider identity drift")
    need(a.get("publicationAuthority") is False,"adapter cannot gain publication authority")
    need(a.get("settlementAuthority") is False,"adapter cannot gain settlement authority")
    need(a.get("custodyAuthority") is False,"adapter cannot gain custody authority")

    d=m.get("discovery",{})
    need(d.get("mustBeNonAuthoritative") is True,"Compute discovery must remain non-authoritative")
    for key in ["computeProviderId","workerId","resourceId","modelId","modelVersion","availableCapacityUnits","quotedPrice","authoritative"]:
        need(key in d.get("requiredCandidateFields",[]),f"candidate field missing: {key}")
    sel=d.get("selectionOrder",[])
    need(sel==["lowest quoted price","highest available capacity","highest reputation score","highest SLA score","stable provider/resource identity"],"selection order drift")
    need(d.get("reputationAndSla")=="non-authoritative selection signals only","reputation/SLA authority drift")

    sub=m.get("submission",{})
    need(sub.get("canonicalEnvironment")==["chainId","computeGraphHash"],"canonical environment binding drift")
    rules=" ".join(sub.get("planRules",[]))
    for token in ["requiresWalletAuthorization=true","canonicalAuthority=false","secretMaterialManaged=false"]:
        need(token in rules,f"submission plan rule missing: {token}")
    for key in ["computeRequestId","computeJobId","acceptedMatchRef","fundingRef","computeProviderId","workerId","resourceId","acceptedPrice"]:
        need(key in sub.get("acceptedBinding",[]),f"accepted binding missing: {key}")

    econ=m.get("economics",{})
    need(econ.get("quoteFields")==["quotedPrice","quoteAsset","maximumPrice"],"quote economics drift")
    need(econ.get("acceptedFields")==["acceptedPrice","fundingRef","acceptedMatchRef"],"accepted economics drift")
    need(econ.get("verificationFields")==["resultCommitment","verificationRef","verificationVerdict"],"verification economics drift")
    need(econ.get("settlementFields")==["entitlementRef","settlementRef"],"settlement fields drift")
    need(econ.get("cancellationFields")==["refundRef"],"refund observation drift")
    erules=" ".join(econ.get("rules",[]))
    for token in ["remain distinct","never fabricates PAID or REFUNDED","accepted price must equal","Wallet authorization"]:
        need(token in erules,f"economic rule missing: {token}")

    life=m.get("lifecycleMapping",{})
    for x in ["CREATED","FUNDED","MATCHED","ACCEPTED","RUNNING","RESULT_COMMITTED","DISPUTED"]:
        need(x in life.get("running",[]),f"running mapping missing {x}")
    need(life.get("success")==["VERIFIED","SETTLED"],"success mapping drift")
    need(life.get("cancelled")==["CANCELLED"],"cancel mapping drift")
    for token in ["verificationVerdict=PASS","verificationRef","resultCommitment","valid provider-neutral output manifest"]:
        need(token in life.get("successRequirements",[]),f"success requirement missing: {token}")

    out=m.get("output",{})
    need(out.get("providerNeutralKinds")==["MIX","STEM","LYRICS_TIMING","ARTWORK"],"output kinds drift")
    need(out.get("required")==["MIX"],"MIX requirement drift")
    need(out.get("verificationRequired") is True,"verification requirement missing")
    need(out.get("providerSpecificPublicationSemantics") is False,"provider-specific publication semantics forbidden")

    cancel=m.get("cancellation",{})
    need(cancel.get("authorizationRequired") is True,"cancel authorization missing")
    need(cancel.get("confirmationRequired") is True,"cancel confirmation missing")
    need(cancel.get("refundRefMayBeObserved") is True,"refund observation missing")
    need(cancel.get("refundRefDoesNotMeanPaid") is True,"refund/payment separation missing")

    dev=m.get("developmentAdapter",{})
    need(dev.get("nonProduction") is True,"development adapter must remain non-production")
    need(dev.get("deterministic") is True,"development adapter must remain deterministic")
    need(dev.get("usesSameProviderInterface") is True,"dev adapter provider-interface parity missing")
    need(dev.get("usesSameGenerationJobManagerLifecycle") is True,"dev adapter lifecycle parity missing")
    for x in ["fundingRef","acceptedMatchRef","resultCommitment","verificationRef","entitlementRef","settlementRef","refundRef"]:
        need(x in dev.get("produces",[]),f"development evidence field missing: {x}")

    boundaries=" ".join(m.get("authorityBoundaries",[]))
    for token in [
      "discovery is non-authoritative",
      "reputation/SLA cannot bypass",
      "not transaction authorization",
      "does not sign or hold Wallet secrets",
      "does not create funding, settlement or refund authority",
      "does not imply Creative registration or publication",
      "does not create Rights or consent authority",
      "without changing publication semantics"
    ]:
        need(token in boundaries,f"authority boundary missing: {token}")

    inv=m.get("invariants",[])
    need(len(inv)==18,"expected HZGCA3-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA3-{i:03d} "),f"invariant numbering drift at {i}")

    for token in [
      "class ComputeMarketGenerationProvider420",
      "class DeterministicDevelopmentComputeClient420",
      "selectComputeCandidate420",
      'workloadClass:"MUSIC_GENERATION"',
      "requiresWalletAuthorization!==true",
      "canonicalAuthority!==false",
      "secretMaterialManaged!==false",
      "acceptedMatchRef",
      "fundingRef",
      "verificationVerdict",
      "entitlementRef",
      "settlementRef",
      "refundRef",
      "Compute environment mismatch",
      "accepted price changed",
      "Compute result not positively verified"
    ]:
        need(token in adapter,f"adapter implementation missing: {token}")

    for token in [
      "capacity-aware selection prefers lower price",
      "capacity-aware selection rejects unavailable and over-budget",
      "non-authoritative tie breakers only",
      "same GenerationJobManager lifecycle end to end",
      "unsigned authorization plan",
      "missing authorization fails",
      "repeated submit remains one canonical Compute job",
      "assignment or accepted-price drift fails closed",
      "positive verification is required",
      "cancellation is authorized",
      "wrong chain or Compute graph fails",
      "preserves funding, verification, entitlement and settlement references separately"
    ]:
        need(token in tests,f"required HZ-GCA-3 test missing: {token}")

    # Shared repository compatibility guards.
    for token in ["bindComputeRequest","AcceptedComputeBound","ComputeResultSynchronized","VerifiedEntitlementBound","SettlementObserved","RefundObserved"]:
        need(token in ai,f"canonical AI Compute adapter surface missing: {token}")
    need("canonicalAuthority: false" in sdk,"Compute SDK must remain non-authoritative intent preparation")
    need("requiresWalletAuthorization: true" in sdk,"Compute SDK Wallet authorization guard missing")
    need("secretMaterialManaged: false" in sdk,"Compute SDK secret-management guard missing")
    need("READY_FOR_WALLET_AUTHORIZATION" in api,"Compute API unsigned Wallet handoff missing")
    need("authoritative: false" in api,"Compute API projection non-authority missing")
    need("computeGraphHash" in runtime and "provider identity mismatch" in runtime,"provider runtime canonical binding guards missing")

    need("**non-authoritative projections**" in doc,"non-authoritative discovery doc missing")
    need("Reputation and SLA are explicitly **non-authoritative selection signals**." in doc,"reputation/SLA doc boundary missing")
    need("420Hz does not sign or hold Wallet private material." in doc,"Wallet secret boundary missing")
    need("does not imply REGISTERED or PUBLISHED" in doc,"publication separation missing")
    need("HZ-GCA-4 — Provenance, consent and AI rights metadata" in doc,"next canonical step missing from doc")

    need("## HZ-GCA-3 — 420AI / Compute Market execution adapter" in roadmap,"canonical HZ-GCA-3 roadmap step missing")
    need("Compute Market worker/provider capability discovery" in roadmap,"canonical discovery requirement missing")
    need("capacity-aware selection" in roadmap,"canonical capacity selection requirement missing")
    need("price quote / escrow / settlement integration" in roadmap,"canonical economic integration requirement missing")
    need("result commitment and verification hooks" in roadmap,"canonical verification requirement missing")
    need("provider reputation/SLA inputs as non-authoritative selection signals" in roadmap,"canonical selection-signal boundary missing")
    need("end-to-end test generation using a qualified non-production adapter" in roadmap,"canonical exit requirement missing")
    need("Level 1 ordinary app-scoped integration step" in roadmap,"HZ-GCA-3 Level-1 classification missing")

    for source in [dep.get("canonicalAIAdapter"),dep.get("canonicalComputeSdk"),dep.get("computeApi"),dep.get("providerRuntime")]:
        need((ROOT/source).is_file(),f"missing shared dependency: {source}")

    blob=json.dumps(m)+"\n"+adapter
    need(re.search(r"0x[a-fA-F0-9]{40}",blob) is None,"HZ-GCA-3 must not invent deployed contract addresses")
    need("https://" not in adapter and "http://" not in adapter,"HZ-GCA-3 must not invent production provider endpoints")
    need(m.get("nextCanonicalStep")=="HZ-GCA-4 — Provenance, consent and AI rights metadata","next canonical step drift")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-3 420AI Compute Market execution adapter",
  "qualificationLevel":1,
  "invariants":0 if errors else len(m.get("invariants",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
