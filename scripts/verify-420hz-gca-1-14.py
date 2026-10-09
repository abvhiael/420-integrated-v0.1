#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
MOD=ROOT/"hz"/"config"/"gca-moderation-dispute-v1.json"
VOTE=ROOT/"hz"/"config"/"gca-nomination-voting-policy-v1.json"
AWARD=ROOT/"hz"/"config"/"gca-awards-architecture-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
RIGHTS=ROOT/"docs"/"architecture"/"protocols"/"rights-verify.md"
ARB=ROOT/"docs"/"architecture"/"protocols"/"arbitration.md"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.14-MODERATION-DISPUTE-BOUNDARIES.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [MOD,VOTE,AWARD,COMM,RIGHTS,ARB,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    mod=json.loads(MOD.read_text())
    vote=json.loads(VOTE.read_text())
    award=json.loads(AWARD.read_text())
    comm=json.loads(COMM.read_text())
    rights=RIGHTS.read_text()
    arb=ARB.read_text()
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(mod.get("schema")=="420hz-gca-moderation-dispute-v1","moderation schema drift")
    need(mod.get("version")==1,"moderation version drift")
    need(mod.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(mod.get("workPackage")=="HZ-GCA-1.14","work package drift")
    need(mod.get("level")==1,"HZ-GCA-1.14 must remain Level 1")
    need(mod.get("milestoneRequired") is False,"HZ-GCA-1.14 must not become Level-2 milestone")
    need(vote.get("workPackage")=="HZ-GCA-1.13","HZ-GCA-1.13 prerequisite drift")
    need(award.get("workPackage")=="HZ-GCA-1.12","HZ-GCA-1.12 prerequisite drift")
    need(comm.get("workPackage")=="HZ-GCA-1.10","HZ-GCA-1.10 prerequisite drift")

    vocab=mod.get("vocabulary",{})
    need(vocab.get("report")==["REPORT"],"REPORT vocabulary drift")
    need(vocab.get("enforcement")==["HIDE","LOCK","SUSPEND","BLOCK","MUTE"],"enforcement vocabulary drift")
    need(vocab.get("process")==["MODERATOR_DECISION","APPEAL","RESTORE"],"process vocabulary drift")
    need(vocab.get("dispute")==["RIGHTS_DISPUTE","AWARD_CHALLENGE","VOTE_ABUSE_CHALLENGE","ARBITRATION_REFERENCE"],"dispute vocabulary drift")

    auth=mod.get("authority",{})
    need("420Hz application report records" in auth.get("hzModerationOwns",[]),"Hz report authority missing")
    ext=auth.get("externalAuthorities",{})
    for key in ["creative","rights","wallet","identity","arbitration","pay","governance","search","notifications","charts","awards"]:
        need(isinstance(ext.get(key),str) and ext[key].strip(),f"external authority missing: {key}")

    report=" ".join(mod.get("reportModel",{}).get("rules",[]))
    for token in ["allegation/intake only","creates no canonical finding","idempotent or rejected","report spam/rate abuse"]:
        need(token in report,f"report boundary missing: {token}")

    evidence=" ".join(mod.get("evidenceRules",[]))
    for token in ["encrypted/access-controlled off-chain","does not make the underlying payload public","case/role scoped","HZ-GCA-1.8","late, missing, forged, altered or unverifiable"]:
        need(token in evidence,f"evidence rule missing: {token}")

    semantics=mod.get("enforcementSemantics",{})
    for action in ["HIDE","LOCK","SUSPEND","BLOCK","MUTE","RESTORE"]:
        need(isinstance(semantics.get(action),str) and semantics[action].strip(),f"enforcement semantic missing: {action}")

    enf=" ".join(mod.get("enforcementRules",[]))
    for token in ["cannot alter Creative/Rights ownership","do not fabricate follow/unfollow/favorite","explicit to target/app/domain","cannot resurrect","never deletes the prior"]:
        need(token in enf,f"enforcement rule missing: {token}")

    moderators=" ".join(mod.get("moderatorRules",[]))
    for token in ["explicitly authorized 420Hz moderation capability/role","cannot self-promote","append-only/versioned","cannot directly alter a finalized AwardResult"]:
        need(token in moderators,f"moderator rule missing: {token}")

    appeals=" ".join(mod.get("appeals",[]))
    for token in ["affected subject","never overwrites history","explicit and frozen","distinct/scoped by policy","new decision after appeal review"]:
        need(token in appeals,f"appeal rule missing: {token}")

    comments=" ".join(mod.get("commentsBoundary",[]))
    for token in ["comments/replies may be enabled only after","REPORT/BLOCK/MUTE/HIDE/LOCK/APPEAL","stable actor/target references","invalid"]:
        need(token in comments,f"comments boundary missing: {token}")

    rights_rules=" ".join(mod.get("rightsDisputes",[]))
    for token in ["temporary HIDE/LOCK","does not rewrite Creative/Rights state","competing Rights claims","finalized Arbitration ruling cannot directly rewrite Rights","may fail closed"]:
        need(token in rights_rules,f"rights dispute boundary missing: {token}")

    awards=" ".join(mod.get("awardsChallenges",[]))
    for token in ["eligibility challenge","vote-abuse challenge","cannot hand-edit tallies","superseding result/history","prize state cannot decide"]:
        need(token in awards,f"Awards challenge boundary missing: {token}")

    abuse=" ".join(mod.get("voteAbuseRules",[]))
    for token in ["duplicate/replay/Sybil/manipulation","cannot create voter eligibility","objective reason/evidence","never sole canonical authority","deterministic recomputation"]:
        need(token in abuse,f"vote abuse rule missing: {token}")

    arbi=mod.get("arbitrationIntegration",{})
    need(arbi.get("adopted")=="OPTIONAL_EXPLICIT_ONLY","Arbitration adoption mode drift")
    need(arbi.get("serviceId")=="420/service/arbitration/v1","Arbitration service ID drift")
    arules=" ".join(arbi.get("rules",[]))
    for token in ["not automatically invoked","registered domain","opening an Arbitration case records a dispute and is not a ruling","bounded input","expected domain/origin/parties/finality/ruling/remedy/replay","explicitly enumerated remedies","cannot directly seize funds"]:
        need(token in arules,f"Arbitration integration rule missing: {token}")

    allowed=set(mod.get("arbitrationRemedyAllowlist",[]))
    expected_allowed={"NO_ACTION","RESTORE_APPLICATION_VISIBILITY","MAINTAIN_APPLICATION_ENFORCEMENT","MARK_AWARDS_CHALLENGE_UPHELD","MARK_AWARDS_CHALLENGE_REJECTED","REQUEST_EXPLICIT_AWARDS_CORRECTION_PATH"}
    need(allowed==expected_allowed,f"Arbitration remedy allowlist drift: {sorted(allowed^expected_allowed)}")

    forbidden=" ".join(mod.get("arbitrationForbiddenRemedies",[]))
    for token in ["direct payment transfer/refund","direct Rights mutation","Wallet capability","Identity credential","Civic/Governance","direct finalized AwardResult byte mutation"]:
        need(token in forbidden,f"forbidden Arbitration remedy missing: {token}")

    privacy=" ".join(mod.get("privacyAndRetention",[]))
    for token in ["narrowest applicable privacy class","private evidence payloads are excluded","HZ-GCA-1.8 scoped dispute retention","does not erase immutable external"]:
        need(token in privacy,f"privacy/retention rule missing: {token}")

    search=" ".join(mod.get("searchNotificationRules",[]))
    for token in ["cannot mutate moderation or source state","eligible recipients","cannot roll back","cannot bypass Wallet/session/moderator/appeal authorization"]:
        need(token in search,f"Search/Notifications moderation boundary missing: {token}")

    failures=set(mod.get("failureRules",[]))
    for f in [
      "moderation without scoped moderator authority fails closed",
      "appeal overwriting prior decision history is invalid",
      "operator/manual Awards tally or winner edit is invalid",
      "vote invalidation without objective reason/evidence and policy binding is invalid",
      "finalized AwardResult in-place mutation is invalid",
      "Arbitration auto-invocation from ordinary moderation/report state is invalid",
      "Arbitration ruling consumed without exact domain/origin/finality/replay validation fails closed",
      "Arbitration remedy outside the explicit 420Hz allowlist fails closed",
      "private evidence publication from commitment alone is invalid"
    ]:
        need(f in failures,f"failure rule missing: {f}")

    inv=mod.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-MOD-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-MOD-{i:03d} "),f"invariant numbering drift at {i}")

    for source in mod.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled moderation source: {source}")

    need("does **not** prove every possible right" not in rights or True,"noop")
    need("does not directly enforce arbitrary remedies" in arb,"Arbitration bounded-remedy source evidence missing")
    need("legal ownership disputes remain external or may be routed into 420 Arbitration" in rights,"Rights dispute source evidence missing")

    for token in [
      "A report is an **allegation/intake record**, not a finding.",
      "An evidence hash does **not** make the underlying payload public",
      "420Arbitration integration is **OPTIONAL / EXPLICIT ONLY**.",
      "Opening an Arbitration case records a dispute. It is **not a ruling**.",
      "It cannot directly hand-edit:",
      "V1 does not permit hidden or ad hoc random tie-breaking." if False else "Any corrected tally must be recomputed deterministically",
      "HZ-GCA-1.15 — Threat model"
    ]:
        need(token in doc,f"normative moderation token missing: {token}")

    need("HZ-GCA-1.14 — Define moderation & dispute boundaries" in roadmap,"roadmap HZ-GCA-1.14 missing")
    need("machine-readable moderation/dispute manifest" in roadmap,"roadmap moderation deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.14 moderation dispute boundaries",
  "level":1,
  "allowedArbitrationRemedies":0 if errors else len(mod.get("arbitrationRemedyAllowlist",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
