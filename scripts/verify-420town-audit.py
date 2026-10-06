#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message, errors):
    if not condition:
        errors.append(message)

def main():
    errors = []

    frozen = json.loads((ROOT / "config/genesis-applications.json").read_text())
    services = json.loads((ROOT / "config/genesis-consumer-services.json").read_text())
    architecture = (ROOT / "docs/architecture/genesis-architecture.md").read_text()
    dependency = (ROOT / "docs/architecture/dependency-map.md").read_text()
    audit = (ROOT / "docs/420TOWN-AUDIT.md").read_text()
    roadmap = (ROOT / "docs/420TOWN-ROADMAP.md").read_text()

    frozen_names = {app["name"] for app in frozen["apps"]}
    require("420Town" not in frozen_names and "420Town Community Boards" not in frozen_names,
            "420Town must not be silently promoted into the frozen Genesis application catalog", errors)

    town = next((x for x in services["services"] if x.get("id") == "420/service/town/v1"), None)
    require(town is not None, "missing GEN-SVC Town service record", errors)
    if town:
        require(town.get("name") == "420Town Community Boards", "unexpected Town service name", errors)
        require(town.get("role") == "GENESIS_FACING_UPDATE", "unexpected Town service role", errors)
        require(town.get("genesis_target") == "communities_posts_threads_comments_votes_moderation",
                "unexpected Town Genesis-facing target", errors)
        expected = {"420 Identity", "420 Search", "420 Notifications", "420 Storage"}
        require(expected.issubset(set(town.get("depends_on", []))),
                "Town direct dependency declaration is incomplete", errors)

    require("membership, roles, permissions, subscriptions, treasuries, and entitlements on-chain" in architecture,
            "Genesis architecture lost Town authority-boundary definition", errors)
    require("420Town / messaging architecture separates on-chain membership, roles, permissions, subscriptions, treasuries, and entitlements" in dependency,
            "dependency map lost Town messaging boundary", errors)

    required_contracts = [
        "contracts/src/town/ITownContributionSource420.sol",
        "contracts/src/town/ITownContributionVerifier420.sol",
        "contracts/src/town/TownContributionVerifier420.sol",
        "contracts/src/town/TownRewardTypes420.sol",
        "contracts/src/town/TownRewardsAdapter420.sol",
    ]
    for path in required_contracts:
        require((ROOT / path).is_file(), f"missing existing Town rewards component: {path}", errors)

    for step in range(1, 13):
        require(f"TOWN-AUDIT-{step}" in roadmap, f"missing stable roadmap step TOWN-AUDIT-{step}", errors)

    require("420Town is **not complete**" in audit, "audit must not overstate 420Town readiness", errors)

    if errors:
        print("420Town audit verifier FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("420Town audit verifier PASS")
    print("classification=frozen_genesis_app:false")
    print("gen_svc_service=420/service/town/v1")
    print("product_complete=false")

if __name__ == "__main__":
    main()
