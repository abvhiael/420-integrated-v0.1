#!/usr/bin/env python3
"""GOV-PRE-03: reconcile the approved limits with Treasury Solidity and Genesis source.

This does NOT certify live funding, signed founders, Vault grants, a deployed release
executor or an on-chain recipient receipt.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contracts/src/treasury/FoundingTreasuryAuthority420.sol"
POLICY = ROOT / "contracts/config/treasury/founding-financial-policy-provisional.json"
LEDGER = ROOT / "config/genesis-allocations.json"
RELEASE = ROOT / "contracts/config/founding-genesis-integration-v1.json"
EXPECTED = {
    "OPERATIONS_ALLOCATION": 4_200_000,
    "CONTINGENCY_ALLOCATION": 840_000,
    "ROUTINE_MAX": 105_000,
    "EXCEPTIONAL_MAX": 420_000,
    "CONTINGENCY_INCIDENT_MAX": 210_000,
    "OPERATIONS_30_DAY_MAX": 840_000,
    "CONTINGENCY_30_DAY_MAX": 420_000,
}


def check(condition, msg):
    if not condition:
        raise ValueError(msg)


def verify(root=ROOT):
    root = Path(root)
    code = (root / SOURCE.relative_to(ROOT)).read_text()
    policy = json.loads((root / POLICY.relative_to(ROOT)).read_text())
    ledger = json.loads((root / LEDGER.relative_to(ROOT)).read_text())
    integration = json.loads((root / RELEASE.relative_to(ROOT)).read_text())
    declared = {name: int(amount.replace("_", "")) for name, amount in re.findall(
        r"uint128 public constant ([A-Z_0-9]+)\s*=\s*([0-9_]+) ether;", code
    )}
    check(all(declared.get(k) == v for k, v in EXPECTED.items()),
          "native founding approval/rolling/incident limits drifted in Solidity")
    check(re.search(r"uint256 public constant ROLLING_DAYS\s*=\s*30;", code) is not None,
          "rolling founding time window changed")
    check(re.search(r"uint64 public constant EXCEPTIONAL_NOTICE\s*=\s*48 hours;", code) is not None,
          "mandatory 48-hour public notice changed")
    ops, cont, en = policy["operations"], policy["contingency"], policy["enforcement"]
    check(policy["token"] == "420" and policy["modeledGenesisSupply"] == "42000000",
          "native supply or denomination changed")
    for key, lhs, rhs in (
        ("operations/allocation", ops["allocation"], EXPECTED["OPERATIONS_ALLOCATION"]),
        ("operations/routine", ops["singleRoutineLimit"], EXPECTED["ROUTINE_MAX"]),
        ("operations/exceptional", ops["exceptionalLimit"], EXPECTED["EXCEPTIONAL_MAX"]),
        ("operations/month", ops["rolling30DayLimit"], EXPECTED["OPERATIONS_30_DAY_MAX"]),
        ("contingency/allocation", cont["allocation"], EXPECTED["CONTINGENCY_ALLOCATION"]),
        ("contingency/incident", cont["singleIncidentLimit"], EXPECTED["CONTINGENCY_INCIDENT_MAX"]),
        ("contingency/month", cont["rolling30DayLimit"], EXPECTED["CONTINGENCY_30_DAY_MAX"]),
        ("contingency/split incident", en["contingencyIncidentCumulative420"],
         EXPECTED["CONTINGENCY_INCIDENT_MAX"]),
    ):
        check(int(lhs) == rhs, key + " policy mismatch")
    check(ops["exceptionalNoticeHours"] == 48 and
          cont["approval"] == "any two distinct founders; three founders to waive 48-hour notice",
          "approved founder notice/threshold configuration changed")
    check(set(cont["eligiblePurposes"]) ==
          {"infrastructure", "application_recovery", "security"},
          "contingency may fund ineligible purpose")
    check(en["routinePaymentMustBeInitiatedAndReleasedBy"] == "FOUNDING_ADMINISTRATOR" and
          en["exceptionalApproval"] == "ANY_TWO_DISTINCT_VERIFIED_FOUNDERS" and
          en["contingencyEmergencyFastTrack"] == "ALL_THREE_VERIFIED_FOUNDERS",
          "approved three-level authorization not reflected")
    check(en["immutableReleaseExecutorBinding"] ==
          "GENESIS_CONFIGURATOR_ONE_SHOT_REVIEWED_RUNTIME_CODEHASH" and
          en["foundingMarkExecutedRequiresActiveControllerRelease"] and
          en["treasuryDisbursementExactGrantRequired"] and
          en["vaultRouteExactGrantRequired"] and
          en["uniqueDisbursementPerPayment"],
          "required exact capability/unique payment guard not reflected")
    check("PENDING_GENESIS_V4" in policy["status"] and
          en["releaseExecutorDeployment"] == "NOT_BOUND_NOT_FUNDED" and
          en["releaseExecutorAddress"] is None and
          en["releaseExecutorRuntimeCodeHash"] is None and not en["liveVaultsFunded"],
          "pre-testnet configuration falsely claims deployed funded Treasury")
    check(not integration["budget"]["allThreeFunded"] and
          not integration["budget"]["supplyReconciled"],
          "pre-testnet Treasury funding release flags were prematurely enabled")
    reserve = next(x for x in ledger["allocations"] if x["id"] == "protocol-reserve")
    split = reserve["earmarks_420"]
    check(reserve["amount_420"] == 8_600_000 and
          split["founding_operations"] == EXPECTED["OPERATIONS_ALLOCATION"] and
          split["founding_contingency"] == EXPECTED["CONTINGENCY_ALLOCATION"] and
          split["unearmarked_protocol_reserve"] == 3_560_000 and
          sum(x["amount_420"] for x in ledger["allocations"]) == 42_000_000,
          "Genesis earmarks have become an additional mint or unapproved reserve debit")
    return {"status": "PASS_CODE_CANDIDATE_ONLY", "genesis_420": 42_000_000,
            "operations_420": 4_200_000, "contingency_420": 840_000,
            "limits_420": {key: EXPECTED[key] for key in EXPECTED},
            "live_payment_receipts_proven": False}


if __name__ == "__main__":
    try:
        print(json.dumps(verify(), sort_keys=True))
    except (ValueError, KeyError, TypeError, OSError) as exc:
        raise SystemExit(f"GOV-PRE-03 policy FAIL-CLOSED: {exc}")
