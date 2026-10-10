#!/usr/bin/env python3
"""Negative regressions for audit provenance, omission and scope tampering."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

path = Path(__file__).with_name('verify-compliance-c01-1.py')
spec = importlib.util.spec_from_file_location('compliance_inventory', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ROOT = module.ROOT
DATA = json.loads((ROOT / 'docs/compliance/C01.1-INVENTORY.json').read_text())

class InventoryTests(unittest.TestCase):
    def deny(self, mutate):
        value = copy.deepcopy(DATA)
        mutate(value)
        with self.assertRaises(ValueError):
            module.validate_metadata(value)

    def test_valid_snapshot(self):
        module.validate_metadata(DATA)

    def test_wrong_base(self):
        self.deny(lambda v: v.update(base_sha='0' * 40))

    def test_wrong_tree(self):
        self.deny(lambda v: v.update(tree_sha='0' * 40))

    def test_omitted_source(self):
        self.deny(lambda v: v['sources'].pop())

    def test_duplicate_source(self):
        self.deny(lambda v: v['sources'].__setitem__(0, v['sources'][1]))

    def test_invalid_digest(self):
        self.deny(lambda v: v['sources'][0].update(sha256='not-a-digest'))

    def test_omitted_branch(self):
        self.deny(lambda v: v['branches'].pop())

    def test_branch_omission_with_adjusted_count(self):
        def mutate(v):
            v['branches'].pop()
            v['branch_count'] -= 1
        self.deny(mutate)

    def test_duplicate_pr(self):
        self.deny(lambda v: v['open_prs'].__setitem__(0, v['open_prs'][1]))

    def test_changed_pr_head(self):
        self.deny(lambda v: v['open_prs'][0].update(head='0' * 40))

    def test_dependency_omitted(self):
        self.deny(lambda v: v['active_dependency_prs'].pop())

    def test_false_absence(self):
        self.deny(lambda v: v['exact_content_matches'].append('fake'))

    def test_wrong_qualification_level(self):
        self.deny(lambda v: v.update(qualification_level=3))

    def test_actual_source_digest_tamper(self):
        value = copy.deepcopy(DATA)
        value['sources'][0]['sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'source baseline digest'):
            module.verify(value)

    def test_actual_tree_digest_tamper(self):
        value = copy.deepcopy(DATA)
        value['tree_listing_sha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'listing digest'):
            module.verify(value)

    def test_exact_head_mismatch(self):
        with self.assertRaisesRegex(ValueError, 'implementation SHA'):
            module.verify(DATA, expected_sha='0' * 40)

    def test_protected_runtime_change_denied(self):
        original_git = module.git
        def fake_git(*args, **kwargs):
            if args[:2] == ('diff', '--name-only'):
                return b'contracts/src/apps/Identity420.sol\n'
            return original_git(*args, **kwargs)
        module.git = fake_git
        try:
            with self.assertRaisesRegex(ValueError, 'unauthorized changed path'):
                module.verify(DATA)
        finally:
            module.git = original_git

    def test_mutated_protected_worktree(self):
        # A disposable sparse worktree is sufficient: checks reject the first
        # changed source before inspecting later files. No source is edited.
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / '.git').symlink_to(ROOT / '.git', target_is_directory=True)
            source = DATA['sources'][0]['path']
            (root / source).parent.mkdir(parents=True)
            (root / source).write_text('mutated')
            with self.assertRaisesRegex(ValueError, 'protected source changed'):
                module.verify(DATA, root=root)

if __name__ == '__main__':
    unittest.main(verbosity=2)
