#!/usr/bin/env python3
"""Validate founder wallet reservations. --require-deployment fails closed when not enrolled.

Structural validation is NOT cryptographic verification of public claim txs.
The actual deployment gate must also check successful canonical on-chain claims
or authenticate a plan/chain-bound wallet signature before enabling authority.
"""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "contracts/config/founder-wallet-reservations.json"
CANON = ROOT / "contracts/config/system-addresses.json"
DISCOVERY = ROOT / "contracts/config/genesis-canonical-addresses.json"
ROLES = ("FOUNDING_ADMINISTRATOR", "ANDREW", "JANET")
BPS = (5000, 2500, 2500)
ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")
HASH = re.compile(r"^0x[0-9a-fA-F]{64}$")


def validate(strict=False):
    m = json.loads(MANIFEST.read_text())
    a = json.loads(CANON.read_text())
    d = json.loads(DISCOVERY.read_text())
    assert m["schema"] == "420-founder-wallet-reservations-v1"
    assert a["founder_wallet_reservations"] == "contracts/config/founder-wallet-reservations.json"
    assert d["founder_wallet_reservations"] == "contracts/config/founder-wallet-reservations.json"
    assert len(m["founders"]) == 3
    assignments = {v["address"].lower() for v in a["assignments"]}
    found = set()
    for i, member in enumerate(m["founders"]):
        assert member["role"] == ROLES[i], f"unexpected role at {i}"
        assert member["developer_compensation_bps"] == BPS[i], f"unexpected split at {i}"
        wallet = member["wallet_address"]
        if wallet is None:
            assert member["ownership_status"] == "UNCLAIMED"
            assert member["claim_tx"] is None and member["claim_block_hash"] is None
            if strict:
                raise ValueError(f"{ROLES[i]} founder wallet unassigned")
            continue
        assert ADDRESS.fullmatch(wallet), f"invalid {ROLES[i]} address"
        key = wallet.lower()
        assert int(key[2:], 16) not in range(0x41f, 0x500), "reserved system address"
        assert key != "0x" + "0" * 40 and key != "0x" + "f" * 38 + "fe", "system address"
        assert key not in assignments, "address reused from system contracts"
        assert key not in found, "duplicated founder wallet"
        found.add(key)
        if strict:
            assert member["ownership_status"] == "CLAIMED_AND_VERIFIED"
            assert HASH.fullmatch(member["claim_tx"])
            assert HASH.fullmatch(member["claim_block_hash"])
    if strict:
        assert len(found) == 3
        assert HASH.fullmatch(m["planned_genesis_hash"])
        assert ADDRESS.fullmatch(m["claim_contract"]["address"])
        assert ADDRESS.fullmatch(m["developer_compensation_splitter"]["address"])
    return len(found)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-deployment", action="store_true")
    opts = parser.parse_args()
    try:
        n = validate(opts.require_deployment)
    except (AssertionError, KeyError, ValueError, TypeError) as e:
        print(f"founder wallet reservation: FAIL-CLOSED: {e}", file=sys.stderr)
        raise SystemExit(1)
    print(f"founder wallet reservation structure valid; {n}/3 public addresses populated, live-proof status: NOT VERIFIED BY THIS SCRIPT")
