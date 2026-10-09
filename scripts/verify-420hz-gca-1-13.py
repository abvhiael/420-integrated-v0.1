#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
POL=ROOT/"hz"/"config"/"gca-nomination-voting-policy-v1.json"
AWARD=ROOT/"hz"/"config"/"gca-awards-architecture-v1.json"
CHART=ROOT/"hz"/"config"/"gca-charts-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
DISC=ROOT/"hz"/"config"/"gca-ai-disclosure-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.13-NOMINATION-VOTING-POLICY.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [POL,AWARD,CHART,COMM,DISC,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    pol=json.loads(POL.read_text())
    award=json.loads(AWARD.read_text())
    chart=json.loads(CHART.read_text())
    comm=json.loads(COMM.read_text())
    disc=json.loads(DISC.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(pol.get("schema")=="420hz-gca-nomination-voting-policy-v1","policy schema drift")
    need(pol.get("version")==1,"policy version drift")
    need(pol.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(pol.get("workPackage")=="HZ-GCA-1.13","work package drift")
    need(pol.get("level")==1,"HZ-GCA-1.13 must remain Level 1")
    need(pol.get("milestoneRequired") is False,"HZ-GCA-1.13 must not become Level-2 milestone")
    need(award.get("workPackage")=="HZ-GCA-1.12","HZ-GCA-1.12 prerequisite drift")
    need(chart.get("workPackage")=="HZ-GCA-1.11","HZ-GCA-1.11 prerequisite drift")
    need(comm.get("workPackage")=="HZ-GCA-1.10","HZ-GCA-1.10 prerequisite drift")
    need(disc.get("workPackage")=="HZ-GCA-1.4","HZ-GCA-1.4 prerequisite drift")

    modes=pol.get("policyModes",{})
    need(modes.get("nomination")==["OPEN_SUBMISSION","CURATED_SUBMISSION","COMMUNITY_THRESHOLD"],"nomination mode drift")
    need(modes.get("selfNomination")==["ALLOWED","DISALLOWED"],"self-nomination mode drift")
    need(modes.get("voterEligibility")==["WALLET_ONE_ACCOUNT_ONE_VOTE","IDENTITY_UNIQUE_ONE_VOTE","JURY_ONE_MEMBER_ONE_VOTE"],"voter eligibility mode drift")
    need(modes.get("quorum")==["MIN_VALID_VOTES","MIN_PARTICIPATION_BPS"],"quorum mode drift")
    need(modes.get("winner")==["PLURALITY","MIN_SHARE_BPS"],"winner mode drift")
    need(modes.get("tie")==["CO_WINNERS","NO_WINNER","RUNOFF_REQUIRED"],"tie mode drift")

    target=" ".join(pol.get("targetEligibility",{}).get("commonRules",[])+pol.get("targetEligibility",{}).get("recordingRules",[])+pol.get("targetEligibility",{}).get("creatorRules",[]))
    for token in ["canonical published RecordingId","PUBLIC and canonically available","canonical CreatorId","at least one eligible published Recording"]:
        need(token in target,f"target eligibility rule missing: {token}")

    compat=pol.get("aiDisclosureCompatibility",{})
    need(compat.get("BEST_AI_GENERATED_SONG")==["AI_GENERATED"],"AI-generated category compatibility drift")
    need(compat.get("BEST_AI_ASSISTED_SONG")==["AI_ASSISTED"],"AI-assisted category compatibility drift")
    need(compat.get("BEST_REMIX_AI_DERIVATIVE")==["AI_DERIVATIVE"],"AI-derivative category compatibility drift")
    all_classes=["HUMAN","AI_ASSISTED","AI_GENERATED","AI_DERIVATIVE"]
    for key in ["SONG_OF_THE_YEAR","ARTIST_OF_THE_YEAR","BEST_INSTRUMENTAL","BEST_LYRICS","BEST_PRODUCTION","COMMUNITY_CHOICE","BREAKTHROUGH_ARTIST"]:
        need(compat.get(key)==all_classes,f"{key} disclosure compatibility drift")

    reqs=" ".join(pol.get("categoryPolicyRequirements",[]))
    for token in ["max nominations per nominator","self-nomination mode","voter eligibility mode","quorum mode/value","winner mode/value","tie mode","requires AI_GENERATED","requires AI_ASSISTED","requires AI_DERIVATIVE"]:
        need(token in reqs,f"category policy requirement missing: {token}")

    noms=" ".join(pol.get("nominationRules",[]))
    for token in ["nominationStart, nominationEnd","qualified Wallet/session actor authorization","maxNominationsPerNominator","duplicate logical nomination key","ballot candidate key","DISQUALIFIED","BALLOT_FROZEN"]:
        need(token in noms,f"nomination rule missing: {token}")

    community=" ".join(pol.get("communityThresholdRules",[]))
    for token in ["thresholdType","thresholdValue","PUBLIC community records","PRIVATE/UNLISTED","cannot multiply threshold support","never casts AwardVote"]:
        need(token in community,f"community threshold rule missing: {token}")

    ballot=" ".join(pol.get("ballotConstructionRules",[]))
    for token in ["after nominations close","deterministic deduplicated set","candidateSetCommitment","after FROZEN","voter-eligibility mode, quorum, winner and tie policy"]:
        need(token in ballot,f"ballot construction rule missing: {token}")

    voter=" ".join(pol.get("voterEligibilityRules",[]))
    for token in ["does not prove unique-human identity","must never be described as one-person-one-vote","minimum-disclosure eligibility result","wrong-ballot, wrong-policy or wrong-audience","frozen explicit jury membership","Wallet addresses alone are insufficient"]:
        need(token in voter,f"voter eligibility rule missing: {token}")

    sybil=" ".join(pol.get("antiSybilRules",[]))
    for token in ["explicitly declare its Sybil assumptions","wallet-account uniqueness only","ballot-scoped nullifier","at most one accepted vote","multiple wallets","cannot expose private Identity proof material"]:
        need(token in sybil,f"anti-Sybil rule missing: {token}")

    vote=" ".join(pol.get("voteRules",[]))
    for token in ["votingStart, votingEnd","domain-separated replayDomain","at most one ACCEPTED vote","idempotently resolves","explicit ABSTAIN","change-your-vote"]:
        need(token in vote,f"vote rule missing: {token}")

    abstain=" ".join(pol.get("abstentionInvalidRules",[]))
    for token in ["counts toward participation quorum","zero candidate support","count neither toward quorum nor candidate support","separately"]:
        need(token in abstain,f"abstention/invalid rule missing: {token}")

    quorum=" ".join(pol.get("quorumThresholdRules",[]))
    for token in ["exactly one quorum mode","MIN_VALID_VOTES","MIN_PARTICIPATION_BPS","frozen eligible-voter denominator","PLURALITY","MIN_SHARE_BPS","integer-safe"]:
        need(token in quorum,f"quorum/threshold rule missing: {token}")

    tie=" ".join(pol.get("tieRules",[]))
    for token in ["CO_WINNERS","NO_WINNER","RUNOFF_REQUIRED","cannot silently resolve","random tie-breaking is not part of v1"]:
        need(token in tie,f"tie rule missing: {token}")

    final=" ".join(pol.get("deterministicFinalizationRules",[]))
    for token in ["after votingEnd","valid CLOSED ballot","same resultCommitment","single-use","cannot be retroactively re-tallied"]:
        need(token in final,f"finalization rule missing: {token}")

    privacy=" ".join(pol.get("privacyRules",[]))
    for token in ["raw Identity proofs","need not reveal voter identity publicly","unrelated ballots to correlate voters unnecessarily","outside Search/Indexer/Analytics","minimum-disclosure"]:
        need(token in privacy,f"voting privacy rule missing: {token}")

    failures=set(pol.get("failureRules",[]))
    for f in [
      "nomination outside the frozen window fails closed",
      "AI disclosure/category mismatch fails closed",
      "nomination cap overflow fails closed",
      "Wallet-only voter mode claiming one-person-one-vote is invalid",
      "IDENTITY_UNIQUE_ONE_VOTE without qualified current minimum-disclosure eligibility fails closed",
      "duplicate/replayed voter key cannot create a second accepted vote",
      "quorum denominator unavailable for MIN_PARTICIPATION_BPS fails closed",
      "finalization before votingEnd or from non-CLOSED ballot fails closed",
      "repeated finalization cannot create a second AwardResult",
      "closed/finalized season cannot be recomputed under a later policy"
    ]:
        need(f in failures,f"failure rule missing: {f}")

    inv=pol.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-VOTE-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-VOTE-{i:03d} "),f"invariant numbering drift at {i}")

    award_states=award.get("states",{})
    need("FROZEN" in award_states.get("AwardBallot",[]),"Awards architecture ballot FROZEN prerequisite missing")
    need("ACCEPTED" in award_states.get("AwardVote",[]),"Awards architecture vote ACCEPTED prerequisite missing")
    need("FINALIZED" in award_states.get("AwardResult",[]),"Awards architecture result FINALIZED prerequisite missing")

    chart_sep=" ".join(chart.get("chartAwardsCommunitySeparation",[]))
    need("AwardVote is never a chart signal" in chart_sep,"Charts/Awards separation drift")
    comm_sep=" ".join(comm.get("chartAwardsSeparation",[]))
    need("AwardVote is a separate" in comm_sep,"Community/Awards separation drift")

    disc_classes={x.get("class") for x in disc.get("classes",[])}
    need(disc_classes==set(all_classes),f"AI disclosure class prerequisite drift: {sorted(disc_classes)}")

    for source in pol.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled voting-policy source: {source}")

    for token in [
      "Wallet addresses alone are insufficient.",
      "A nomination outside the frozen nomination window fails closed.",
      "This is **not** a permanent hard-coded global list." if False else "BEST_AI_GENERATED_SONG — AI_GENERATED only",
      "COMMUNITY_CHOICE does not hard-code a threshold",
      "One voter key may have at most one ACCEPTED vote per ballot.",
      "V1 does not permit hidden or ad hoc random tie-breaking.",
      "Repeated finalization returns the existing result or fails without producing another AwardResult.",
      "HZ-GCA-1.14 — Define moderation & dispute boundaries"
    ]:
        need(token in doc,f"normative nomination/voting token missing: {token}")

    need("HZ-GCA-1.13 — Define nomination & voting policy framework" in roadmap,"roadmap HZ-GCA-1.13 missing")
    need("machine-readable policy manifest" in roadmap,"roadmap nomination/voting deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.13 nomination voting policy",
  "level":1,
  "voterModes":0 if errors else len(pol.get("policyModes",{}).get("voterEligibility",[])),
  "categories":0 if errors else len(pol.get("aiDisclosureCompatibility",{})),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
