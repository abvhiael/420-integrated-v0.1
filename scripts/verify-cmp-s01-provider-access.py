#!/usr/bin/env python3
"""S-01 fail-closed provider source policy qualifier."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = root / "contracts/config/compute-market/cmp-s01-provider-access.json"
o = json.loads(p.read_text(encoding="utf-8"))
assert o["schemaVersion"] == "cmp-s01-provider-inventory-v1"
assert o["fundedRewardsEnabled"] is False
assert all(o["rules"].values()), "security rules must remain strict"
assert len(o["sources"]) >= 2
assert {s["system"] for s in o["sources"]} == {"BOINC", "FOLDING_AT_HOME"}
for s in o["sources"]:
    assert s["status"].startswith("DISABLED"), s["id"]
    assert s["approvedForProduction"] is False
    assert s["rewardEligibility"] == "DENIED"
    assert s["evidenceTier"] == "AGGREGATE_OBSERVATION_ONLY"
    assert s["workUnitProofAvailable"] is False
    assert s["identityOwnershipProofAvailable"] is False
    assert s["pollMinimumSeconds"] >= 3600
    assert s["sourceFreshnessSeconds"] >= s["pollMinimumSeconds"]
    assert s["requiredApprovals"] and s["permissions"] and s["credentialPolicy"]
    assert s["providerUrl"].startswith("https://")
boinc = next(s for s in o["sources"] if s["system"] == "BOINC")
assert boinc["projectScope"] == "PROJECT_SPECIFIC"
assert boinc["id"] == "boinc-project-not-selected"
fah = next(s for s in o["sources"] if s["system"] == "FOLDING_AT_HOME")
assert "flat-file" in fah["statsSource"]
print("CMP S-01 provider permissions and evidence boundary PASS")
