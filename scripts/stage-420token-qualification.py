#!/usr/bin/env python3
"""Stage the Token-owned Foundry graph without unrelated CADC/Bridge fixtures."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
BRIDGE_OWNED = {"TokenGatewayRouterIntegration420.t.sol", "TokenGatewaySemantics420.t.sol"}
REQUIRED_TESTS = {
    "TokenGenesis420.t.sol", "TokenAudit420.t.sol", "TokenVaultIntegration420.t.sol",
    "TokenDeploymentBinding420.t.sol", "TokenCompliance420.t.sol", "TokenTemplateInvariant420.t.sol",
}
IMPORT = re.compile(r"""(?:\bfrom\s+|\bimport\s+)["']([^"']+)["']""")
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        raise RuntimeError("Token staging must use a fresh directory")
    if output.is_relative_to(CONTRACTS):
        raise RuntimeError("Do not stage inside the authoritative Solidity graph")
    output.mkdir(parents=True, exist_ok=True)
    tests = sorted(p for p in (CONTRACTS / "test").glob("Token*.t.sol") if p.name not in BRIDGE_OWNED)
    if not REQUIRED_TESTS.issubset({p.name for p in tests}):
        raise RuntimeError("Missing retained Token test owner")
    pending = tests + sorted((CONTRACTS / "src/token").glob("*.sol"))
    hashes = {}
    while pending:
        source = pending.pop().resolve()
        if not source.is_relative_to(CONTRACTS) or not source.is_file():
            raise RuntimeError("Unresolved Token dependency: " + str(source))
        rel = source.relative_to(CONTRACTS)
        key = rel.as_posix()
        if key in hashes:
            continue
        content = source.read_bytes()
        hashes[key] = hashlib.sha256(content).hexdigest()
        target = output / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        for dep in IMPORT.findall(content.decode("utf-8")):
            if not dep.startswith("."):
                raise RuntimeError("Unexpected non-relative import in Token graph: " + dep)
            pending.append(source.parent / dep)
    shutil.copyfile(CONTRACTS / "foundry.toml", output / "foundry.toml")
    hashes["foundry.toml"] = hashlib.sha256((CONTRACTS / "foundry.toml").read_bytes()).hexdigest()
    for name, digest in hashes.items():
        if hashlib.sha256((output / name).read_bytes()).hexdigest() != digest:
            raise RuntimeError("Staged source mismatch: " + name)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    evidence = {"head": head, "tests": [p.name for p in tests], "bridge_owned_separate": sorted(BRIDGE_OWNED),
                "sha256": hashes}
    (output / "token-source-closure.json").write_text(json.dumps(evidence, sort_keys=True, indent=2) + "\n")
    print(json.dumps(evidence, sort_keys=True))
if __name__ == "__main__":
    main()
