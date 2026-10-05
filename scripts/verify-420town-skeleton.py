#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def require(condition, message, errors):
    if not condition:
        errors.append(message)

def main():
    errors = []
    services = json.loads((ROOT / "config/genesis-consumer-services.json").read_text())
    town_cfg = json.loads((ROOT / "config/420town-genesis.json").read_text())
    catalog = json.loads((ROOT / "town/schema/v1/object-catalog.json").read_text())

    service = next((x for x in services["services"] if x["id"] == "420/service/town/v1"), None)
    require(service is not None, "missing canonical GEN-SVC Town record", errors)
    if service:
        require(town_cfg["serviceId"] == service["id"], "Town service ID drift", errors)
        require(town_cfg["name"] == service["name"], "Town service name drift", errors)
        require(town_cfg["role"] == service["role"], "Town service role drift", errors)
        require(town_cfg["genesisTarget"] == service["genesis_target"], "Town target drift", errors)
        require(set(town_cfg["dependencies"].values()) == set(service["depends_on"]),
                "Town dependency set drift", errors)

    require(town_cfg["frozenGenesisApplication"] is False,
            "Town skeleton must not claim frozen Genesis-app status", errors)
    require(town_cfg["objectIdPolicy"] == "OPAQUE_STABLE_IDS",
            "Town object IDs must remain opaque and stable", errors)
    require(catalog["id_policy"] == "OPAQUE_STABLE_IDS",
            "Town schema catalogue ID policy drift", errors)
    require(catalog["namespace"] == "420Town" and catalog["version"] == "v1",
            "Town schema namespace/version drift", errors)

    expected_visibility = {
        "PUBLIC","UNLISTED","FOLLOWERS","COMMUNITY_ONLY","PURCHASERS_OR_BACKERS",
        "PRIVATE","ORGANIZATION_MEMBERS","MODERATORS","ADMINS"
    }
    require(set(catalog["visibility"]) == expected_visibility,
            "Town visibility vocabulary must match GEN-SVC", errors)

    required_kinds = {
        "Community","Membership","RoleBinding","PermissionGrant","Subscription",
        "Entitlement","TreasuryRef","Post","Thread","Comment","Vote","ModerationAction"
    }
    kinds = [item["kind"] for item in catalog["objects"]]
    require(len(kinds) == len(set(kinds)), "duplicate Town object kinds", errors)
    require(set(kinds) == required_kinds, "Town object catalogue incomplete", errors)

    required_files = [
        "town/README.md",
        "town/.env.example",
        "town/model/model.go",
        "town/model/model_test.go",
        "town/config/config.go",
        "town/config/config_test.go",
        "town/schema/v1/object-catalog.json",
        "docs/apps/town/index.md",
        ".github/workflows/420town-audit.yml",
    ]
    for path in required_files:
        require((ROOT / path).is_file(), f"missing Town skeleton file: {path}", errors)

    if errors:
        print("420Town skeleton verifier FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("420Town skeleton verifier PASS")
    print("service_id=420/service/town/v1")
    print("namespace=420Town")
    print("schema=v1")
    print("object_id_policy=OPAQUE_STABLE_IDS")

if __name__ == "__main__":
    main()
