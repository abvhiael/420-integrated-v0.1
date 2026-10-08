#!/usr/bin/env python3
"""GROW-06: enforce no unapproved Grow protocol/contract authority."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
def read(path):
    return (ROOT / path).read_text(encoding="utf-8")
def require(condition, message):
    if not condition:
        raise AssertionError(message)

decision = read("docs/audit/420GROW-GROW-06-CONTRACT-DECISION.md")
identity = read("docs/audit/420GROW-GROW-02-IDENTITY-DECISION.md")
product = read("docs/audit/420GROW-GROW-01-PRODUCT-DEFINITION.md")
require("NO_GROW_AUTHORITY_BEARING_CONTRACT_REQUIRED" in decision, "no contract decision missing")
require("CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID" in identity, "consumer identity changed")
require("read-only" in product.lower(), "read-only product definition missing")
ids = read("contracts/src/libraries/ServiceIds420.sol")
require(not re.search(r"(?i)(grow|420/service/grow)", ids), "Grow service ID must not be invented")
apps = json.loads(read("config/genesis-applications.json"))
consumers = json.loads(read("config/genesis-consumer-services.json"))
require("420grow" not in json.dumps(apps).lower(), "Grow incorrectly admitted to frozen Genesis apps")
require("420grow" not in json.dumps(consumers).lower(), "Grow incorrectly admitted to canonical consumer service catalog")
wallet = read("wallet/web/core/genesis-app-catalog.js")
require("NO_CANONICAL_SERVICE_ID" in wallet and "420 Grow" in wallet, "Wallet must retain unresolved Grow identity")
for folder in ("contracts/src", "contracts/script", "contracts/test"):
    root = ROOT / folder
    if root.exists():
        for path in root.rglob("*.sol"):
            require(not re.search(r"(?i)420grow|(?:^|[/_-])grow(?:[/_-]|$)", str(path.relative_to(ROOT))), "unexpected Grow contract/deployment: " + str(path))
for folder in ("grow",):
    root = ROOT / folder
    for path in root.rglob("*.sol"):
        raise AssertionError("unexpected Grow-owned Solidity: " + str(path))
print("GROW-06 no-contract authority verifier: PASS")
