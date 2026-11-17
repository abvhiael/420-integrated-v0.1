#!/usr/bin/env python3
"""Run unmodified Stake test owners in their isolated, complete Solidity import closure."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
IMPORT = re.compile(r'\bimport\s+(?:[^;]*?\bfrom\s+)?["\x27]([^"\x27]+)["\x27]\s*;')
REMAP = {"forge-std/": CONTRACTS / "forge-std"}
GENESIS_FILTER = ("testStakeGenesisInitializationIntrospection|"
                  "testGenesisBondLifecycleAndDelegationPolicy|"
                  "testConsensusSystemCallerIsOneTimeAndGovernanceCannotForgeOutcome|"
                  "testStakeFacadeReportsCollateralSolvency")

def closure(owners):
    seen = set()
    pending = list(owners)
    while pending:
        source = pending.pop().resolve()
        if source in seen:
            continue
        if not source.is_relative_to(CONTRACTS) or not source.is_file():
            raise RuntimeError(f"missing or external dependency: {source}")
        seen.add(source)
        for name in IMPORT.findall(source.read_text()):
            for prefix, base in REMAP.items():
                if name.startswith(prefix):
                    pending.append(base / name[len(prefix):])
                    break
            else:
                pending.append(source.parent / name)
    return sorted(seen)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--audit", choices=["7", "8"], required=True)
    p.add_argument("--log-dir", type=Path, required=True)
    a = p.parse_args()
    a.log_dir.mkdir(parents=True, exist_ok=True)
    logdir = a.log_dir.resolve()
    testdir = CONTRACTS / "test"
    if a.audit == "7":
        owners = [testdir / n for n in ("StakeValidatorGenesis420.t.sol",
                                        "StakeSystemCallABIVectors420.t.sol")]
        groups = [(owners[0], GENESIS_FILTER), (owners[1], None)]
    else:
        owners = sorted(testdir.glob("Stake*.t.sol"))
        required = {"StakeValidatorGenesis420.t.sol", "StakeSystemCallABIVectors420.t.sol",
                    "StakeSecurityInvariant420.t.sol", "StakeTransitionProperty420.t.sol",
                    "StakeRollbackAtomicity420.t.sol"}
        if not required.issubset({x.name for x in owners}):
            raise RuntimeError("canonical Stake test owners missing")
        owners += [testdir / "ConsensusSystemCall420.t.sol", testdir / "ValidatorEligibility420.t.sol"]
        groups = [(x, None) for x in owners]
    dependencies = closure(owners)
    with tempfile.TemporaryDirectory(prefix="stake-qualification-") as folder:
        dest = Path(folder)
        for source in dependencies:
            target = dest / source.relative_to(CONTRACTS)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        # Keep all canonical compiler, fuzz, invariant and permission settings intact.
        shutil.copyfile(CONTRACTS / "foundry.toml", dest / "foundry.toml")
        # The isolated root uses identical source paths; no bridge fixtures are copied.
        (dest / "remappings.txt").write_text("forge-std/=forge-std/\n")
        (logdir / "inputs.json").write_text(json.dumps({
            "owners": [x.name for x in owners],
            "profile": os.environ.get("FOUNDRY_PROFILE", "default"),
            "source_sha256": {str(x.relative_to(ROOT)): hashlib.sha256(x.read_bytes()).hexdigest()
                              for x in dependencies},
            "foundry_config_sha256": hashlib.sha256((CONTRACTS / "foundry.toml").read_bytes()).hexdigest(),
        }, indent=2, sort_keys=True) + "\n")
        for owner, filter_ in groups:
            command = ["forge", "test", "--root", str(dest), "--match-path",
                       "test/" + owner.name, "-vv"]
            if filter_:
                command += ["--match-test", filter_]
            print("Running", owner.name, flush=True)
            output = []
            with (logdir / (owner.name + ".log")).open("w") as log:
                process = subprocess.Popen(command, cwd=dest, stdout=subprocess.PIPE,
                                           stderr=subprocess.STDOUT, text=True)
                for line in process.stdout:
                    print(line, end="", flush=True)
                    log.write(line)
                    output.append(line)
                rc = process.wait()
            if rc:
                raise SystemExit(rc)
            if not re.search(r"\b[1-9][0-9]* tests? passed\b", "".join(output)):
                raise RuntimeError(f"no executed passing tests: {owner.name}")

if __name__ == "__main__":
    main()
