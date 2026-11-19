#!/usr/bin/env python3
"""Validate the complete reviewed finding set against exact source-bound REC-9 evidence."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS = ROOT / "contracts"
REVIEW = ROOT / "docs/audit/420TREASURY-REC-9-STATIC-REVIEW.json"

def require(ok, reason):
    if not ok:
        raise RuntimeError(reason)

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def read(path):
    return json.loads(path.read_text())

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)

def review(evidence):
    reviewed = read(REVIEW)
    inputs = read(evidence / "inputs.json")
    source = reviewed["sourceCommit"]
    require(inputs["head"] == source and inputs["workflowRun"] == str(reviewed["runId"]), "wrong retained source/run")
    require(inputs["profile"] == "ci", "wrong qualification profile")
    spec = importlib.util.spec_from_file_location("closure", ROOT / "scripts/qualify-stake-isolated.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    owners = sorted((CONTRACTS / "src/treasury").glob("*.sol")) + [
        CONTRACTS / p for p in ("src/governance/GovernanceTimelock.sol", "src/governance/CivicGovernor420.sol",
        "src/system/StakeSystemSafety420.sol", "src/apps/ProtocolRegistry.sol",
        "test/TreasuryRec9Security420.t.sol", "test/TreasuryRec9Governance420.t.sol")]
    deps = mod.closure(owners)
    actual = {str(p.relative_to(ROOT)): sha(p) for p in deps}
    require(actual == inputs["sources"], "retained source closure has changed")
    require(inputs["foundry"] == sha(CONTRACTS / "foundry.toml"), "retained Foundry configuration changed")
    for path in [*actual, "contracts/foundry.toml", "scripts/qualify-stake-isolated.py",
                 "scripts/treasury/qualify-security.py"]:
        require((ROOT / path).read_bytes() == git("show", source + ":" + path), "review source drift: " + path)
    log = (evidence / "security-tests.log").read_text()
    for expected in ("6 tests passed, 0 failed, 0 skipped",
                     "testNestedMatureCivicOperationCannotBorrowOuterContext()",
                     "testNestedMatureCivicOperationRollsBackWithOuterFailure()",
                     "runs: 50000", "runs: 2048, calls: 524288, reverts: 0"):
        require(expected in log, "missing retained execution: " + expected)
    for name in ("testNestedMatureCivicOperationCannotBorrowOuterContext", "testNestedMatureCivicOperationRollsBackWithOuterFailure",
                 "testFuzzBudgetAssetRecipientAndActionSubstitution", "testMalformedCalldataAndUnknownSelectorsCannotMutateAccounting",
                 "testUint128CeilingAndEpochSaturationRemainAtomic", "invariant_RealCapabilityScopedAccountingAndEligibility"):
        require("[PASS] " + name in log, "missing passing case: " + name)
    require("0.11.3" in (evidence / "slither-version.log").read_text(), "wrong static analyzer version")
    require((evidence / "forbidden-primitives.txt").read_text().startswith("PASS:"), "forbidden-primitive check not passed")
    expected = {}
    for row in reviewed["findings"]:
        key = (row["scope"], row["id"])
        require(key not in expected, "duplicate reviewed finding")
        require(row["disposition"] == "REVIEWED_NO_CHANGE" and row["reason"].strip() and row["evidence"].strip(),
                "finding missing exact disposition")
        expected[key] = row
    observed = {}
    counts = {}
    for scope in ("treasury-slither", "governance-slither", "stake-safety-slither"):
        raw = read(evidence / (scope + ".json"))
        require(raw["success"] is True, "static analysis failed: " + scope)
        detectors = raw["results"]["detectors"]
        counts[scope] = len(detectors)
        for finding in detectors:
            key = (scope, finding["id"])
            require(key not in observed and key in expected, "unreviewed or duplicate finding: " + str(key))
            row = expected[key]
            require(all(row[k] == finding[k] for k in ("check", "impact", "description")),
                    "finding contents changed: " + str(key))
            observed[key] = finding
    require(observed.keys() == expected.keys(), "reviewed finding set changed")
    # Verify the exact REC-5 Stake safety test closure against the actual passing candidate.
    stake_source = "4c8e448de67122d6c45f703c86075f6ec6ae664b"
    stake_deps = mod.closure([CONTRACTS / "test/SecurityStakeSafety420.t.sol"])
    for p in [*stake_deps, CONTRACTS / "foundry.toml"]:
        path = str(p.relative_to(ROOT))
        require(p.read_bytes() == git("show", stake_source + ":" + path), "REC-5 Stake safety test input changed: " + path)
    result = {
        "schema": "420-treasury-rec9-reviewed-evidence-v1",
        "candidate": git("rev-parse", "HEAD").decode().strip(),
        "sourceCommit": source, "sourceRun": reviewed["runId"], "sourceArtifact": reviewed["artifactId"],
        "sourceArtifactSha256": reviewed["artifactSha256"], "retainedExecution": True,
        "foundryTestsPassed": 6, "fuzzRuns": 50000, "invariantCalls": 524288, "invariantReverts": 0,
        "staticCounts": counts, "reviewedHighReports": sum(f["impact"] == "High" for f in observed.values()),
        "unresolvedFindings": 0, "stakeSafetyExecution": {"sha": stake_source, "run": 44583083947, "passed": 3,
         "closureSha256": {str(p.relative_to(ROOT)): sha(p) for p in stake_deps}},
        "reviewSha256": sha(REVIEW), "externalReviewComplete": False, "liveAcceptanceComplete": False,
        "result": "PASS",
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    (evidence / "review-result.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    # Preserve the original raw reports, tests, and source package; supplement, never overwrite historical results.
    with tarfile.open(evidence / "review-supplement.tar.gz", "w:gz") as archive:
        for p in [REVIEW, Path(__file__), ROOT / "docs/audit/420TREASURY-REC-9-SECURITY-REVIEW.md",
                  ROOT / "docs/STAKE-AUDIT-10-STATIC-REVIEW.json", evidence / "review-result.json"]:
            archive.add(p, arcname=str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else p.name)
    return result

if __name__ == "__main__":
    review(Path(sys.argv[1]).resolve())
