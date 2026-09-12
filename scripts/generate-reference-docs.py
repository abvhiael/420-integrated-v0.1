#!/usr/bin/env python3
"""Deterministic 420Docs generated-reference entry point.

DOC-10 renderers plug into this script. DOC-10.1 establishes the source registry,
output contract, deterministic formatting and --check mode. Later DOC-10 phases
extend renderers without changing the authority model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "docs" / "reference" / "reference-sources.json"
GENERATED_ROOT = ROOT / "docs" / "reference" / "generated"
SOURCE_MANIFEST = GENERATED_ROOT / "source-manifest.md"
SCHEMA_VERSION = "1.0.0"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_registry() -> tuple[dict, bytes]:
    raw = REGISTRY.read_bytes()
    data = json.loads(raw.decode("utf-8"))
    if data.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(
            f"unsupported reference source schemaVersion: {data.get('schemaVersion')!r}"
        )
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
        if not isinstance(sources, list) or not all(
            isinstance(item, str) and item for item in sources
        ):
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
        "---",
        "title: Generated reference source manifest",
        "audience:",
        "  - developer",
        "category: reference",
        "status: generated",
        "version: current",
        "---",
        "",
        "# Generated reference source manifest",
        "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate with `python scripts/generate-reference-docs.py`.",
        "",
        f"Generator schema: `{SCHEMA_VERSION}`  ",
        f"Source registry: `docs/reference/reference-sources.json`  ",
        f"Source registry SHA-256: `{sha256_bytes(registry_raw)}`",
        "",
        "This manifest records the checked-in source locations used by DOC-10 renderers. Presence is not authority: later family renderers must still enforce verification, environment and provenance rules before publishing distributable reference values.",
        "",
        "| Family | Phase | Source | Kind |",
        "| --- | --- | --- | --- |",
    ]

    for family in sorted(registry["families"], key=lambda item: item["id"]):
        family_id = family["id"]
        phase = family.get("phase", "")
        for source in sorted(family["sources"]):
            kind = source_kind(ROOT / source)
            lines.append(f"| `{family_id}` | `{phase}` | `{source}` | {kind} |")

    lines.extend([
        "",
        "## Family notes",
        "",
    ])
    for family in sorted(registry["families"], key=lambda item: item["id"]):
        lines.append(f"### {family['id']}")
        lines.append("")
        lines.append(str(family.get("notes", "")))
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def planned_outputs() -> dict[Path, str]:
    registry, registry_raw = load_registry()
    return {SOURCE_MANIFEST: render_source_manifest(registry, registry_raw)}


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
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail if committed generated reference output differs from deterministic output",
    )
    args = parser.parse_args()
    try:
        outputs = planned_outputs()
        return check(outputs) if args.check else write(outputs)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"reference generation failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
