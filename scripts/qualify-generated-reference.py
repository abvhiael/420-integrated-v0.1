#!/usr/bin/env python3
"""Generate or qualify all DOC-10 generated-reference outputs deterministically."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
GENERATED = ROOT / "docs" / "reference" / "generated"


def load_module(filename: str, name: str):
    path = SCRIPTS / filename
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load renderer: {filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def expected_outputs() -> dict[Path, str]:
    core = load_module("generate-reference-docs.py", "reference_core")
    outputs: dict[Path, str] = dict(core.planned_outputs())

    families = [
        ("reference_rpc_renderer.py", "reference_rpc", "rpc.md"),
        ("reference_indexer_renderer.py", "reference_indexer", "indexer-api.md"),
        ("reference_sdk_cli_renderer.py", "reference_sdk_cli", "sdk-cli.md"),
        ("reference_network_renderer.py", "reference_network", "networks.md"),
        ("reference_deployment_renderer.py", "reference_deployment", "deployments.md"),
    ]
    for filename, module_name, output_name in families:
        module = load_module(filename, module_name)
        render = getattr(module, "render", None)
        if not callable(render):
            raise RuntimeError(f"renderer has no render() function: {filename}")
        outputs[GENERATED / output_name] = render()
    return outputs


def stale_paths(outputs: dict[Path, str]) -> list[str]:
    stale: list[str] = []
    for path, expected in outputs.items():
        if not path.is_file() or path.read_text(encoding="utf-8") != expected:
            stale.append(path.relative_to(ROOT).as_posix())
    return stale


def print_identities(outputs: dict[Path, str]) -> None:
    print("DOC-10 generated output identities:")
    for path, content in sorted(outputs.items(), key=lambda item: item[0].as_posix()):
        print(f"  {sha256_text(content)}  {path.relative_to(ROOT).as_posix()}")


def check(outputs: dict[Path, str]) -> int:
    stale = stale_paths(outputs)
    if stale:
        print("DOC-10 generated reference is stale or missing:", file=sys.stderr)
        for path in stale:
            print(f"  - {path}", file=sys.stderr)
        print("Run: python scripts/qualify-generated-reference.py --write", file=sys.stderr)
        return 1
    print(f"DOC-10 generated reference is current ({len(outputs)} outputs)")
    print_identities(outputs)
    return 0


def write(outputs: dict[Path, str]) -> int:
    for path, content in outputs.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")
        print(f"wrote {path.relative_to(ROOT).as_posix()}")
    print_identities(outputs)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="fail when any generated reference output is stale or missing")
    mode.add_argument("--write", action="store_true", help="rewrite all generated reference outputs")
    args = parser.parse_args()
    try:
        outputs = expected_outputs()
        return write(outputs) if args.write else check(outputs)
    except Exception as exc:
        print(f"DOC-10 generated-reference qualification failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
