#!/usr/bin/env python3
"""Phase 2: fail-closed structural qualification of the one canonical Foundry runner."""
from pathlib import Path
import runpy
import os
import subprocess
import sys
import tempfile
import json
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
  self.assertIn('python3 ../scripts/bet/run-scoped-foundry.py "$MATCH_PATH" --match-path "$MATCH_PATH" -vv',wf)
  policy=read("docs/ci/UNIVERSAL-SCOPED-QUALIFICATION-POLICY.md")
  self.assertIn("every mandatory item",policy)
  self.assertIn("separate jobs",policy)
 def test_scoped_runner_isolation_and_fail_closed(self):
  runner=ROOT/"scripts/bet/run-scoped-foundry.py"
  with tempfile.TemporaryDirectory() as td:
   base=Path(td)
   (base/"foundry.toml").write_text("[profile.default]\n")
   for d in ("test/selected","test/deps","test/unrelated","src","script","bin"):
    (base/d).mkdir(parents=True)
   fixtures={"selected/Root.t.sol":'import "../deps/Dep.sol";\n',
             "deps/Dep.sol":'import "./Nested.sol";\n',
             "deps/Nested.sol":"// transitive dependency\n",
             "unrelated/Poison.t.sol":"invalid source\n"}
   for name,content in fixtures.items():
    (base/"test"/name).write_text(content)
   fake=base/"bin/forge"
   fake.write_text("#!"+sys.executable+"\n"+'''
import json,os,sys
from pathlib import Path
root=Path(os.environ["FOUNDRY_TEST"])
assert root.parent==Path.cwd()
assert not list(Path(os.environ["FOUNDRY_SRC"]).iterdir())
assert not list(Path(os.environ["FOUNDRY_SCRIPT"]).iterdir())
assert sorted(str(p.relative_to(root)) for p in root.rglob("*.sol"))==["deps/Dep.sol","deps/Nested.sol","selected/Root.t.sol"]
for p in root.rglob("*.sol"):
 assert p.read_bytes()==(Path("test")/p.relative_to(root)).read_bytes()
assert os.environ["FOUNDRY_PROFILE"]=="pr"
assert os.environ["FOUNDRY_FUZZ_RUNS"]=="2500"
assert sys.argv[1:3]==["test","--match-path"]
assert sys.argv[3]==str(root/"selected/*.t.sol")
assert sys.argv[4:]==["-vv"]
mode=os.environ.get("FAKE_MODE","pass")
print("1 tests passed" if mode!="empty" else "0 tests passed")
sys.exit(1 if mode=="fail" else 0)
''')
   fake.chmod(0o755)
   env=dict(os.environ,PATH=str(base/"bin")+os.pathsep+os.environ["PATH"],FOUNDRY_PROFILE="pr",FOUNDRY_FUZZ_RUNS="2500")
   def invoke(pattern,mode):
    return subprocess.run([sys.executable,str(runner),pattern,"--match-path",pattern,"-vv"],cwd=base,env=dict(env,FAKE_MODE=mode),capture_output=True,text=True)
   good=invoke("test/selected/*.t.sol","pass")
   self.assertEqual(good.returncode,0,good.stdout+good.stderr)
   for pattern,mode in [("test/missing/*.t.sol","pass"),("test/selected/*.t.sol","empty"),("test/selected/*.t.sol","fail")]:
    self.assertNotEqual(invoke(pattern,mode).returncode,0)
   self.assertFalse(list(base.glob(".scoped-foundry.*")))
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
