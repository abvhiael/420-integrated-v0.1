#!/usr/bin/env python3
"""Validate Genesis application/contract-map documentation ownership."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "config/genesis-applications.json"
CONTRACT_MAP = ROOT / "contracts/config/genesis-dapp-contract-map.json"
INVENTORY = ROOT / "docs/audit/genesis-contract-documentation-inventory.json"

ALLOWED = {
    "public-genesis-app",
    "public-genesis-protocol",
    "covered-protocol",
    "covered-application",
    "implementation-alias",
    "testnet-only-app",
}


def load(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> int:
    errors: list[str] = []
    try:
        public = load(PUBLIC)
        contract_map = load(CONTRACT_MAP)
        inventory = load(INVENTORY)
    except Exception as exc:
        print(f"Genesis documentation inventory FAILED: {exc}", file=sys.stderr)
        return 1

    surfaces = inventory.get("surfaces", [])
    by_name: dict[str, list[dict]] = {}
    for item in surfaces:
        name = item.get("name")
        if isinstance(name, str):
            by_name.setdefault(name, []).append(item)

    contract_names = [item.get("dapp") for item in contract_map.get("apps", [])]
    public_names = [item.get("name") for item in public.get("apps", [])]

    for name in contract_names:
        matches = by_name.get(name, [])
        if len(matches) != 1:
            errors.append(f"contract-map surface {name!r} must appear exactly once in inventory (found {len(matches)})")

    extra = sorted(set(by_name) - set(contract_names))
    if extra:
        errors.append(f"inventory contains surfaces not present in contract map: {', '.join(extra)}")

    for name, matches in by_name.items():
        if len(matches) != 1:
            continue
        item = matches[0]
        classification = item.get("classification")
        if classification not in ALLOWED:
            errors.append(f"{name}: unsupported classification {classification!r}")
        if classification == "documentation-gap":
            errors.append(f"{name}: documentation-gap is forbidden at DOC-18 closeout")
        docs = item.get("docs")
        if not isinstance(docs, str) or not docs:
            errors.append(f"{name}: missing canonical docs path")
        else:
            target = ROOT / docs
            if not target.exists():
                errors.append(f"{name}: canonical docs path does not exist: {docs}")
        if classification == "implementation-alias":
            alias = item.get("alias_of")
            if not isinstance(alias, str) or alias not in public_names:
                errors.append(f"{name}: implementation alias must target a frozen public Genesis application")

    represented_public: set[str] = set()
    for name in public_names:
        if name in by_name:
            represented_public.add(name)
            continue
        if any(item.get("alias_of") == name for item in surfaces):
            represented_public.add(name)
            continue
        errors.append(f"public Genesis application {name!r} has no inventory ownership or implementation alias")

    faucet = by_name.get("420 Faucet", [{}])[0]
    if faucet.get("classification") != "testnet-only-app":
        errors.append("420 Faucet must remain testnet-only-app")

    civic = by_name.get("420 Civic", [{}])[0]
    if civic.get("classification") != "implementation-alias" or civic.get("alias_of") != "420 Governance":
        errors.append("420 Civic must remain an implementation-alias of 420 Governance")

    if errors:
        for error in errors:
            print(f"Genesis documentation inventory FAILED: {error}", file=sys.stderr)
        return 1

    print(
        "Genesis documentation inventory PASS: "
        f"{len(contract_names)} contract-map surfaces, {len(public_names)} frozen public surfaces, zero documentation gaps"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
