#!/usr/bin/env python3
"""Repository-level 420-IS audit verifier.

This verifier intentionally proves repository consistency only. It does not
claim a live deployment, ProtocolRegistry publication, public-testnet
qualification, or Genesis acceptance.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED_CONTRACTS = [
    "I420IS.sol",
    "InteropIds420.sol",
    "InteropProviderRegistry420.sol",
    "InteropNamespaceRegistry420.sol",
    "InteropCheckpointRegistry420.sol",
    "InteropRouter420.sol",
]

def read(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        raise SystemExit(f"missing required file: {path}")
    return p.read_text(encoding="utf-8")

def load(path: str):
    return json.loads(read(path))

def main() -> None:
    dapp_map = load("contracts/config/genesis-dapp-contract-map.json")
    entry = next((x for x in dapp_map if x.get("dapp") == "420-IS"), None)
    if entry is None:
        raise SystemExit("420-IS missing from genesis contract map")
    if entry.get("contracts") != EXPECTED_CONTRACTS:
        raise SystemExit(
            f"420-IS contract inventory drift: {entry.get('contracts')!r}"
        )

    required_paths = [
        "contracts/src/interfaces/I420IS.sol",
        "contracts/src/interop/InteropIds420.sol",
        "contracts/src/interop/InteropProviderRegistry420.sol",
        "contracts/src/interop/InteropNamespaceRegistry420.sol",
        "contracts/src/interop/InteropCheckpointRegistry420.sol",
        "contracts/src/interop/InteropRouter420.sol",
        "contracts/test/InteropGenesis420.t.sol",
        "contracts/test/InteropAudit420.t.sol",
        "docs/architecture/protocols/registry-names-identity-420is.md",
    ]
    for path in required_paths:
        read(path)

    service_ids = read("contracts/src/libraries/ServiceIds420.sol")
    if 'INTEROP = keccak256("420/service/420-is/v1")' not in service_ids:
        raise SystemExit("canonical 420-IS service ID drift")

    address_ns = load("contracts/config/genesis-address-namespace.json")
    resolved = address_ns.get("registryResolved", [])
    interop = next((x for x in resolved if x.get("id") == "interop-router"), None)
    if interop is None:
        raise SystemExit("interop-router missing from registry-resolved namespace")
    if interop.get("contract") != "InteropRouter420.sol":
        raise SystemExit("interop-router contract binding drift")
    if interop.get("status") != "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS":
        raise SystemExit("interop-router must remain Registry-resolved, not fixed")

    architecture = read("docs/architecture/protocols/registry-names-identity-420is.md")
    required_architecture_terms = [
        "420 Interoperability Standard (420-IS)",
        "InteropProviderRegistry420",
        "InteropNamespaceRegistry420",
        "InteropCheckpointRegistry420",
        "InteropRouter420",
        "420/IS/MAPPING/V1",
        "420/IS/CHECKPOINT/V1",
        "DISC-011",
        "DISC-012",
        "DISC-013",
        "DISC-015",
    ]
    missing = [term for term in required_architecture_terms if term not in architecture]
    if missing:
        raise SystemExit(f"architecture invariant coverage drift: {missing}")

    interface = read("contracts/src/interfaces/I420IS.sol")
    for interface_name in [
        "I420ISIdentity",
        "I420ISEntitlement",
        "I420ISCapability",
        "I420ISPaymentReference",
        "I420ISEncryptionEndpoint",
        "I420ISSession",
        "I420ISCheckpoint",
        "I420ISPrivacyProof",
        "I420ISAdapter",
    ]:
        if f"interface {interface_name}" not in interface:
            raise SystemExit(f"missing canonical interface: {interface_name}")

    providers = read("contracts/src/interop/InteropProviderRegistry420.sol")
    namespaces = read("contracts/src/interop/InteropNamespaceRegistry420.sol")
    checkpoints = read("contracts/src/interop/InteropCheckpointRegistry420.sol")
    router = read("contracts/src/interop/InteropRouter420.sol")

    source_assertions = {
        "provider standard-version gate": (providers, "candidate.standardVersion() != InteropIds420.STANDARD_VERSION"),
        "provider type gate": (providers, "candidate.adapterType() != expectedType"),
        "active adapter gate": (namespaces, "providers.isActiveAdapter(n.providerId, msg.sender)"),
        "explicit supersession": (namespaces, "MappingStatus.SUPERSEDED"),
        "explicit revocation": (namespaces, "MappingStatus.REVOKED"),
        "checkpoint chain binding": (checkpoints, '"420/IS/CHECKPOINT/V1", block.chainid'),
        "checkpoint sequence gate": (checkpoints, "sequence != prior.sequence + 1"),
        "router activation fail-closed": (router, "if (!p.active) return false;"),
    }
    for name, (source, needle) in source_assertions.items():
        if needle not in source:
            raise SystemExit(f"missing required source invariant: {name}")

    print("420-IS repository audit verifier: PASS")
    print("scope: repository consistency only; live deployment/testnet evidence not asserted")

if __name__ == "__main__":
    main()
