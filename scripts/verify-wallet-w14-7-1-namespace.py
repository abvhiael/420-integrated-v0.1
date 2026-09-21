#!/usr/bin/env python3
"""W14.7.1: assert one unambiguous Genesis contract/address namespace.

This is a blocking verifier, NOT a migration/deployment generator. It rejects
legacy aliases, contradictory freeze claims, missing proposed predeploys and
unqualified Wallet release states. An address reservation is not deployment.
"""
import json
import pathlib
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = {
    "canonical": "contracts/config/genesis-canonical-addresses.json",
    "system": "config/system-addresses.json",
    "system_mirror": "contracts/config/system-addresses.json",
    "bridge": "config/swap-bridge-extension-addresses.json",
    "predeploy": "contracts/config/predeploy/predeploy-plan.json",
    "deployment": "contracts/config/deployment-manifest.json",
    "wallet": "wallet/deployment-inventory.json",
}
WALLET_IDS = {
    "smartAccountFactory420": "smart-account-factory",
    "capabilityRegistry420": "capability-registry",
    "protocolRegistry": "protocol-registry",
    "names420": "names",
    "identity420": "identity",
}
FROZEN = {
    0x420: "RewardController",
    0x421: "AttentionTreasury",
    0x422: "DevelopmentTreasury",
    0x423: "ValidatorRegistry",
    0x424: "ProtocolReserve",
    0x43c: "ConsensusSystemCall420",
}
EXPECTED_WALLET = {
    "smart-account-factory": 0x446,
    "capability-registry": 0x447,
    "protocol-registry": 0x448,
    "names": 0x445,
    "identity": 0x449,
}


def normalize(value):
    if not isinstance(value, str) or len(value) != 42 or not value.startswith("0x"):
        raise ValueError("invalid EVM address: %r" % value)
    return "0x" + format(int(value[2:], 16), "040x")


def load(root):
    return {name: json.loads((root / path).read_text(encoding="utf-8"))
            for name, path in SOURCES.items()}


def validate(docs):
    errors = []
    claims = defaultdict(list)
    anchors = {}

    def record(scope, address, contract):
        location = normalize(address)
        identity = str(contract).removesuffix(".sol")
        claims[location].append((scope, identity))
        return location

    for item in docs["canonical"]["anchors"]:
        ident = item["id"]
        if ident in anchors:
            errors.append("duplicate canonical id: " + ident)
        anchors[ident] = record("canonical:" + ident, item["address"], item["contract"])
    for scope, field, namefield in (
        ("system", "assignments", "name"),
        ("system_mirror", "assignments", "name"),
        ("bridge", "assignments", "name"),
        ("predeploy", "predeploys", "name"),
        ("deployment", "contracts", "name"),
    ):
        for item in docs[scope][field]:
            record(scope, item["address"], item[namefield])

    for location, holders in sorted(claims.items()):
        identities = {name for _, name in holders}
        if len(identities) > 1:
            errors.append("address collision %s: %s" % (location, holders))
        for scope in ("canonical", "system", "system_mirror", "bridge", "predeploy", "deployment"):
            owned = [name for label, name in holders if label == scope or label.startswith(scope + ":")]
            if len(owned) > 1:
                errors.append("duplicate address in %s: %s" % (scope, location))

    # One logical contract identity must have one predeploy location; a second
    # same-named legacy placement is not an acceptable alias.
    locations_by_contract = defaultdict(set)
    for location, holders in claims.items():
        for _, name in holders:
            locations_by_contract[name].add(location)
    for name, locations in sorted(locations_by_contract.items()):
        if len(locations) > 1:
            errors.append("multi-address contract %s: %s" % (name, sorted(locations)))

    for slot, contract in FROZEN.items():
        location = "0x" + format(slot, "040x")
        for scope in ("system", "system_mirror", "predeploy", "deployment"):
            matches = [name for label, name in claims.get(location, []) if label == scope]
            if matches != [contract]:
                errors.append("frozen %s %s must be %s; found %s" %
                              (scope, location, contract, matches))

    for anchor_id, slot in EXPECTED_WALLET.items():
        address = "0x" + format(slot, "040x")
        if anchors.get(anchor_id) != address:
            errors.append("canonical %s must use %s" % (anchor_id, address))
    for inventory_id, anchor_id in WALLET_IDS.items():
        if normalize(docs["wallet"]["walletAuthority"][inventory_id]["address"]) != anchors.get(anchor_id):
            errors.append("wallet inventory drift: " + inventory_id)

    if docs["wallet"].get("readyForLiveTestnet") is not False:
        errors.append("Wallet must remain fail-closed until live deployment attestation")
    if docs["wallet"].get("releaseGates", {}).get("canonicalAddressConflictResolved") is not True:
        errors.append("canonical conflict gate must not pass before verified migration")

    return errors


def main():
    try:
        errors = validate(load(ROOT))
    except (OSError, KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
        errors = [str(exc)]
    print(json.dumps({"pass": not errors, "phase": "W14.7.1",
                      "errorCount": len(errors), "errors": errors}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
