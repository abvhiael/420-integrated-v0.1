#!/usr/bin/env python3
"""GOV-PRE-01: reconcile the single canonical 42m Genesis ledger and non-additive founding earmarks.

The frozen V3 network bundle is historical; this validator verifies the amended working
ledger without pretending that a V4 Genesis commitment or Treasury Vault funding exists.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNIT = 10**18
SUPPLY = 42_000_000
RESERVE = 8_600_000
OPERATIONS = 4_200_000
CONTINGENCY = 840_000
REMAINDER = RESERVE - OPERATIONS - CONTINGENCY
ADDRESSES = {
    "founder-vesting": "0427",
    "validator-bootstrap-reserve": "042e",
    "attention-bootstrap": "0421",
    "development-bootstrap": "0422",
    "community-validator-credit-reserve": "0425",
    "community-testnet-reward-reserve": "0426",
    "public-distribution-genesis-tranche": "042a",
    "public-distribution-day180-tranche": "042a",
    "public-distribution-day365-tranche": "042a",
    "protocol-reserve": "0424",
}
EXPECTED = {
    "founder-vesting": 500_000,
    "founder-admin-liquid": 250_000,
    "founder-andrew-liquid": 125_000,
    "founder-janet-liquid": 125_000,
    "validator-bootstrap-reserve": 3_000_000,
    "attention-bootstrap": 4_200_000,
    "development-bootstrap": 4_200_000,
    "community-validator-credit-reserve": 6_300_000,
    "community-testnet-reward-reserve": 2_100_000,
    "public-distribution-genesis-tranche": 4_200_000,
    "public-distribution-day180-tranche": 4_200_000,
    "public-distribution-day365-tranche": 4_200_000,
    "protocol-reserve": RESERVE,
}
SOURCE = "protocol-reserve"
SOURCE_ADDRESS = "0x" + "0"*36 + "0424"
ROLES = ("FOUNDING_ADMINISTRATOR", "ANDREW", "JANET")


def check(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def load(root: Path, name: str) -> dict:
    return json.loads((root / name).read_text(encoding="utf-8"))


def integer(value, context: str) -> int:
    check(type(value) is int and value >= 0, f"{context} must be a nonnegative integer")
    return value


def verify(root: Path = ROOT) -> dict:
    ledger = load(root, "config/genesis-allocations.json")
    policy = load(root, "contracts/config/treasury/founding-financial-policy-provisional.json")
    integration = load(root, "contracts/config/founding-genesis-integration-v1.json")
    protocol = load(root, "config/protocol.json")
    wallets = load(root, "contracts/config/founder-wallet-reservations.json")
    system = load(root, "contracts/config/system-addresses.json")
    historical = load(root, "testnet/genesis/genesis-allocations.json")
    frozen = load(root, "contracts/config/genesis-config-commitment.json")

    check(ledger["schema"] == "420-integrated-genesis-allocations-v1", "unexpected ledger schema")
    check(ledger["genesis_supply_420"] == SUPPLY, "Genesis token supply changed")
    check(ledger["genesis_supply_kief"] == str(SUPPLY * UNIT), "Genesis kief supply changed")
    rows = ledger["allocations"]
    ids = [row["id"] for row in rows]
    check(len(ids) == len(set(ids)), "duplicate canonical Genesis allocation ID")
    check(set(ids) == set(EXPECTED), "missing, extra or duplicated Genesis allocation (possible double count)")
    check(len(rows) == len(EXPECTED), "duplicate/extra Genesis allocation")
    check(sum(integer(r["amount_420"], r["id"]) for r in rows) == SUPPLY,
          "Genesis token sum not conserved")
    check(sum(int(r["amount_kief"]) for r in rows) == SUPPLY * UNIT,
          "Genesis kief sum not conserved")
    by_id = {row["id"]: row for row in rows}
    bindings = {item["name"]: item["address"].lower() for item in system["assignments"]}
    check(len(bindings) == len(system["assignments"]), "duplicate system contract binding")
    check(bindings["ProtocolReserve"] == SOURCE_ADDRESS, "frozen ProtocolReserve predeploy changed")
    check(bindings["CommunityValidatorReserve"] == "0x" + "0"*36 + "0425",
          "validator credit reserve address changed")
    check(bindings["CommunityRewardReserve"] == "0x" + "0"*36 + "0426",
          "community reward reserve address changed")
    check(bindings["FounderVestingRegistry"] == "0x" + "0"*36 + "0427",
          "founder vesting predeploy changed")
    for row in rows:
        key = row["id"]
        check(integer(row["amount_420"], key) == EXPECTED[key], f"{key} amount changed")
        check(row["amount_kief"] == str(EXPECTED[key] * UNIT), f"{key} token/kief mismatch")
        if key in ADDRESSES:
            addr = "0x" + "0"*36 + ADDRESSES[key]
            check(row["destination"].lower() == addr, f"{key} frozen destination changed")
        else:
            check(row["destination"] is None and
                  row["destination_source"] == "contracts/config/founder-wallet-reservations.json" and
                  row["status"] == "AWAITING_ADDRESS_SIGNATURE",
                  f"{key} has unverified personal wallet destination")

    # An earmark is a subdivision of the existing 8.6m protocol-reserve entry,
    # NOT another allocation and NOT a claim that either Vault has received funds.
    parent = by_id[SOURCE]
    split = parent.get("earmarks_420")
    check(isinstance(split, dict) and set(split) == {
        "founding_operations", "founding_contingency", "unearmarked_protocol_reserve"
    }, "missing or extraneous ProtocolReserve purpose earmarks")
    check(split["founding_operations"] == OPERATIONS, "Operations earmark drift")
    check(split["founding_contingency"] == CONTINGENCY, "Contingency earmark drift")
    check(split["unearmarked_protocol_reserve"] == REMAINDER, "unearmarked reserve drift")
    check(sum(integer(x, k) for k, x in split.items()) == parent["amount_420"],
          "ProtocolReserve earmarks exceed/underfund single Genesis source")
    check(parent["earmark_treatment"] == "NON_ADDITIVE_WITHIN_PROTOCOL_RESERVE_UNFUNDED_VAULTS",
          "Genesis earmarks improperly represented as separate mint/funded Vaults")

    check(by_id["community-validator-credit-reserve"]["amount_420"] +
          by_id["community-testnet-reward-reserve"]["amount_420"] == 8_400_000,
          "Community/Testnet 8.4m allocation drift")
    check(sum(by_id[k]["amount_420"] for k in (
        "public-distribution-genesis-tranche", "public-distribution-day180-tranche",
        "public-distribution-day365-tranche")) == 12_600_000,
          "three public tranches altered")
    check(sum(by_id[k]["amount_420"] for k in (
        "founder-vesting", "founder-admin-liquid", "founder-andrew-liquid",
        "founder-janet-liquid")) == 1_000_000, "founders total changed")
    check(by_id["founder-vesting"]["founder_roles"] == list(ROLES),
          "three-founder vesting roster changed")
    founders = wallets["founders"]
    check(len(founders) == 3 and [f["role"] for f in founders] == list(ROLES),
          "legacy ten-founder roster or changed ordering")
    check([f["genesis_total_420"] for f in founders] == [500_000, 250_000, 250_000],
          "founder 50/25/25 allocation drift")
    check([f["genesis_locked_420"] for f in founders] == [250_000, 125_000, 125_000],
          "founder vesting amounts drift")
    check([f["genesis_liquid_420"] for f in founders] == [250_000, 125_000, 125_000],
          "founder liquid amounts drift")

    funding = policy["genesisFunding"]
    check(funding == {
        "sourceAllocationId": SOURCE,
        "sourcePredeploy": SOURCE_ADDRESS,
        "sourceTotal420": RESERVE,
        "foundingOperationsEarmark420": OPERATIONS,
        "contingencyEarmark420": CONTINGENCY,
        "unearmarkedProtocolReserve420": REMAINDER,
        "treatment": "NON_ADDITIVE_WITHIN_PROTOCOL_RESERVE_UNFUNDED_VAULTS",
    }, "Treasury policy funding source disagrees with canonical ledger")
    check(policy["modeledGenesisSupply"] == str(SUPPLY) and
          policy["operations"]["allocation"] == str(OPERATIONS) and
          policy["contingency"]["allocation"] == str(CONTINGENCY),
          "Treasury budget/supply disagreement")
    budget = integration["budget"]
    check(integration["genesis"]["modeledTotalSupply"] == str(SUPPLY) and
          budget["operationsTokens"] == str(OPERATIONS) and
          budget["contingencyTokens"] == str(CONTINGENCY) and
          budget["fundingSourceAllocationId"] == SOURCE and
          budget["fundingSourcePredeploy"] == SOURCE_ADDRESS and
          budget["unearmarkedProtocolReserveTokens"] == str(REMAINDER) and
          budget["ledgerEarmarksReconciled"] is True,
          "Founding Genesis release manifest funding reconciliation disagrees")
    check(budget["allThreeFunded"] is False and budget["supplyReconciled"] is False,
          "unfunded/unapproved Genesis Vaults represented as live settled balances")
    g = protocol["genesis"]
    check(g["modeled_total_genesis_supply_420"] == SUPPLY, "normative modeled supply drift")
    check(g["community_testnet_distribution_420"] == 8_400_000,
          "normative Community/Testnet allocation drift")
    check(g["founders_core_contributors"]["wallet_count"] == 3 and
          g["founders_core_contributors"]["total_allocation_420"] == 1_000_000,
          "normative founder allocation drift")
    check(g["founding_financial_source_420"] == {
        "source_allocation_id": SOURCE,
        "source_address": SOURCE_ADDRESS,
        "source_total_420": RESERVE,
        "operations_earmark_420": OPERATIONS,
        "contingency_earmark_420": CONTINGENCY,
        "remaining_unearmarked_420": REMAINDER,
        "additional_genesis_issuance_420": 0,
        "vaults_funded_at_genesis": False,
    }, "protocol normative Genesis financing disagrees")

    # The old frozen output is immutable historical evidence, not a second
    # source of current allocations or a release-authorized V4 candidate.
    check(frozen["status"] == "FROZEN_V3", "frozen V3 commitment changed without ceremony")
    historical_rows = historical["allocations"]
    check(sum(int(x["amount_kief"]) for x in historical_rows) == SUPPLY * UNIT,
          "historical frozen testnet bundle not conserved")
    check(next(x["amount_420"] for x in historical_rows if x["id"] == "founder-vesting")
          == 1_000_000, "historical V3 bundle overwritten with candidate allocations")
    check(ledger["status"] == "FOUNDING_THREE_AMENDMENT_PENDING_V4_RECOMMIT",
          "working ledger incorrectly marked frozen or released")
    return {
        "status": "PASS_CANDIDATE_ONLY",
        "genesis_420": SUPPLY,
        "distinct_genesis_entries": len(rows),
        "founding_operations_420": OPERATIONS,
        "founding_contingency_420": CONTINGENCY,
        "unearmarked_protocol_reserve_420": REMAINDER,
        "additional_issuance_420": 0,
        "v4_genesis_approved": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.root), sort_keys=True))
    except (ValueError, TypeError, KeyError, AttributeError, OSError) as exc:
        parser.exit(1, f"GOV-PRE-01 FAIL-CLOSED: {exc}\n")
