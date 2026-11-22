#!/usr/bin/env python3
"""GOV-PRE-01 negative tests: counterfeit Genesis issuance or reserve earmarks fail closed."""
import copy
import importlib.util
import json
import shutil
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "gov_pre_01_verify", ROOT / "scripts/verify-genesis-supply-reconciliation.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

FILES = (
    "config/genesis-allocations.json",
    "config/protocol.json",
    "contracts/config/treasury/founding-financial-policy-provisional.json",
    "contracts/config/founding-genesis-integration-v1.json",
    "contracts/config/founder-wallet-reservations.json",
    "contracts/config/system-addresses.json",
    "testnet/genesis/genesis-allocations.json",
    "contracts/config/genesis-config-commitment.json",
)


def fixture():
    temporary = tempfile.TemporaryDirectory()
    root = Path(temporary.name)
    for file in FILES:
        output = root / file
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / file, output)
    return temporary, root


def mutate(root, file, fn):
    path = root / file
    value = json.loads(path.read_text())
    fn(value)
    path.write_text(json.dumps(value, indent=2) + "\n")


def negative(label, file, fn, expected):
    temp, root = fixture()
    try:
        mutate(root, file, fn)
        try:
            MODULE.verify(root)
        except (ValueError, KeyError, TypeError, AttributeError) as exc:
            assert expected.lower() in str(exc).lower(), (label, str(exc))
        else:
            raise AssertionError(label + " unexpectedly passed supply reconciliation")
    finally:
        temp.cleanup()


def entry(data, key):
    return next(a for a in data["allocations"] if a["id"] == key)


def main():
    baseline = MODULE.verify(ROOT)
    assert baseline["status"] == "PASS_CANDIDATE_ONLY"
    assert baseline["genesis_420"] == 42_000_000
    assert baseline["additional_issuance_420"] == 0
    cases = [
        ("extra Genesis mint", FILES[0],
         lambda d: d["allocations"].append({
            "id": "founding-operations-new-mint", "amount_420": 4_200_000,
            "amount_kief": str(4_200_000*10**18), "destination": None}),
         "possible double count"),
        ("duplicate zero-value identifier", FILES[0],
         lambda d: d["allocations"].append(dict(d["allocations"][0], amount_420=0, amount_kief="0")),
         "duplicate canonical"),
        ("silently inflate protocol reserve", FILES[0],
         lambda d: entry(d, "protocol-reserve").update(amount_420=13_640_000),
         "Genesis token sum"),
        ("independent remainder drift", FILES[0],
         lambda d: entry(d, "protocol-reserve")["earmarks_420"].update(unearmarked_protocol_reserve=8_600_000),
         "unearmarked reserve drift"),
        ("founding operations internal double spend", FILES[0],
         lambda d: entry(d, "protocol-reserve")["earmarks_420"].update(founding_operations=8_400_000),
         "Operations earmark drift"),
        ("unfrozen reserve redirection", FILES[0],
         lambda d: entry(d, "protocol-reserve").update(destination="0x" + "0"*36 + "0425"),
         "frozen destination"),
        ("wrong wei unit", FILES[0],
         lambda d: entry(d, "protocol-reserve").update(amount_kief="8600000"),
         "kief sum"),
        ("mismatched authority funding", FILES[2],
         lambda d: d["genesisFunding"].update(sourceAllocationId="community-validator-credit-reserve"),
         "Treasury policy funding source"),
        ("contradictory normalized source", FILES[1],
         lambda d: d["genesis"]["founding_financial_source_420"].update(remaining_unearmarked_420=8_600_000),
         "protocol normative Genesis financing"),
        ("false vault funding report", FILES[3],
         lambda d: d["budget"].update(allThreeFunded=True),
         "unfunded/unapproved"),
        ("fake fourth founder", FILES[4],
         lambda d: d["founders"].append(copy.deepcopy(d["founders"][2])),
         "legacy ten-founder"),
        ("frozen address repurpose", FILES[5],
         lambda d: next(x for x in d["assignments"] if x["name"] == "ProtocolReserve").update(
             address="0x" + "0"*36 + "0420"),
         "frozen ProtocolReserve"),
        ("historical Genesis overwritten", FILES[6],
         lambda d: entry(d, "founder-vesting").update(amount_420=500_000),
         "historical frozen testnet"),
        ("stale V3 marked V4 without ceremony", FILES[7],
         lambda d: d.update(status="FROZEN_V4"),
         "frozen V3"),
        ("old founder amount overcommitted", FILES[0],
         lambda d: entry(d, "founder-admin-liquid").update(amount_420=500_000),
         "Genesis token sum"),
    ]
    for label, file, change, expected in cases:
        negative(label, file, change, expected)
    print(f"GOV-PRE-01: baseline PASS; {len(cases)} adversarial mutations rejected; no V3 release claim")


if __name__ == "__main__":
    main()
