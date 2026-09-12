#!/usr/bin/env python3
"""Deterministic 420Docs generated-reference entry point."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "docs" / "reference" / "reference-sources.json"
GENERATED_ROOT = ROOT / "docs" / "reference" / "generated"
SOURCE_MANIFEST = GENERATED_ROOT / "source-manifest.md"
CONTRACT_REFERENCE = GENERATED_ROOT / "contracts.md"
CONTRACT_CATALOGUE = ROOT / "developer-hub" / "catalogue" / "local.example.json"
SCHEMA_VERSION = "1.0.0"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_registry() -> tuple[dict, bytes]:
    raw = REGISTRY.read_bytes()
    data = json.loads(raw.decode("utf-8"))
    if data.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"unsupported reference source schemaVersion: {data.get('schemaVersion')!r}")
    families = data.get("families")
    if not isinstance(families, list) or not families:
        raise ValueError("reference source registry must contain a non-empty families array")
    seen = set()
    for family in families:
        if not isinstance(family, dict):
            raise ValueError("each reference family must be an object")
        family_id = family.get("id")
        if not isinstance(family_id, str) or not family_id:
            raise ValueError("reference family id must be a non-empty string")
        if family_id in seen:
            raise ValueError(f"duplicate reference family id: {family_id}")
        seen.add(family_id)
        sources = family.get("sources")
        if not isinstance(sources, list) or not all(isinstance(item, str) and item for item in sources):
            raise ValueError(f"reference family {family_id} has invalid sources")
    return data, raw


def source_kind(path: Path) -> str:
    if path.is_file():
        return "file"
    if path.is_dir():
        return "directory"
    return "missing"


def render_source_manifest(registry: dict, registry_raw: bytes) -> str:
    lines = [
        "---", "title: Generated reference source manifest", "audience:", "  - developer",
        "category: reference", "status: generated", "version: current", "---", "",
        "# Generated reference source manifest", "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate with `python scripts/generate-reference-docs.py`.", "",
        f"Generator schema: `{SCHEMA_VERSION}`  ",
        "Source registry: `docs/reference/reference-sources.json`  ",
        f"Source registry SHA-256: `{sha256_bytes(registry_raw)}`", "",
        "This manifest records the checked-in source locations used by DOC-10 renderers. Presence is not authority: family renderers still enforce verification, environment and provenance rules before publishing distributable reference values.", "",
        "| Family | Phase | Source | Kind |", "| --- | --- | --- | --- |",
    ]
    for family in sorted(registry["families"], key=lambda item: item["id"]):
        for source in sorted(family["sources"]):
            lines.append(f"| `{family['id']}` | `{family.get('phase', '')}` | `{source}` | {source_kind(ROOT / source)} |")
    lines.extend(["", "## Family notes", ""])
    for family in sorted(registry["families"], key=lambda item: item["id"]):
        lines += [f"### {family['id']}", "", str(family.get("notes", "")), ""]
    return "\n".join(lines).rstrip() + "\n"


def solidity_source_for(name: str) -> Path | None:
    matches = sorted((ROOT / "contracts" / "src").rglob(f"{name}.sol"))
    return matches[0] if len(matches) == 1 else None


def contract_natspec(source: str) -> tuple[str, str]:
    notice = ""
    dev = ""
    for line in source.splitlines():
        stripped = line.strip()
        if stripped.startswith("/// @notice") and not notice:
            notice = stripped.removeprefix("/// @notice").strip()
        elif stripped.startswith("/// @dev") and not dev:
            dev = stripped.removeprefix("/// @dev").strip()
        if re.search(r"\b(contract|interface|library)\s+[A-Za-z_][A-Za-z0-9_]*", stripped):
            break
    return notice, dev


def source_functions(source: str) -> list[str]:
    cleaned = re.sub(r"//.*", "", source)
    functions = []
    for match in re.finditer(r"\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)\s*([^\{;]*)[\{;]", cleaned, re.S):
        name, params, suffix = match.groups()
        if " external" not in f" {suffix}" and " public" not in f" {suffix}":
            continue
        params = " ".join(params.split())
        suffix = " ".join(suffix.split())
        functions.append(f"{name}({params}) {suffix}".strip())
    return functions


def placeholder_hash(value: str) -> bool:
    return bool(re.fullmatch(r"([0-9a-fA-F])\1{63}", value or ""))


def render_contract_reference() -> str:
    raw = CONTRACT_CATALOGUE.read_bytes()
    catalogue = json.loads(raw.decode("utf-8"))
    if catalogue.get("schemaVersion") != "1.0.0":
        raise ValueError("unsupported contract catalogue schemaVersion")
    contracts = catalogue.get("contracts")
    if not isinstance(contracts, list):
        raise ValueError("contract catalogue contracts must be an array")

    lines = [
        "---", "title: Generated contract and ABI reference", "audience:", "  - developer",
        "category: reference", "status: generated", "version: current", "---", "",
        "# Generated contract, NatSpec and ABI reference", "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate with `python scripts/generate-reference-docs.py`.", "",
        "Source catalogue: `developer-hub/catalogue/local.example.json`  ",
        f"Catalogue SHA-256: `{sha256_bytes(raw)}`  ",
        f"Catalogue chain ID: `{catalogue.get('chainId', '')}`  ",
        "Environment scope: **local example only**", "",
        "This page is generated from the currently checked-in contract catalogue plus matching Solidity source. A catalogue `verified: true` flag is not sufficient by itself to publish a distributable ABI: the referenced build artifact must exist, the ABI hash must be non-placeholder and the source/provenance must remain environment-scoped.", "",
    ]

    if not contracts:
        lines.append("No catalogue contracts are currently checked in.")
        return "\n".join(lines).rstrip() + "\n"

    for entry in sorted(contracts, key=lambda item: str(item.get("name", ""))):
        name = str(entry.get("name", ""))
        source_path = solidity_source_for(name)
        artifact_path = ROOT / str(entry.get("artifact", ""))
        interface_path = ROOT / str(entry.get("interface", ""))
        abi_hash = str(entry.get("abiSha256", ""))
        abi_distributable = bool(
            entry.get("verified") is True
            and artifact_path.is_file()
            and re.fullmatch(r"[0-9a-fA-F]{64}", abi_hash)
            and not placeholder_hash(abi_hash)
        )

        lines += [f"## {name}", "", f"- Protocol: `{entry.get('protocol', '')}`", f"- Version: `{entry.get('version', '')}`", f"- Catalogue provenance: `{entry.get('source', '')}`", f"- Deployment block: `{entry.get('deploymentBlock', '')}`", f"- Catalogue address: `{entry.get('address', '')}` (**local example only**)", f"- Solidity source: `{source_path.relative_to(ROOT).as_posix() if source_path else 'unresolved'}`", f"- Declared artifact: `{entry.get('artifact', '')}` ({'present' if artifact_path.is_file() else 'missing'})", f"- Declared interface: `{entry.get('interface', '')}` ({'present' if interface_path.is_file() else 'missing'})", f"- Declared ABI SHA-256: `{abi_hash}`", f"- Distributable verified ABI: **{'YES' if abi_distributable else 'NO — fail closed'}**", ""]

        if source_path:
            source = source_path.read_text(encoding="utf-8")
            notice, dev = contract_natspec(source)
            lines += ["### NatSpec", ""]
            lines.append(f"- Notice: {notice or '_No contract-level `@notice` found._'}")
            lines.append(f"- Developer note: {dev or '_No contract-level `@dev` found._'}")
            lines += ["", "### Public/external source surface", ""]
            funcs = source_functions(source)
            if funcs:
                for signature in funcs:
                    lines.append(f"- `{signature}`")
            else:
                lines.append("_No public/external functions derived._")
            lines.append("")

        if not abi_distributable:
            reasons = []
            if entry.get("verified") is not True:
                reasons.append("catalogue entry is not verified")
            if not artifact_path.is_file():
                reasons.append("declared build artifact is not checked in")
            if placeholder_hash(abi_hash):
                reasons.append("declared ABI hash is a placeholder")
            if not re.fullmatch(r"[0-9a-fA-F]{64}", abi_hash):
                reasons.append("declared ABI hash is malformed")
            lines += ["### ABI publication status", "", "The generated reference does not publish ABI JSON for this entry because " + "; ".join(reasons) + ". This is intentional fail-closed behavior, not a missing-documentation workaround.", ""]

    return "\n".join(lines).rstrip() + "\n"


def planned_outputs() -> dict[Path, str]:
    registry, registry_raw = load_registry()
    return {
        SOURCE_MANIFEST: render_source_manifest(registry, registry_raw),
        CONTRACT_REFERENCE: render_contract_reference(),
    }


def check(outputs: dict[Path, str]) -> int:
    stale = []
    for path, expected in outputs.items():
        if not path.exists() or path.read_text(encoding="utf-8") != expected:
            stale.append(path.relative_to(ROOT).as_posix())
    if stale:
        print("generated reference output is stale or missing:", file=sys.stderr)
        for path in stale:
            print(f"  - {path}", file=sys.stderr)
        return 1
    print("generated reference output is current")
    return 0


def write(outputs: dict[Path, str]) -> int:
    for path, content in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")
        print(f"wrote {path.relative_to(ROOT).as_posix()}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if committed generated reference output differs from deterministic output")
    args = parser.parse_args()
    try:
        outputs = planned_outputs()
        return check(outputs) if args.check else write(outputs)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"reference generation failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
