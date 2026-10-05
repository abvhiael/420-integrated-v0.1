#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message, errors):
    if not condition:
        errors.append(message)

def main():
    errors = []
    cfg = json.loads((ROOT / "config/420town-authority-v1.json").read_text())
    town_cfg = json.loads((ROOT / "config/420town-genesis.json").read_text())
    catalog = json.loads((ROOT / "town/schema/v1/object-catalog.json").read_text())
    services = json.loads((ROOT / "config/genesis-consumer-services.json").read_text())
    architecture = (ROOT / "docs/architecture/genesis-architecture.md").read_text()
    dependency_map = (ROOT / "docs/architecture/dependency-map.md").read_text()
    source = (ROOT / "contracts/src/town/TownAuthority420.sol").read_text()

    town = next((x for x in services["services"] if x["id"] == "420/service/town/v1"), None)
    require(town is not None, "missing Town service record", errors)
    if town:
        require(town["authority"] == "REPLACEABLE_APPLICATION", "Town service authority classification drift", errors)

    require("keeps membership, roles, permissions, subscriptions, treasuries, and entitlements on-chain" in architecture,
            "genesis architecture no longer preserves Town on-chain authority boundary", errors)
    require("separates on-chain membership, roles, permissions, subscriptions, treasuries, and entitlements" in dependency_map,
            "dependency map no longer preserves Town authority/transport boundary", errors)

    require(town_cfg["status"] in {"AUTHORITY_BASELINE", "CONTENT_BASELINE"},
            "Town canonical config regressed below the authority baseline", errors)
    require("TOWN-AUDIT-3" in town_cfg["implementedThrough"], "Town canonical config missing TOWN-AUDIT-3", errors)
    require("TOWN-AUDIT-3" not in town_cfg["deferredRoadmap"], "Town canonical config still defers TOWN-AUDIT-3", errors)
    require(town_cfg["authorityContract"] == "TownAuthority420", "Town canonical authority contract drift", errors)
    require(town_cfg["authorityBoundary"]["treasuryCustody"] is False, "Town canonical config must not claim treasury custody", errors)

    require(cfg["authorityContract"] == "TownAuthority420", "authority contract config drift", errors)
    require(cfg["treasuryModel"]["mode"] == "REFERENCE_ONLY", "Town treasury must remain reference-only", errors)
    require(cfg["treasuryModel"]["custody"] is False, "Town must not claim treasury custody", errors)
    require(len(cfg["invariants"]) >= 13, "Town authority invariant inventory incomplete", errors)

    authority_catalog = catalog.get("authority_v1", {})
    require(authority_catalog.get("contract") == "TownAuthority420", "schema catalog authority contract drift", errors)
    require(authority_catalog.get("treasury_mode") == "REFERENCE_ONLY", "schema catalog treasury mode drift", errors)
    require(set(authority_catalog.get("membership_states", [])) == {"NONE","ACTIVE","LEFT","REMOVED"},
            "schema catalog membership states drift", errors)
    require(set(authority_catalog.get("roles", [])) == {"MEMBER","MODERATOR","ADMIN"},
            "schema catalog role vocabulary drift", errors)

    for token in [
        "PERMISSION_MANAGE_MEMBERS",
        "PERMISSION_MANAGE_ROLES",
        "PERMISSION_MANAGE_SUBSCRIPTIONS",
        "PERMISSION_MANAGE_ENTITLEMENTS",
        "PERMISSION_MANAGE_TREASURY",
        "function hasPermission",
        "function setTreasuryReference",
        "function transferCommunityOwnership",
    ]:
        require(token in source, f"authority contract missing {token}", errors)

    for token in ["function withdraw(", "function transferValue(", "mapping(address => uint256) public balances"]:
        require(token not in source, f"Town authority unexpectedly exposes custody primitive: {token}", errors)

    for path in [
        "contracts/test/TownAuthorityCommunity420.t.sol",
        "contracts/test/TownAuthorityAccess420.t.sol",
        "contracts/test/TownAuthorityEntitlements420.t.sol",
        "contracts/test/TownAuthorityTreasury420.t.sol",
        "contracts/test/TownAuthorityEvents420.t.sol",
        "docs/apps/town/authority.md",
    ]:
        require((ROOT / path).is_file(), f"missing authority artifact: {path}", errors)

    if errors:
        print("420Town authority verifier FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("420Town authority verifier PASS")
    print("authority_contract=TownAuthority420")
    print("treasury_model=REFERENCE_ONLY")
    print("authority_scope=APPLICATION_SCOPED_ON_CHAIN")
    print(f"invariants={len(cfg['invariants'])}")

if __name__ == "__main__":
    main()
