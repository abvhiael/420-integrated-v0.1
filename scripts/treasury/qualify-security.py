#!/usr/bin/env python3
"""Source-bound REC-9 security qualification; all raw static findings are retained."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
spec = importlib.util.spec_from_file_location("closure", ROOT / "scripts/qualify-stake-isolated.py")
isolated = importlib.util.module_from_spec(spec)
spec.loader.exec_module(isolated)
out = Path(sys.argv[1]).resolve()
scope = Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
scope.mkdir(parents=True, exist_ok=False)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write(name, obj):
    (out / name).write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n")

def run(name, args, cwd=ROOT, accepted=(0,)):
    with (out / (name + ".log")).open("w") as log:
        process = subprocess.Popen(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in process.stdout:
            print(line, end="", flush=True)
            log.write(line)
        rc = process.wait()
    if rc not in accepted:
        raise RuntimeError(f"{name} failed ({rc})")
    return rc

def analyze(name, owners):
    target = scope / (name + ".sol")
    target.write_text("// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.24;\n" +
                      "".join('import "./' + str(owner.relative_to(CONTRACTS)) + '";\n' for owner in owners))
    raw = out / (name + ".json")
    solc = Path.home() / ".svm/0.8.24/solc-0.8.24"
    if not solc.is_file():
        raise RuntimeError(f"canonical solc unavailable: {solc}")
    run(name, ["slither", str(target), "--compile-force-framework", "solc", "--solc", str(solc),
               "--solc-args", "--optimize --optimize-runs 200 --via-ir --evm-version cancun",
               "--json", str(raw)], cwd=scope, accepted=(0, 255))
    target.unlink()
    report = json.loads(raw.read_text())
    if report.get("success") is not True:
        raise RuntimeError(f"{name}: static analysis did not succeed")
    # Keep original paths, source offsets, IDs and descriptions; no blanket suppression.
    return report["results"]["detectors"]

treasury = sorted((CONTRACTS / "src/treasury").glob("*.sol"))
governance = [CONTRACTS / "src/governance" / n for n in ["GovernanceTimelock.sol", "CivicGovernor420.sol"]]
safety = [CONTRACTS / n for n in ["src/system/StakeSystemSafety420.sol", "src/governance/GovernanceTimelock.sol",
                                  "src/apps/ProtocolRegistry.sol"]]
tests = [CONTRACTS / "test" / n for n in ["TreasuryRec9Security420.t.sol", "TreasuryRec9Governance420.t.sol"]]
deps = isolated.closure(treasury + governance + safety + tests)
for p in deps:
    target = scope / p.relative_to(CONTRACTS)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(p, target)
    assert sha(target) == sha(p)
shutil.copyfile(CONTRACTS / "foundry.toml", scope / "foundry.toml")
(scope / "remappings.txt").write_text("forge-std/=forge-std/\n")
write("inputs.json", {
    "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
    "profile": os.environ.get("FOUNDRY_PROFILE", "default"),
    "sources": {str(p.relative_to(ROOT)): sha(p) for p in deps},
    "foundry": sha(CONTRACTS / "foundry.toml"),
    "workflowRun": os.environ.get("GITHUB_RUN_ID"),
})
for tool in ("forge", "slither"):
    run(tool + "-version", [tool, "--version"])
run("security-tests", ["forge", "test", "--root", str(scope), "--match-path", "test/TreasuryRec9*.t.sol", "-vv"])
if not re.search(r"\b[1-9][0-9]* tests? passed, 0 failed\b", (out / "security-tests.log").read_text()):
    raise RuntimeError("no passing executed tests")
for pattern in (r"\btx\s*\.\s*origin\b", r"\bselfdestruct\s*\(", r"\bdelegatecall\s*\("):
    for p in treasury:
        if re.search(pattern, p.read_text()):
            raise RuntimeError(f"forbidden primitive in {p}: {pattern}")
(out / "forbidden-primitives.txt").write_text("PASS: tx.origin, selfdestruct, delegatecall scan of every Treasury source\n")
findings = {}
for name, owners in [("treasury-slither", treasury), ("governance-slither", governance), ("stake-safety-slither", safety)]:
    findings[name] = analyze(name, owners)
# No finding is discarded from the raw review package. Source-bound high-severity gate
# includes Treasury and directly affected shared Governance, rather than all ecosystem contracts.
unresolved = []
for name, detectors in findings.items():
    for d in detectors:
        elements = d.get("elements", [])
        owned = any("src/treasury/" in e["source_mapping"]["filename_relative"] or
                    "src/governance/GovernanceTimelock.sol" in e["source_mapping"]["filename_relative"] or
                    "src/governance/CivicGovernor420.sol" in e["source_mapping"]["filename_relative"]
                    for e in elements)
        if d["impact"] == "High" and owned:
            unresolved.append({"scope": name, "id": d.get("id"), "check": d["check"],
                               "description": d["description"], "elements": elements})
        print(json.dumps({"scope": name, "id": d.get("id"), "check": d["check"], "impact": d["impact"],
                          "description": d["description"]}, sort_keys=True))
write("static-summary.json", {"counts": {k: len(v) for k, v in findings.items()}, "unresolvedHigh": unresolved})
with tarfile.open(out / "independent-review-package.tar.gz", "w:gz") as archive:
    include = set(deps)
    include.update([CONTRACTS / "foundry.toml", ROOT / "scripts/treasury/qualify-security.py",
                    ROOT / ".github/workflows/treasury-rec9-security.yml",
                    ROOT / "contracts/config/420treasury-genesis.json",
                    ROOT / "contracts/config/treasury/treasury-audit-6-release-materialization.json",
                    ROOT / "contracts/config/treasury/treasury-release-executor.json"])
    include.update((ROOT / "docs/audit").glob("420TREASURY-*.md"))
    include.add(ROOT / "docs/audit/420TREASURY-REC-8-REHEARSAL.json")
    include.update((ROOT / "docs/apps/treasury").glob("*.md"))
    for p in sorted(include):
        archive.add(p, arcname=str(p.relative_to(ROOT)))
    for p in sorted(out.iterdir()):
        if p.is_file() and p.name != "independent-review-package.tar.gz":
            archive.add(p, arcname="qualification/" + p.name)
if unresolved:
    raise RuntimeError("unresolved high-severity Treasury/shared Governance static findings; see static-summary.json")
print("REC-9 targeted executable and high-severity security gate PASS")
