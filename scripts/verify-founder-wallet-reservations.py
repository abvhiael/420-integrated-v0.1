#!/usr/bin/env python3
"""Structural and optionally cryptographic founder wallet reservation verification.

This script validates the three separate public founder addresses and, in strict
Genesis mode, EIP-191 personal_sign proof for the *specific* Genesis commitment.
No private key, seed or password is imported or handled.
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
SIG = re.compile(r"^0x[0-9a-fA-F]{130}$")


def challenge(m, founder):
    return "\n".join((
        "420Integrated Founder Wallet Reservation v1",
        f"Network: {m['target_network']}",
        f"Chain ID: {m['modeled_chain_id']}",
        f"Genesis commitment: {m['planned_genesis_hash'].lower()}",
        f"Founder role: {founder['role']}",
        f"Wallet: {founder['wallet_address'].lower()}",
        "Purpose: prove personal control for a named founding role; not a transaction or token approval",
    ))


def validate(strict=False, print_challenges=False):
    m = json.loads(MANIFEST.read_text())
    a = json.loads(CANON.read_text())
    d = json.loads(DISCOVERY.read_text())
    assert m["schema"] == "420-founder-wallet-reservations-v1"
    assert a["founder_wallet_reservations"] == "contracts/config/founder-wallet-reservations.json"
    assert d["founder_wallet_reservations"] == "contracts/config/founder-wallet-reservations.json"
    assert len(m["founders"]) == 3
    for catalog in (a,d):
        assert len(catalog["founder_wallet_slots"]) == 3
    assignments = {x["address"].lower() for x in a["assignments"]}
    found = set()
    if strict:
        assert m["target_network"] in ("mainnet","testnet")
        assert type(m["modeled_chain_id"]) is int and m["modeled_chain_id"] > 0
        assert HASH.fullmatch(m["planned_genesis_hash"])
    for i, member in enumerate(m["founders"]):
        assert member["role"] == ROLES[i], f"unexpected role at {i}"
        assert member["developer_compensation_bps"] == BPS[i], f"unexpected split at {i}"
        for catalog in (a,d):
            slot = catalog["founder_wallet_slots"][i]
            assert slot["role"] == ROLES[i] and slot["compensation_bps"] == BPS[i]
            assert slot["address"] == member["wallet_address"]
        wallet = member["wallet_address"]
        if wallet is None:
            assert member["ownership_status"] == "UNCLAIMED"
            assert member["claim_tx"] is None and member["claim_block_hash"] is None
            if strict: raise ValueError(f"{ROLES[i]} founder wallet not supplied")
            continue
        assert ADDRESS.fullmatch(wallet), f"invalid {ROLES[i]} address"
        key = wallet.lower()
        assert int(key[2:], 16) not in range(0x41f, 0x500), "reserved system address"
        assert key != "0x" + "0" * 40 and key != "0x" + "f" * 38 + "fe", "system address"
        assert key not in assignments, "address reused from system contracts"
        assert key not in found, "duplicate founder wallet address"
        found.add(key)
        if strict:
            proof = member["pre_genesis_proof"]
            assert proof["method"] == "EIP191_PERSONAL_SIGN"
            assert HASH.fullmatch(proof["genesis_plan_commitment"])
            assert proof["genesis_plan_commitment"].lower() == m["planned_genesis_hash"].lower()
            assert SIG.fullmatch(proof["signature"])
            from eth_account import Account
            from eth_account.messages import encode_defunct
            actual = Account.recover_message(
                encode_defunct(text=challenge(m, member)), signature=proof["signature"]
            )
            assert actual.lower() == key, f"invalid personal_sign proof for {member['role']}"
            assert member["ownership_status"] in ("PREGENESIS_SIGNATURE_VERIFIED","CLAIMED_AND_VERIFIED")
        if print_challenges and m["target_network"] and m["planned_genesis_hash"]:
            print("\n=== " + member["role"] + " ===\n" + challenge(m, member))
    if strict:
        assert len(found) == 3
    return len(found)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-deployment", action="store_true")
    parser.add_argument("--print-challenges", action="store_true")
    opts = parser.parse_args()
    try:
        n = validate(opts.require_deployment, opts.print_challenges)
    except (AssertionError, KeyError, ValueError, TypeError, ImportError) as e:
        print(f"founder wallet reservation: FAIL-CLOSED: {e}", file=sys.stderr)
        raise SystemExit(1)
    print(f"founder wallet reservation structure valid; {n}/3 public addresses populated; "
          f"{'EIP-191 verified for Genesis' if opts.require_deployment else 'proof not verified in structure-only mode'}")
