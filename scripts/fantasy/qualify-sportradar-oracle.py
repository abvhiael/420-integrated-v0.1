"""Execute source validation and real canonical oracle/scorer integration.

Default mode uses synthetic schemas; --capture-store adds private authenticated
captures without copying licensed source payloads into the qualification artifact.
No testnet/public deployment or escrow-settlement claim.
"""
import argparse
import ast
from datetime import datetime,timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"clients/420bet-fantasy"))
from eth_abi import encode
from nhl import FIELDS,k256
from sportradar import load_capture,CaptureError
from sportradar_scoring import bootstrap_mapping,normalise,oracle_plan,observation_calldata,timestamp,EVIDENCE_DOMAIN
from test_sportradar_scoring import fixture,ASOF,CUTOFF


def execute(command,env,out,name,cwd=ROOT):
    result=subprocess.run(command,cwd=cwd,env=env,capture_output=True)
    (out/(name+".stdout.log")).write_bytes(result.stdout);(out/(name+".stderr.log")).write_bytes(result.stderr)
    if result.returncode:raise RuntimeError("actual execution failed: "+name)
    return result.stdout.decode("utf-8-sig")


def git(*args):return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()


def approved_cutoff(scheduled):
    code="import {cutoffForSlate} from './clients/420bet-fantasy/slate-time.mjs'; console.log(cutoffForSlate(JSON.parse(process.argv[1])).cutoff)"
    return int(subprocess.check_output(["node","--input-type=module","-e",code,json.dumps([scheduled])],cwd=ROOT,text=True))


def write_vector(game,path):
    slate=k256(b"420.SPORTRADAR.QUALIFICATION.SLATE.V1")
    plan=oracle_plan([game],420,"0x"+"11"*20,"0x"+slate.hex(),"0x"+"22"*32,"0x"+"33"*32,1,game["asOf"])
    rows=plan["rows"]
    vector=(slate,bytes.fromhex(game["game"][2:]),game["scheduled"],game["cutoff"],game["asOf"],game["actualStart"],game["finalAt"],bytes.fromhex(plan["evidence"][2:]),bytes.fromhex(plan["root"][2:]),
            [r["athlete"] for r in rows],[r["positions"] for r in rows],[[r["stats"][f] for f in FIELDS] for r in rows],[[bytes.fromhex(p[2:]) for p in r["proof"]] for r in rows],[r["pointsTenths"] for r in rows])
    abi="(bytes32,bytes32,uint64,uint64,uint64,uint64,uint64,bytes32,bytes32,uint32[],uint8[],("+",".join(["uint16"]*8+["bool"]*7)+")[],bytes32[][],int256[])"
    path.write_text("0x"+encode([abi],[vector]).hex(),encoding="utf-8")
    return plan


def verify_trace(trace,game):
    line=next(l for l in trace.splitlines() if "emit Connected(" in l)
    def field(n,pattern):return re.search(n+r": (?:[A-Za-z0-9_]+: \[)?("+pattern+")",line)[1]
    plan=oracle_plan([game],31337,field("book",r"0x[0-9a-fA-F]{40}"),field("slate",r"0x[0-9a-fA-F]{64}"),field("manifest",r"0x[0-9a-fA-F]{64}"),field("feed",r"0x[0-9a-fA-F]{64}"),1,game["asOf"])
    for name in ("resultDigest","statsDigest","root","evidence"):
        if plan[name].lower()!=field(name,r"0x[0-9a-fA-F]{64}").lower():raise RuntimeError("independent contract domain mismatch: "+name)
    calls=next(l for l in trace.splitlines() if "emit Calls(" in l)
    for name in ("resolveCalldata","verifyStatsCalldata"):
        actual=re.search(name+r": (0x[0-9a-fA-F]+)",calls)[1]
        if plan[name].lower()!=actual.lower():raise RuntimeError("independent ABI mismatch: "+name)
    observation=re.search(r"observationCalldata: (0x[0-9a-fA-F]+)",calls)[1]
    nonce=k256(encode(["string","uint256"],["sportradar-observation",3]))
    expected=observation_calldata(plan,"stats","0x"+k256(b"reporter-a").hex(),"0x"+nonce.hex(),game["asOf"]+1)
    if expected.lower()!=observation.lower():raise RuntimeError("actual router observation ABI mismatch")
    identities={}
    modules=["FantasySlateBook420","OracleRouter420","OracleProviderRegistry420","OracleFeedRegistry420","FantasyNHLScoring420"]
    for line in trace.splitlines():
        if "emit Identity(" not in line:continue
        hashes=re.findall(r"0x[0-9a-fA-F]{64}\b",line);kind=next((m for m in modules if k256(m.encode()).hex()==hashes[0][2:].lower()),None)
        if kind is None or kind in identities:raise RuntimeError("unknown/duplicate deployed identity")
        identities[kind]={"address":re.search(r"0x[0-9a-fA-F]{40}\b",line)[0],"runtimeHash":hashes[1],"runtimeBytes":int(re.search(r"runtimeBytes: (\d+)",line)[1])}
        if not 0<identities[kind]["runtimeBytes"]<=24576:raise RuntimeError("invalid deployed runtime size")
    if set(identities)!=set(modules):raise RuntimeError("missing actual deployed code identities")
    return {"canonicalOracleAccepted":True,"independentDigestAndABIReplay":True,"root":plan["root"],"evidence":plan["evidence"],"slateBook":plan["slateBook"],"leafCount":len(plan["rows"]),"upstreamSources":1,"operators":2,"deployedModules":identities}


