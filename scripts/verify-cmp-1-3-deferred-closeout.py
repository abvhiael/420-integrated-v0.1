#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
LEDGER = ROOT / "contracts/config/compute-market/cmp-1.3-deferred-closeout-ledger.json"

def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

data = json.loads(LEDGER.read_text())
if data.get("schema") != "420Integrated.ComputeMarket.CMP-1.3.DeferredCloseoutDraft.v1":
    fail("unexpected ledger schema")
if data.get("authorized_substep") is not None:
    fail("deferred closeout must remain unnumbered until the authoritative roadmap is recovered")
if data.get("repository_closeout_candidate") is not False:
    fail("deferred closeout must not claim phase completion")
if data.get("live_release") is not False:
    fail("deferred closeout must not claim live release")

for rel in data.get("required_components", []):
    if not (ROOT / rel).is_file():
        fail(f"missing preserved component: {rel}")
for rel in data.get("required_tests", []):
    if not (ROOT / rel).is_file():
        fail(f"missing preserved test: {rel}")
if not data.get("external_release_blockers"):
    fail("release blockers must remain explicit")

print("CMP-1.3 deferred closeout draft: preserved and unnumbered")
