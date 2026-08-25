#!/usr/bin/env python3
import argparse, datetime, hashlib, json, pathlib, subprocess, sys, os

ap=argparse.ArgumentParser()
ap.add_argument("--gate",required=True)
ap.add_argument("--status",choices=["PASS","FAIL"],required=True)
ap.add_argument("--command",required=True)
ap.add_argument("--summary",required=True)
ap.add_argument("--artifact",default="")
ap.add_argument("--runner",default=os.environ.get("RUNNER_NAME","local"))
args=ap.parse_args()

root=pathlib.Path(__file__).resolve().parents[1]
schema=json.loads((root/"release/evidence/schema.json").read_text())
if args.gate not in schema["gates"]:
    raise SystemExit(f"unknown gate {args.gate}")

try:
    commit=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
except Exception:
    commit="UNKNOWN"

artifact_sha=""
if args.artifact:
    p=(root/args.artifact) if not pathlib.Path(args.artifact).is_absolute() else pathlib.Path(args.artifact)
    if p.exists() and p.is_file():
        artifact_sha=hashlib.sha256(p.read_bytes()).hexdigest()

record={
    "schema":"420-integrated-qualification-evidence-v1",
    "gate":args.gate,
    "status":args.status,
    "timestamp_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "git_commit":commit,
    "artifact_sha256":artifact_sha,
    "runner":args.runner,
    "command":args.command,
    "result_summary":args.summary,
}
out=root/"release/evidence"/f"{args.gate}.json"
out.write_text(json.dumps(record,indent=2)+"\n")
print(out)
