"""Fail-closed NHL v7 normalization and canonical oracle transaction preparation.

No network, provider credentials, transaction signing, or implicit acceptance.
Requires matching summary/play-by-play/ice-time captures and frozen identity mapping.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
from eth_abi import encode
from nhl import FIELDS, checked_stats, points, k256, stat_leaf, merkle
from sportradar import CaptureError, endpoint, load_capture

POSITIONS = {"C":1,"LW":2,"RW":4,"D":8,"G":16}
SLATE_DOMAIN = k256(b"420.FANTASY.SLATE.V1")
EVIDENCE_DOMAIN = k256(b"420.FANTASY.SPORTRADAR.NORMALIZED.V1")
REPORT_ABI = "(bytes32,bytes32,uint64,uint64)"
RESULT_ABI = "(bytes32,uint64,uint64,uint64,bool,bool,bool)[]"


def fail(message):
    raise CaptureError(message)


def uint(value):
    if type(value) is not int or not 0 <= value < 65536: fail("missing or invalid uint16 statistic")
    return value


def timestamp(value):
    if not isinstance(value,str): fail("missing timestamp")
    try:
        d=datetime.fromisoformat(value.replace("Z","+00:00"))
        if d.tzinfo is None: fail("timestamp requires timezone")
        return int(d.timestamp())
    except ValueError: fail("invalid timestamp")


def seconds(value):
    if not isinstance(value,str) or not re.fullmatch(r"\d{1,3}:\d{2}(?::\d{2})?",value): fail("missing or invalid ice time")
    parts=[int(v) for v in value.split(":")]
    if parts[-1]>=60 or (len(parts)==3 and parts[-2]>=60):fail("invalid ice-time component")
    return parts[0]*60+parts[1] if len(parts)==2 else parts[0]*3600+parts[1]*60+parts[2]


def roster(game, side):
    team=game.get(side)
    if not isinstance(team,dict) or not isinstance(team.get("players"),list) or not team["players"]:fail("missing full roster")
    endpoint("team",team.get("id"))
    result={}
    for p in team["players"]:
        endpoint("player",p.get("id"))
        if p["id"] in result:fail("duplicate player")
        result[p["id"]]=p
    return result


def bootstrap_mapping(summary):
    """Replay bootstrap only; live use must freeze this before opening entries."""
    rows=[]
    for side in ("home","away"):
        for pid,p in roster(summary,side).items():
            ref=p.get("reference");pos=p.get("primary_position")
            if not isinstance(ref,str) or not ref.isdigit() or not 0<int(ref)<2**32 or pos not in POSITIONS:fail("unresolved canonical identity or position")
            rows.append({"providerID":pid,"athlete":int(ref),"reference":ref,"positions":POSITIONS[pos]})
    return {"version":1,"providerGameID":summary["id"],"game":"0x"+k256(encode(["string","string"],["SPORTRADAR.NHL.V7",summary["id"]])).hex(),
            "scheduled":summary["scheduled"],"rows":sorted(rows,key=lambda p:p["athlete"]),"mode":"historical-replay-not-preentry-evidence"}


def normalise(records, mapping, as_of, cutoff):
    if type(as_of) is not int or type(cutoff) is not int or not 0<as_of<2**64 or not 0<cutoff<2**64:fail("invalid revision time")
    if set(records)!={"summary","pbp","time-on-ice"}:fail("all three captures required")
    gid=mapping.get("providerGameID");endpoint("summary",gid)
    if type(mapping.get("version")) is not int or mapping["version"]!=1:fail("unsupported identity mapping")
    if not re.fullmatch(r"0x[0-9a-f]{64}",mapping.get("game","")):fail("invalid canonical game")
    # Canonical game IDs have one deterministic provider namespace in this adapter.
    if mapping["game"] != "0x"+k256(encode(["string","string"],["SPORTRADAR.NHL.V7",gid])).hex():fail("wrong game mapping")
    raw={};digests=[]
    for kind,(meta,data) in records.items():
        if meta.get("provider")!="SPORTRADAR" or meta.get("apiVersion")!=7 or meta.get("access")!="trial" or meta.get("endpoint")!=endpoint(kind,gid):fail("capture domain mismatch")
        captured=meta.get("capturedAt")
        if type(captured) not in (float,int) or not math.isfinite(captured) or math.ceil(captured)>as_of:fail("capture unavailable at revision time")
        if data.get("id")!=gid or data.get("status")!="closed" or data.get("coverage")!="full" or data.get("deleted") is True:fail("game is unresolved or incompletely covered")
        if data.get("scheduled")!=mapping.get("scheduled"):fail("original schedule differs from frozen mapping")
        if not re.fullmatch(r"[0-9a-f]{64}",meta.get("bodySHA256","")):fail("invalid capture digest")
        raw[kind]=data;digests.append((kind,meta["bodySHA256"]))
    summary,pbp,ice=(raw[k] for k in ("summary","pbp","time-on-ice"))
    start=timestamp(summary.get("start_time"));end=timestamp(summary.get("end_time"))
    if not 0<start<end<cutoff or as_of<end:fail("game not eligible within fixed cutoff")
    duration=seconds(summary.get("total_game_duration"))
    if not 0<duration<=8*3600:fail("invalid game duration")
    for data in (pbp,ice):
        if timestamp(data.get("start_time"))!=start or timestamp(data.get("end_time"))!=end or seconds(data.get("total_game_duration"))!=duration:fail("inconsistent game timing")
    allplayers={};icemap={};sideof={}
    for side in ("home","away"):
        players=roster(summary,side);toiplayers=roster(ice,side)
        if summary[side]["id"]!=ice[side]["id"] or summary[side]["id"]!=pbp.get(side,{}).get("id"):fail("team mismatch")
        if set(players)!=set(toiplayers):fail("summary/ice-time roster mismatch")
        for pid,p in players.items():
            if pid in allplayers:fail("player listed on both teams")
            allplayers[pid]=p;icemap[pid]=toiplayers[pid];sideof[pid]=side
    rows=mapping.get("rows")
    if not isinstance(rows,list) or len(rows)!=len(allplayers):fail("incomplete frozen roster mapping")
    mapped={};ids=set()
    for row in rows:
        pid=row.get("providerID");aid=row.get("athlete");p=allplayers.get(pid)
        if p is None or pid in mapped or type(aid) is not int or not 0<aid<2**32 or aid in ids:fail("ambiguous athlete mapping")
        if type(row.get("positions")) is not int or row["positions"] not in POSITIONS.values():fail("unknown or invalid position mask")
        if row.get("reference")!=p.get("reference") or str(aid)!=p.get("reference") or row.get("positions")!=POSITIONS.get(p.get("primary_position")):fail("identity/position mismatch")
        mapped[pid]=row;ids.add(aid)
    eventstats={pid:Counter() for pid in allplayers};eventids=set();eventplayers=set()
    periods=pbp.get("periods")
    if not isinstance(periods,list) or not periods:fail("missing play-by-play periods")
    deleted=pbp.get("deleted_events")
    if not isinstance(deleted,list):fail("missing deletion inventory")
    deletedids=set()
    for d in deleted:
        if not isinstance(d,dict) or not isinstance(d.get("event"),dict) or not isinstance(d["event"].get("id"),str):fail("invalid deletion record")
        deletedids.add(d["event"]["id"])
    shootout_seen=False
    for period in periods:
        if period.get("type") not in ("period","overtime","shootout"):fail("unknown period type")
        shootout=period["type"]=="shootout";shootout_seen|=shootout
        events=period.get("events")
        if not isinstance(events,list):fail("missing period events")
        for event in events:
            eid=event.get("id")
            if not isinstance(eid,str) or eid in eventids or eid in deletedids:fail("duplicate or deleted event")
            eventids.add(eid)
            statistics=event.get("statistics",[])
            if not isinstance(statistics,list):fail("invalid event statistics")
            if statistics and event.get("official") is not True:fail("unofficial scoring event")
            for st in statistics:
                pid=st.get("player",{}).get("id");typ=st.get("type")
                if pid is None:continue  # team-only statistics never invent athlete attribution
                if pid not in allplayers:fail("unknown event athlete")
                team=st.get("team",{}).get("id")
                if team!=summary[sideof[pid]]["id"]:fail("event athlete/team mismatch")
                eventplayers.add(pid);r=eventstats[pid]
                if shootout:
                    if typ=="shot" and st.get("goal") is True:r["shootout"]+=1
                    continue
                if typ=="shot":
                    r["shots"]+=1
                    if st.get("goal") is True:
                        r["goals"]+=1;r["shorthanded"]+=st.get("strength")=="shorthanded"
                elif typ=="assist":r["assists"]+=1;r["shorthanded"]+=st.get("strength")=="shorthanded"
                elif typ=="block":r["blocks"]+=1
                elif typ=="shotagainst":
                    if event.get("event_type")=="goal" and st.get("goal") is True and st.get("saved") is False:
                        r["goalsAgainst"]+=1
                    elif event.get("event_type")=="shotsaved" and st.get("saved") is True and st.get("goal") in (None,False):
                        r["saves"]+=1
                    else:fail("ambiguous goalie shot")
    output=[];participation={};ice_seconds={}
    for pid,p in allplayers.items():
        toi=icemap[pid].get("time_on_ice")
        observed=seconds(toi["total"]) if isinstance(toi,dict) and "total" in toi else None
        played=p.get("played")
        if type(played) is not bool and played is not None:fail("invalid played flag")
        if played is True:
            if observed is None or observed<=0 or observed>duration or seconds(p.get("time_on_ice",{}).get("total"))!=observed or p.get("scratched") is True:fail("inconsistent participation/ice time")
            participation[pid]=True;ice_seconds[pid]=observed
        else:
            # v7 omits played on scratches/unused backups. DNP requires closed
            # full coverage, both complete rosters, no ice time, no event facts,
            # and explicitly zero summary scoring/goalie statistics below.
            if observed not in (None,0) or pid in eventplayers:fail("DNP contradicts positive participation")
            participation[pid]=False;ice_seconds[pid]=0
    for pid,p in allplayers.items():
        stats=p.get("statistics")
        if not isinstance(stats,dict) or not isinstance(stats.get("total"),dict) or not isinstance(stats.get("shorthanded"),dict) or not isinstance(stats.get("shootout"),dict):fail("missing explicit statistic groups")
        total=stats["total"];short=stats["shorthanded"]
        s={k:0 for k in FIELDS[:8]};s.update({k:False for k in FIELDS[8:]})
        for target,source in (("goals","goals"),("assists","assists"),("shots","shots"),("blocks","blocked_shots")):s[target]=uint(total.get(source))
        s["shorthanded"]=uint(short.get("goals"))+uint(short.get("assists"));s["shootout"]=uint(stats["shootout"].get("goals"))
        if s["shootout"] and not shootout_seen:fail("shootout total without shootout period")
        for field in ("goals","assists","shots","blocks","shorthanded","shootout"):
            if s[field]!=eventstats[pid][field]:fail("summary/play-by-play mismatch: "+field)
        goalie=mapped[pid]["positions"]==16
        if goalie:
            gt=p.get("goaltending",{}).get("total")
            if not isinstance(gt,dict):fail("missing goalie statistics")
            s["saves"]=uint(gt.get("saves"));s["goalsAgainst"]=uint(gt.get("goals_against"))
            if uint(gt.get("shots_against"))!=s["saves"]+s["goalsAgainst"]:fail("goalie save/GA conservation")
            if any(s[k]!=eventstats[pid][k] for k in ("saves","goalsAgainst")):fail("goalie event mismatch")
            credit=gt.get("credit")
            if credit not in ("win","loss","overtime_loss","none"):fail("unknown goalie decision")
            s["win"]=credit=="win";s["overtimeLoss"]=credit=="overtime_loss"
            if s["overtimeLoss"] and duration<=3600:fail("overtime loss without overtime")
            if s["win"] and summary[sideof[pid]]["points"]<=summary["away" if sideof[pid]=="home" else "home"]["points"]:fail("goalie win conflicts with result")
            s["soleGoalie"]=participation[pid] and sum(participation[q] for q in allplayers if sideof[q]==sideof[pid] and mapped[q]["positions"]==16)==1
            official_shutout=gt.get("shutout")
            if official_shutout is not None and type(official_shutout) is not bool:fail("invalid official shutout flag")
            # A credited sole-goalie shutout can include a delayed-penalty
            # extra-attacker interval: literal on-ice seconds need not be 60:00.
            # Require the explicit official award plus complete sole-goalie
            # participation evidence; never infer this from the team score.
            s["entireGame"]=participation[pid] and (ice_seconds[pid]==duration or
                (s["soleGoalie"] and s["goalsAgainst"]==0 and official_shutout is True))
            s["shutout"]=participation[pid] and s["soleGoalie"] and s["entireGame"] and s["goalsAgainst"]==0
            if official_shutout is not None and official_shutout!=s["shutout"]:fail("official shutout contradicts eligibility")
            if participation[pid] and s["soleGoalie"] and s["goalsAgainst"]==0 and ice_seconds[pid]<duration and official_shutout is None:fail("missing full-game/shutout evidence")
        s["played"]=participation[pid];s["complete"]=True
        checked_stats(s,goalie)
        output.append({"athlete":mapped[pid]["athlete"],"positions":mapped[pid]["positions"],"game":mapping["game"],"stats":s,"pointsTenths":points(s,goalie)})
    ordinary={side:sum(r["stats"]["goals"] for r in output if sideof[next(pid for pid,row in mapped.items() if row["athlete"]==r["athlete"])]==side) for side in ("home","away")}
    scores={side:uint(summary[side].get("points")) for side in ("home","away")}
    if shootout_seen:
        if ordinary["home"]!=ordinary["away"] or abs(scores["home"]-scores["away"])!=1 or any(scores[side]!=ordinary[side]+int(scores[side]>scores["away" if side=="home" else "home"]) for side in scores):fail("shootout/team score conservation")
    elif ordinary!=scores:fail("ordinary/team goal conservation")
    for side in ("home","away"):
        decisions=[allplayers[pid]["goaltending"]["total"].get("credit") for pid in allplayers if sideof[pid]==side and mapped[pid]["positions"]==16]
        winning=scores[side]>scores["away" if side=="home" else "home"]
        if winning:
            if decisions.count("win")!=1 or any(d in ("loss","overtime_loss") for d in decisions):fail("inconsistent winning goalie decisions")
        elif decisions.count("loss")+decisions.count("overtime_loss")!=1 or "win" in decisions:fail("inconsistent losing goalie decisions")
    mapping_hash=k256(json.dumps(mapping,sort_keys=True,separators=(",",":")).encode())
    evidence=k256(encode(["bytes32","bytes32","bytes32[]"],[EVIDENCE_DOMAIN,mapping_hash,[bytes.fromhex(h) for _,h in sorted(digests)]]))
    return {"providerGameID":gid,"game":mapping["game"],"scheduled":timestamp(mapping["scheduled"]),"actualStart":start,"finalAt":end,"decidedAt":end,
            "asOf":as_of,"cutoff":cutoff,"mappingMode":mapping.get("mode","unspecified"),"evidence":"0x"+evidence.hex(),"mappingHash":"0x"+mapping_hash.hex(),"rows":sorted(output,key=lambda r:r["athlete"]),
            "upstreamSources":1,"oracleAccepted":False,"sourceValidation":"summary/PBP/ice-time cross-check; single upstream"}


def normalise_captures(summary,pbp,ice,mapping,as_of,cutoff):
    records={kind:load_capture(path) for kind,path in (("summary",summary),("pbp",pbp),("time-on-ice",ice))}
    return normalise(records,mapping,as_of,cutoff)


def oracle_plan(games, chain_id, slate_book, slate, manifest, feed, revision, as_of):
    """ABI calldata for real router observations, resolve and verifyStats calls.

    Operators must read actual immutable slate/manifest/feed context on chain,
    review source evidence, and submit their own authorized transactions.
    """
    if not games or type(chain_id) is not int or chain_id<=0 or type(revision) is not int or not 0<revision<2**64:fail("invalid report context")
    def b32(value):
        if not isinstance(value,str) or not re.fullmatch(r"0x[0-9a-f]{64}",value) or int(value,16)==0:fail("invalid bytes32 context")
        return bytes.fromhex(value[2:])
    if not isinstance(slate_book,str) or not re.fullmatch(r"0x[0-9a-fA-F]{40}",slate_book) or int(slate_book,16)==0:fail("invalid slate book")
    s,m,f=b32(slate),b32(manifest),b32(feed)
    rows=[];results=[];ids=set();gameids=set()
    for game in games:
        if game["game"] in gameids or game["asOf"]!=as_of:fail("mixed or duplicate game revision")
        if as_of>=game["cutoff"]:fail("report after fixed scoring cutoff")
        gameids.add(game["game"])
        results.append((b32(game["game"]),game["actualStart"],game["finalAt"],game["decidedAt"],True,True,False))
        for row in game["rows"]:
            if row["athlete"] in ids or row["game"]!=game["game"]:fail("ambiguous slate athlete")
            ids.add(row["athlete"]);checked_stats(row["stats"],row["positions"]==16);rows.append(row)
    resolved=max(r[3] for r in results)
    if type(as_of) is not int or not resolved<=as_of<=resolved+86400:fail("report outside original correction window")
    # Preserve the frozen game order passed by the publisher; contract checks it.
    rows.sort(key=lambda r:r["athlete"])
    leaves=[stat_leaf(s,revision,r["athlete"],b32(r["game"]),r["stats"]) for r in rows]
    root,proofs=merkle(leaves)
    evidence=k256(encode(["bytes32","bytes32[]"],[EVIDENCE_DOMAIN,[b32(g["evidence"]) for g in games]]))
    report=(root,evidence,revision,as_of)
    digest=k256(encode(["bytes32","uint256","address","bytes32","bytes32","string",REPORT_ABI],[SLATE_DOMAIN,chain_id,slate_book,s,m,"STATS",report]))
    result_digest=k256(encode(["bytes32","uint256","address","bytes32","bytes32","string",RESULT_ABI,"bytes32"],[SLATE_DOMAIN,chain_id,slate_book,s,m,"RESULT",results,evidence]))
    def call(signature,types,values):return "0x"+(k256(signature.encode())[:4]+encode(types,values)).hex()
    witnesses=[{"athlete":r["athlete"],"game":r["game"],"positions":r["positions"],"stats":r["stats"],"pointsTenths":r["pointsTenths"],"leaf":"0x"+leaf.hex(),"proof":["0x"+v.hex() for v in proof]} for r,leaf,proof in zip(rows,leaves,proofs)]
    return {"chainID":chain_id,"slateBook":slate_book,"slate":slate,"manifest":manifest,"feed":feed,"root":"0x"+root.hex(),"evidence":"0x"+evidence.hex(),"revision":revision,"asOf":as_of,
            "statsDigest":"0x"+digest.hex(),"resultDigest":"0x"+result_digest.hex(),"rows":witnesses,
            "resolveCalldata":call("resolve(bytes32,(bytes32,uint64,uint64,uint64,bool,bool,bool)[],bytes32)",["bytes32",RESULT_ABI,"bytes32"],[s,results,evidence]),
            "verifyStatsCalldata":call("verifyStats(bytes32,(bytes32,bytes32,uint64,uint64))",["bytes32",REPORT_ABI],[s,report]),
            "oracleAccepted":False,"singleUpstream":True}


def observation_calldata(plan, phase, provider, observation, observed_at, confidence=10000):
    if phase not in ("result","stats"):fail("unsupported observation phase")
    if type(observed_at) is not int or observed_at<plan["asOf"] or type(confidence) is not int or not 0<confidence<=10000:fail("invalid observation time/confidence")
    def b32(v):
        if not isinstance(v,str) or not re.fullmatch(r"0x[0-9a-f]{64}",v) or int(v,16)==0:fail("invalid observation identity")
        return bytes.fromhex(v[2:])
    signature="submitObservation(bytes32,bytes32,bytes32,int256,bytes32,bytes32,uint64,uint16)"
    return "0x"+(k256(signature.encode())[:4]+encode(["bytes32","bytes32","bytes32","int256","bytes32","bytes32","uint64","uint16"],
        [b32(plan["feed"]),b32(provider),b32(observation),0,b32(plan[phase+"Digest"]),b32(plan["evidence"]),observed_at,confidence])).hex()


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("--summary",required=True);p.add_argument("--pbp",required=True);p.add_argument("--ice",required=True);p.add_argument("--mapping",required=True);p.add_argument("--as-of",required=True,type=int);p.add_argument("--cutoff",required=True,type=int);p.add_argument("--output",required=True);p.add_argument("--context",help="JSON chainID/slateBook/slate/manifest/feed/revision read from the target chain");a=p.parse_args()
    try:
        result=normalise_captures(a.summary,a.pbp,a.ice,json.loads(Path(a.mapping).read_text()),a.as_of,a.cutoff)
        if a.context:
            context=json.loads(Path(a.context).read_text())
            result={"normalized":result,"oraclePlan":oracle_plan([result],context["chainID"],context["slateBook"],context["slate"],context["manifest"],context["feed"],context["revision"],a.as_of)}
        Path(a.output).write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
        print(json.dumps({"validatedAthletes":len(result.get("normalized",result)["rows"]),"evidence":result.get("normalized",result)["evidence"],"oracleAccepted":False}))
    except (CaptureError,ValueError,KeyError,TypeError) as e:raise SystemExit("normalization rejected: "+str(e))

if __name__=="__main__":main()
