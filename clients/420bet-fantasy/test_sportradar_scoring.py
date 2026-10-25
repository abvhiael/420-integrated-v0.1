"""Synthetic regression cases; authenticated source checks run separately/private."""
import copy
import hashlib
import unittest
from eth_abi import decode
from nhl import k256, FIELDS
from sportradar import CaptureError,endpoint
from sportradar_scoring import bootstrap_mapping, normalise, oracle_plan, observation_calldata, seconds

GID="2010fc1d-05a9-46a9-ab51-57941d7e31a7"
HOME="44179d47-0f24-11e2-8525-18a905767e44"
AWAY="441862de-0f24-11e2-8525-18a905767e44"
START=1792861200;END=START+8000;ASOF=END+100;CUTOFF=START+36*3600


def fixture():
    game={"id":GID,"coverage":"full","status":"closed","scheduled":"2026-10-24T17:00:00+00:00","start_time":"2026-10-24T17:07:27+00:00","end_time":"2026-10-24T19:13:20+00:00","total_game_duration":"60:00"}
    for side,team,offset in [("home",HOME,0),("away",AWAY,8)]:
        rows=[]
        for index,pos in enumerate(["C","LW","RW","D","D","G","C","G"]):
            n=offset+index+1;pid=f"00000000-0000-0000-0000-{n:012d}";played=index!=7
            st={"total":{"goals":0,"assists":0,"shots":0,"blocked_shots":0},"shorthanded":{"goals":0,"assists":0},"shootout":{"goals":0}}
            p={"id":pid,"reference":str(8000000+n),"primary_position":pos,"position":"G" if pos=="G" else "F","statistics":st}
            if played:p.update(played=True,time_on_ice={"total":"60:00"})
            if pos=="G":p["goaltending"]={"total":{"saves":0,"goals_against":0,"shots_against":0,"credit":"none"}}
            rows.append(p)
        game[side]={"id":team,"points":1 if side=="home" else 0,"players":rows}
    game["home"]["players"][0]["statistics"]["total"].update(goals=1,shots=1)
    game["home"]["players"][5]["goaltending"]["total"]["credit"]="win"
    game["away"]["players"][5]["goaltending"]["total"].update(goals_against=1,shots_against=1,credit="loss")
    ice=copy.deepcopy(game)
    for side in ["home","away"]:
        for p in ice[side]["players"]:
            if p.get("played"):p["time_on_ice"]["periods"]=[{"number":i,"type":"REG","total":"20:00","shifts":[{"start":"00:00","end":"20:00","duration":"20:00"}]} for i in [1,2,3]]
    pbp=copy.deepcopy(game);pbp["deleted_events"]=[]
    event={"id":"goal-event","official":True,"event_type":"goal","statistics":[
      {"type":"shot","goal":True,"strength":"even","player":{"id":game["home"]["players"][0]["id"]},"team":{"id":HOME}},
      {"type":"shotagainst","goal":True,"saved":False,"strength":"even","player":{"id":game["away"]["players"][5]["id"]},"team":{"id":AWAY}}]}
    pbp["periods"]=[{"number":1,"type":"period","events":[event]},{"number":2,"type":"period","events":[]},{"number":3,"type":"period","events":[]}]
    records={k:({"provider":"SPORTRADAR","apiVersion":7,"access":"trial","endpoint":endpoint(k,GID),"capturedAt":ASOF-1,"bodySHA256":hashlib.sha256(k.encode()).hexdigest()},v) for k,v in [("summary",game),("pbp",pbp),("time-on-ice",ice)]}
    return records,bootstrap_mapping(game)


