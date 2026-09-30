#!/usr/bin/env python3
"""REG-AUDIT-4: verify the complete active Genesis address namespace."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = "0x0000000000000000000000000000000000000434"
NAMESPACE = "contracts/config/genesis-address-namespace.json"
SOURCES = {
    "namespace": NAMESPACE,
    "system": "contracts/config/system-addresses.json",
    "system_mirror": "config/system-addresses.json",
    "canonical": "contracts/config/genesis-canonical-addresses.json",
    "predeploy": "contracts/config/predeploy/predeploy-plan.json",
    "deployment": "contracts/config/deployment-manifest.json",
    "bridge": "config/swap-bridge-extension-addresses.json",
    "wallet": "wallet/deployment-inventory.json",
    "catalogue": "developer-hub/catalogue/local.example.json",
    "manifest": "developer-hub/manifests/local.example.json",
    "wallet_reconciliation": "contracts/config/wallet-authority-address-reconciliation.json",
    "migration_candidates": "contracts/config/w14-7-address-migration-candidates.json",
    "global_candidate": "contracts/config/w14-7-4-global-address-reconciliation.json",
    "extended": "config/extended-system-addresses.json",
}

def load(root=ROOT):
    return {k: json.loads((root / p).read_text(encoding="utf-8")) for k, p in SOURCES.items()}

def addr(v):
    if not isinstance(v, str) or len(v) != 42 or not v.startswith("0x"):
        raise ValueError(f"invalid EVM address: {v!r}")
    int(v[2:], 16)
    return v.lower()

def named(entries, field="name"):
    out = {}
    for x in entries:
        name, slot = x[field], addr(x["address"])
        if name in out:
            raise ValueError(f"duplicate identity: {name}")
        out[name] = slot
    return out

def validate(d):
    errors = []
    ns = d["namespace"]
    system = d["system"]
    mirror = d["system_mirror"]

    if ns.get("status") != "FROZEN_FOR_GENESIS_ADDRESS_AUTHORITY":
        errors.append("namespace authority is not frozen")
    if ns.get("canonicalRegistry", {}).get("address", "").lower() != REGISTRY:
        errors.append("namespace canonical Registry must be 0x0434")
    if system != mirror:
        errors.append("system address mirrors differ")
    if system.get("namespace_authority") != NAMESPACE or mirror.get("namespace_authority") != NAMESPACE:
        errors.append("system mirrors do not name namespace authority")

    frozen = named(system["assignments"])
    frozen_slots = set(frozen.values())
    ns_fixed = named(ns["fixedAssignments"])
    if ns_fixed != frozen:
        errors.append("namespace fixed assignments differ from system map")
    if frozen.get("ProtocolRegistry") != REGISTRY:
        errors.append("frozen ProtocolRegistry must remain 0x0434")

    start = int(addr(system["reserved_range"]["start"]), 16)
    end = int(addr(system["reserved_range"]["end"]), 16)
    if len(frozen_slots) != len(frozen):
        errors.append("duplicate fixed Genesis address")
    for name, slot in frozen.items():
        n = int(slot, 16)
        if n < start or n > end:
            errors.append(f"fixed assignment outside reserved range: {name}@{slot}")

    for label, field in (("predeploy", "predeploys"), ("deployment", "contracts")):
        doc = d[label]
        if doc.get("namespace_authority") != NAMESPACE:
            errors.append(f"{label} does not name namespace authority")
        actual = named(doc[field])
        if actual != frozen:
            errors.append(f"{label} does not exactly match frozen system map")

    canonical = d["canonical"]
    if canonical.get("namespace_authority") != NAMESPACE:
        errors.append("canonical discovery map does not name namespace authority")
    anchors = {x["id"]: (x["contract"].removesuffix(".sol"), addr(x["address"])) for x in canonical["anchors"]}
    reg = anchors.get("protocol-registry")
    if reg != ("ProtocolRegistry", REGISTRY):
        errors.append("canonical Registry anchor must be ProtocolRegistry@0x0434")
    for ident, (name, slot) in anchors.items():
        if frozen.get(name) != slot:
            errors.append(f"canonical anchor conflicts with frozen owner: {ident}@{slot}")
    for x in canonical.get("registry_resolved", []):
        if x.get("address") is not None or x.get("candidate") is not None:
            errors.append(f"registry-resolved service asserts fixed address: {x['id']}")

    bridge = d["bridge"]
    if bridge.get("namespaceAuthority") != NAMESPACE:
        errors.append("bridge candidate map does not name namespace authority")
    active = dict((slot, name) for name, slot in frozen.items())
    for x in bridge["assignments"]:
        slot, name = addr(x["address"]), x["name"]
        if slot in active:
            errors.append(f"bridge collision at {slot}: {name} vs {active[slot]}")
        active[slot] = name

    wallet = d["wallet"]
    if wallet.get("sourceOfTruth", {}).get("genesisAddressNamespace") != NAMESPACE:
        errors.append("wallet does not name namespace authority")
    if wallet.get("addressNamespacePolicyResolved") is not True:
        errors.append("wallet namespace policy is not marked reconciled")
    wa = wallet["walletAuthority"]
    if addr(wa["protocolRegistry"]["address"]) != REGISTRY:
        errors.append("wallet Registry resident reference must be 0x0434")
    for key in ("smartAccountFactory420", "capabilityRegistry420"):
        item = wa[key]
        if item.get("address") is not None:
            errors.append(f"{key} unverified candidate promoted to active address")
        slot = addr(item["candidateAddress"])
        if slot in active:
            errors.append(f"wallet candidate collision at {slot}: {key} vs {active[slot]}")
        active[slot] = key

    entry = next((x for x in canonical.get("reserved", []) if x.get("id") == "entry-point"), None)
    if not entry:
        errors.append("EntryPoint reservation missing")
    else:
        slot = addr(entry["address"])
        if slot in active:
            errors.append(f"EntryPoint reservation collision at {slot}")
        active[slot] = "EntryPoint420"

    expected_reservations = {(x["name"], addr(x["address"])) for x in bridge["assignments"]}
    expected_reservations |= {
        ("EntryPoint420", addr(entry["address"])) if entry else ("EntryPoint420", "missing"),
        ("SmartAccountFactory420", addr(wa["smartAccountFactory420"]["candidateAddress"])),
        ("CapabilityRegistry420", addr(wa["capabilityRegistry420"]["candidateAddress"])),
    }
    actual_reservations = {(x["name"], addr(x["address"])) for x in ns.get("activeNonPredeployReservations", [])}
    if actual_reservations != expected_reservations:
        errors.append("namespace active non-predeploy reservations do not match active sources")

    cat = next((x for x in d["catalogue"].get("contracts", []) if x.get("name") == "ProtocolRegistry"), None)
    if not cat or addr(cat["address"]) != REGISTRY:
        errors.append("Developer Hub catalogue Registry example is not canonical 0x0434")
    man = d["manifest"].get("contracts", {}).get("Registry420", {})
    if addr(man.get("address")) != REGISTRY:
        errors.append("Developer Hub manifest Registry example is not canonical 0x0434")

    for label in ("wallet_reconciliation", "migration_candidates", "global_candidate"):
        hist = d[label]
        if not str(hist.get("status", "")).startswith("SUPERSEDED"):
            errors.append(f"{label} historical proposal is not explicitly superseded")
        if hist.get("supersededBy") != NAMESPACE:
            errors.append(f"{label} does not point to namespace supersession authority")
    if d["extended"].get("status") != "SUPERSEDED_BY_SYSTEM_ADDRESSES_V4":
        errors.append("extended-system-addresses historical mirror is not superseded")

    # Historical alternate Registry claims are allowed only as retired/superseded evidence.
    for slot in ("0x0000000000000000000000000000000000000422",
                 "0x0000000000000000000000000000000000000448"):
        if slot in active and active[slot] == "ProtocolRegistry":
            errors.append(f"historical Registry alias became active: {slot}")

    return sorted(set(errors))

def main():
    try:
        errors = validate(load())
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        errors = [f"REG-AUDIT-4 namespace verification blocked: {exc}"]
    print(json.dumps({
        "step": "REG-AUDIT-4",
        "pass": not errors,
        "canonicalRegistry": REGISTRY,
        "errorCount": len(errors),
        "errors": errors,
    }, indent=2))
    return int(bool(errors))

if __name__ == "__main__":
    sys.exit(main())
