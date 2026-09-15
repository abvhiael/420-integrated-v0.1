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
EVENT_ERROR_REFERENCE = GENERATED_ROOT / "events-errors.md"
CONTRACT_CATALOGUE = ROOT / "developer-hub" / "catalogue" / "local.example.json"
SCHEMA_VERSION = "1.0.0"
MASK64 = (1 << 64) - 1

KECCAK_ROT = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
]
KECCAK_RC = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
]


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rol64(value: int, amount: int) -> int:
    if amount == 0:
        return value & MASK64
    return ((value << amount) | (value >> (64 - amount))) & MASK64


def keccak_f1600(state: list[int]) -> None:
    for rc in KECCAK_RC:
        c = [state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20] for x in range(5)]
        d = [c[(x - 1) % 5] ^ rol64(c[(x + 1) % 5], 1) for x in range(5)]
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] ^= d[x]
        b = [0] * 25
        for x in range(5):
            for y in range(5):
                b[y + 5 * ((2 * x + 3 * y) % 5)] = rol64(state[x + 5 * y], KECCAK_ROT[x][y])
        for x in range(5):
            for y in range(5):
                state[x + 5 * y] = b[x + 5 * y] ^ ((~b[(x + 1) % 5 + 5 * y]) & b[(x + 2) % 5 + 5 * y])
        state[0] ^= rc


