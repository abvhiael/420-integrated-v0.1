#!/usr/bin/env python3
"""Materialize the exact Vault/Genesis Solidity dependency closure for CI.

This reproduces checked-out bytes, not substitutions or mocks; unrelated CADC
LayerZero fixture sources must not turn a focused development-compensation
security/contract gate into an unresolvable full-repository compile.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
ROOT_FILES = (
    "src/revenue/DevelopmentCompensationVault420.sol",
    "src/revenue/DevelopmentCompensationIds420.sol",
    "src/revenue/FoundingDeveloperCompensationSplitter420.sol",
    "test/DevelopmentCompensationVault420.t.sol",
    "test/DevelopmentCompensationAdversarial420.t.sol",
    "test/DevelopmentCompensationGenesis420.t.sol",
    "test/DevelopmentCompensationEcosystem420.t.sol",
    "test/ExchangeFeeSettlement420.t.sol",
    "test/FounderWalletClaimsAndCompensation420.t.sol",
)
IMPORT = re.compile(r"""\bimport\s+(?:[^;]*?\bfrom\s+)?["']([^"']+)["']\s*;""")


def stage(output: Path) -> dict[str, str]:
    source = CONTRACTS.resolve()
    dest = output.resolve()
    if dest == source or dest.is_relative_to(source):
        raise ValueError("isolated qualification output must not overwrite the repository")
    pending = [source / name for name in ROOT_FILES]
    seen: set[Path] = set()
    while pending:
        path = pending.pop().resolve()
        if path in seen:
            continue
        if not path.is_relative_to(source) or not path.is_file():
            raise ValueError(f"missing, external or invalid Solidity import: {path}")
        seen.add(path)
        for name in IMPORT.findall(path.read_text()):
            pending.append(source / name if name.startswith("forge-std/") else path.parent / name)
    hashes = {}
    for path in sorted(seen):
        target = dest / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        if target.read_bytes() != path.read_bytes():
            raise RuntimeError(f"copied qualification source drift: {path}")
        hashes[str(path.relative_to(source))] = hashlib.sha256(path.read_bytes()).hexdigest()
    shutil.copyfile(source / "foundry.toml", dest / "foundry.toml")
    (dest / "remappings.txt").write_text("forge-std/=forge-std/\n")
    return hashes


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(stage(args.output), indent=2, sort_keys=True))
