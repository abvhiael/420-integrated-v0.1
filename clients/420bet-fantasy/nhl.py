"""Versioned NHL reference calculations and real encrypted-lineup transport.

No network calls, provider credentials or fabricated oracle acceptance. Applications
must obtain licensed evidence and capability-authorized validation separately.
"""
import json
from fractions import Fraction
from Crypto.PublicKey import ECC
from Crypto.Protocol.DH import key_agreement, import_x25519_public_key
from Crypto.Protocol.KDF import HKDF
from Crypto.Hash import SHA256, keccak
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from eth_abi import encode
from eth_keys import keys


def k256(value):
    h = keccak.new(digest_bits=256)
    h.update(value)
    return h.digest()


DOMAIN = k256(b"420.FANTASY.CONTEST.V1")
STAT_DOMAIN = k256(b"420.FANTASY.NHL.STAT_LEAF.V1")
TRANSPORT = b"420-FANTASY-LINEUP-V1"
FIELDS = ("goals", "assists", "shots", "blocks", "shorthanded", "shootout", "saves", "goalsAgainst",
          "win", "shutout", "overtimeLoss", "played", "complete", "entireGame", "soleGoalie")
STATS_ABI = "(" + ",".join(["uint16"] * 8 + ["bool"] * 7) + ")"


def context(pool, subject, nonce):
    if len(pool) != 32 or len(subject) != 32 or not 0 < nonce < 2**64:
        raise ValueError("invalid context")
    return TRANSPORT + pool + subject + nonce.to_bytes(8, "big")


def encrypt_lineup(public_key, lineup, salt, aad):
    if len(lineup) != 7 or len(set(lineup)) != 7 or any(type(i) is not int or not 0 < i < 2**32 for i in lineup) or len(salt) != 32:
        raise ValueError("seven distinct athlete IDs and a 32-byte salt required")
    ephemeral = ECC.generate(curve="Curve25519")
    shared = key_agreement(eph_priv=ephemeral, static_pub=import_x25519_public_key(public_key),
                           kdf=lambda z: HKDF(z, 32, k256(aad), SHA256, context=TRANSPORT))
    nonce = get_random_bytes(12)
    cipher = AES.new(shared, AES.MODE_GCM, nonce=nonce, mac_len=16)
    cipher.update(aad)
    plaintext = encode(["uint32[7]", "bytes32"], [lineup, salt])
    ciphertext, tag = cipher.encrypt_and_digest(plaintext)
    return b"\x01" + ephemeral.public_key().export_key(format="raw") + nonce + ciphertext + tag


def decrypt_lineup(private_key, envelope, aad):
    from eth_abi import decode
    if len(envelope) != 317 or envelope[0] != 1:
        raise ValueError("invalid envelope version or length")
    key = ECC.import_key(private_key)
    shared = key_agreement(static_priv=key, eph_pub=import_x25519_public_key(envelope[1:33]),
                           kdf=lambda z: HKDF(z, 32, k256(aad), SHA256, context=TRANSPORT))
    cipher = AES.new(shared, AES.MODE_GCM, nonce=envelope[33:45], mac_len=16)
    cipher.update(aad)
    plaintext = cipher.decrypt_and_verify(envelope[45:-16], envelope[-16:])
    lineup, salt = decode(["uint32[7]", "bytes32"], plaintext)
    return list(lineup), salt


def commitment(chain, engine, pool, subject, nonce, lineup, salt):
    return k256(encode(["bytes32", "uint256", "address", "bytes32", "bytes32", "uint64", "uint32[7]", "bytes32"],
                       [DOMAIN, chain, engine, pool, subject, nonce, lineup, salt]))


def receipt_digest(chain, engine, pool, manifest, subject, user_key, committed, nonce, expiry, envelope):
    return k256(encode(["bytes32", "uint256", "address", "bytes32", "bytes32", "bytes32", "bytes32", "bytes32", "uint64", "uint64", "bytes32"],
                       [DOMAIN, chain, engine, pool, manifest, subject, user_key, committed, nonce, expiry, k256(envelope)]))


def validate_lineup(lineup, roster):
    if len(lineup) != 7 or len(set(lineup)) != 7:
        raise ValueError("duplicate or missing player")
    for athlete, mask in zip(lineup, (1, 2, 4, 8, 8, 16, 15)):
        if athlete not in roster or not roster[athlete]["positions"] & mask:
            raise ValueError("position mismatch")


def validate_and_sign(private_key, encryption_private_key, envelope, chain, engine, pool, manifest,
                      subject, user_key, nonce, expiry, roster, committed, custodian_key_hash):
    """Custodian: decrypt and validate actual committed roster before signing admission.

    Caller must first verify chain manifest, active user credential, lock, invitation
    and validator capability. Return no plaintext in a public pre-lock response.
    Persist the decrypted roster/salt securely for mandatory post-lock publication.
    """
    if k256(ECC.import_key(encryption_private_key).public_key().export_key(format="raw")) != custodian_key_hash:
        raise ValueError("custodian key does not match the published slate")
    lineup, salt = decrypt_lineup(encryption_private_key, envelope, context(pool, subject, nonce))
    validate_lineup(lineup, roster)
    if commitment(chain, engine, pool, subject, nonce, lineup, salt) != committed:
        raise ValueError("ciphertext does not match committed lineup")
    digest = receipt_digest(chain, engine, pool, manifest, subject, user_key, committed, nonce, expiry, envelope)
    sig = keys.PrivateKey(private_key).sign_msg_hash(digest)
    # Solidity ecrecover convention, not personal_sign's additional message prefix.
    return sig.r.to_bytes(32, "big") + sig.s.to_bytes(32, "big") + bytes([sig.v + 27])