class ScoringSourceTest(unittest.TestCase):
    def setUp(self):self.r,self.m=fixture()
    def run_source(self):return normalise(self.r,self.m,ASOF,CUTOFF)
    def reject(self):
        with self.assertRaises((CaptureError,ValueError,KeyError,TypeError)):self.run_source()
    def test_complete_records_and_real_goalie_shutout(self):
        n=self.run_source();self.assertEqual(len(n["rows"]),16)
        by={r["athlete"]:r for r in n["rows"]};self.assertEqual(by[8000001]["pointsTenths"],100);self.assertEqual(by[8000006]["pointsTenths"],100)
        self.assertTrue(by[8000006]["stats"]["shutout"]);self.assertFalse(by[8000008]["stats"]["played"])
    def test_summary_goal_mismatch_rejected(self):self.r["summary"][1]["home"]["players"][0]["statistics"]["total"]["goals"]=2;self.reject()
    def test_missing_stat_not_zero(self):del self.r["summary"][1]["home"]["players"][0]["statistics"]["total"]["blocked_shots"];self.reject()
    def test_future_capture_rejected(self):self.r["pbp"][0]["capturedAt"]=ASOF+1;self.reject()
    def test_incomplete_coverage_rejected(self):self.r["pbp"][1]["coverage"]="boxscore";self.reject()
    def test_live_game_rejected(self):self.r["summary"][1]["status"]="inprogress";self.reject()
    def test_wrong_game_rejected(self):self.r["pbp"][1]["id"]=HOME;self.reject()
    def test_wrong_endpoint_rejected(self):self.r["pbp"][0]["endpoint"]=endpoint("summary",GID);self.reject()
    def test_after_cutoff_rejected(self):
        with self.assertRaises(CaptureError):normalise(self.r,self.m,ASOF,START+100)
    def test_original_schedule_change_rejected(self):self.m["scheduled"]="2026-10-24T18:00:00Z";self.reject()
    def test_duplicate_identity_rejected(self):self.m["rows"][1]["athlete"]=self.m["rows"][0]["athlete"];self.reject()
    def test_wrong_position_rejected(self):self.m["rows"][0]["positions"]=16;self.reject()
    def test_wrong_nhl_reference_rejected(self):self.m["rows"][0]["reference"]="99";self.reject()
    def test_wrong_team_in_events_rejected(self):self.r["pbp"][1]["periods"][0]["events"][0]["statistics"][0]["team"]["id"]=AWAY;self.reject()
    def test_deleted_event_rejected(self):self.r["pbp"][1]["deleted_events"]=[{"event":{"id":"goal-event"}}];self.reject()
    def test_duplicate_event_rejected(self):self.r["pbp"][1]["periods"][0]["events"]*=2;self.reject()
    def test_unofficial_event_rejected(self):self.r["pbp"][1]["periods"][0]["events"][0]["official"]=False;self.reject()
    def test_dnp_with_positive_ice_rejected(self):self.r["summary"][1]["home"]["players"][0]["played"]=False;self.reject()
    def test_dnp_missing_stat_rejected(self):del self.r["summary"][1]["home"]["players"][7]["statistics"]["total"]["shots"];self.reject()
    def test_goalie_credit_not_inferred_from_team_score(self):self.r["summary"][1]["home"]["players"][5]["goaltending"]["total"]["credit"]="unknown";self.reject()
    def test_goalie_save_conservation_rejected(self):self.r["summary"][1]["away"]["players"][5]["goaltending"]["total"]["shots_against"]=2;self.reject()
    def test_nonfull_goalie_cannot_get_shutout(self):
        for kind in ["summary","time-on-ice"]:self.r[kind][1]["home"]["players"][5]["time_on_ice"]["total"]="59:00"
        self.reject()  # cannot silently omit a potentially earned shutout
    def test_official_shutout_with_delayed_penalty_pull(self):
        for kind in ["summary","time-on-ice"]:self.r[kind][1]["home"]["players"][5]["time_on_ice"]["total"]="59:50"
        self.r["summary"][1]["home"]["players"][5]["goaltending"]["total"]["shutout"]=True
        row=next(r for r in self.run_source()["rows"] if r["athlete"]==8000006)
        self.assertTrue(row["stats"]["shutout"]);self.assertTrue(row["stats"]["entireGame"])
    def test_relief_goalies_do_not_get_individual_shutout(self):
        for kind in ["summary","time-on-ice"]:
            first=self.r[kind][1]["home"]["players"][5];backup=self.r[kind][1]["home"]["players"][7]
            first["time_on_ice"]["total"]="30:00";backup["played"]=True;backup["time_on_ice"]={"total":"30:00"}
        rows=[r for r in self.run_source()["rows"] if r["athlete"] in [8000006,8000008]]
        self.assertTrue(all(not r["stats"]["shutout"] and not r["stats"]["soleGoalie"] for r in rows))
    def test_shootout_is_bonus_only_not_goal_shot_or_save(self):
        player=self.r["summary"][1]["home"]["players"][0];player["statistics"]["shootout"]["goals"]=1
        event={"id":"so-event","official":True,"event_type":"goal","statistics":[{"type":"shot","goal":True,"player":{"id":player["id"]},"team":{"id":HOME}}]}
        self.r["summary"][1]["away"]["players"][0]["statistics"]["total"].update(goals=1,shots=1)
        self.r["summary"][1]["home"]["players"][5]["goaltending"]["total"].update(goals_against=1,shots_against=1)
        self.r["summary"][1]["home"]["points"]=2;self.r["summary"][1]["away"]["points"]=1
        equaliser=copy.deepcopy(self.r["pbp"][1]["periods"][0]["events"][0]);equaliser["id"]="equaliser"
        equaliser["statistics"][0].update(player={"id":self.r["summary"][1]["away"]["players"][0]["id"]},team={"id":AWAY})
        equaliser["statistics"][1].update(player={"id":self.r["summary"][1]["home"]["players"][5]["id"]},team={"id":HOME})
        self.r["pbp"][1]["periods"][0]["events"].append(equaliser)
        self.r["pbp"][1]["periods"].append({"number":5,"type":"shootout","events":[event]})
        row=next(r for r in self.run_source()["rows"] if r["athlete"]==8000001)
        self.assertEqual(row["stats"]["goals"],1);self.assertEqual(row["stats"]["shots"],1);self.assertEqual(row["stats"]["shootout"],1);self.assertEqual(row["pointsTenths"],115)
    def test_short_handed_goal_bonus_reconciles(self):
        self.r["summary"][1]["home"]["players"][0]["statistics"]["shorthanded"]["goals"]=1
        self.r["pbp"][1]["periods"][0]["events"][0]["statistics"][0]["strength"]="shorthanded"
        self.assertEqual(self.run_source()["rows"][0]["pointsTenths"],120)
    def test_oracle_domain_binds_chain_manifest_and_revision(self):
        g=self.run_source();args=[ [g],420,"0x"+"11"*20,"0x"+"22"*32,"0x"+"33"*32,"0x"+"44"*32,1,ASOF]
        a=oracle_plan(*args);args[1]=421;b=oracle_plan(*args);self.assertNotEqual(a["statsDigest"],b["statsDigest"])
        args[1]=420;args[6]=2;self.assertNotEqual(a["statsDigest"],oracle_plan(*args)["statsDigest"])
        self.assertFalse(a["oracleAccepted"]);self.assertTrue(a["singleUpstream"])
    def test_observation_calldata_uses_actual_canonical_selector(self):
        plan=oracle_plan([self.run_source()],420,"0x"+"11"*20,"0x"+"22"*32,"0x"+"33"*32,"0x"+"44"*32,1,ASOF)
        raw=bytes.fromhex(observation_calldata(plan,"stats","0x"+"55"*32,"0x"+"66"*32,ASOF)[2:])
        self.assertEqual(raw[:4],k256(b"submitObservation(bytes32,bytes32,bytes32,int256,bytes32,bytes32,uint64,uint16)")[:4])
        value=decode(["bytes32","bytes32","bytes32","int256","bytes32","bytes32","uint64","uint16"],raw[4:]);self.assertEqual(value[4].hex(),plan["statsDigest"][2:])
    def test_team_score_disagreement_rejected(self):
        self.r["summary"][1]["home"]["points"]=2;self.reject()
    def test_cutoff_blocks_oracle_report_without_backdating(self):
        game=self.run_source();game["cutoff"]=ASOF
        with self.assertRaises(CaptureError):oracle_plan([game],420,"0x"+"11"*20,"0x"+"22"*32,"0x"+"33"*32,"0x"+"44"*32,1,ASOF)
    def test_bad_time_components_rejected(self):
        for val in ["60:60","1:99:00","bad",None]:
            with self.assertRaises(CaptureError):seconds(val)

if __name__=="__main__":unittest.main()
