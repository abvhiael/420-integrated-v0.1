#!/usr/bin/env python3
"""C01.5 design/traceability and negative privacy/security invariants."""
import json
import pathlib
import re
import subprocess
import sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "docs/compliance/C01.5-THREATS.json").read_text())
doc = (ROOT / "docs/compliance/C01.5-THREAT-PRIVACY-MODEL.md").read_text()
roadmap = (ROOT / "docs/compliance/420COMPLIANCE-ROADMAP.md").read_text()
assert data["step"] == "C01.5" and data["qualification_level"] == 1
assert data["status"] == "DESIGN_CONTROLS_NOT_IMPLEMENTED" and data["release_enabled"] is False
assert len(data["threats"]) >= 16
ids = [t["id"] for t in data["threats"]]
assert len(ids) == len(set(ids)) and all(re.fullmatch(r"T[0-9]{2}", i) for i in ids)
for t in data["threats"]:
    for name in ("threat","trust_boundary","abuse","mitigation","negative_expected","downstream_requirements"):
        assert t[name], (t["id"], name)
    assert all(re.fullmatch(r"C[0-9]{2}\.[0-9]+", x) for x in t["downstream_requirements"])
for concept in ("Fraudulent", "Manipulated", "prompt injection", "Approval bypass", "tenant", "Stale", "Coercion", "chain", "Denial of service"):
    assert any(concept.casefold() in t["threat"].casefold() or concept.casefold() in t["abuse"].casefold() for t in data["threats"]), concept
for term in ("author", "independent", "publisher", "unknown", "revoked", "public", "off-chain", "return", "no transaction", "C01.8", "C08.5"):
    assert term.casefold() in doc.casefold(), term
assert "| C01.5 |" in roadmap and "| C01.6 |" in roadmap
assert "ErrTravelTransactionDisabled" in (ROOT / "genesis/svc3/travelapp/COMPATIBILITY.md").read_text()
if len(sys.argv) == 2:
    actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    assert actual == sys.argv[1], (actual, sys.argv[1])
print("C01.5 threat model: 16 controls, negative paths, ID traceability, privacy and no-activation PASS")
