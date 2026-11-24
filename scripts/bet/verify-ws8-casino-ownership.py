#!/usr/bin/env python3
"""Bind actual ownership regression executions and relevant source digests to the candidate."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path)
parser.add_argument("--write", action="store_true")
args = parser.parse_args()
root = args.directory
sha = os.environ["EXPECTED_SHA"]
assert subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() == sha
assert not subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=no"], text=True).strip()

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def suite(path, name):
    found = [s["test_results"] for key,s in json.loads(path.read_text()).items() if key.split(":")[-1] == name]
    assert len(found) == 1 and found[0]
    assert all(t["status"] == "Success" for t in found[0].values())
    return found[0]

capital_raw = root / "results.json"
sports_raw = root / "sports-ownership-results.json"
capital = suite(capital_raw, "BetGenesisCapitalization420Test")
sports = suite(sports_raw, "SportsFundedTickets420Test")
mandatory = {
    "BetGenesisCapitalization420Test": ["testCasinoOwnedSettlementRecognizesOnlySafeSurplus()"],
    "SportsFundedTickets420Test": [
        "testCanonicalCasinoOperatorOwnsFundedMarketGain()",
        "testCanonicalCasinoOperatorOwnsFundedMarketLoss()",
        "testCasinoOperatorBindingRejectedAfterExternalFunding()",
        "testProfitAdapterExcludesOperatorOwnedGainAndDonation()",
        "testAccountingInvariantAcrossAdmissionWinAndClaim()",
        "testTwoMarketsShareTokenWithoutDoubleCountingCollateral()",
    ],
}
for name, tests in mandatory.items():
    executed = capital if name == "BetGenesisCapitalization420Test" else sports
    assert all(executed[test]["status"] == "Success" for test in tests)
repo = Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())
sources = [
    "contracts/src/bet/BetIds420.sol",
    "contracts/src/bet/BetOperatorRegistry420.sol",
    "contracts/src/bet/BankrollVault420.sol",
    "contracts/src/bet/BetGenesisCapitalization420.sol",
    "contracts/src/bet/BetProfitAccounting420.sol",
    "contracts/src/bet/BetCustodyProfitEpochSources420.sol",
    "contracts/src/bet/sports/SportsFundedTickets420.sol",
    "contracts/test/BetGenesisCapitalization420.t.sol",
    "contracts/test/sports-5d4/SportsFundedTickets420.t.sol",
]
report = {
    "qualifiedSHA": sha,
    "trackedWorkingTreeDirty": False,
    "mandatoryTests": mandatory,
    "suiteCounts": {"BetGenesisCapitalization420Test": len(capital), "SportsFundedTickets420Test": len(sports)},
    "rawSHA256": {"results.json": digest(capital_raw), "sports-ownership-results.json": digest(sports_raw)},
    "sourceSHA256": {p: digest(repo / p) for p in sources},
}
out = root / "casino-ownership-execution.json"
if args.write:
    out.write_text(json.dumps(report, indent=2) + "\n")
else:
    assert json.loads(out.read_text()) == report
print("Exact-candidate casino ownership evidence verified:", sha, report["suiteCounts"])
