#!/usr/bin/env python3
"""Stage only the real Solidity dependency closure for local Wallet/Token integration."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
ROOTS = [
    "src/governance/GovernanceTimelock.sol",
    "src/apps/ProtocolRegistry.sol",
    "src/system/CapabilityRegistry420.sol",
    "src/accounts/EntryPoint420.sol",
    "src/accounts/SmartAccountFactory420.sol",
    "src/vault/VaultAuthorization420.sol",
    "src/vault/VaultPolicyRegistry420.sol",
    "src/vault/VaultRegistry420.sol",
    "src/vault/VaultAccounting420.sol",
    "src/vault/AssetVault420.sol",
    "src/token/TokenTemplateRegistry420.sol",
    "src/token/TokenFactory420.sol",
]
IMPORT = re.compile(r"""(?:\bfrom\s+|\bimport\s+)["']([^"']+)["']""")

def main():
    output = Path(sys.argv[1]).resolve()
    if output.is_relative_to(ROOT) or (output.exists() and any(output.iterdir())):
        raise RuntimeError("Stage into a fresh directory outside the repository")
    output.mkdir(parents=True, exist_ok=True)
    hashes = {}
    pending = [CONTRACTS / p for p in ROOTS]
    while pending:
        source = pending.pop().resolve()
        if not source.is_relative_to(CONTRACTS) or not source.is_file():
            raise RuntimeError(f"Unresolved Solidity dependency: {source}")
        rel = source.relative_to(CONTRACTS).as_posix()
        if rel in hashes:
            continue
        content = source.read_bytes()
        hashes[rel] = hashlib.sha256(content).hexdigest()
        target = output / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        for dep in IMPORT.findall(content.decode("utf-8")):
            if not dep.startswith("."):
                raise RuntimeError(f"Unexpected non-relative import: {dep}")
            pending.append(source.parent / dep)
    shutil.copyfile(CONTRACTS / "foundry.toml", output / "foundry.toml")
    hashes["foundry.toml"] = hashlib.sha256((CONTRACTS / "foundry.toml").read_bytes()).hexdigest()
    for rel, digest in hashes.items():
        if hashlib.sha256((output / rel).read_bytes()).hexdigest() != digest:
            raise RuntimeError(f"Staged source mismatch: {rel}")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    evidence = {"head": head, "roots": ROOTS, "sha256": hashes}
    (output / "source-closure.json").write_text(json.dumps(evidence, sort_keys=True, indent=2) + "\n")
    print(f"Token local EVM source closure: {len(hashes)} files at {head}")

if __name__ == "__main__":
    main()
