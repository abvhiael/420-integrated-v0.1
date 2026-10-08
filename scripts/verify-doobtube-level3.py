#!/usr/bin/env python3
"""DOOBTUBE-11 Level 3 ownership/reconciliation verifier."""
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    p=ROOT/path
    assert p.exists(), f"missing {path}"
    return p.read_text(encoding="utf-8")

def need(path, phrases):
    text=read(path)
    for phrase in phrases:
        assert phrase in text, f"{path}: missing {phrase!r}"
    return text

phase=need("docs/audit/DOOBTUBE-PHASE-CLOSEOUT.md",[
    "DOOBTUBE-11 — Repository Level 3 exact-head closeout",
    "PENDING LEVEL 3 QUALIFICATION",
    "Solidity Contracts",
    "Genesis Address Authority",
    "420 Integrated Qualification",
    "420Docs Qualification",
    "420 Genesis Contract Hardening",
    "DoobTube Level 2 integration",
    "no full Foundry duplication",
])

sol=need(".github/workflows/contracts-foundry.yml",[
    "name: Solidity Contracts",
    'shard: [0, 1, 2, 3]',
    "qualify-foundry-shard.sh",
    "docs/audit/DOOBTUBE-PHASE-CLOSEOUT.md",
    "audit/doobtube-baseline-20261006",
])
assert "matrix:\n        shard: [0, 1, 2, 3]" in sol
assert "--force" not in sol.split("pr-shards:",1)[1].split("foundry:",1)[0]

gen=need(".github/workflows/genesis-address-authority.yml",[
    "name: Genesis Address Authority",
    "docs/audit/DOOBTUBE-PHASE-CLOSEOUT.md",
    "audit/doobtube-baseline-20261006",
    "Genesis owns address/namespace/predeploy authority qualification only",
])
for forbidden in ("forge test","qualify-foundry-shard.sh","forge build --force"):
    assert forbidden not in gen, f"Genesis duplicates Foundry owner: {forbidden}"

global_ci=need(".github/workflows/qualification.yml",[
    "name: 420 Integrated Qualification",
    "docs/audit/DOOBTUBE-PHASE-CLOSEOUT.md",
    "audit/doobtube-baseline-20261006",
    "go test ./...",
    "live-engine-smoke.sh",
    "run-fault-matrix.py",
    "run-soak.py --slots 120 --slot-ms 35",
])

docs=need(".github/workflows/docs-qualify.yml",[
    "name: 420Docs Qualification",
    "docs/audit/DOOBTUBE-PHASE-CLOSEOUT.md",
    "audit/doobtube-baseline-20261006",
    "qualify-documentation.py",
])

hard=need(".github/workflows/contracts-hardening.yml",[
    "name: 420 Genesis Contract Hardening",
    "docs/audit/DOOBTUBE-PHASE-CLOSEOUT.md",
    "Verify exact qualification head",
    "Dangerous authority and opcode scan",
    "Hardening size build",
    "Genesis invariant campaign",
    "Slither high-severity gate",
])
assert "forge clean" not in hard
assert "forge build --force" not in hard
assert "forge build --sizes" in hard

level2=need(".github/workflows/doobtube-integration.yml",[
    "name: DoobTube Level 2 integration",
    "docs/audit/DOOBTUBE-PHASE-CLOSEOUT.md",
    "Run Level 2 ecosystem integration suite",
    "Verify Level 2 ecosystem integration",
])

manifest=json.loads(read("doobtube/release/manifest-v1.json"))
assert manifest["production"] is False
assert manifest["testnet_ready"] is False
assert manifest["genesis_ready"] is False
assert manifest["production_ready"] is False
assert manifest["contracts"]==[]
assert manifest["reserved_addresses"]==[]
assert manifest["service_identity"]["doobtube"] is None

road=read("docs/DOOBTUBE-ROADMAP.md")
audit=read("docs/DOOBTUBE-AUDIT.md")
assert "## DOOBTUBE-11 — Repository Level 3 exact-head closeout" in road
assert "DOOBTUBE-0 through DOOBTUBE-10 are complete" in audit
assert "Next: DOOBTUBE-11 — Repository Level 3 exact-head closeout" in audit

# No DoobTube-owned Solidity graph may appear during closeout.
assert not (ROOT/"contracts/src/doobtube").exists()
assert not (ROOT/"contracts/test/DoobTube420.t.sol").exists()

print("DOOBTUBE-11 Level 3 ownership and closeout wiring verification: PASS")
