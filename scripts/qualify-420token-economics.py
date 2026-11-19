#!/usr/bin/env python3
"""Qualify only TOKEN-AUDIT-3, with the exact imported source bytes and CI profile."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
OWNER = "test/token-economics/TokenEconomics420.t.sol"
IMPORT = re.compile(r"""(?:\bfrom\s+|\bimport\s+)["']([^"']+)["']""")
EXPECTED = {
    "testAllEightTemplatesExactFeeLedgerProvenanceAndEvents",
    "testAllEightRejectWrongFeeAndDisabledTemplate",
    "testFuzzNonExactFeeNeverChangesEconomics",
    "testFrozenDepositRollbackAndIdenticalCreate2RetryForEveryTemplate",
    "testWindingDownAndClosedVaultRejectEveryTemplate",
    "testUnregisteredSameIdAndWrongAccountingRegistryRollback",
    "testWrongVaultIdAndDevCompRejectedAndSameIdSpoofNotAdmitted",
    "testUnauthorizedLedgerWithdrawalAndFeeRedirection",
    "testUnrecordedNativeBalanceDoesNotCreateAccountingCredit",
    "testHostileVaultReentryRejectedAcrossAllCreatePathsAndAtomicRollback",
}


def stage(dest):
    pending = [CONTRACTS / OWNER]
    hashes = {}
    while pending:
        source = pending.pop().resolve()
        if not source.is_relative_to(CONTRACTS) or not source.is_file():
            raise RuntimeError("Unresolved economic qualification dependency: " + str(source))
        rel = source.relative_to(CONTRACTS)
        if rel.as_posix() in hashes:
            continue
        content = source.read_bytes()
        hashes[rel.as_posix()] = hashlib.sha256(content).hexdigest()
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        for dep in IMPORT.findall(content.decode("utf-8")):
            if not dep.startswith("."):
                raise RuntimeError("Unexpected non-relative import: " + dep)
            pending.append(source.parent / dep)
    config = CONTRACTS / "foundry.toml"
    shutil.copyfile(config, dest / "foundry.toml")
    hashes["foundry.toml"] = hashlib.sha256(config.read_bytes()).hexdigest()
    for name, digest in hashes.items():
        if hashlib.sha256((dest / name).read_bytes()).hexdigest() != digest:
            raise RuntimeError("Staged file drift: " + name)
    return hashes


def main():
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    expected = os.environ.get("EXPECTED_SHA", head)
    if head != expected:
        raise RuntimeError("Exact-head mismatch")
    config = json.loads((CONTRACTS / "config/420token-genesis.json").read_text())
    if (config["creationFeeNative420"] != "42" or len(config["templates"]) != 8
            or config["communityTreasuryVaultId"] != "420/treasury/vault/token-creation-community-revenue/v1"):
        raise RuntimeError("Frozen economic authority mismatch")
    env = dict(os.environ, FOUNDRY_PROFILE="ci", NO_COLOR="1")
    with tempfile.TemporaryDirectory(prefix="420token-economics-") as folder:
        dest = Path(folder)
        hashes = stage(dest)
        print(json.dumps({"head": head, "owner": OWNER, "source_closure_sha256": hashes}, sort_keys=True), flush=True)
        result = subprocess.run(
            ["forge", "test", "--root", folder, "--match-path", OWNER, "--json"],
            cwd=dest, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        print(result.stderr, end="", file=sys.stderr)
        print(result.stdout, end="", flush=True)
        result.check_returncode()
        suites = json.loads(result.stdout)
        actual = {}
        for suite in suites.values():
            for signature, item in suite["test_results"].items():
                name = signature.split("(")[0]
                if name in actual or item["status"] != "Success":
                    raise RuntimeError("Duplicate or nonpassing test: " + name)
                actual[name] = item
        if set(actual) != EXPECTED:
            raise RuntimeError("Incomplete economic test inventory: " + repr(sorted(set(actual) ^ EXPECTED)))
        runs = actual["testFuzzNonExactFeeNeverChangesEconomics"]["kind"]["Fuzz"]["runs"]
        if runs != 50000:
            raise RuntimeError("Unexpected fuzz run count: " + str(runs))
        for name, digest in hashes.items():
            if hashlib.sha256((dest / name).read_bytes()).hexdigest() != digest:
                raise RuntimeError("Executed staged source drift: " + name)
        print(json.dumps({"head": head, "tests_passed": len(actual), "tests_failed": 0, "tests_skipped": 0,
                          "fuzz_runs": runs, "templates": 8, "creation_fee_native": "42",
                          "passed_test_names": sorted(actual)}, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
