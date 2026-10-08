#!/usr/bin/env python3
"""GROW-01 app-scoped product-definition consistency gate (stdlib-only)."""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def require(condition, message):
    if not condition:
        raise AssertionError(message)

def main():
    spec = read("docs/audit/420GROW-GROW-01-PRODUCT-DEFINITION.md")
    ledger = read("docs/audit/420GROW-INITIAL-AUDIT-AND-REMEDIATION-ROADMAP.md")
    apps = json.loads(read("config/genesis-applications.json"))
    consumers = json.loads(read("config/genesis-consumer-services.json"))
    location = json.loads(read("config/420location-events-genesis.json"))
    service_ids = read("contracts/src/libraries/ServiceIds420.sol")
    wallet = read("docs/420WALLET-W14.5-APP-CATALOG.md")
    require(apps.get("status") == "FROZEN", "Genesis catalog no longer frozen")
    require(not any("grow" in a["name"].lower() for a in apps["apps"]), "Grow catalog promotion needs separate decision")
    require(not any("grow" in a["name"].lower() for a in consumers["services"]), "Grow consumer registry entry needs review")
    require("GROW =" not in service_ids and "GROW=" not in service_ids, "Grow canonical service ID requires GROW-02")
    require("420 Grow" in wallet and "no canonical service ID" in wallet, "Wallet unresolved identity note changed")
    require(location["integrations"]["420Grow"] == ["business/farm places"], "Location integration contract changed")
    require({"FARM","BUSINESS"}.issubset(set(location["place"]["categories"])), "Place categories changed")
    for code in range(1,11):
        require(f"GROW-{code:02d}" in ledger, f"Ledger missing GROW-{code:02d}")
    for code in ["G1","G2","G3","G4","G5","G6"]:
        require(re.search(r"\\*\\*Invariant " + code + r":",spec),f"Missing invariant {code}")
    for label in ["Purpose","Users","Required user workflows","Trust boundaries","Release classification","Level 1","GROW-02"]:
        require(label.lower() in spec.lower(),f"Missing definition element {label}")
    require("not an amendment" in spec and "no new smart contract" in spec.lower(), "Product authority boundary missing")
    print("PASS GROW-01 canonical product-definition consistency: catalog, ID, upstream contract, invariants, roadmap")

if __name__ == "__main__":
    try:
        main()
    except (AssertionError, ValueError, KeyError, OSError) as exc:
        print(f"FAIL GROW-01: {exc}",file=sys.stderr)
        sys.exit(1)
