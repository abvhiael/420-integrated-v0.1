#!/usr/bin/env python3
"""Fail closed unless actual machine-readable test execution covers WS8."""
import json
import subprocess
import sys
from pathlib import Path

REQUIRED = (
    "testLegitimateFundedHandSettlement", "testColludingDealers",
    "testForgedRecipient", "testCiphertextSubstitution", "testRevokedKeys",
    "testCrossHandReplay", "testPrematureReveal", "testSelectiveWithholding",
    "testDisputeAbuse", "testDoubleSettlement", "testReentrancy",
)
if len(sys.argv) != 4:
    raise SystemExit("usage: verify-ws8-execution.py foundry|go execution.json report.json")
kind, source, output = sys.argv[1:]
root = Path(__file__).resolve().parents[2]
sha = subprocess.check_output(["git", "-c", "safe.directory=" + root.as_posix(), "rev-parse", "HEAD"], cwd=root, text=True).strip()
dirty = subprocess.run(["git", "-c", "safe.directory=" + root.as_posix(), "diff", "--quiet", "HEAD"], cwd=root).returncode != 0
report = {"qualifiedSHA": None if dirty else sha, "sourceCommit": sha, "trackedWorkingTreeDirty": dirty, "executionKind": kind}
if kind == "foundry":
    data = json.loads(Path(source).read_text(encoding="utf-8"))
    owners = [v for k, v in data.items() if k.endswith(":BetPokerIntegratedFundedAdversarial54Test")]
    if len(owners) != 1:
        raise SystemExit("missing actual funded-hand test owner")
    tests = owners[0]["test_results"]
    actual = {name.split("(")[0]: result for name, result in tests.items()}
    for name in REQUIRED:
        if name not in actual or actual[name]["status"] != "Success":
            raise SystemExit("mandatory executed test failed/missing/skipped: " + name)
    all_tests = {k + ":" + n: r for k, v in data.items() for n, r in v["test_results"].items()}
    if not all_tests or any(r["status"] != "Success" for r in all_tests.values()):
        raise SystemExit("an inherited or mandatory scoped test failed/skipped")
    report.update(mandatoryTests={n: actual[n]["status"] for n in REQUIRED}, totalPassed=len(all_tests))
elif kind == "go":
    events = [json.loads(line) for line in Path(source).read_text(encoding="utf-8").splitlines() if line.strip()]
    target = "TestWS8CommittedCryptographicEvidence"
    relevant = [e for e in events if e.get("Test") == target]
    if not any(e["Action"] == "pass" for e in relevant) or any(e["Action"] in {"fail", "skip"} for e in events):
        raise SystemExit("actual cryptographic owner did not pass")
    count = sum("verified committed genuine proof " in e.get("Output", "") for e in relevant)
    if count != 41:
        raise SystemExit("actual cryptographic verification did not cover 41 proofs")
    report.update(test=target, genuineProofsVerified=count)
else:
    raise SystemExit("unknown execution kind")
Path(output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report))