def main():
    p=argparse.ArgumentParser();p.add_argument("--forge",default="forge");p.add_argument("--solc",default="0.8.30");p.add_argument("--output",required=True);p.add_argument("--capture-store");p.add_argument("--allow-dirty",action="store_true",help="diagnostics only; emits no qualification certificate");a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);cert=out/"qualification.json";cert.unlink(missing_ok=True)
    if git("status","--porcelain","--untracked-files=no") and not a.allow_dirty:raise RuntimeError("qualification requires clean tracked source")
    sha=git("rev-parse","HEAD");env=dict(os.environ);env.pop("SPORTRADAR_API_KEY",None);env.pop("SPORTRADAR_API_KEY_FILE",None)
    execute([sys.executable,"-m","unittest","discover","-s","clients/420bet-fantasy","-p","test_*.py","-v"],env,out,"clients")
    log=(out/"clients.stderr.log").read_text()
    count=int(re.search(r"Ran (\d+) tests",log)[1])
    inventory=sum(sum(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name.startswith("test_") for n in ast.walk(ast.parse(path.read_text()))) for path in (ROOT/"clients/420bet-fantasy").glob("test_*.py"))
    if count!=inventory or count<77 or "\nOK\n" not in log or "skipped=" in log:raise RuntimeError("incomplete actual source/client execution")
    execute(["node","--test","--test-reporter=tap","clients/420bet-fantasy/slate-time.test.mjs"],env,out,"timezone")
    if "# fail 0" not in (out/"timezone.stdout.log").read_text():raise RuntimeError("timezone execution failed")
    records,mapping=fixture();synthetic=normalise(records,mapping,ASOF,approved_cutoff(timestamp(mapping["scheduled"])))
    cases=[("synthetic",synthetic)];source_results=[]
    if a.capture_store:
        groups={}
        for path in sorted(Path(a.capture_store).resolve().joinpath("captures").glob("*.json")):
            meta,data=load_capture(path);ep=meta["endpoint"]
            kind="time-on-ice" if ep.endswith("/time_on_ice.json") else "summary" if ep.endswith("/summary.json") else "pbp" if ep.endswith("/pbp.json") else None
            if kind:groups.setdefault(data["id"],{})[kind]=(meta,data)
        for gid,records in sorted(groups.items()):
            if set(records)!={"summary","pbp","time-on-ice"}:continue
            asof=math.ceil(max(r[0]["capturedAt"] for r in records.values()));summary=records["summary"][1]
            try:
                game=normalise(records,bootstrap_mapping(summary),asof,approved_cutoff(timestamp(summary["scheduled"])))
            except CaptureError as error:
                source_results.append({"game":gid,"sourceValidated":False,"rejection":str(error)});continue
            item={"game":gid,"sourceValidated":True,"athletes":len(game["rows"]),"shootoutBonuses":sum(r["stats"]["shootout"] for r in game["rows"]),"shutouts":sum(r["stats"]["shutout"] for r in game["rows"]),"overtimeLosses":sum(r["stats"]["overtimeLoss"] for r in game["rows"]),"evidence":game["evidence"]}
            if asof<=game["finalAt"]+86400 and asof<game["cutoff"]:
                cases.append((gid,game));item["oracleReplayEligible"]=True
            else:item.update(oracleReplayEligible=False,rejection="new capture arrived after original correction window; no backdating")
            source_results.append(item)
        if len(source_results)<4 or sum(r["sourceValidated"] for r in source_results)<3:raise RuntimeError("insufficient real source validation")
    execute_env=dict(env,FOUNDRY_PROFILE="pr",FOUNDRY_SRC=str(ROOT/"contracts/src/bet/fantasy"),FOUNDRY_TEST=str(ROOT/"contracts/test/fantasy-oracle"),FOUNDRY_OUT=str(out/"build"),FOUNDRY_CACHE_PATH=str(out/"cache"),FOUNDRY_VIA_IR="true",FOUNDRY_CHAIN_ID="31337",FOUNDRY_FS_PERMISSIONS=json.dumps([{"access":"read","path":str(out)}]))
    config=out/"foundry.toml"
    source_config=(ROOT/"contracts/foundry.toml").read_text()
    permission='fs_permissions = [{ access = "read", path = '+json.dumps(out.as_posix())+' }]'
    config.write_text(source_config.replace('[profile.pr]','[profile.pr]\n'+permission),encoding="utf-8")
    native=[]
    for name,game in cases:
        vector=out/(name+".abi");write_vector(game,vector);execute_env["FANTASY_ORACLE_VECTOR"]=str(vector)
        if name=="synthetic":
            embedded=(ROOT/"contracts/test/fantasy-oracle/FantasySportradarOracle420.t.sol").read_text()
            if 'encoded=hex"'+vector.read_text().removeprefix("0x")+'";' not in embedded:raise RuntimeError("standalone oracle vector differs from regenerated genuine input")
        cmd=[a.forge,"test","--root",str(ROOT/"contracts"),"--config-path",str(config),"--no-dynamic-test-linking","--use",a.solc,"--match-contract","FantasySportradarOracle420Test"]
        raw=execute(cmd+["--json"],execute_env,out,name+"-native",ROOT/"contracts");suites=json.loads(raw)
        tests=[t for suite in suites.values() for t in suite["test_results"].values()]
        if len(tests)!=11 or any(t["status"]!="Success" for t in tests):raise RuntimeError("missing/failed actual oracle test")
        trace=execute(cmd+["--match-test","testVerifiedProviderStatisticsReachCanonicalOracleAndScorer","-vvvv"],execute_env,out,name+"-trace",ROOT/"contracts")
        result=verify_trace(trace,game);result.update(case=name,nativeTestsPassed=11,source="synthetic schema" if name=="synthetic" else "authenticated Sportradar historical replay")
        native.append(result)
        # Licensed derived statistics remain in the explicitly private output.
    ordinary_env=dict(execute_env);ordinary_env.pop("FANTASY_ORACLE_VECTOR",None)
    raw=execute(cmd+["--json"],ordinary_env,out,"ordinary-native",ROOT/"contracts");ordinary=json.loads(raw)
    ordinary_tests=[t for suite in ordinary.values() for t in suite["test_results"].values()]
    if len(ordinary_tests)!=11 or any(t["status"]!="Success" for t in ordinary_tests):raise RuntimeError("ordinary native execution failed")
    if git("rev-parse","HEAD")!=sha or (git("status","--porcelain","--untracked-files=no") and not a.allow_dirty):raise RuntimeError("source changed")
    paths=git("ls-files","clients/420bet-fantasy","contracts/test/fantasy-oracle","scripts/fantasy/qualify-sportradar-oracle.py").splitlines()
    for module in ["FantasySlateBook420","OracleRouter420","FantasyNHLScoring420"]:
        artifact=json.loads((out/"build"/(module+".sol")/(module+".json")).read_text())
        metadata=artifact["metadata"]
        if isinstance(metadata,str):metadata=json.loads(metadata)
        for source in metadata["sources"]:
            source_path=Path(source)
            if not source_path.is_absolute():source_path=(ROOT/"contracts"/source_path).resolve()
            if not source_path.is_relative_to(ROOT):raise RuntimeError("untracked external source in oracle compilation")
            paths.append(source_path.relative_to(ROOT).as_posix())
    paths=sorted(set(paths))
    if not a.allow_dirty:
        for path in paths:git("ls-files","--error-unmatch",path)
    report={"qualifiedSHA":sha,"levels":[1,2],"scope":"Sportradar scoring normalization and canonical oracle/scorer connection; no live settlement","pythonTestsPassed":count,"timezoneTestsPassed":6,"ordinaryNativeTestsPassed":11,"native":native,"sourceValidation":source_results,
            "officialTestnetDeployed":False,"liveSettlementQualified":False,"upstreamIndependenceQualified":False,"newNetworkCallsDuringQualification":0,"diagnosticOnly":a.allow_dirty,
            "sourceSHA256":{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths},"evidenceSHA256":{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file()},"completedAt":datetime.now(timezone.utc).isoformat()}
    if not a.allow_dirty:cert.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    else:(out/"diagnostic.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"sha":sha,"pythonTests":count,"nativeCases":len(native),"sourceGames":len(source_results),"diagnosticOnly":a.allow_dirty}))

if __name__=="__main__":main()
