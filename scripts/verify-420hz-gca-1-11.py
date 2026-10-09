#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
CHART=ROOT/"hz"/"config"/"gca-charts-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
OBJECTS=ROOT/"hz"/"config"/"gca-object-model-v1.json"
PRIV=ROOT/"hz"/"config"/"gca-privacy-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.11-CHARTS-RULES.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [CHART,COMM,OBJECTS,PRIV,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    chart=json.loads(CHART.read_text())
    comm=json.loads(COMM.read_text())
    objects=json.loads(OBJECTS.read_text())
    priv=json.loads(PRIV.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(chart.get("schema")=="420hz-gca-charts-v1","Charts schema drift")
    need(chart.get("version")==1,"Charts version drift")
    need(chart.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(chart.get("workPackage")=="HZ-GCA-1.11","work package drift")
    need(chart.get("level")==1,"HZ-GCA-1.11 must remain Level 1")
    need(chart.get("milestoneRequired") is False,"HZ-GCA-1.11 must not become Level-2 milestone")
    need(comm.get("workPackage")=="HZ-GCA-1.10","HZ-GCA-1.10 prerequisite drift")
    need(objects.get("workPackage")=="HZ-GCA-1.2","HZ-GCA-1.2 prerequisite drift")
    need(priv.get("workPackage")=="HZ-GCA-1.7","HZ-GCA-1.7 prerequisite drift")

    auth=chart.get("authority",{})
    need(auth.get("chartState")=="DERIVED_PROJECTION_ONLY","Charts authority must remain derived-only")
    forbidden=" ".join(auth.get("forbiddenAuthorities",[]))
    for token in ["Creative ownership/rights","Awards nomination/ballot/vote/result","payment/reward entitlement","governance"]:
        need(token in forbidden,f"forbidden Chart authority missing: {token}")

    families=[x.get("key") for x in chart.get("chartFamilies",[])]
    expected_families=["TOP_RECORDINGS","TRENDING_RECORDINGS","NEW_RECORDINGS","TOP_ARTISTS","COMMUNITY_FAVORITES"]
    need(families==expected_families,f"chart family drift: {families}")

    signals={x.get("signal"):x for x in chart.get("signalVocabulary",[])}
    expected_signals={"RAW_PLAY","QUALIFIED_PLAY","DISTINCT_LISTENER","PUBLIC_FAVORITE","PUBLIC_PLAYLIST_ADD","PUBLIC_FOLLOW","PUBLIC_SHARE","AWARD_VOTE","SEARCH_CLICK","GENERATE_COUNT"}
    need(set(signals)==expected_signals,f"signal vocabulary drift: {sorted(set(signals)^expected_signals)}")
    need(signals["RAW_PLAY"].get("canonicalForCharts") is False,"RAW_PLAY must not automatically score")
    need(signals["QUALIFIED_PLAY"].get("canonicalForCharts") is True,"QUALIFIED_PLAY must remain eligible")
    need(signals["AWARD_VOTE"].get("canonicalForCharts") is False,"AWARD_VOTE must never score")
    need(signals["GENERATE_COUNT"].get("canonicalForCharts") is False,"GENERATE_COUNT must not score")

    elig=" ".join(chart.get("eligibilityRules",[]))
    for token in ["eligible PUBLIC","PRIVATE and UNLISTED","deleted, withdrawn, unavailable, rights-blocked","AI disclosure class is a filter/facet"]:
        need(token in elig,f"eligibility rule missing: {token}")

    windows={x.get("key"):x for x in chart.get("timeWindows",[])}
    for key in ["DAILY","WEEKLY","MONTHLY","ALL_TIME"]:
        need(key in windows,f"time window missing: {key}")
    need(windows["DAILY"].get("duration")=="24h","DAILY duration drift")
    need(windows["WEEKLY"].get("duration")=="7d","WEEKLY duration drift")
    need(windows["MONTHLY"].get("duration")=="30d","MONTHLY duration drift")

    method=chart.get("methodology",{})
    need(method.get("version")=="1","chart policy version drift")
    weights=method.get("weights",{})
    expected_weights={"qualifiedPlayPoints":1,"distinctListenerBonus":1,"publicFavoritePoints":0,"publicPlaylistAddPoints":0,"publicFollowArtistPoints":0}
    need(weights==expected_weights,f"v1 chart weights drift: {weights}")
    interp=" ".join(method.get("interpretation",[]))
    need("qualified plays as the only positive score weight" in interp,"qualified-play primary v1 rule missing")
    need("new chartPolicyVersion" in interp,"methodology versioning rule missing")
    need("no hidden personalized or sponsored boost" in interp,"hidden boost prohibition missing")

    qp=" ".join(chart.get("qualifiedPlayRules",[]))
    for token in ["does not invent an unavailable playback-service threshold","one event/source replay key contributes at most once","cannot multiply chart credit","deterministic policy","retain source/reference/checkpoint"]:
        need(token in qp,f"qualified-play rule missing: {token}")

    dl=" ".join(chart.get("distinctListenerRules",[]))
    for token in ["privacy-preserving","at most once per target","must not require publishing Wallet/Identity linkage","never Identity credential/trust authority"]:
        need(token in dl,f"distinct-listener rule missing: {token}")

    anti=" ".join(chart.get("antiGamingRules",[]))
    for token in ["dedupe by stable event/replay key","exclude private/unlisted","cannot directly edit final rank","sponsored placement must never be mixed","award votes cannot be reused"]:
        need(token in anti,f"anti-gaming rule missing: {token}")

    snap=" ".join(chart.get("snapshotRules",[]))
    for token in ["chartPolicyVersion","deterministic","stable canonical target identifier ascending","source checkpoints/freshness","new snapshot/result commitment"]:
        need(token in snap,f"snapshot rule missing: {token}")

    fresh=" ".join(chart.get("freshnessRebuildRules",[]))
    for token in ["fail closed or label stale/degraded","reproduce the same ordered result","must not resurrect","cannot rewrite rank"]:
        need(token in fresh,f"freshness/rebuild rule missing: {token}")

    privacy=" ".join(chart.get("privacyRules",[]))
    for token in ["PRIVATE favorites","UNLISTED playlists/content","raw listener identity","hidden private relation"]:
        need(token in privacy,f"Charts privacy rule missing: {token}")

    sep=" ".join(chart.get("chartAwardsCommunitySeparation",[]))
    for token in ["do not automatically become chart points","AwardVote is never a chart signal","does not create Award eligibility","distinct from Creative ownership/rights"]:
        need(token in sep,f"Charts separation rule missing: {token}")

    failures=set(chart.get("failureRules",[]))
    for f in [
      "PRIVATE or UNLISTED activity entering a public chart fails closed",
      "AwardVote used as chart credit fails closed",
      "duplicate/replayed event producing additional chart credit fails closed",
      "snapshot without policy version/window/source checkpoint/result commitment is invalid",
      "non-deterministic tie-breaking for identical input set is invalid",
      "sponsored placement altering chart rank is invalid"
    ]:
        need(f in failures,f"Charts failure rule missing: {f}")

    inv=chart.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-CHART-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-CHART-{i:03d} "),f"invariant numbering drift at {i}")

    chart_obj=next((x for x in objects.get("objects",[]) if x.get("type")=="ChartSnapshot"),None)
    need(chart_obj is not None,"HZ-GCA-1.2 ChartSnapshot prerequisite missing")
    if chart_obj:
        need(chart_obj.get("class")=="DERIVED_PROJECTION","ChartSnapshot object class drift")
        immutable=set(chart_obj.get("immutable",[]))
        for key in ["chartPolicyVersion","windowStart","windowEnd","sourceCheckpoint","resultCommitment"]:
            need(key in immutable,f"ChartSnapshot immutable field missing: {key}")

    comsep=" ".join(comm.get("chartAwardsSeparation",[]))
    need("not automatically qualified chart events" in comsep,"HZ-GCA-1.10 chart separation drift")
    need("HZ-GCA-1.11" in comsep,"HZ-GCA-1.10 deferral link missing")

    for source in chart.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled Charts source: {source}")

    for token in [
      "A raw play is not a qualified play.",
      "An Award vote is never a chart event.",
      "qualified play: **1**",
      "does not invent a playback-duration or completion threshold",
      "score descending;",
      "Sponsored Search placement must be visibly separate",
      "HZ-GCA-1.12 — Define Awards architecture"
    ]:
        need(token in doc,f"normative Charts token missing: {token}")

    need("HZ-GCA-1.11 — Define Charts rules" in roadmap,"roadmap HZ-GCA-1.11 missing")
    need("machine-readable Charts policy manifest" in roadmap,"roadmap Charts deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.11 Charts rules",
  "level":1,
  "chartFamilies":0 if errors else len(chart.get("chartFamilies",[])),
  "signals":0 if errors else len(chart.get("signalVocabulary",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)
