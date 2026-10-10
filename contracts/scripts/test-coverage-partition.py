#!/usr/bin/env python3
"""Negative and preservation checks for the qualification evidence boundary."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


partition_module = load("partition", "coverage-foundry-shard.py")
partition = partition_module.partition
merge_lcov = load("merge", "merge-coverage.py").merge_lcov


class EvidenceBoundary(unittest.TestCase):
    def test_all_contexts_reconstruct_the_canonical_partition_once(self):
        inventory = sorted([f"src/S{i:03}.sol" for i in range(128)]
                           + [f"test/T{i:03}.t.sol" for i in range(128)])
        for shard in range(4):
            targets = inventory[shard::4]
            groups = partition_module.context_partitions(inventory, targets, shard, 4)
            self.assertEqual(len(groups), 16)
            self.assertEqual(sorted(path for group in groups for path in group), targets)
            for segment, group in enumerate(groups):
                self.assertEqual(group, inventory[shard + segment * 4::64])

    def test_transitive_and_cyclic_imports_retain_all_runtime_dependencies(self):
        cache = {"test/A.t.sol": {"imports": ["src/B.sol"]},
                 "src/B.sol": {"imports": ["src/C.sol"]},
                 "src/C.sol": {"imports": ["src/B.sol"]}}
        self.assertEqual(set(cache), partition_module.dependency_closure(cache, ["test/A.t.sol"]))
        del cache["src/C.sol"]
        with self.assertRaises(ValueError):
            partition_module.dependency_closure(cache, ["test/A.t.sol"])

    def test_snapshot_retains_script_after_live_cache_is_pruned(self):
        targets = ["script/Decision10DeploySeed420.s.sol", "test/A.t.sol"]
        cache = {targets[0]: {"imports": ["src/B.sol"]},
                 targets[1]: {"imports": ["src/B.sol"]}, "src/B.sol": {"imports": []}}
        candidate = "1" * 40
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "graph.json")
            partition_module.write_graph_snapshot(path, cache, targets, candidate, 0, 4, "ci")
            del cache[targets[0]]
            retained = partition_module.read_graph_snapshot(path, targets, candidate, 0, 4)
            self.assertEqual(set(retained), set(targets + ["src/B.sol"]))
            self.assertEqual(set(retained),
                             partition_module.dependency_closure(retained, targets))

    def test_wrong_candidate_profile_partition_or_missing_graph_fails_closed(self):
        targets = ["script/Decision10DeploySeed420.s.sol", "test/A.t.sol"]
        cache = {targets[0]: {"imports": ["src/B.sol"]},
                 targets[1]: {"imports": ["src/B.sol"]}, "src/B.sol": {"imports": []}}
        candidate = "1" * 40
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, "graph.json")
            partition_module.write_graph_snapshot(path, cache, targets, candidate, 0, 4, "ci")
            original = json.loads(path.read_text())
            for key, value in (("candidate_sha", "2" * 40), ("profile", "pr"),
                               ("shard", 1), ("count", 8), ("targets", targets[1:])):
                with self.subTest(key=key):
                    changed = dict(original, **{key: value})
                    path.write_text(json.dumps(changed))
                    with self.assertRaises(ValueError):
                        partition_module.read_graph_snapshot(path, targets, candidate, 0, 4)
            changed = dict(original, files={targets[1]: cache[targets[1]]})
            path.write_text(json.dumps(changed))
            with self.assertRaises(ValueError):
                partition_module.read_graph_snapshot(path, targets, candidate, 0, 4)
            path.unlink()
            with self.assertRaises(FileNotFoundError):
                partition_module.read_graph_snapshot(path, targets, candidate, 0, 4)

    def test_missing_or_duplicate_primary_assignment_fails_closed(self):
        inventory = ["src/A.sol", "src/B.sol", "test/A.t.sol", "test/B.t.sol"]
        self.assertEqual((["test/A.t.sol"], ["src/B.sol", "test/B.t.sol"]),
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
