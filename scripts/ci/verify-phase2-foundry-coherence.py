#!/usr/bin/env python3
"""Phase 2: fail-closed structural qualification of the one canonical Foundry runner."""
from pathlib import Path
import runpy
import unittest

ROOT=Path(__file__).resolve().parents[2]
def read(path): return (ROOT/path).read_text(encoding="utf-8")
class FoundryOwnership(unittest.TestCase):
 def test_one_authoritative_sharded_runner(self):
  wf=read(".github/workflows/contracts-foundry.yml")
  runner=read("contracts/scripts/qualify-foundry-shard.sh")
  self.assertIn("name: Solidity Contracts",wf)
  self.assertIn("workflow_dispatch:",wf)
  self.assertIn("scripts/qualify-foundry-shard.sh",wf)
  self.assertIn("scripts/merge-coverage.py",wf)
  self.assertIn("diff -u ../artifacts/contracts/expected-inventory.txt ../artifacts/contracts/qualified-inventory.txt",wf)
  self.assertIn("for shard in 0 1 2 3; do",wf)
  self.assertIn("find src test script -type f -name '*.sol'",runner)
  self.assertIn("i % count == shard",runner)
  self.assertIn("failed_tests=()",runner)
  self.assertIn('forge test --match-path "$target"',runner)
  self.assertIn("coverage-foundry-shard.py",runner)
  self.assertIn("exit 1",runner)
 def test_scoped_suite_exact_head(self):
  wf=read(".github/workflows/reusable-scoped-foundry.yml")
  self.assertIn("workflow_call:",wf)
  self.assertIn("github.event.pull_request.head.sha || github.sha",wf)
  self.assertIn('test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"',wf)
  self.assertIn('forge test --match-path "$MATCH_PATH" -vv',wf)
  policy=read("docs/ci/UNIVERSAL-SCOPED-QUALIFICATION-POLICY.md")
  self.assertIn("every mandatory item",policy)
  self.assertIn("separate jobs",policy)
 def test_deterministic_four_way_coverage_partition(self):
  mod=runpy.run_path(str(ROOT/"contracts/scripts/coverage-foundry-shard.py"),run_name="__phase2_import__")
  inv=[f"src/Test{i:03d}.sol" for i in range(12)]+[f"test/Case{i:03d}.sol" for i in range(12)]
  parts=[inv[i::4] for i in range(4)]
  self.assertEqual(sorted(sum(parts,[])),inv)
  for i,targets in enumerate(parts):
   tests,skipped=mod["partition"](inv,targets,i,4)
   self.assertEqual(len(tests),3)
   self.assertEqual(set(skipped),set(inv)-set(targets))
   with self.assertRaises(ValueError):
    mod["partition"](inv,targets[::-1],i,4)
 def test_no_superseded_parallel_ci_sol02_owner(self):
  for obsolete in [".github/workflows/solidity-qualification-summary.yml",".github/workflows/solidity-scope-safety.yml",".github/workflows/sol02-selector-level1.yml"]:
   self.assertFalse((ROOT/obsolete).exists(),"legacy competing runner reintroduced: "+obsolete)
if __name__=="__main__":
 unittest.main()
