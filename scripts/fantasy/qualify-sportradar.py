"""Actual scoped Level 1 client execution; no live-source qualification claim."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--output",required=True);args=parser.parse_args()
    out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
    cert=out/"qualification.json";cert.unlink(missing_ok=True)
    if git("status","--porcelain","--untracked-files=no"):raise RuntimeError("tracked source must be clean")
    sha=git("rev-parse","HEAD")
    env=dict(os.environ);env.pop("SPORTRADAR_API_KEY",None);env.pop("SPORTRADAR_API_KEY_FILE",None)
    commands=[("client",[sys.executable,"-m","unittest","discover","-s","clients/420bet-fantasy","-p","test_*.py","-v"]),
              ("timezone",["node","--test","--test-reporter=tap","clients/420bet-fantasy/slate-time.test.mjs"])]
    for name,command in commands:
        result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True)
        (out/(name+".stdout.log")).write_bytes(result.stdout);(out/(name+".stderr.log")).write_bytes(result.stderr)
        if result.returncode:raise RuntimeError("actual execution failed: "+name)
    log=(out/"client.stderr.log").read_text();tz=(out/"timezone.stdout.log").read_text()
    if not re.search(r"Ran 46 tests",log) or "\nOK\n" not in log or "skipped=" in log:raise RuntimeError("incomplete client execution")
    if not re.search(r"# tests 6\b",tz) or not re.search(r"# fail 0\b",tz):raise RuntimeError("incomplete timezone execution")
    paths=git("ls-files","clients/420bet-fantasy","scripts/fantasy/qualify-sportradar.py",".github/workflows/420bet-sportradar-testing-level1.yml").splitlines()
    sources={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}
    if git("rev-parse","HEAD")!=sha or git("status","--porcelain","--untracked-files=no"):raise RuntimeError("source changed")
    report={"qualifiedSHA":sha,"tree":git("rev-parse","HEAD^{tree}"),"level":1,"scope":"Sportradar offline transport and existing cryptographic client",
            "pythonTestsPassed":46,"newProviderTests":28,"inheritedCryptoClientTests":18,"timezoneTestsPassed":6,"nativeTestsRerun":False,
            "liveProviderRequests":0,"liveSourceAccepted":False,"accountActiveVerified":False,
            "pending":["account and credential provisioning","authenticated samples and complete field mapping","oracle-connected real-game qualification"],
            "completedAt":datetime.now(timezone.utc).isoformat(),"sourceSHA256":sources,
            "evidenceSHA256":{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in out.iterdir() if p.is_file()}}
    cert.write_text(json.dumps(report,indent=2)+"\n");print(json.dumps({k:report[k] for k in ["qualifiedSHA","level","pythonTestsPassed","timezoneTestsPassed","liveProviderRequests"]}))

if __name__=="__main__":main()
