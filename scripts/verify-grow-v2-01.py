#!/usr/bin/env python3
"""GROW-V2-01: bounded product decision consistency and non-promotion verifier."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = root / "docs/audit/420GROW-V2-01-EXPANDED-PRODUCT-DECISION.md"
s = p.read_text(encoding="utf-8")
for expected in [
    "GROW-V2-01", "Plant lifecycle and genetics", "Environment and control",
    "Harvest and analytics", "Inventory and traceability", "AI assistance",
    "Lawful home grower", "Cultivation technician", "Facility manager",
    "Compliance / quality reviewer", "Operator / equipment maintainer",
    "Public visitor", "Tenant isolation", "Traceability", "Device safety",
    "GROW-V2-02", "GROW-V2-15", "GROW-V2-16",
    "GROW-01–GROW-10", "no new Genesis service ID",
]:
    assert expected in s, f"Missing GROW-V2-01 requirement: {expected}"
old = (root / "docs/audit/420GROW-GROW-01-PRODUCT-DEFINITION.md").read_text(encoding="utf-8")
assert "read-only" in old, "Historical Grow GROW-01 basis changed"
assert (root / "grow/web/runtime-config.js").read_text(encoding="utf-8").find("enabled:false") >= 0, "Public directory safety configuration changed"
print("GROW-V2-01 bounded product decision verification: PASS")
