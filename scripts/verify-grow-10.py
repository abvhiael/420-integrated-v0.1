#!/usr/bin/env python3
"""GROW-10 preflight: stage evidence cannot be mistaken for live qualification."""
from pathlib import Path
import json

root=Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text(encoding="utf-8")
def check(ok,message):
    if not ok: raise AssertionError(message)

ledger=read("docs/audit/420GROW-GROW-10-STAGE-QUALIFICATION.md")
configuration=read("grow/web/runtime-config.js")
identity=read("docs/audit/420GROW-GROW-02-IDENTITY-DECISION.md")
app=json.dumps(json.loads(read("config/genesis-applications.json"))).lower()
check("GROW-10 as a **whole remains BLOCKED**" in ledger,"missing truthful release gate")
for term in ("CODE","BUILD","CONTRACT","TEST","DOCUMENTATION","INTEGRATION","SECURITY","TESTNET","GENESIS","PRODUCTION"):
    check("| "+term+" |" in ledger,"missing independent "+term+" gate")
for term in ("Not supplied — BLOCKED","Not run against live","not a newly numbered roadmap step","rollback","TLS","CORS"):
    check(term.lower() in ledger.lower(),"missing live stage prerequisite "+term)
check("enabled:false" in configuration and 'locationBaseUrl:""' in configuration,"unapproved live web endpoint enabled")
check("CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID" in identity,"canonical identity altered")
check("420grow" not in app,"unapproved Genesis application admission")
check(not list((root/"grow").rglob("*.sol")),"unapproved Grow Solidity artifact")
print("GROW-10 stage readiness preflight: PASS; real deployment remains BLOCKED")
