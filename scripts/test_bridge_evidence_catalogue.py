#!/usr/bin/env python3
"""Catalogue boundary tests; these do not execute underlying consensus suites."""
import contextlib
import copy
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import bridge_evidence_catalogue as c


class CatalogueTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.tmp.name) / 'bundle'
        shutil.copytree(c.DEFAULT, cls.root)
        cls.original = c.read_json(cls.root / 'catalogue.json')

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    @contextlib.contextmanager
    def manifest(self):
        document = copy.deepcopy(self.original)
        try:
            yield document
            c.write_json(self.root / 'catalogue.json', document)
            (self.root / 'catalogue.sha256').write_text(c.sha256((self.root / 'catalogue.json').read_bytes()) + '\n')
            with self.assertRaises(ValueError):
                c.validate(self.root)
        finally:
            c.write_json(self.root / 'catalogue.json', self.original)
            (self.root / 'catalogue.sha256').write_text(c.sha256((self.root / 'catalogue.json').read_bytes()) + '\n')

    def test_complete_bundle(self):
        result = c.validate(self.root)
        self.assertTrue(result['pass'])
        self.assertEqual(result['datasets'], 15)
        self.assertEqual(result['recovered_original_logs'], 19)

    def test_missing_payload(self):
        path = self.root / self.original['artifacts'][0]['local_path']
        data = path.read_bytes()
        try:
            path.unlink()
            with self.assertRaises(ValueError): c.validate(self.root)
        finally: path.write_bytes(data)

    def test_changed_payload(self):
        path = self.root / self.original['artifacts'][0]['local_path']
        data = path.read_bytes()
        try:
            path.write_bytes(data + b'changed')
            with self.assertRaises(ValueError): c.validate(self.root)
        finally: path.write_bytes(data)

    def test_unlisted_payload(self):
        path = self.root / 'data/unlisted'
        try:
            path.write_text('unexpected')
            with self.assertRaises(ValueError): c.validate(self.root)
        finally: path.unlink()

    def test_symlink_payload(self):
        path = self.root / self.original['artifacts'][0]['local_path']
        data = path.read_bytes()
        elsewhere = self.root / 'outside'
        try:
            elsewhere.write_bytes(data); path.unlink(); path.symlink_to(elsewhere)
            with self.assertRaises(ValueError): c.validate(self.root)
        finally: path.unlink(); path.write_bytes(data); elsewhere.unlink()

    def test_controlled_is_not_historical(self):
        with self.manifest() as m:
            r = next(r for r in m['artifacts'] if r['origin'] == 'CONTROLLED')
            r['origin'] = 'HISTORICAL'; r['historical_only'] = True
            r['admissible_claims'] = c.capabilities(r['origin'], r['kind'], r['gateway_relation'])

    def test_rpc_cannot_become_consensus(self):
        with self.manifest() as m:
            r = next(r for r in m['artifacts'] if r['kind'] == 'untrusted_validator_data')
            r['origin'] = 'HISTORICAL'; r['kind'] = 'validator_data'
            r['admissible_claims'] = c.capabilities(r['origin'], r['kind'], r['gateway_relation'])

    def test_unrelated_payment_cannot_become_gateway(self):
        with self.manifest() as m:
            m['artifacts'][0]['complete_420_gateway_authorization'] = True

    def test_dataset_deletion(self):
        with self.manifest() as m: m['datasets'].pop()

    def test_artifact_deletion(self):
        with self.manifest() as m: m['artifacts'].pop()

    def test_duplicate_artifact(self):
        with self.manifest() as m: m['artifacts'].append(copy.deepcopy(m['artifacts'][0]))

    def test_expected_result_substitution(self):
        with self.manifest() as m: m['identity_checks'][0]['expected'] = '00' * 32

    def test_source_revision_substitution(self):
        with self.manifest() as m: m['artifacts'][0]['source']['commit'] = '0' * 40

    def test_source_object_substitution(self):
        with self.manifest() as m: m['artifacts'][0]['git_blob_oid'] = '0' * 40

    def test_prior_run_evidence_preserved(self):
        with self.manifest() as m: m['datasets'][0]['ci_run_ids'] = [123]

    def test_scope_limitations_preserved(self):
        with self.manifest() as m: m['datasets'][0]['limitations'] = ['Everything qualified']

    def test_recovered_log_pin_substitution(self):
        with self.manifest() as m:
            r = next(r for r in m['artifacts'] if r['source']['kind'] == 'RECOVERED_ORIGINAL_RECORD')
            r['source']['expected_sha256'] = '0' * 64

    def test_forbidden_claims_for_all_origins(self):
        for origin in c.ORIGINS:
            r = next(r for r in self.original['artifacts'] if r['origin'] == origin)
            for claim in c.FORBIDDEN_CLAIMS:
                with self.assertRaises(ValueError): c.validate_claim(r, claim)

    def test_observation_claim_is_limited(self):
        r = next(r for r in self.original['artifacts'] if r['origin'] == 'RPC_OBSERVATION')
        self.assertTrue(c.validate_claim(r, 'observation_only'))
        with self.assertRaises(ValueError): c.validate_claim(r, 'underlying_cryptographic_fixture')

    def test_unsafe_paths(self):
        for path in ['../escape', '/absolute', 'a/../b', 'a\\b', 'a//b', 'a/./b', 'C:/b', 'a\nb']:
            with self.assertRaises(ValueError): c.relative(path)

    def test_duplicate_json_keys(self):
        with self.assertRaises(ValueError): json.loads('{"id":1,"id":2}', object_pairs_hook=c.pairs)

    def test_materialization_is_reproducible(self):
        result = c.materialize(self.root, Path(self.tmp.name) / 'copy')
        self.assertEqual(result['catalogue_sha256'], c.validate(self.root)['catalogue_sha256'])


if __name__ == '__main__': unittest.main(verbosity=2)
