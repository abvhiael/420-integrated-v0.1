#!/usr/bin/env python3
"""C01.4 preserved-ID / authority-boundary regression checks (stdlib only)."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
roadmap = (root / "docs/compliance/420COMPLIANCE-ROADMAP.md").read_text()
amendment = (root / "docs/compliance/C01.4-SHARED-AUTHORITY-AMENDMENT.md").read_text()
travel = (root / "genesis/svc3/travelapp/COMPATIBILITY.md").read_text()

def require(condition: bool, detail: str) -> None:
    if not condition:
        raise AssertionError(detail)

for step in ("C01.1", "C01.2", "C01.3", "C01.4", "C01.5", "C01.6", "C01.7", "C01.8"):
    require(re.search(r"^\\| " + re.escape(step) + r" \\|", roadmap, re.M) is not None, "missing canonical " + step)
require("C01.4-SHARED-AUTHORITY-AMENDMENT.md" in roadmap, "roadmap does not point to amendment")
for item in ("420Compliance", "DOOBr", "420Travel", "420Location", "R01.4", "R01.5", "R01.7", "R04.7", "C05.4", "C05.7", "TRAVEL-TN-01", "TRAVEL-TN-08", "GEN-SVC-3.9", "Level 2", "Level 3"):
    require(item in amendment, "missing mapping: " + item)
for term in ("DENY", "REVIEW_REQUIRED", "UNKNOWN", "revocation", "handover", "return", "SIMULATION_ONLY", "public", "legal approval", "software qualification"):
    require(term.lower() in amendment.lower(), "missing safety/ownership boundary: " + term)
require("ErrTravelTransactionDisabled" in travel, "travel disabled gateway boundary missing")
require("structural validation only" in travel.lower(), "travel structural-only boundary missing")
require("no transaction activation" in amendment.lower(), "amendment must not imply operational enablement")
if len(sys.argv) > 1:
    actual = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True).strip()
    require(actual == sys.argv[1], "SHA mismatch: expected " + sys.argv[1] + " actual " + actual)
print("C01.4 authority/IDs/fail-closed contract: PASS")
