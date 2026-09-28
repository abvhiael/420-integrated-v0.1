#!/usr/bin/env python3
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
LEDGER = ROOT / "contracts/config/compute-market/cmp-1.3.8-closeout-ledger.json"

def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)

data = json.loads(LEDGER.read_text())
if data.get("schema") != "420Integrated.ComputeMarket.CMP-1.3.8.CloseoutLedger.v1":
    fail("unexpected ledger schema")
if data.get("repository_closeout_candidate") is not True:
    fail("repository_closeout_candidate must be true")
if data.get("live_release") is not False:
    fail("CMP-1.3.8 must not claim live release")

for rel in data.get("required_components", []):
    if not (ROOT / rel).is_file():
        fail(f"missing required component: {rel}")
for rel in data.get("required_tests", []):
    if not (ROOT / rel).is_file():
        fail(f"missing required test: {rel}")

required_substeps = [f"1.3.{i}" for i in range(0, 8)]
for step in required_substeps:
    if step not in data.get("substeps", {}):
        fail(f"missing substep disposition: {step}")

required_invariants = [
    "CMP-INV-002","CMP-INV-003","CMP-INV-004","CMP-INV-005",
    "CMP-INV-007","CMP-INV-008","CMP-INV-019","CMP-INV-020",
    "CMP-INV-021","CMP-INV-022","CMP-INV-023","CMP-INV-026",
    "CMP-INV-028","CMP-INV-029","CMP-INV-030"
]
for inv in required_invariants:
    if inv not in data.get("invariants", {}):
        fail(f"missing invariant disposition: {inv}")

if not data.get("external_release_blockers"):
    fail("release blockers must remain explicit")

print("CMP-1.3.8 repository closeout ledger: READY")
