#!/usr/bin/env python3
"""Synthetic W14.7.5 preflight regressions; not real Genesis readiness evidence."""
import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('verify-wallet-w14-7-5-preflight.py')
spec = importlib.util.spec_from_file_location('preflight', SCRIPT)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)
ADDR = '0x' + '0' * 36 + '0446'
WORD = '0x' + '0' * 64


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        (self.root / 'artifacts').mkdir()
        (self.root / 'src').mkdir()
        (self.root / 'src' / 'Factory.sol').write_text('contract Factory {}')
        (self.root / 'artifacts' / 'Factory.json').write_text(json.dumps({
            'deployedBytecode': {'object': '0x60016000'}, 'metadata': '{}'}))
        self.plan = {'status': 'FROZEN_ADDRESS_MAP_ARTIFACTS_READY',
                     'predeploys': [{'name': 'Factory', 'address': ADDR,
                                    'source': 'Factory.sol'}]}
        self.canonical = {'anchors': [{'contract': 'Factory.sol', 'address': ADDR}]}
        self.inventory = {'releaseGates': {'canonicalAddressConflictResolved': True}}
        self.inputs = {'entries': {'Factory': {'constructor': [], 'post_init': []}},
                       'genesis_time': 1, 'founder_beneficiaries': [],
                       'bridge_verifier': ADDR, 'dex_pool_implementation': ADDR,
                       'bootstrap_governor': ADDR}
        self.storage = {'Factory': {WORD: WORD}}

    def tearDown(self):
        self.tmp.cleanup()

    def check(self):
        return preflight.check(self.plan, self.canonical, self.inventory,
                               self.inputs, self.root / 'artifacts', self.storage,
                               self.root / 'src')

    def test_complete_synthetic_fixture(self):
        self.assertTrue(self.check()['ready'])

    def test_unapproved_namespace_fails(self):
        self.inventory['releaseGates']['canonicalAddressConflictResolved'] = False
        self.assertFalse(self.check()['ready'])

    def test_legacy_predeploy_address_fails(self):
        self.plan['predeploys'][0]['address'] = '0x' + '0' * 36 + '0434'
        self.assertFalse(self.check()['ready'])

    def test_missing_artifact_fails(self):
        (self.root / 'artifacts' / 'Factory.json').unlink()
        self.assertFalse(self.check()['ready'])

    def test_constructor_bytecode_or_missing_provenance_fails(self):
        (self.root / 'artifacts' / 'Factory.json').write_text(json.dumps({
            'deployedBytecode': {'object': '__UNLINKED__'}}))
        self.assertFalse(self.check()['ready'])

    def test_missing_storage_fails(self):
        self.storage = None
        self.assertFalse(self.check()['ready'])

    def test_unresolved_inputs_fail(self):
        self.inputs['genesis_time'] = 'FROM_FROZEN_TESTNET_OR_MAINNET_GENESIS'
        self.assertFalse(self.check()['ready'])

    def test_duplicate_placement_fails(self):
        (self.root / 'src' / 'Another.sol').write_text('contract Another {}')
        self.plan['predeploys'].append({'name': 'Another', 'address': ADDR,
                                        'source': 'Another.sol'})
        self.assertFalse(self.check()['ready'])


if __name__ == '__main__':
    unittest.main()
