#!/usr/bin/env python3
"""Audit the full Genesis address namespace before promoting Wallet deployment.

This standalone preflight deliberately exits nonzero against the current frozen
maps. Do not wire it into a release gate as passing until an authoritative,
namespace-wide map and all predeploy/deployment manifests are reconciled.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = {
    "canonical": "contracts/config/genesis-canonical-addresses.json",
    "system": "config/system-addresses.json",
    "system_mirror": "contracts/config/system-addresses.json",
    "bridge": "config/swap-bridge-extension-addresses.json",
    "predeploy": "contracts/config/predeploy/predeploy-plan.json",
    "deployment": "contracts/config/deployment-manifest.json",
    "inventory": "wallet/deployment-inventory.json",
}


def address(value):
    if not isinstance(value, str) or not value.startswith("0x") or len(value) != 42:
        raise ValueError(f"invalid address: {value!r}")
    int(value[2:], 16)
    return value.lower()


def entries(doc, field, name_field):
    return {address(item["address"]): str(item[name_field]) for item in doc[field]}


def audit(documents):
    problems = []
    canonical = documents["canonical"]
    anchors = [(address(item["address"]), item["id"], item["contract"].removesuffix(".sol"))
               for item in canonical["anchors"]]
    system = entries(documents["system"], "assignments", "name")
    mirror = entries(documents["system_mirror"], "assignments", "name")
    bridge = entries(documents["bridge"], "assignments", "name")
    predeploy = entries(documents["predeploy"], "predeploys", "name")
    deployment = entries(documents["deployment"], "contracts", "name")
    if system != mirror:
        problems.append({"kind": "system-registry-mirror-drift"})
    seen = {}
    for location, anchor_id, contract in anchors:
        if location in seen:
            problems.append({"kind": "canonical-duplicate-address", "address": location,
                             "first": seen[location], "second": anchor_id})
        seen[location] = anchor_id
        if location in system and system[location] != contract:
            problems.append({"kind": "canonical-vs-system", "address": location,
                             "canonical": contract, "system": system[location]})
        if location in bridge and bridge[location] != contract:
            problems.append({"kind": "canonical-vs-bridge", "address": location,
                             "canonical": contract, "bridge": bridge[location]})
        if predeploy.get(location) != contract:
            problems.append({"kind": "canonical-predeploy-missing-or-mismatch",
                             "address": location, "canonical": contract,
                             "predeploy": predeploy.get(location)})
        if deployment.get(location) != contract:
            problems.append({"kind": "canonical-deployment-manifest-missing-or-mismatch",
                             "address": location, "canonical": contract,
                             "deployment": deployment.get(location)})
    for location in system.keys() & bridge.keys():
        if system[location] != bridge[location]:
            problems.append({"kind": "system-vs-bridge", "address": location,
                             "system": system[location], "bridge": bridge[location]})
    for location, name in predeploy.items():
        if location in system and system[location] != name:
            problems.append({"kind": "predeploy-vs-system", "address": location,
                             "predeploy": name, "system": system[location]})
        if location in bridge and bridge[location] != name:
            problems.append({"kind": "predeploy-vs-bridge", "address": location,
                             "predeploy": name, "bridge": bridge[location]})
    inventory = documents["inventory"]
    anchor_by_id = {anchor_id: location for location, anchor_id, _ in anchors}
    for wallet_key, anchor_id in (("smartAccountFactory420", "smart-account-factory"),
                                  ("capabilityRegistry420", "capability-registry"),
                                  ("protocolRegistry", "protocol-registry"),
                                  ("names420", "names"), ("identity420", "identity")):
        actual = address(inventory["walletAuthority"][wallet_key]["address"])
        if actual != anchor_by_id[anchor_id]:
            problems.append({"kind": "wallet-canonical-drift", "wallet": wallet_key,
                             "inventory": actual, "canonical": anchor_by_id[anchor_id]})
    return problems


def main():
    try:
        docs = {name: json.loads((ROOT / path).read_text(encoding="utf-8"))
                for name, path in FILES.items()}
        problems = audit(docs)
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"pass": False, "error": str(exc)}, indent=2))
        return 2
    print(json.dumps({"pass": not problems, "collisionsAndDrifts": len(problems),
                      "problems": problems}, indent=2))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
