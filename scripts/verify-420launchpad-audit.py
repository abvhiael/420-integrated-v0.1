#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

def require(cond, msg):
    if not cond:
        errors.append(msg)

src = ROOT / "contracts/src/launchpad"
required = [
    "LaunchpadIds420.sol",
    "LaunchpadAuthorization420.sol",
    "LaunchpadProjectRegistry420.sol",
    "LaunchpadSaleRegistry420.sol",
    "LaunchpadAllocationRegistry420.sol",
    "LaunchpadRouter420.sol",
]
for name in required:
    require((src / name).is_file(), f"missing Launchpad source: {name}")

cfg = json.loads((ROOT / "contracts/config/420launchpad-genesis.json").read_text())
require(cfg.get("schema") == "420-launchpad-genesis-v1", "unexpected Launchpad genesis schema")
boundary = cfg.get("boundary", {})
for key in ("custody","minting","dex","payment_execution"):
    require(boundary.get(key) is False, f"V1 boundary drift: {key} must remain false")
invariants = cfg.get("invariants", [])
for n in range(1, 11):
    prefix = f"LAUNCHPAD-INV-{n:03d}:"
    require(any(x.startswith(prefix) for x in invariants), f"missing invariant {prefix}")

svc = (ROOT / "contracts/src/libraries/ServiceIds420.sol").read_text()
require('keccak256("420/service/launchpad/v1")' in svc, "canonical launchpad service ID missing")

consumer = json.loads((ROOT / "config/genesis-consumer-services.json").read_text())
crowd = next((x for x in consumer.get("services", []) if x.get("id") == "420/service/launchpad-crowdfunding/v1"), None)
require(crowd is not None, "Launchpad crowdfunding consumer-service target missing")
if crowd:
    require(crowd.get("authority") == "APPLICATION_WITH_CONTRACT_BACKED_SETTLEMENT", "crowdfunding authority drift")
    expected = {"420 Identity","420 Pay","420 Arbitration","420Reputation","420 Notifications"}
    require(expected.issubset(set(crowd.get("depends_on", []))), "crowdfunding dependencies drift")

flags = {x["key"]: x.get("genesis_default") for x in consumer.get("feature_flags", [])}
require(flags.get("launchpad.securities_or_equity") is False, "securities/equity must remain disabled")

recon_path = ROOT / "contracts/config/interfaces/420launchpad-dependency-reconciliation.json"
require(recon_path.is_file(), "dependency reconciliation missing")
if recon_path.is_file():
    recon = json.loads(recon_path.read_text())
    require(recon["protocol"]["boundary"] == "NON_CUSTODIAL_COMMITMENT_REGISTRY", "protocol boundary reconciliation drift")
    require(recon["genesisFacingCrowdfunding"]["securitiesOrEquityEnabled"] is False, "crowdfunding feature-gate drift")

test = ROOT / "contracts/test/LaunchpadGenesis420.t.sol"
audit_test = ROOT / "contracts/test/LaunchpadAudit420.t.sol"
require(test.is_file(), "focused Launchpad test missing")
require(audit_test.is_file(), "Launchpad audit test missing")

report = ROOT / "docs/audit/420LAUNCHPAD-AUDIT.md"
roadmap = ROOT / "docs/audit/420LAUNCHPAD-AUDIT-ROADMAP.md"
require(report.is_file(), "Launchpad audit report missing")
require(roadmap.is_file(), "Launchpad audit roadmap missing")
if roadmap.is_file():
    text = roadmap.read_text()
    for n in range(1, 9):
        require(f"LAUNCHPAD-AUDIT-{n}" in text, f"roadmap step {n} missing")

# V1 must remain non-custodial. Fail if obvious token/native transfer primitives are introduced.
solidity = "\n".join((src / name).read_text() for name in required)
for forbidden in (".transfer(", ".transferFrom(", ".safeTransferFrom(", ".call{value:", "selfdestruct(", "delegatecall("):
    require(forbidden not in solidity, f"forbidden V1 custody/execution primitive found: {forbidden}")

if errors:
    print("420Launchpad audit verification FAILED")
    for e in errors:
        print(f" - {e}")
    raise SystemExit(1)

print("420Launchpad audit verification PASS")
print("Protocol V1 boundary: NON_CUSTODIAL_COMMITMENT_REGISTRY")
print("Genesis-facing crowdfunding integration: NOT YET COMPLETE (tracked by roadmap)")