def keccak256(data: bytes) -> bytes:
    rate = 136
    padded = bytearray(data)
    padded.append(0x01)
    while len(padded) % rate != rate - 1:
        padded.append(0)
    padded.append(0x80)
    state = [0] * 25
    for offset in range(0, len(padded), rate):
        block = padded[offset:offset + rate]
        for i, byte in enumerate(block):
            state[i // 8] ^= byte << (8 * (i % 8))
        keccak_f1600(state)
    out = bytearray()
    while len(out) < 32:
        for i in range(rate):
            out.append((state[i // 8] >> (8 * (i % 8))) & 0xFF)
            if len(out) == 32:
                break
        if len(out) < 32:
            keccak_f1600(state)
    return bytes(out)


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


def load_catalogue() -> tuple[dict, bytes]:
    raw = CONTRACT_CATALOGUE.read_bytes()
    catalogue = json.loads(raw.decode("utf-8"))
    if catalogue.get("schemaVersion") != "1.0.0":
        raise ValueError("unsupported contract catalogue schemaVersion")
    contracts = catalogue.get("contracts")
    if not isinstance(contracts, list):
        raise ValueError("contract catalogue contracts must be an array")
    return catalogue, raw


def render_contract_reference() -> str:
    catalogue, raw = load_catalogue()
    contracts = catalogue["contracts"]
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
        abi_distributable = bool(entry.get("verified") is True and artifact_path.is_file() and re.fullmatch(r"[0-9a-fA-F]{64}", abi_hash) and not placeholder_hash(abi_hash))
        lines += [f"## {name}", "", f"- Protocol: `{entry.get('protocol', '')}`", f"- Version: `{entry.get('version', '')}`", f"- Catalogue provenance: `{entry.get('source', '')}`", f"- Deployment block: `{entry.get('deploymentBlock', '')}`", f"- Catalogue address: `{entry.get('address', '')}` (**local example only**)", f"- Solidity source: `{source_path.relative_to(ROOT).as_posix() if source_path else 'unresolved'}`", f"- Declared artifact: `{entry.get('artifact', '')}` ({'present' if artifact_path.is_file() else 'missing'})", f"- Declared interface: `{entry.get('interface', '')}` ({'present' if interface_path.is_file() else 'missing'})", f"- Declared ABI SHA-256: `{abi_hash}`", f"- Distributable verified ABI: **{'YES' if abi_distributable else 'NO — fail closed'}**", ""]
        if source_path:
            source = source_path.read_text(encoding="utf-8")
            notice, dev = contract_natspec(source)
            lines += ["### NatSpec", "", f"- Notice: {notice or '_No contract-level `@notice` found._'}", f"- Developer note: {dev or '_No contract-level `@dev` found._'}", "", "### Public/external source surface", ""]
            funcs = source_functions(source)
            lines.extend(f"- `{signature}`" for signature in funcs) if funcs else lines.append("_No public/external functions derived._")
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


def split_params(value: str) -> list[str]:
    parts = []
    current = []
    depth = 0
    for char in value:
        if char in "([":
            depth += 1
        elif char in ")]":
            depth -= 1
        if char == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(char)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def canonical_param_type(param: str, enum_names: set[str]) -> tuple[str | None, bool]:
    tokens = param.strip().split()
    indexed = "indexed" in tokens
    tokens = [token for token in tokens if token not in {"indexed", "memory", "calldata", "storage"}]
    if not tokens:
        return None, indexed
    if len(tokens) >= 2 and tokens[0] == "address" and tokens[1] == "payable":
        raw_type = "address"
    else:
        raw_type = tokens[0]
    array_suffix = ""
    match = re.fullmatch(r"(.+?)(\[[0-9]*\](?:\[[0-9]*\])*)", raw_type)
    if match:
        raw_type, array_suffix = match.groups()
    if raw_type == "uint":
        raw_type = "uint256"
    elif raw_type == "int":
        raw_type = "int256"
    elif raw_type in enum_names:
        raw_type = "uint8"
    elementary = bool(re.fullmatch(r"(?:address|bool|string|bytes|bytes[1-9]|bytes[12][0-9]|bytes3[0-2]|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256))", raw_type))
    if not elementary:
        return None, indexed
    return raw_type + array_suffix, indexed


def source_events_errors(source: str) -> tuple[list[dict], list[dict]]:
    enum_names = set(re.findall(r"\benum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{", source))
    cleaned = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    cleaned = re.sub(r"//.*", "", cleaned)
    events = []
    errors = []
    for kind, target in (("event", events), ("error", errors)):
        pattern = rf"\b{kind}\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)\s*;"
        for match in re.finditer(pattern, cleaned, re.S):
            name, raw_params = match.groups()
            canonical = []
            indexed_positions = []
            unresolved = False
            for index, param in enumerate(split_params(raw_params)):
                ctype, indexed = canonical_param_type(param, enum_names)
                if ctype is None:
                    unresolved = True
                else:
                    canonical.append(ctype)
                if indexed:
                    indexed_positions.append(index)
            signature = None if unresolved else f"{name}({','.join(canonical)})"
            target.append({
                "name": name,
                "declaration": " ".join(raw_params.split()),
                "signature": signature,
                "indexed": indexed_positions,
            })
    return events, errors


def render_event_error_reference() -> str:
    catalogue, raw = load_catalogue()
    lines = [
        "---", "title: Generated events and custom errors", "audience:", "  - developer",
        "category: reference", "status: generated", "version: current", "---", "",
        "# Generated events and custom errors", "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate with `python scripts/generate-reference-docs.py`.", "",
        "Publication boundary: `developer-hub/catalogue/local.example.json`  ",
        f"Catalogue SHA-256: `{sha256_bytes(raw)}`  ",
        "Environment scope: **local example only**", "",
        "Event topics and custom-error selectors are Ethereum Keccak-256 hashes of canonical ABI signatures. They are published only when the source declaration can be normalized unambiguously. User-defined or otherwise ambiguous parameter types are reported unresolved instead of guessed.", "",
        "## Global event index", "",
        "| Contract | Event | Canonical signature | Indexed parameter positions | topic0 |",
        "| --- | --- | --- | --- | --- |",
    ]
    all_events = []
    all_errors = []
    per_contract = []
    for entry in sorted(catalogue["contracts"], key=lambda item: str(item.get("name", ""))):
        name = str(entry.get("name", ""))
        source_path = solidity_source_for(name)
        if not source_path:
            per_contract.append((name, None, [], []))
            continue
        source = source_path.read_text(encoding="utf-8")
        events, errors = source_events_errors(source)
        per_contract.append((name, source_path, events, errors))
        for item in events:
            all_events.append((name, item))
        for item in errors:
            all_errors.append((name, item))
    for contract, item in sorted(all_events, key=lambda pair: (pair[1]["name"], pair[0])):
        signature = item["signature"]
        topic = "unresolved" if signature is None else "0x" + keccak256(signature.encode("utf-8")).hex()
        indexed = ", ".join(str(i) for i in item["indexed"]) if item["indexed"] else "none"
        lines.append(f"| `{contract}` | `{item['name']}` | `{signature or 'unresolved'}` | {indexed} | `{topic}` |")
    if not all_events:
        lines.append("| _none_ | _none_ | _none_ | _none_ | _none_ |")
    lines += ["", "## Global custom-error index", "", "| Contract | Error | Canonical signature | Selector |", "| --- | --- | --- | --- |"]
    for contract, item in sorted(all_errors, key=lambda pair: (pair[1]["name"], pair[0])):
        signature = item["signature"]
        selector = "unresolved" if signature is None else "0x" + keccak256(signature.encode("utf-8")).hex()[:8]
        lines.append(f"| `{contract}` | `{item['name']}` | `{signature or 'unresolved'}` | `{selector}` |")
    if not all_errors:
        lines.append("| _none_ | _none_ | _none_ | _none_ |")
    for contract, source_path, events, errors in per_contract:
        lines += ["", f"## {contract}", ""]
        if source_path is None:
            lines.append("Matching Solidity source is unresolved; event/error extraction failed closed.")
            continue
        lines += [f"Source: `{source_path.relative_to(ROOT).as_posix()}`", "", "### Events", ""]
        if events:
            for item in events:
                signature = item["signature"]
                topic = "unresolved" if signature is None else "0x" + keccak256(signature.encode("utf-8")).hex()
                indexed = ", ".join(str(i) for i in item["indexed"]) if item["indexed"] else "none"
                lines += [f"- `{item['name']}({item['declaration']})`", f"  - canonical signature: `{signature or 'unresolved'}`", f"  - indexed parameter positions: {indexed}", f"  - topic0: `{topic}`"]
        else:
            lines.append("_No events declared in the matching source._")
        lines += ["", "### Custom errors", ""]
        if errors:
            for item in errors:
                signature = item["signature"]
                selector = "unresolved" if signature is None else "0x" + keccak256(signature.encode("utf-8")).hex()[:8]
                lines += [f"- `{item['name']}({item['declaration']})`", f"  - canonical signature: `{signature or 'unresolved'}`", f"  - selector: `{selector}`"]
        else:
            lines.append("_No custom errors declared in the matching source._")
    lines += ["", "## Hashing self-check", "", "The generator carries an internal Ethereum Keccak-256 implementation. Known-vector checks are enforced before output: `keccak256(\"\") = c5d246...a470` and `transfer(address,uint256)` selector = `0xa9059cbb`.", ""]
    return "\n".join(lines).rstrip() + "\n"


def planned_outputs() -> dict[Path, str]:
    if keccak256(b"").hex() != "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470":
        raise ValueError("Keccak-256 self-check failed for empty string")
    if keccak256(b"transfer(address,uint256)").hex()[:8] != "a9059cbb":
        raise ValueError("Keccak-256 self-check failed for ERC-20 transfer selector")
    registry, registry_raw = load_registry()
    return {
        SOURCE_MANIFEST: render_source_manifest(registry, registry_raw),
        CONTRACT_REFERENCE: render_contract_reference(),
        EVENT_ERROR_REFERENCE: render_event_error_reference(),
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
