#!/usr/bin/env python3
"""BNB-1.1 source-inventory and fail-closed boundary verifier (no live booking tests)."""
from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs/bnb/BNB-1.1-CANONICAL-SOURCE-RECONCILIATION.md"
def require(ok, why):
    if not ok:
        raise SystemExit("BNB-1.1 FAIL: " + why)
def read(rel):
    p = ROOT / rel
    require(p.is_file(), f"missing {rel}")
    return p.read_text(encoding="utf-8")
def main():
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    require(re.fullmatch(r"[0-9a-f]{40}", head) is not None, "invalid implementation SHA")
    content = DOC.read_text(encoding="utf-8")
    for heading in ["Authority and scope", "Reconciled authoritative source inventory", "Requirement-by-requirement reconciliation", "Contradictions and decisions to resolve", "BNB-1 handoff", "Qualification and limitations"]:
        require(heading in content, f"missing section {heading}")
    for n in range(1, 16):
        require(f"BNB-S{n:02d}" in content, f"missing requirement BNB-S{n:02d}")
    genesis = json.loads(read("config/genesis-applications.json"))
    require(genesis.get("status") == "FROZEN", "frozen application decision was altered")
    require(not any("bnb" in a.get("name", "").lower() for a in genesis.get("apps", [])), "new BnB Genesis promotion requires explicit reconciliation")
    consumers = json.loads(read("config/genesis-consumer-services.json"))
    flags = {entry["key"]: entry["genesis_default"] for entry in consumers["feature_flags"]}
    require(flags.get("travel.bnb_booking") is False, "BNB Genesis flag must remain disabled")
    cfg = json.loads(read("config/420travel-genesis.json"))
    require(cfg["bnb_compatibility"]["enabled_at_genesis"] is False, "BNB compatibility enabled at Genesis")
    for k in ["420BNB_BOOKING", "DYNAMIC_PRICING", "HOST_ESCROW", "CANCELLATION_SETTLEMENT", "INSURANCE_OR_DAMAGE_DEPOSITS"]:
        require(k in cfg["deferred_scope"], f"missing deferred scope {k}")
    source = read("genesis/svc3/travelapp/compatibility.go")
    for typename in ["Property", "Host", "Guest", "Availability", "NightlyPrice", "Reservation"]:
        require(re.search(r"\btype " + typename + r" struct\b", source) is not None, f"missing compatibility {typename}")
    for method in ["Reserve", "Quote", "Pay", "Escrow", "CancelAndSettle", "DynamicPrice"]:
        require(re.search(r"func \(GenesisTravelTransactions\) " + method + r"\([^\n]*ErrTravelTransactionDisabled", source) is not None, f"{method} no longer statically fails closed")
    require("travel-compat/v1" in source, "compatibility version mismatch")
    print("BNB-1.1 source-boundary verification PASS; SHA " + head)
if __name__ == "__main__":
    main()
