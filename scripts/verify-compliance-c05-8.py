#!/usr/bin/env python3
"""C05.8 targeted Oracle suitability and ABI-ownership guard."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
read = lambda p: (root / p).read_text(encoding="utf-8")
runtime = read("contracts/src/interfaces/IOracle420.sol")
genesis = read("contracts/src/interfaces/genesis/IOracle420.sol")
source = read("contracts/src/interfaces/IOracleSourceAdapter420.sol")
authority = read("docs/apps/oracle/index.md")
review = read("docs/compliance/C05.8-ORACLE-SUITABILITY.md")
roadmap = read("docs/compliance/420COMPLIANCE-ROADMAP.md")
def require(ok, reason):
    if not ok:
        raise SystemExit("C05.8 FAIL: " + reason)

require("C05.8 | Oracle integration suitability review" in roadmap, "canonical step missing")
require(all(re.search(r"function\\s+" + fn + r"\\s*\\(", runtime) for fn in ("readNumeric", "readResult")), "runtime Oracle ABI drift")
require(not re.search(r"function\\s+(price|isFresh|isSafe)\\s*\\(", runtime), "frozen ABI imported into runtime")
require(all(re.search(r"function\\s+" + fn + r"\\s*\\(", genesis) for fn in ("price", "isFresh", "isSafe")), "frozen Genesis ABI changed")
require(all(re.search(r"function\\s+" + fn + r"\\s*\\(", source) for fn in ("readNumeric", "readResult")), "source adapter read-only ABI changed")
require("420/service/oracle/v1" in authority and "reporting-only authority" in authority, "Oracle registry/reporting authority drift")
require("NO ORACLE ADAPTER REQUIRED" in review and "reporting-only authority" in review and "readNumeric(bytes32)" in review and "readResult(bytes32)" in review, "incomplete C05.8 decision")
require("not be silently substituted" in review and "Never" in review, "runtime/frozen or legal authority split undocumented")
require(all(k in review for k in ("C05.2", "C05.3", "C05.6", "C05.7", "C09.5", "C08.5")), "source/consumer or deferral absent")
print("C05.8 Oracle suitability and runtime/frozen ABI authority: PASS")
