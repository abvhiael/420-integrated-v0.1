#!/usr/bin/env python3
"""Independently verify actual native admission, stat proofs, points, ranking and settlement."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from eth_abi import encode, decode
from eth_keys import keys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "clients/420bet-fantasy"))
from nhl import (FIELDS, STATS_ABI, k256, context, decrypt_lineup, commitment, receipt_digest,
                 stat_leaf, points, payouts)


def only(items, label):
    if len(items) != 1:
        raise ValueError(f"expected one {label}, got {len(items)}")
    return items[0]


def replay(text):
    ctx = only([line for line in text.splitlines() if "emit QualificationContext(" in line], "execution context")
    hashes = re.findall(r"0x[0-9a-fA-F]{64}\b", ctx)
    addresses = re.findall(r"0x[0-9a-fA-F]{40}\b", ctx)
    pool, slate, game = [bytes.fromhex(h[2:]) for h in hashes]
    engine, controller = addresses
    chain = int(re.search(r"chainId: (\d+)", ctx)[1])
    created = only(re.findall(r"emit PoolCreated\(pool: (0x[0-9a-f]+), slate: (0x[0-9a-f]+), manifest: (0x[0-9a-f]+), paid: true, fee: (\d+), prize: 0\)", text, re.I), "paid pool")
    assert created[0].lower() == "0x" + pool.hex()
    manifest = bytes.fromhex(created[2][2:])
    entry_fee = int(created[3])
    fixture = json.loads((ROOT / "clients/420bet-fantasy/fixtures/encrypted-lineups.json").read_text())
    encrypted = re.findall(r"emit EntryAccepted\(pool: (0x[0-9a-f]+), entry: (\d+), subject: (0x[0-9a-f]+), nonce: (\d+), commitment: (0x[0-9a-f]+), envelope: (0x[0-9a-f]+)\)", text, re.I)
    receipts = re.findall(r"FantasyAdmission420::verifyReceipt\((0x[0-9a-f]+), (0x[0-9a-f]+), (0x[0-9a-f]+), (\d+), 317, (0x[0-9a-f]+)\)", text, re.I)
    assert len(encrypted) == len(receipts) == 3
    lineups = {}
    validator = keys.PrivateKey(bytes.fromhex("00" * 29 + "aabbcc")).public_key
    for entry, receipt in zip(encrypted, receipts):
        _, index, subject_hex, nonce, committed_hex, ciphertext_hex = entry
        index, nonce = int(index), int(nonce)
        subject = bytes.fromhex(subject_hex[2:])
        ciphertext = bytes.fromhex(ciphertext_hex[2:])
        lineup, salt = decrypt_lineup(bytes.fromhex(fixture["keyDER"]), ciphertext, context(pool, subject, nonce))
        committed = commitment(chain, engine, pool, subject, nonce, lineup, salt)
        assert committed.hex() == committed_hex[2:].lower() == receipt[4][2:].lower()
        user_key = k256(encode(["bytes32", "bytes32"], [k256(b"verified-issuer"), k256(encode(["string", "uint8"], ["person", index]))]))
        digest = receipt_digest(chain, engine, pool, manifest, subject, user_key, committed, nonce, int(receipt[3]), ciphertext)
        assert digest.hex() == receipt[1][2:].lower()
        sig = bytes.fromhex(receipt[2][2:])
        assert sig[-1] in (27, 28)
        recovered = keys.Signature(sig[:-1] + bytes([sig[-1] - 27])).recover_public_key_from_msg_hash(digest)
        assert recovered == validator
        lineups[index] = lineup
    calculations = re.findall(r"FantasyNHLScoring420::calculate\([^\n]+?, (0x[0-9a-f]{64}), (\d+), (0x[0-9a-f]{64}), \[([^\]]+)\], (0x[0-9a-f]+)\) \[staticcall\]", text, re.I)
    assert len(calculations) == 3
    scores = {}
    stat_root = None
    proof_count = 0
    for index, (slate_hex, revision, root_hex, lineup_text, witnesses) in enumerate(calculations, 1):
        assert bytes.fromhex(slate_hex[2:]) == slate and int(revision) == 1
        lineup = [int(i.strip()) for i in lineup_text.split(",")]
        assert lineup == lineups[index]
        raw_stats, proofs = decode([STATS_ABI + "[7]", "bytes32[][7]"], bytes.fromhex(witnesses[2:]))
        root = bytes.fromhex(root_hex[2:])
        if stat_root is not None:
            assert root == stat_root
        stat_root = root
        score = 0
        for slot, (athlete, raw, proof) in enumerate(zip(lineup, raw_stats, proofs)):
            stat = dict(zip(FIELDS, raw))
            value = stat_leaf(slate, 1, athlete, game, stat)
            for sibling in proof:
                value = k256(min(value, sibling) + max(value, sibling))
            assert value == root
            score += points(stat, goalie=slot == 5)
            proof_count += 1
        scores[index] = score
    emitted_scores = {int(index): int(value) for index, value in re.findall(r"emit EntryScored\(pool: 0x[0-9a-f]+, revision: 1, entry: (\d+), score: (-?\d+)\)", text, re.I)}
    assert emitted_scores == scores
    policy_hex = only(re.findall(r"FantasyPayoutPolicy420::register\(0x[0-9a-f]+, 0, (0x[0-9a-f]+)\)", text, re.I), "frozen payout policy")
    rows = decode(["(uint64,uint64,uint16[])[]"], bytes.fromhex(policy_hex[2:]))[0]
    weights = only([list(row[2]) for row in rows if row[0] <= len(scores) <= row[1]], "applicable payout band")
    allocated, fee, order = payouts(scores, entry_fee * len(scores), weights)
    actual = {int(index): int(amount) for index, amount in re.findall(r"emit Credited\(pool: 0x[0-9a-f]+, entry: (\d+), beneficiary: [^,]+, amount: (\d+)\)", text, re.I)}
    assert actual == allocated
    settled = only(re.findall(r"emit PoolSettled\(pool: 0x[0-9a-f]+, candidate: (0x[0-9a-f]+), prize: (\d+), development: (\d+)\)", text, re.I), "canonical settlement")
    prize = entry_fee * len(scores) - fee
    assert int(settled[1]) == prize and int(settled[2]) == fee
    fund_line=only([line for line in text.splitlines() if "emit QualificationFund(" in line],"canonical fund context")
    fund_addresses=re.findall(r"0x[0-9a-fA-F]{40}\b",fund_line)
    assert len(fund_addresses)==2
    fund_beneficiary=fund_addresses[1]
    forwarded=re.findall(r"emit Withdrawn\(beneficiary: (0x[0-9a-fA-F]{40}), amount: (\d+)\)",text)
    assert len(forwarded)==1 and forwarded[0][0].lower()==fund_beneficiary.lower() and int(forwarded[0][1])==fee
    domain = k256(b"420.FANTASY.RANKING.V1")
    rank_hash = k256(encode(["bytes32", "bytes32", "uint64", "uint64"], [domain, pool, 1, len(scores)]))
    payout_hash = k256(encode(["bytes32", "bytes32", "uint64", "uint256", "uint16[]"], [domain, pool, 1, prize, weights]))
    for index in order:
        rank_hash = k256(encode(["bytes32", "uint64", "int256"], [rank_hash, index, scores[index]]))
    for index in sorted(allocated):
        payout_hash = k256(encode(["bytes32", "uint64", "uint256"], [payout_hash, index, allocated[index]]))
    ranking_root = k256(encode(["bytes32", "bytes32", "uint64", "uint64", "uint256", "bytes32", "bytes32"],
                              [domain, pool, 1, len(scores), prize, rank_hash, payout_hash]))
    candidates = re.findall(r"Candidate\(\{ statRoot: (0x[0-9a-f]+), rankingRoot: (0x[0-9a-f]+), evidence: (0x[0-9a-f]+), dataAsOf: (\d+)[^,]*, revision: (\d+)[^}]*\}\)", text, re.I)
    # Foundry renders struct names with braces; fail closed if its trace schema changes.
    if not candidates:
        candidates = re.findall(r"Candidate\(\{\s*statRoot: (0x[0-9a-f]+), rankingRoot: (0x[0-9a-f]+), evidence: (0x[0-9a-f]+), dataAsOf: (\d+)[^,]*, revision: (\d+)[^}]*\}\)", text, re.I)
    assert candidates
    for c in candidates:
        assert c[0][2:].lower() == stat_root.hex() and c[1][2:].lower() == ranking_root.hex() and int(c[4]) == 1
    c = candidates[-1]
    candidate_tuple = (stat_root, ranking_root, bytes.fromhex(c[2][2:]), int(c[3]), 1)
    final_digest = k256(encode(["bytes32", "uint256", "address", "bytes32", "address", "bytes32", "bytes32", "bytes32", "(bytes32,bytes32,bytes32,uint64,uint64)"],
                              [k256(b"420.BET.FANTASY.DISPUTE.V1"), chain, controller, pool, engine, manifest,
                               k256(b"420.FANTASY.NHL.OFFICIAL_SPORTRADAR_SPORTSDATAIO.CUTOFF.V1"),
                               k256(b"420.FANTASY.NHL.DAILY.PICK6_INSPIRED.V1"), candidate_tuple]))
    assert final_digest.hex() == settled[0][2:].lower()
    return {"pool": "0x" + pool.hex(), "engine": engine, "controller": controller,
            "entryCount": len(scores), "receiptSignaturesVerified": 3, "encryptedLineupsDecrypted": 3,
            "statMerkleProofsVerified": proof_count, "scoresTenths": scores, "payoutsBaseUnits": allocated,
            "developmentBaseUnits": fee,"developmentBeneficiary":fund_beneficiary,"developmentTransferredBaseUnits":fee,
            "rankingRoot": "0x" + ranking_root.hex(),
            "candidate": "0x" + final_digest.hex(), "source": "actual Foundry execution; deterministic NHL-shaped fixture statistics, not licensed/live NHL data"}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("trace")
    p.add_argument("output")
    args = p.parse_args()
    data = Path(args.trace).read_bytes()
    report = replay(data.decode("utf-8-sig"))
    report["traceSHA256"] = hashlib.sha256(data).hexdigest()
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
