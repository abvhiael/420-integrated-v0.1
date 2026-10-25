import json
from pathlib import Path
import random
import unittest
from Crypto.PublicKey import ECC
from eth_keys import keys
from nhl import (FIELDS, k256, context, encrypt_lineup, decrypt_lineup, commitment, receipt_digest,
                 validate_lineup, validate_and_sign, points, merkle, stat_leaf, payouts, select_source)


def stats(**changes):
    value = dict.fromkeys(FIELDS[:8], 0)
    value.update(dict.fromkeys(FIELDS[8:], False))
    value.update(played=True, complete=True)
    value.update(changes)
    return value


class NHLFrameworkTest(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads((Path(__file__).parent / "fixtures/encrypted-lineups.json").read_text())
        self.row = self.fixture["rows"][0]
        self.private = bytes.fromhex(self.fixture["keyDER"])
        self.public = bytes.fromhex(self.fixture["publicKey"])
        self.pool = bytes.fromhex(self.fixture["pool"])
        self.subject = bytes.fromhex(self.row["subject"])
        self.aad = context(self.pool, self.subject, 1)
        self.roster = {i: {"positions": mask} for i, mask in zip(range(1, 8), (1, 2, 4, 8, 8, 16, 1))}

    def test_all_native_envelopes_are_real_authenticated_ciphertexts(self):
        for row in self.fixture["rows"]:
            with self.subTest(who=row["who"], nonce=row["nonce"]):
                actual = decrypt_lineup(self.private, bytes.fromhex(row["envelope"]), context(self.pool, bytes.fromhex(row["subject"]), row["nonce"]))
                self.assertEqual(actual, (row["lineup"], bytes.fromhex(row["salt"])))

    def test_fresh_encryption_is_randomized_and_round_trips(self):
        salt = bytes.fromhex(self.row["salt"])
        first = encrypt_lineup(self.public, self.row["lineup"], salt, self.aad)
        second = encrypt_lineup(self.public, self.row["lineup"], salt, self.aad)
        self.assertNotEqual(first, second)
        self.assertEqual(decrypt_lineup(self.private, first, self.aad), (self.row["lineup"], salt))

    def test_ciphertext_modification_fails_authentication(self):
        envelope = bytearray.fromhex(self.row["envelope"])
        envelope[70] ^= 1
        with self.assertRaises(ValueError):
            decrypt_lineup(self.private, bytes(envelope), self.aad)

    def test_cross_pool_or_nonce_decryption_fails(self):
        for aad in (context(k256(b"other"), self.subject, 1), context(self.pool, self.subject, 2)):
            with self.assertRaises(ValueError):
                decrypt_lineup(self.private, bytes.fromhex(self.row["envelope"]), aad)

    def test_wrong_private_key_cannot_decrypt(self):
        with self.assertRaises(ValueError):
            decrypt_lineup(ECC.generate(curve="Curve25519").export_key(format="DER"), bytes.fromhex(self.row["envelope"]), self.aad)

    def test_custodian_signs_only_decrypted_legal_committed_lineup(self):
        chain = 420
        engine = "0x" + "12" * 20
        manifest = k256(b"manifest")
        user_key = k256(b"verified-user")
        salt = bytes.fromhex(self.row["salt"])
        committed = commitment(chain, engine, self.pool, self.subject, 1, self.row["lineup"], salt)
        private = bytes.fromhex("00" * 29 + "aabbcc")
        envelope = bytes.fromhex(self.row["envelope"])
        signature = validate_and_sign(private, self.private, envelope, chain, engine, self.pool, manifest,
                                      self.subject, user_key, 1, 2000, self.roster, committed, k256(self.public))
        digest = receipt_digest(chain, engine, self.pool, manifest, self.subject, user_key, committed, 1, 2000, envelope)
        recovered = keys.Signature(signature[:-1] + bytes([signature[-1] - 27])).recover_public_key_from_msg_hash(digest)
        self.assertEqual(recovered, keys.PrivateKey(private).public_key)
        with self.assertRaises(ValueError):
            validate_and_sign(private, self.private, envelope, chain, engine, self.pool, manifest,
                              self.subject, user_key, 1, 2000, self.roster, k256(b"forged"), k256(self.public))
        with self.assertRaises(ValueError):
            validate_and_sign(private, self.private, envelope, chain, engine, self.pool, manifest,
                              self.subject, user_key, 1, 2000, self.roster, committed, k256(b"wrong-custodian"))

    def test_position_and_duplicate_rejections(self):
        validate_lineup(self.row["lineup"], self.roster)
        for lineup in ([1, 2, 3, 4, 5, 6, 6], [2, 1, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 7, 6]):
            with self.assertRaises(ValueError):
                validate_lineup(lineup, self.roster)

    def test_approved_scoring_examples(self):
        self.assertEqual(points(stats(goals=3, assists=1, shots=5, blocks=3, shorthanded=1)), 559)
        self.assertEqual(points(stats(win=True, saves=36, goalsAgainst=2), True), 272)
        self.assertEqual(points(stats(win=True, saves=36, shutout=True, entireGame=True, soleGoalie=True), True), 382)

    def test_bonus_stacking_once_and_shootout_separate(self):
        self.assertEqual(points(stats(shots=10, blocks=6)), 150 + 78 + 60)
        self.assertEqual(points(stats(shootout=3)), 45)
        self.assertEqual(points(stats(goals=1, shots=1, shorthanded=1)), 120)

    def test_negative_goalie_and_verified_non_participation(self):
        self.assertEqual(points(stats(goalsAgainst=8), True), -280)
        self.assertEqual(points(stats(played=False)), 0)
        with self.assertRaises(ValueError):
            points(stats(played=False, shots=1))

    def test_missing_null_or_inconsistent_stats_are_not_zero(self):
        samples = [stats(complete=False), stats(shots=None), stats(shorthanded=1), stats(goals=2, shots=1),
                   stats(saves=1), stats(win=True, overtimeLoss=True)]
        missing = stats()
        del missing["blocks"]
        samples.append(missing)
        for sample in samples:
            with self.assertRaises(ValueError):
                points(sample)

    def test_all_merkle_proofs_and_tampering(self):
        leaves = [stat_leaf(k256(b"slate"), 1, i, k256(b"game"), stats(shots=i)) for i in range(1, 22)]
        root, proofs = merkle(leaves)
        for leaf, proof in zip(leaves, proofs):
            for sibling in proof:
                leaf = k256(min(leaf, sibling) + max(leaf, sibling))
            self.assertEqual(leaf, root)
        modified = stat_leaf(k256(b"slate"), 2, 1, k256(b"game"), stats(shots=1))
        for sibling in proofs[0]:
            modified = k256(min(modified, sibling) + max(modified, sibling))
        self.assertNotEqual(modified, root)

    def test_two_entries_override_and_ties(self):
        self.assertEqual(payouts({1: 10, 2: 0}, 200, [6000, 4000]), ({1: 194, 2: 0}, 6, [1, 2]))
        self.assertEqual(payouts({1: 10, 2: 10}, 3, [10000], False)[0], {1: 2, 2: 1})

    def test_tie_crossing_paid_cutoff_and_residual_order(self):
        allocation, fee, _ = payouts({1: 10, 2: 0, 3: 0}, 300, [6000, 3000, 1000])
        self.assertEqual((allocation, fee), ({1: 175, 2: 58, 3: 58}, 9))
        self.assertEqual(payouts({1: 10, 2: 0, 3: 0}, 101, [7000, 3000], False)[0], {1: 71, 2: 15, 3: 15})

    def test_randomized_payout_conservation(self):
        rng = random.Random(420)
        for _ in range(1000):
            count = rng.randrange(2, 200)
            scores = {i: rng.randrange(-20, 20) for i in range(1, count + 1)}
            gross = rng.randrange(10**24)
            allocated, fee, _ = payouts(scores, gross, [6000, 4000])
            self.assertEqual(sum(allocated.values()) + fee, gross)

    def _source(self, source, revision=1, available=10, value=1):
        return dict(source=source, revision=revision, availableAt=available, valid=True, athletes={1: value})

    def test_official_overrides_primary_and_primary_overrides_secondary(self):
        secondary = self._source("SPORTSDATAIO", value=7)
        primary = self._source("SPORTRADAR", value=8)
        official = self._source("NHL_OFFICIAL", value=9)
        self.assertEqual(select_source([secondary, primary, official], 20, [1])["athletes"], {1: 9})
        self.assertEqual(select_source([secondary, primary], 20, [1])["athletes"], {1: 8})

    def test_secondary_requires_precommitted_fallback_and_complete_coverage(self):
        secondary = self._source("SPORTSDATAIO")
        with self.assertRaises(ValueError):
            select_source([secondary], 20, [1])
        self.assertEqual(select_source([secondary], 20, [1], True), secondary)
        with self.assertRaises(ValueError):
            select_source([secondary], 20, [1, 2], True)

    def test_late_corrections_and_conflicting_top_tier_fail_closed(self):
        old = self._source("NHL_OFFICIAL", value=1)
        late = self._source("NHL_OFFICIAL", revision=2, available=21, value=2)
        self.assertEqual(select_source([old, late], 20, [1]), old)
        with self.assertRaises(ValueError):
            select_source([old, self._source("NHL_OFFICIAL", value=3)], 20, [1])


if __name__ == "__main__":
    unittest.main()
