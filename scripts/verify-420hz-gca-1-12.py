#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
AWARD=ROOT/"hz"/"config"/"gca-awards-architecture-v1.json"
OBJECTS=ROOT/"hz"/"config"/"gca-object-model-v1.json"
CHART=ROOT/"hz"/"config"/"gca-charts-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.12-AWARDS-ARCHITECTURE.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [AWARD,OBJECTS,CHART,COMM,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    award=json.loads(AWARD.read_text())
    objects=json.loads(OBJECTS.read_text())
    chart=json.loads(CHART.read_text())
    comm=json.loads(COMM.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(award.get("schema")=="420hz-gca-awards-architecture-v1","Awards schema drift")
    need(award.get("version")==1,"Awards version drift")
    need(award.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(award.get("workPackage")=="HZ-GCA-1.12","work package drift")
    need(award.get("level")==1,"HZ-GCA-1.12 must remain Level 1")
    need(award.get("milestoneRequired") is False,"HZ-GCA-1.12 must not become Level-2 milestone")

    auth=award.get("authority",{})
    expected_owned=["AwardProgram","AwardSeason","AwardCategory","EligibilityPolicy","AwardNomination","AwardBallot","AwardVote","AwardResult","AwardBadge"]
    need(auth.get("owns")==expected_owned,"Awards-owned object set drift")
    ext=auth.get("externalAuthorities",{})
    for key in ["creative","wallet","identity","governance","charts","community","pay","search","notifications"]:
        need(isinstance(ext.get(key),str) and ext[key].strip(),f"external Awards authority missing: {key}")

    graph=" ".join(award.get("objectGraph",[]))
    for token in ["AwardProgram -> AwardSeason[]","AwardSeason -> AwardCategory[] + EligibilityPolicy snapshot","accepted nominations -> frozen AwardBallot","AwardResult -> permanent AwardBadge[]"]:
        need(token in graph,f"Awards object graph missing: {token}")

    states=award.get("states",{})
    required_state_sets={
      "AwardProgram":["DRAFT","ACTIVE","PAUSED","RETIRED"],
      "AwardSeason":["DRAFT","SCHEDULED","NOMINATIONS_OPEN","NOMINATIONS_CLOSED","BALLOT_FROZEN","VOTING_OPEN","VOTING_CLOSED","FINALIZED","ARCHIVED","CANCELLED"],
      "AwardCategory":["DRAFT","ACTIVE","CLOSED","RETIRED"],
      "AwardNomination":["SUBMITTED","ACCEPTED","REJECTED","WITHDRAWN","DISQUALIFIED"],
      "AwardBallot":["DRAFT","FROZEN","OPEN","CLOSED","FINALIZED","VOID"],
      "AwardVote":["ACCEPTED","INVALIDATED"],
      "AwardResult":["FINALIZED","SUPERSEDED_BY_CORRECTION"],
      "AwardBadge":["ISSUED","DISPLAY_SUPERSEDED"]
    }
    for k,v in required_state_sets.items():
        need(states.get(k)==v,f"{k} lifecycle drift")

    season=" ".join(award.get("seasonRules",[]))
    for token in ["fixed before NOMINATIONS_OPEN","silent reinterpretation is forbidden","FINALIZED season cannot return","CANCELLED season cannot produce"]:
        need(token in season,f"season rule missing: {token}")

    cats=award.get("categoryFramework",{})
    need(cats.get("versionedPerSeason") is True,"categories must be versioned per season")
    need(cats.get("permanentHardcodedList") is False,"category list must not be permanent hard-code")
    expected_categories=[
      "SONG_OF_THE_YEAR","ARTIST_OF_THE_YEAR","BEST_AI_GENERATED_SONG","BEST_AI_ASSISTED_SONG",
      "BEST_REMIX_AI_DERIVATIVE","BEST_INSTRUMENTAL","BEST_LYRICS","BEST_PRODUCTION",
      "COMMUNITY_CHOICE","BREAKTHROUGH_ARTIST"
    ]
    need(cats.get("initialCategoryKeys")==expected_categories,"initial Awards category framework drift")
    cat_rules=" ".join(cats.get("rules",[]))
    for token in ["versioned definitions","distinct from Creative RecordingClass","RECORDING or CREATOR_PROFILE"]:
        need(token in cat_rules,f"category rule missing: {token}")

    elig=" ".join(award.get("eligibilityPolicyArchitecture",[]))
    need("versioned rules commitment" in elig,"EligibilityPolicy versioning missing")
    need("does not duplicate or override Creative rights" in elig,"EligibilityPolicy external authority separation missing")
    need("deferred to HZ-GCA-1.13" in elig,"eligibility policy deferral missing")

    nom=" ".join(award.get("nominationArchitecture",[]))
    for token in ["eligibilitySnapshotCommitment","native Creative CreatorId/RecordingId","cannot silently retarget","deferred to HZ-GCA-1.13"]:
        need(token in nom,f"nomination architecture missing: {token}")

    ballot=" ".join(award.get("ballotArchitecture",[]))
    for token in ["candidateSetCommitment","after FROZEN","not a Civic/Governance ballot","deferred to HZ-GCA-1.13"]:
        need(token in ballot,f"ballot architecture missing: {token}")

    vote=" ".join(award.get("voteArchitecture",[]))
    for token in ["product-domain vote/commitment only","wallet signature/private key material is never stored","does not become a Civic vote","deferred to HZ-GCA-1.13"]:
        need(token in vote,f"vote architecture missing: {token}")

    result=" ".join(award.get("resultArchitecture",[]))
    for token in ["valid closed/finalizable AwardBallot","immutable historical Awards truth","superseding result/history edge","independent of whether any financial prize exists"]:
        need(token in result,f"result architecture missing: {token}")

    badge=" ".join(award.get("badgeArchitecture",[]))
    for token in ["exactly one finalized AwardResult","not automatically a token/NFT","does not grant Creative rights"]:
        need(token in badge,f"badge architecture missing: {token}")

    sep=" ".join(award.get("chartCommunitySeparation",[]))
    for token in ["does not automatically nominate","does not automatically nominate, cast a vote","COMMUNITY_CHOICE is only a category name","immutable chartSnapshotId/policy/window"]:
        need(token in sep,f"Charts/Community separation missing: {token}")

    prize=" ".join(award.get("prizeSeparation",[]))
    for token in ["independent of prize settlement","zero-prize awards are valid","external settlement references only","cannot change the finalized AwardResult"]:
        need(token in prize,f"prize separation missing: {token}")

    validation=" ".join(award.get("validationRules",[]))
    for token in ["every AwardSeason references one AwardProgram","every AwardCategory belongs to exactly one season","every AwardBallot references one season/category","every AwardBadge references one finalized result","Civic/Governance proposal/ballot/vote IDs cannot substitute"]:
        need(token in validation,f"Awards validation rule missing: {token}")

    failures=set(award.get("failureRules",[]))
    for f in [
      "season activation with invalid/unordered windows fails closed",
      "material season/category/policy mutation after freeze/open fails closed",
      "ballot candidate mutation after FROZEN is invalid",
      "AwardVote carrying wallet private/signature material is invalid",
      "AwardResult before valid ballot closure/finalization is invalid",
      "prize payment state changing AwardResult legitimacy is invalid"
    ]:
        need(f in failures,f"Awards failure rule missing: {f}")

    inv=award.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-AWARD-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-AWARD-{i:03d} "),f"invariant numbering drift at {i}")

    obj_types={x.get("type") for x in objects.get("objects",[])}
    for t in expected_owned:
        need(t in obj_types,f"HZ-GCA-1.2 Awards object missing: {t}")

    chart_sep=" ".join(chart.get("chartAwardsCommunitySeparation",[]))
    need("AwardVote is never a chart signal" in chart_sep,"HZ-GCA-1.11 Awards separation drift")
    comm_sep=" ".join(comm.get("chartAwardsSeparation",[]))
    need("AwardVote is a separate" in comm_sep,"HZ-GCA-1.10 Awards separation drift")

    for source in award.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled Awards source: {source}")

    for token in [
      "They are canonical only inside the 420Hz Awards product domain.",
      "This is **not** a permanent hard-coded global list.",
      "An AwardBallot is not a Civic ballot.",
      "AwardVote is not:",
      "A valid award may have **zero prize**.",
      "Finalized seasons/results remain queryable as permanent public history.",
      "HZ-GCA-1.13 — Define nomination & voting policy framework"
    ]:
        need(token in doc,f"normative Awards token missing: {token}")

    need("HZ-GCA-1.12 — Define Awards architecture" in roadmap,"roadmap HZ-GCA-1.12 missing")
    need("machine-readable Awards architecture manifest" in roadmap,"roadmap Awards deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.12 Awards architecture",
  "level":1,
  "objects":0 if errors else len(award.get("authority",{}).get("owns",[])),
  "categories":0 if errors else len(award.get("categoryFramework",{}).get("initialCategoryKeys",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