def checked_stats(stats, goalie=False):
    if set(stats) != set(FIELDS):
        raise ValueError("missing, null or unexpected stat field")
    for field in FIELDS[:8]:
        if type(stats[field]) is not int or not 0 <= stats[field] < 65536:
            raise ValueError("invalid statistic")
    for field in FIELDS[8:]:
        if type(stats[field]) is not bool:
            raise ValueError("invalid stat flag")
    s = stats
    if not s["complete"] or s["goals"] > s["shots"] or s["shorthanded"] > s["goals"] + s["assists"] or (s["win"] and s["overtimeLoss"]) or (s["shutout"] and s["goalsAgainst"]):
        raise ValueError("inconsistent statistics")
    if not goalie and any(s[f] for f in ("saves", "goalsAgainst", "win", "shutout", "overtimeLoss", "entireGame", "soleGoalie")):
        raise ValueError("goalie stats on a skater")
    if s["shutout"] != bool(goalie and s["played"] and s["entireGame"] and s["soleGoalie"] and s["goalsAgainst"] == 0):
        raise ValueError("invalid shutout eligibility")
    if not s["played"] and any(s[f] for f in FIELDS if f not in ("played", "complete")):
        raise ValueError("non-participant has statistics")
    return s


def points(stats, goalie=False):
    s = checked_stats(stats, goalie)
    if not s["played"]:
        return 0
    value = sum(s[f] * w for f, w in zip(FIELDS[:6], (85, 50, 15, 13, 20, 15)))
    value += 30 * sum((s["goals"] >= 3, s["shots"] >= 5, s["blocks"] >= 3, s["goals"] + s["assists"] >= 3))
    if goalie:
        value += s["saves"] * 7 - s["goalsAgainst"] * 35 + 60 * s["win"] + 40 * s["shutout"] + 20 * s["overtimeLoss"] + 30 * (s["saves"] >= 35)
    return value


def stat_leaf(slate, revision, athlete, game, stats):
    return k256(k256(encode(["bytes32", "bytes32", "uint64", "uint32", "bytes32", STATS_ABI],
                            [STAT_DOMAIN, slate, revision, athlete, game, [stats[f] for f in FIELDS]])))


def merkle(leaves):
    if not leaves:
        raise ValueError("empty statistic set")
    layers = [list(leaves)]
    while len(layers[-1]) > 1:
        layer = layers[-1]
        if len(layer) % 2:
            layer = layer + [layer[-1]]
        layers.append([k256(min(a, b) + max(a, b)) for a, b in zip(layer[::2], layer[1::2])])
    proofs = []
    for index in range(len(leaves)):
        path = []
        for layer in layers[:-1]:
            neighbor = index ^ 1
            path.append(layer[neighbor] if neighbor < len(layer) else layer[index])
            index //= 2
        proofs.append(path)
    return layers[-1][0], proofs


def payouts(scores, gross, weights, paid=True):
    """Independent exact-rational ranking/entitlements. Entry IDs are positive integers."""
    if len(scores) < 2 or gross < 0:
        raise ValueError("invalid funded pool")
    fee = gross * 3 // 100 if paid else 0
    prize = gross - fee
    if len(scores) == 2:
        weights = [10000]
    if sum(weights) != 10000 or len(weights) > len(scores) or any(w < 0 for w in weights):
        raise ValueError("invalid payout schedule")
    order = sorted(scores, key=lambda entry: (-scores[entry], entry))
    exact = {}
    start = 0
    while start < len(order):
        end = start + 1
        while end < len(order) and scores[order[end]] == scores[order[start]]:
            end += 1
        amount = Fraction(prize * sum(weights[start:end]), 10000 * (end - start))
        exact.update((entry, amount) for entry in order[start:end])
        start = end
    allocated = {entry: value.numerator // value.denominator for entry, value in exact.items()}
    residual = prize - sum(allocated.values())
    for entry in sorted(entry for entry, value in exact.items() if value.denominator != 1)[:residual]:
        allocated[entry] += 1
    assert sum(allocated.values()) + fee == gross
    return allocated, fee, order


def select_source(snapshots, cutoff, required_athletes, allow_secondary=False):
    """Select one complete snapshot; never average or opportunistically mix fields.

    Inputs are already authenticated licensed captures. This function does not
    authenticate a provider or turn a local fixture into a live observation.
    """
    for source in ("NHL_OFFICIAL", "SPORTRADAR", "SPORTSDATAIO"):
        if source == "SPORTSDATAIO" and not allow_secondary:
            break
        candidates = [s for s in snapshots if s["source"] == source and s["availableAt"] <= cutoff
                      and s["valid"] and set(s["athletes"]) == set(required_athletes)]
        if not candidates:
            continue
        newest = max(s["revision"] for s in candidates)
        latest = [s for s in candidates if s["revision"] == newest]
        normalized = {json.dumps(s["athletes"], sort_keys=True, separators=(",", ":")) for s in latest}
        if len(normalized) != 1:
            raise ValueError("conflicting highest-priority evidence")
        return latest[0]
    raise ValueError("no complete authoritative snapshot before cutoff")
