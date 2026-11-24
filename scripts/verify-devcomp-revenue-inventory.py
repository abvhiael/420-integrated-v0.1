#!/usr/bin/env python3
"""Validate the DEVCOMP source inventory and its generated Markdown view."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs/audit"
STEM = "DEVCOMP-06-APPLICATION-REVENUE-INVENTORY"
CALL = re.compile(r"\.contribute(?:Native|Token|Fantasy)\s*(?:\{|\()")
CLASSES = {"eligible", "excluded", "shared", "policy-exception", "release-disabled", "review-required"}


def load(name):
    return json.loads((ROOT / name).read_text())


def catalogs():
    return {
        "Genesis launch": {row["name"] for row in load("config/genesis-applications.json")["apps"]},
        "Decision 2": {row["name"] for row in load("config/genesis-application-decision-2.json")["entries"]},
        "Contract ownership": {row["dapp"] for row in load("contracts/config/genesis-dapp-contract-map.json")["apps"]},
        "Consumer services": {row["name"] for row in load("config/genesis-consumer-services.json")["services"]},
    }


def render(data):
    lines = [
        "# DEVCOMP-06 application revenue inventory", "",
        "This inventory covers the checked-in catalogue records and the production Solidity calls "
        "to the compensation vault. Catalogue classifications describe release authority. Route "
        "classifications describe the economics of a specific implementation.", "",
        "A review-required entry remains open until its receipts, obligations and retained basis "
        "have been reconciled with source and policy. Run the validator with `--require-closed` "
        "to reject open entries.", "", "## Production and excluded routes", "",
        "| Application | Route | Classification | Receipt and settlement | Evidence |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in data["routes"]:
        links = ", ".join(f"[{Path(path).name}](https://github.com/abvhiael/420-integrated-v0.1/blob/main/{path})" for path in row["sources"])
        lines.append(f'| {row["application"]} | {row["route"]} | {row["classification"]} | {row["trace"]} | {links} |')
    lines.extend(["", "## Catalogue coverage", "",
                  "| Catalogue | Entry | Disposition |", "| --- | --- | --- |"])
    for name, entries in data["catalogues"].items():
        for app, disposition in sorted(entries.items()):
            lines.append(f"| {name} | {app} | {disposition} |")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write-markdown", action="store_true")
    parser.add_argument("--require-closed", action="store_true")
    args = parser.parse_args()
    data = load(f"docs/audit/{STEM}.json")
    if data.get("schema") != "420-devcomp-06-application-revenue-inventory-v1":
        parser.error("unsupported inventory schema")
    expected = catalogs()
    if set(expected) != data["catalogues"].keys():
        parser.error("catalogue sources differ")
    for name, names in expected.items():
        if names != data["catalogues"][name].keys():
            parser.error(f"{name} entries differ from the authoritative source")
    decisions = load("config/genesis-application-decision-2.json")["entries"]
    for row in decisions:
        if row.get("release_enabled") is not False or data["catalogues"]["Decision 2"][row["name"]] != "release-disabled":
            parser.error(f"Decision 2 release authority changed for {row['name']}")
    policy = load("contracts/config/application-revenue-policy-v1.json")
    if data["policy"] != policy["policyId"]:
        parser.error("V1 policy identifier drift")
    if policy["developmentCompensation"]["maxBpsV1"] != 1000:
        parser.error("V1 compensation ceiling drift")
    observed = set()
    identities = set()
    known = set.union(*expected.values())
    for route in data["routes"]:
        identity = (route["application"], route["route"])
        if identity in identities or identity[0] not in known:
            parser.error(f"duplicate or unknown route {identity}")
        identities.add(identity)
        if route["classification"] not in CLASSES or not route["trace"].strip() or not route["sources"]:
            parser.error(f"incomplete route {identity}")
        for source in route["sources"]:
            if not (ROOT / source).is_file():
                parser.error(f"missing evidence {source}")
        for source in route.get("vaultCallers", []):
            if source in observed or source not in route["sources"] or not CALL.search((ROOT / source).read_text()):
                parser.error(f"invalid or duplicate vault caller {source}")
            observed.add(source)
    actual = {p.relative_to(ROOT).as_posix() for p in (ROOT / "contracts/src").rglob("*.sol")
              if CALL.search(p.read_text())}
    if observed != actual:
        parser.error(f"vault caller inventory drift: {sorted(observed ^ actual)}")
    for entries in data["catalogues"].values():
        for app, key in entries.items():
            if key not in CLASSES:
                parser.error(f"invalid classification for {app}")
            if key not in {"release-disabled", "review-required"} and not any(
                row["application"] == app and row["classification"] == key for row in data["routes"]
            ):
                parser.error(f"catalogue classification lacks route evidence for {app}")
    target = AUDIT / f"{STEM}.md"
    markdown = render(data)
    if args.write_markdown:
        target.write_text(markdown)
    if target.read_text() != markdown:
        parser.error("generated Markdown drift")
    open_entries = {(name, app) for name, entries in data["catalogues"].items()
                    for app, value in entries.items() if value == "review-required"}
    open_routes = [row for row in data["routes"] if row["classification"] == "review-required"]
    print(f"{sum(map(len, expected.values()))} catalogue records, {len(data['routes'])} routes, "
          f"{len(actual)} vault callers, {len(open_entries)} open catalogue records, {len(open_routes)} open routes")
    if args.require_closed and (open_entries or open_routes):
        parser.error("revenue qualification remains open")


if __name__ == "__main__":
    main()
