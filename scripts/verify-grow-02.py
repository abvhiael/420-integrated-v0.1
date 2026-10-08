#!/usr/bin/env python3
"""GROW-02 consumer-only identity decision qualification (stdlib)."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
def read(path): return (root / path).read_text(encoding="utf-8")
def check(ok, message):
    if not ok: raise AssertionError(message)

def main():
    decision=read("docs/audit/420GROW-GROW-02-IDENTITY-DECISION.md")
    spec=read("docs/audit/420GROW-GROW-01-PRODUCT-DEFINITION.md")
    apps=json.loads(read("config/genesis-applications.json"))
    consumer=json.loads(read("config/genesis-consumer-services.json"))
    location=json.loads(read("config/420location-events-genesis.json"))
    ids=read("contracts/src/libraries/ServiceIds420.sol")
    wallet=read("wallet/web/core/genesis-app-catalog.js")
    wallet_doc=read("docs/420WALLET-W14.5-APP-CATALOG.md")
    check("CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID" in decision,"Identity choice undocumented")
    check("GROW-03 — Shared location consumer" in decision,"Next canonical step changed")
    for token in ("Rejected option A","Rejected option B","ProtocolRegistry","Wallet","fail closed","Level 1"):
        check(token.lower() in decision.lower(),f"Missing decision coverage {token}")
    check("read-only" in spec,"GROW-01 baseline no longer read only")
    check(apps["status"]=="FROZEN","Genesis catalog is not frozen")
    check(not any("grow" in a["name"].lower() for a in apps["apps"]),"Grow promoted to frozen Genesis catalog")
    check(not any("grow" in s["name"].lower() for s in consumer["services"]),"Grow promoted to consumer service")
    check("GROW =" not in ids and "GROW=" not in ids and '"420/service/grow/v1"' not in ids,"Invented canonical Grow service ID")
    check(location["integrations"]["420Grow"] == ["business/farm places"],"Shared location contract drift")
    check("{ name: '420 Grow', status: 'NO_CANONICAL_SERVICE_ID' }" in wallet,"Wallet's unresolved product marker changed")
    canonical_section=wallet.split("export const GENESIS_APP_SERVICES",1)[1].split("export const GENESIS_APP_CATEGORIES",1)[0]
    check("420 Grow" not in canonical_section and "'grow'" not in canonical_section and "420/service/grow/v1" not in canonical_section,"Grow enabled as canonical Wallet service")
    check("420 Grow" in wallet_doc and "no canonical service ID" in wallet_doc,"Wallet documentary record drift")
    print("PASS GROW-02: consumer-only identity, frozen Genesis, no canonical Grow ID or Wallet launch alias")

if __name__ == "__main__": main()
