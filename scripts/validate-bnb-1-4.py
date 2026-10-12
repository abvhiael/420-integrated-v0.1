#!/usr/bin/env python3
"""BNB-1.4 documentation authority and fail-closed boundary validation."""
import json
import re
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs/bnb/BNB-1.4-PROTOCOL-AUTHORITY-AND-INTEGRATION-BOUNDARIES.md"
def require(v, msg):
    if not v: raise SystemExit("BNB-1.4 FAIL: " + msg)
def main():
    doc = DOC.read_text(encoding="utf-8")
    for n in range(1, 11):
        require(f"BNB-A{n:02d}" in doc, f"missing BNB-A{n:02d}")
    for item in ("420Travel","420Location","420Identity","420Registry","420Verify","420Names","420Wallet","420Pay","420Swap","420Arbitration","420Reputation","420Notifications","420Search","420Analytics","420Storage","420Rights","420Governance","420Bridge","420Compute","Oracle Interface Layer"):
        require(item in doc, "missing authority " + item)
    for term in ("idempotency","replay","finality","privacy","fail","UNAUTHORIZED","WRONG_ASSET","SETTLEMENT_FAILED","BNB-1.5"):
        require(term.lower() in doc.lower(), "missing policy " + term)
    config = json.loads((ROOT/"config/420travel-genesis.json").read_text())
    require(config["bnb_compatibility"]["enabled_at_genesis"] is False, "BnB Genesis enabled")
    require("420BNB_BOOKING" in config["deferred_scope"], "booking not deferred")
    c = json.loads((ROOT/"config/genesis-consumer-services.json").read_text())
    require(any(x["key"]=="travel.bnb_booking" and x["genesis_default"] is False for x in c["feature_flags"]), "consumer flag enabled")
    source = (ROOT/"genesis/svc3/travelapp/compatibility.go").read_text()
    for method in ("Reserve","Quote","Pay","Escrow","CancelAndSettle","DynamicPrice"):
        require(re.search(r"func \(GenesisTravelTransactions\) "+method+r"\([^\n]*ErrTravelTransactionDisabled",source) is not None,"Travel gate drift "+method)
    sha = subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    require(bool(re.fullmatch("[0-9a-f]{40}",sha)), "invalid checked out SHA")
    print("BNB-1.4 authority-boundary Level 1 PASS at "+sha)
if __name__=="__main__": main()
