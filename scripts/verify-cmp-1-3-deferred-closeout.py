#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
LEDGER = ROOT / "contracts/config/compute-market/cmp-1.3-deferred-closeout-ledger.json"
DRAFT = ROOT / "docs/compute-market/CMP-1.3-DEFERRED-CLOSEOUT-DRAFT.md"

def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

data = json.loads(LEDGER.read_text())
if data.get("schema") != "420Integrated.ComputeMarket.CMP-1.3.16.CloseoutLedger.v1":
    fail("deferred ledger has not been promoted to CMP-1.3.16 closeout schema")
if data.get("step") != "CMP-1.3.16":
    fail("promoted ledger is not assigned to CMP-1.3.16")
if data.get("migrated_from_deferred_closeout") is not True:
    fail("migration provenance missing")
if data.get("live_release") is not False:
    fail("closeout migration must not claim live release")
if "MIGRATED INTO AUTHORIZED CMP-1.3.16 CLOSEOUT" not in DRAFT.read_text():
    fail("historical deferred draft is not marked migrated")

print("CMP-1.3 deferred closeout material: migrated into authorized CMP-1.3.16")
