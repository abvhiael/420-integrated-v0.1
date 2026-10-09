#!/usr/bin/env python3
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[1]
CONS=ROOT/"hz"/"config"/"gca-architecture-consolidation-v1.json"
MASTER=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1-ARCHITECTURE.md"
INDEX=ROOT/"docs"/"architecture"/"420hz"/"index.md"
ARCH_INDEX=ROOT/"docs"/"architecture"/"index.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [CONS,MASTER,INDEX,ARCH_INDEX,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    cons=json.loads(CONS.read_text())
    master=MASTER.read_text()
    index=INDEX.read_text()
    arch_index=ARCH_INDEX.read_text()
    roadmap=ROADMAP.read_text()

    need(cons.get("schema")=="420hz-gca-architecture-consolidation-v1","consolidation schema drift")
    need(cons.get("version")==1,"consolidation version drift")
    need(cons.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(cons.get("workPackage")=="HZ-GCA-1.18","work package drift")
    need(cons.get("level")==1,"HZ-GCA-1.18 must remain Level 1")
    need(cons.get("milestoneRequired") is False,"HZ-GCA-1.18 must not become Level-2 milestone")

    scope=cons.get("consolidationScope",{})
    expected_wps=[f"HZ-GCA-1.{i}" for i in range(1,18)]
    need(scope.get("includes")==expected_wps,"consolidation package order/scope drift")
    need(scope.get("normativeEntryPoint")=="docs/architecture/420hz/HZ-GCA-1-ARCHITECTURE.md","normative entry point drift")
    need(scope.get("architectureIndex")=="docs/architecture/420hz/index.md","architecture index path drift")
    need("subordinate manifests remain normative" in scope.get("rule",""),"subordinate normative-precedence rule missing")

    packages=cons.get("packages",[])
    need(len(packages)==17,f"expected 17 indexed packages, found {len(packages)}")
    seen=[]
    for i,pkg in enumerate(packages,1):
        wp=f"HZ-GCA-1.{i}"
        need(pkg.get("workPackage")==wp,f"package order drift at {wp}")
        need(pkg.get("qualificationLevel")==1,f"{wp} consolidation qualification-level drift")
        mpath=ROOT/pkg.get("manifest","")
        dpath=ROOT/pkg.get("document","")
        need(mpath.is_file(),f"missing indexed manifest {pkg.get('manifest')}")
        need(dpath.is_file(),f"missing indexed document {pkg.get('document')}")
        if mpath.is_file():
            m=json.loads(mpath.read_text())
            need(m.get("canonicalStep")=="HZ-GCA-1",f"{wp} canonicalStep drift")
            need(m.get("workPackage")==wp,f"{wp} manifest workPackage drift")
            need(m.get("level")==1,f"{wp} manifest Level drift")
            need(m.get("milestoneRequired") is False,f"{wp} manifest milestone drift")
            need(bool(m.get("schema")),f"{wp} schema missing")
            seen.append(m.get("workPackage"))
        if dpath.is_file():
            text=dpath.read_text()
            need(wp in text,f"{wp} missing from indexed document")
    need(seen==expected_wps,"indexed manifest work packages are incomplete/out of order")

    ledger=cons.get("authorityLedger",[])
    domains={x.get("domain"):x for x in ledger}
    for domain in [
      "Wallet/SmartAccount authorization",
      "Identity/eligibility credentials",
      "AI generation execution",
      "Creative publication identity",
      "Rights/licenses/provenance authority",
      "Private Generate project/workspace state",
      "Artifact storage availability/integrity",
      "Generation funding/settlement",
      "Community source relations",
      "Charts",
      "Awards product state",
      "Moderation application enforcement",
      "Arbitration",
      "Indexer/Search",
      "Analytics",
      "Notifications",
      "Governance"
    ]:
        need(domain in domains,f"authority ledger domain missing: {domain}")

    need(domains["Charts"].get("derived") is True,"Charts must remain derived")
    need(domains["Indexer/Search"].get("derived") is True,"Indexer/Search must remain derived")
    need(domains["Analytics"].get("derived") is True,"Analytics must remain derived")
    need(domains["Notifications"].get("derived") is True,"Notifications must remain derived")
    for domain in ["Wallet/SmartAccount authorization","AI generation execution","Creative publication identity","Rights/licenses/provenance authority","Community source relations","Awards product state"]:
        need(domains[domain].get("derived") is False,f"{domain} cannot be marked derived authority")

    avd=cons.get("authoritativeVsDerived",{})
    need("Derived state cannot authorize protected writes or override authoritative source state."==avd.get("rule"),"authoritative/derived rule drift")
    for token in ["ChartSnapshot rankings","Indexer projections","Search ranking/discovery","Analytics aggregates","Notification delivery state"]:
        need(token in avd.get("derived",[]),f"derived-state entry missing: {token}")

    obj=cons.get("objectDomains",{})
    for k in ["generate","community","charts","awards"]:
        need(isinstance(obj.get(k),list) and obj[k],f"object-domain group missing: {k}")
    need("GenerationProject" in obj["generate"],"Generate object consolidation missing")
    need("ArtistFollow" in obj["community"],"Community object consolidation missing")
    need(obj["charts"]==["ChartSnapshot"],"Charts object consolidation drift")
    need("AwardVote" in obj["awards"] and "AwardResult" in obj["awards"],"Awards object consolidation missing")

    need(cons.get("generateLifecycle")==["DRAFT","QUOTED","SUBMITTED","RUNNING","SUCCEEDED","REVIEWED","REGISTERED","PUBLISHED"],"Generate lifecycle consolidation drift")
    need(cons.get("generateTerminalRunStates")==["FAILED","CANCELLED"],"Generate terminal states drift")
    need(cons.get("disclosureClasses")==["HUMAN","AI_ASSISTED","AI_GENERATED","AI_DERIVATIVE"],"disclosure classes drift")
    need(cons.get("privacyClasses")==["PUBLIC","UNLISTED","PRIVATE","SECRET"],"privacy classes drift")

    seps=" ".join(cons.get("architectureSeparations",[]))
    for token in [
      "transformation permission is distinct from training permission",
      "Generate success is distinct from Creative registration/publication",
      "raw play is distinct from qualified play",
      "Community relation is distinct from Chart credit",
      "Chart rank is distinct from Awards eligibility/result",
      "AwardVote is distinct from Chart, Community and Civic/Governance voting",
      "moderation application enforcement is distinct from Creative/Rights/Identity/Wallet/payment/governance authority",
      "Arbitration ruling is a bounded input",
      "partial output is distinct from verified success/publication/settlement"
    ]:
        need(token in seps,f"architecture separation missing: {token}")

    cross=cons.get("crossCuttingRules",{})
    for key in ["authorization","privacy","storage","economics","charts","awards","moderation","recovery"]:
        need(isinstance(cross.get(key),str) and cross[key].strip(),f"cross-cutting rule missing: {key}")

    need(cons.get("unresolvedAuthorityDuplication")==[],"unresolved authority duplication must be empty")

    consistency=" ".join(cons.get("consistencyRules",[]))
    for token in [
      "HZ-GCA-1.1 through HZ-GCA-1.17",
      "every indexed manifest/document path must exist",
      "unresolvedAuthorityDuplication must remain empty",
      "authoritative vs derived state",
      "exact subordinate normative documents"
    ]:
        need(token in consistency,f"consistency rule missing: {token}")

    for source in cons.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing consolidation source: {source}")

    for wp in expected_wps:
        need(wp in master,f"master architecture missing {wp}")
        need(wp in index,f"420Hz architecture index missing {wp}")

    master_tokens=[
      "Unresolved authority duplication: NONE.",
      "Derived state cannot authorize protected writes or override authoritative state.",
      "DRAFT → QUOTED → SUBMITTED → RUNNING → SUCCEEDED → REVIEWED → REGISTERED → PUBLISHED",
      "HUMAN",
      "AI_ASSISTED",
      "AI_GENERATED",
      "AI_DERIVATIVE",
      "PUBLIC",
      "UNLISTED",
      "PRIVATE",
      "SECRET",
      "A ChartSnapshot is a **derived, deterministic, rebuildable projection**.",
      "Wallet-only voting never claims one-person-one-vote.",
      "Reports are allegations, not findings.",
      "reconcile canonical/source authority before retrying any action",
      "HZ-GCA-1.19 — Phase-1 adversarial review"
    ]
    for token in master_tokens:
        need(token in master,f"master architecture token missing: {token}")

    need("420Hz Generate + Community + Awards architecture" in arch_index,"global architecture index missing 420Hz entry")
    need("machine-readable consolidation manifest" in roadmap,"roadmap consolidation deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

    need(re.search(r"0x[a-fA-F0-9]{40}",json.dumps(cons)) is None,"HZ-GCA-1.18 must not assign a deployed address")
    need("https://" not in json.dumps(cons) and "http://" not in json.dumps(cons),"HZ-GCA-1.18 must not invent a production endpoint")
    need("420/service/420hz" not in json.dumps(cons).lower(),"HZ-GCA-1.18 must not invent a 420Hz service ID")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.18 architecture documentation consolidation",
  "level":1,
  "packages":0 if errors else len(cons.get("packages",[])),
  "authorityDomains":0 if errors else len(cons.get("authorityLedger",[])),
  "unresolvedAuthorityDuplication":None if errors else len(cons.get("unresolvedAuthorityDuplication",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
