#!/usr/bin/env python3
"""Deterministically render the DOC-10.7 network and chain registry reference."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_DIR = ROOT / "developer-hub" / "manifests"
SCHEMA = ROOT / "developer-hub" / "schema" / "network-manifest.schema.json"
DISCOVERY = ROOT / "developer-hub" / "src" / "network-discovery.mjs"
OUTPUT = ROOT / "docs" / "reference" / "generated" / "networks.md"
ENVIRONMENTS = ("local", "devnet", "testnet", "mainnet")


def load_manifests() -> list[tuple[Path, dict]]:
    manifests: list[tuple[Path, dict]] = []
    for path in sorted(MANIFEST_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("schemaVersion") != "1.0.0":
            raise ValueError(f"unsupported manifest schemaVersion in {path}")
        network = data.get("network") or {}
        environment = network.get("environment")
        if environment not in ENVIRONMENTS:
            raise ValueError(f"unsupported environment in {path}: {environment!r}")
        manifests.append((path, data))
    return manifests


def render() -> str:
    if not SCHEMA.is_file() or not DISCOVERY.is_file():
        raise ValueError("network schema/discovery source missing")
    manifests = load_manifests()
    by_environment: dict[str, list[tuple[Path, dict]]] = {name: [] for name in ENVIRONMENTS}
    for item in manifests:
        by_environment[item[1]["network"]["environment"]].append(item)

    lines = [
        "---",
        "title: Generated network and chain registry reference",
        "audience:",
        "  - developer",
        "category: reference",
        "status: generated",
        "version: current",
        "---",
        "",
        "# Generated network and chain registry reference",
        "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate from Developer Hub network manifests.",
        "",
        "Sources:",
        "",
        "- `developer-hub/manifests/*.json`",
        "- `developer-hub/schema/network-manifest.schema.json`",
        "- `developer-hub/src/network-discovery.mjs`",
        "",
        "Network manifests are environment-scoped discovery records. A chain ID alone is not sufficient proof that two environments are the same network, and this page never promotes local example values into devnet, testnet or mainnet.",
        "",
        "## Environment availability",
        "",
        "| Environment | Checked-in manifest | Publication status |",
        "| --- | --- | --- |",
    ]
    for environment in ENVIRONMENTS:
        entries = by_environment[environment]
        if entries:
            names = ", ".join(f"`{path.relative_to(ROOT).as_posix()}`" for path, _ in entries)
            status = "available, environment-scoped"
        else:
            names = "none"
            status = "unavailable — fail closed"
        lines.append(f"| `{environment}` | {names} | {status} |")

    for environment in ENVIRONMENTS:
        lines += ["", f"## {environment}", ""]
        entries = by_environment[environment]
        if not entries:
            lines.append(f"No checked-in `{environment}` manifest exists. DOC-10 does not infer one from another environment.")
            continue
        for path, data in entries:
            network = data["network"]
            currency = data["nativeCurrency"]
            rpc = data["rpc"]
            services = data.get("services", {})
            contracts = data.get("contracts", {})
            can_faucet = environment != "mainnet" and "faucet" in services
            is_production = environment == "mainnet"
            lines += [
                f"### {network['name']}",
                "",
                f"- Manifest: `{path.relative_to(ROOT).as_posix()}`",
                f"- Schema version: `{data['schemaVersion']}`",
                f"- Environment: `{environment}`",
                f"- Chain ID: `{network['chainId']}`",
                f"- Native currency: `{currency['name']}` / `{currency['symbol']}` / `{currency['decimals']}` decimals",
                f"- `canRequestFaucet`: **{'true' if can_faucet else 'false'}**",
                f"- `isProduction`: **{'true' if is_production else 'false'}**",
                "",
                "#### RPC discovery",
                "",
            ]
            for endpoint in rpc.get("http", []):
                lines.append(f"- HTTP: `{endpoint}`")
            for endpoint in rpc.get("websocket", []):
                lines.append(f"- WebSocket: `{endpoint}`")
            lines += ["", "#### Service discovery", ""]
            if services:
                for name, endpoint in sorted(services.items()):
                    lines.append(f"- `{name}` → `{endpoint}`")
            else:
                lines.append("_No service endpoints declared._")
            lines += ["", "#### Manifest contract hints", ""]
            if contracts:
                for name, contract in sorted(contracts.items()):
                    version = f", version `{contract['version']}`" if contract.get("version") else ""
                    lines.append(f"- `{name}` → `{contract['address']}`; source `{contract['source']}`{version}")
                lines += ["", "Manifest contract entries are discovery hints scoped to this manifest. Canonical deployment publication remains DOC-10.8 and requires approved/verified deployment evidence."]
            else:
                lines.append("_No contract hints declared._")

    lines += [
        "",
        "## Manifest contract",
        "",
        "The v1 schema permits environments `local`, `devnet`, `testnet`, and `mainnet`; requires a positive decimal chain ID and at least one HTTP RPC endpoint; fixes native symbol `420`; constrains known service names; and forbids a Faucet service in mainnet manifests.",
        "",
        "Developer Hub discovery derives `canRequestFaucet` from a non-mainnet environment plus a declared Faucet service, and derives `isProduction` only from `environment === mainnet`.",
        "",
        "## Authority boundary",
        "",
        "A manifest selects an environment and discovery endpoints. It does not establish consensus, finality, balances, ownership, contract execution, or deployment truth by itself. Security-sensitive clients must bind the selected manifest to canonical chain/deployment evidence and fail closed on mismatches.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(), encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
