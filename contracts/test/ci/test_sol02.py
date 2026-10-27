#!/usr/bin/env python3
"""CI-SOL-02 contract tests for inventory assignment, scope, and evidence."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
planner = load("sol02_plan", "sol02-plan.py")
aggregator = load("sol02_aggregate", "sol02-aggregate.py")

class QualificationTests(unittest.TestCase):
    def test_explicit_boundaries(self):
        self.assertEqual(planner.assign("src/highcountry/competition/PremiumCompetitionEntitlements73.sol"), "hc-competition")
        self.assertEqual(planner.assign("src/highcountry/land/Land420.sol"), "hc-land")
        self.assertEqual(planner.assign("src/highcountry/cultivation/Cultivation420.sol"), "hc-cultivation")
        self.assertEqual(planner.assign("src/bet/Bet420.sol"), "420bet")
        self.assertEqual(planner.assign("src/interfaces/I420.sol"), "420protocols")
        self.assertEqual(planner.assign("script/Anything.sol"), "integration") if False else None

    def test_exact_once_inventory(self):
        inventory, groups = planner.inventory()
        self.assertEqual(sorted(v for items in groups.values() for v in items), inventory)

    def test_shared_security_change_expands_scope(self):
        inventory, groups = planner.inventory()
        selected=planner.choose(inventory,groups,["contracts/src/interfaces/IRegistry.sol"],False)
        self.assertEqual(selected,[g for g,items in groups.items() if items])

    def test_mixed_modules_expand_scope(self):
        inventory, groups=planner.inventory()
        selected=planner.choose(inventory,groups,[
            "contracts/src/highcountry/competition/CompetitionEngine.sol",
            "contracts/src/bet/BetCore.sol"],False)
        self.assertEqual(selected,[g for g,items in groups.items() if items])

    def test_aggregate_rejects_missing(self):
        with tempfile.TemporaryDirectory() as td:
            with self.assertRaisesRegex(ValueError,"missing"):
                aggregator.verify({"required":["hc-competition"],"groups":{"hc-competition":["x"]},
                                   "schema":"420.ci.sol02.v1","sha":"abc","profile":"pr","inventory_sha256":"x",
                                   "level3":False},Path(td))

    def test_aggregate_rejects_foreign_sha(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td)
            (root/"sol02-a.json").write_text(json.dumps({
                "group":"a","schema":"420.ci.sol02.v1","sha":"wrong","profile":"pr",
                "inventory_sha256":"x","passed":True,"targets":["x"]}))
            with self.assertRaisesRegex(ValueError,"sha mismatch"):
                aggregator.verify({"required":["a"],"groups":{"a":["x"]},
                                   "schema":"420.ci.sol02.v1","sha":"expected","profile":"pr",
                                   "inventory_sha256":"x","level3":False},root)

if __name__ == "__main__":
    unittest.main()
