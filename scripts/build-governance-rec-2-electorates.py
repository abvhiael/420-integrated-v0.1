#!/usr/bin/env python3
"""Deterministic GOV-REC-2 equal-weight electorate and sorted-pair Merkle proof builder.

Fixture data is never valid Genesis evidence. Real eligibility records require independently
verified, immutable provenance; this utility verifies their shape, not external truth.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

MASK = (1 << 64) - 1
ROUNDS = (
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A,
    0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
    0x8000000080008081, 0x8000000000008009, 0x000000000000008A,
    0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
    0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
    0x000000000000800A, 0x800000008000000A, 0x8000000080008081,
    0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
)
ROTATIONS = (
    (0, 36, 3, 41, 18), (1, 44, 10, 45, 2), (62, 6, 43, 15, 61),
    (28, 55, 25, 21, 56), (27, 20, 39, 8, 14),
)
ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")
HASH = re.compile(r"0x[0-9a-fA-F]{64}\Z")


def _rot(value, shift):
    return ((value << shift) | (value >> (64 - shift))) & MASK if shift else value


def keccak(data: bytes) -> bytes:
    """Ethereum Keccak-256, not NIST SHA3-256 (different padding)."""
    state = [0] * 25
    rate = 136
    payload = bytearray(data)
    payload.append(1)
    while len(payload) % rate != rate - 1:
        payload.append(0)
    payload.append(0x80)
    for offset in range(0, len(payload), rate):
        block = payload[offset:offset + rate]
        for i in range(rate // 8):
            state[i] ^= int.from_bytes(block[i * 8:i * 8 + 8], "little")
        for constant in ROUNDS:
            c = [state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20] for x in range(5)]
            d = [c[(x - 1) % 5] ^ _rot(c[(x + 1) % 5], 1) for x in range(5)]
            for x in range(5):
                for y in range(5):
                    state[x + 5 * y] ^= d[x]
            b = [0] * 25
            for x in range(5):
                for y in range(5):
                    b[y + 5 * ((2 * x + 3 * y) % 5)] = _rot(state[x + 5 * y], ROTATIONS[x][y])
            for x in range(5):
                for y in range(5):
                    state[x + 5 * y] = b[x + 5 * y] ^ (
                        (~b[(x + 1) % 5 + 5 * y]) & b[(x + 2) % 5 + 5 * y]
                    )
            state[0] ^= constant
    return b"".join(x.to_bytes(8, "little") for x in state)[:32]


def leaf(address: str) -> bytes:
    return keccak(bytes.fromhex(address[2:]).rjust(32, b"\x00"))


def parent(a: bytes, b: bytes) -> bytes:
    return keccak(min(a, b) + max(a, b))


def merkle(members: list[str]):
    """Numerically sorted addresses, sorted-pair inner hashes; odd nodes promoted."""
    values = [leaf(address) for address in members]
    levels = [values]
    while len(levels[-1]) > 1:
        old = levels[-1]
        levels.append([
            parent(old[i], old[i + 1]) if i + 1 < len(old) else old[i]
            for i in range(0, len(old), 2)
        ])
    root = levels[-1][0]
    proofs = {}
    for index, address in enumerate(members):
        siblings = []
        for level in levels[:-1]:
            sibling = index ^ 1
            if sibling < len(level):
                siblings.append("0x" + level[sibling].hex())
            index //= 2
        proofs[address] = siblings
    return root, proofs


def verify(root: bytes, address: str, proof: list[str]) -> bool:
    computed = leaf(address)
    for sibling in proof:
        computed = parent(computed, bytes.fromhex(sibling[2:]))
    return computed == root


def make_vectors(source: dict) -> dict:
    if source.get("schema") != "420-civic-electorate-input-v1":
        raise ValueError("unexpected electorate input schema")
    if type(source.get("fixtureOnly")) is not bool:
        raise ValueError("fixtureOnly must explicitly distinguish synthetic evidence")
    chain = source.get("chainId")
    if type(chain) is not int or chain <= 0:
        raise ValueError("missing positive chain identity")
    houses = source.get("houses")
    if not isinstance(houses, dict) or set(houses) != {"COMMUNITY", "VALIDATOR"}:
        raise ValueError("exact COMMUNITY and VALIDATOR houses are required")
    if not source["fixtureOnly"]:
        origin = source.get("eligibilitySource")
        if (
            not isinstance(origin, dict) or not origin.get("reference")
            or not HASH.fullmatch(str(origin.get("snapshotHash", "")))
        ):
            raise ValueError("missing independently verifiable release eligibility-source reference and snapshot hash")
    output = {
        "schema": "420-civic-electorate-vectors-v1",
        "chainId": chain,
        "fixtureOnly": source["fixtureOnly"],
        "sourceSchema": source["schema"],
        "sourceDigestSha256": "0x" + hashlib.sha256(
            json.dumps(source, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        "houses": {},
    }
    for house in ("COMMUNITY", "VALIDATOR"):
        section = houses[house]
        if not isinstance(section, dict) or not isinstance(section.get("members"), list):
            raise ValueError(f"{house}: members list required")
        members = section["members"]
        if not members:
            raise ValueError(f"{house}: empty electorate")
        total = section.get("totalWeight")
        if type(total) is not int or total != len(members):
            raise ValueError(f"{house}: totalWeight must equal unique member count")
        addresses = []
        for member in members:
            if not isinstance(member, dict) or not ADDRESS.fullmatch(str(member.get("address", ""))):
                raise ValueError(f"{house}: malformed member address")
            address = member["address"].lower()
            if address == "0x" + "0" * 40:
                raise ValueError(f"{house}: zero member address")
            evidence = member.get("evidence")
            if not isinstance(evidence, dict) or not evidence.get("reference"):
                raise ValueError(f"{house}: missing member eligibility evidence reference")
            if not source["fixtureOnly"]:
                if evidence.get("eligible") is not True or not HASH.fullmatch(str(evidence.get("recordHash", ""))):
                    raise ValueError(f"{house}: unverified eligibility evidence")
            addresses.append(address)
        if len(set(addresses)) != len(addresses):
            raise ValueError(f"{house}: duplicate eligible address")
        addresses.sort(key=lambda a: int(a, 16))
        root, proofs = merkle(addresses)
        if root == bytes(32):
            raise ValueError(f"{house}: zero Merkle root")
        expected = section.get("expectedRoot")
        if expected is not None and (
            not HASH.fullmatch(str(expected)) or expected.lower() != "0x" + root.hex()
        ):
            raise ValueError(f"{house}: committed Merkle root mismatch")
        for address in addresses:
            if not verify(root, address, proofs[address]):
                raise ValueError(f"{house}: invalid generated Merkle proof")
        output["houses"][house] = {
            "root": "0x" + root.hex(),
            "totalWeight": len(addresses),
            "members": [{"address": address, "proof": proofs[address]} for address in addresses],
        }
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--check", action="store_true", help="fail on mismatch without editing the file")
    args = parser.parse_args()
    vectors = make_vectors(json.loads(args.input.read_text(encoding="utf-8")))
    rendered = json.dumps(vectors, sort_keys=True, indent=2) + "\n"
    if args.check:
        if not args.output.is_file() or args.output.read_text(encoding="utf-8") != rendered:
            raise SystemExit("GOV_REC_2_VECTORS=DRIFT")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    print("GOV_REC_2_VECTORS=PASS")


if __name__ == "__main__":
    main()
