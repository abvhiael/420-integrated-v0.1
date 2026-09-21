#!/usr/bin/env python3
"""Synthetic checks for the W14.7.4 source-consumer inventory."""
import importlib.util
import pathlib
import tempfile
import unittest

FILE = pathlib.Path(__file__).with_name('audit-wallet-w14-7-4-consumers.py')
spec = importlib.util.spec_from_file_location('w1474_consumers', FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def full(slot):
    return '0x' + format(slot, '040x')


class ConsumerInventoryTests(unittest.TestCase):
    def test_bridge_consensus_overlap_is_identified(self):
        candidate = {'preservedSystemAssignments': [['ConsensusSystemCall420', '0x043c']],
                     'migratedExistingPredeploys': [], 'canonicalAuthorities': [],
                     'bridgeCandidates': [['BridgeAssetRegistry', '0x0462']]}
        canonical = {'anchors': []}
        bridge = {'assignments': [{'name': 'BridgeAssetRegistry', 'address': full(0x43c)}]}
        old, new = module.claims_from_authorities(candidate, canonical, bridge)
        self.assertEqual(old[full(0x43c)], ['BridgeAssetRegistry'])
        self.assertEqual(new['ConsensusSystemCall420'], full(0x43c))

    def test_wallet_collision_is_not_mistaken_for_preserved_system_identity(self):
        candidate = {'preservedSystemAssignments': [['RewardController', '0x0420']],
                     'migratedExistingPredeploys': [],
                     'canonicalAuthorities': [['smart-account-factory', 'SmartAccountFactory420', '0x0446']],
                     'bridgeCandidates': []}
        canonical = {'anchors': [{'id': 'smart-account-factory', 'address': full(0x420)}]}
        old, new = module.claims_from_authorities(candidate, canonical, {'assignments': []})
        self.assertEqual(old[full(0x420)], ['SmartAccountFactory420'])
        self.assertEqual(new['RewardController'], full(0x420))

    def test_full_width_case_insensitive_matches_and_line_numbers(self):
        old = {full(0x435): ['Names420']}
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            source = root / 'src.ts'
            source.write_text('const unrelated = "hello";\nconst old = "%s";\n' % full(0x435).upper().replace('0X', '0x'))
            findings = module.inventory(root, old, [source])
            self.assertEqual(len(findings), 1)
            self.assertEqual(findings[0]['line'], 2)
            self.assertEqual(findings[0]['claimedMigratingIdentities'], ['Names420'])

    def test_no_false_match_inside_longer_hex_number(self):
        old = {full(0x435): ['Names420']}
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            source = root / 'src.sol'
            source.write_text('0x0%s0\n' % full(0x435)[2:])
            self.assertEqual(module.inventory(root, old, [source]), [])

    def test_non_text_and_candidate_map_are_excluded(self):
        old = {full(0x435): ['Names420']}
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            binary = root / 'blob.bin'
            binary.write_text(full(0x435))
            candidate = root / module.CANDIDATE
            candidate.parent.mkdir(parents=True)
            candidate.write_text(full(0x435))
            self.assertEqual(module.inventory(root, old, [binary, candidate]), [])

    def test_legacy_alias_slot_is_reported(self):
        candidate = {'preservedSystemAssignments': [],
                     'migratedExistingPredeploys': [{'name': 'Names420', 'from': '0x0435', 'to': '0x0445'}],
                     'canonicalAuthorities': [['names', 'Names420', '0x0445']], 'bridgeCandidates': []}
        canonical = {'anchors': [{'id': 'names', 'address': full(0x445)}]}
        old, new = module.claims_from_authorities(candidate, canonical, {'assignments': []})
        self.assertEqual(old[full(0x435)], ['Names420'])
        self.assertEqual(new['Names420'], full(0x445))


if __name__ == '__main__':
    unittest.main()
