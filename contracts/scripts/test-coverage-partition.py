#!/usr/bin/env python3
"""Negative and preservation checks for the qualification evidence boundary."""
import importlib.util
from pathlib import Path
import tempfile
import unittest


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


partition = load("partition", "coverage-foundry-shard.py").partition
merge_lcov = load("merge", "merge-coverage.py").merge_lcov


class EvidenceBoundary(unittest.TestCase):
    def test_missing_or_duplicate_primary_assignment_fails_closed(self):
        inventory = ["src/A.sol", "src/B.sol", "test/A.t.sol", "test/B.t.sol"]
        self.assertEqual((["test/A.t.sol"], ["test/B.t.sol"]),
                         partition(inventory, inventory[::2], 0, 2))
        for targets in (["src/A.sol"], ["src/A.sol", "test/A.t.sol", "test/A.t.sol"], inventory[1::2]):
            with self.assertRaises(ValueError):
                partition(inventory, targets, 0, 2)

    def test_invalid_source_path_and_empty_test_partition_fail_closed(self):
        for inventory in (["src/../secret.sol", "test/A.t.sol"], ["src/A.sol", "src/B.sol"]):
            with self.assertRaises(ValueError):
                partition(inventory, inventory, 0, 1)

    def test_merging_preserves_uncovered_lines_and_unknown_branches(self):
        with tempfile.TemporaryDirectory() as directory:
            a, b = Path(directory, "a.info"), Path(directory, "b.info")
            a.write_text("TN:\nSF:src/A.sol\nFN:1,a\nFNDA:2,a\nDA:1,2\nDA:2,0\nBRDA:1,0,0,-\nend_of_record\n")
            b.write_text("TN:\nSF:src/A.sol\nFN:1,a\nFNDA:3,a\nDA:1,3\nDA:2,0\nBRDA:1,0,0,-\nend_of_record\nTN:\nSF:src/B.sol\nDA:1,0\nend_of_record\n")
            content, count = merge_lcov([a, b])
            self.assertEqual(count, 2)
            for item in ("FNDA:5,a", "DA:1,5", "DA:2,0", "BRDA:1,0,0,-", "BRH:0", "SF:src/B.sol\nFNF:0\nFNH:0\nDA:1,0\nLF:1\nLH:0"):
                self.assertIn(item, content)

    def test_unknown_lcov_format_is_not_silently_dropped(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "unknown.info")
            path.write_text("SF:src/A.sol\nUNSUPPORTED:1\nend_of_record\n")
            with self.assertRaises(ValueError):
                merge_lcov([path])


if __name__ == "__main__":
    unittest.main()
