#!/usr/bin/env python3
import json
import pathlib
import tempfile
import unittest
import importlib.util

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("scope", ROOT / "scripts/select-solidity-scope.py")
scope = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scope)
M = json.loads((ROOT / "config/solidity-qualification-scopes.json").read_text())

class ScopeTests(unittest.TestCase):
    def test_premium_paths_remain_bounded(self):
        self.assertEqual(scope.classify([
            "contracts/src/highcountry/competition/PremiumCompetitionEntitlements73.sol",
            "contracts/test/highcountry/unit/competition/HCNext73Premium.t.sol",
            ".github/workflows/highcountry-premium-bounded-next-7-3.yml",
            "docs/highcountry/HC-NEXT-7.3-PREMIUM-EVENTS.md"], M), "competition")

    def test_shared_security_fails_closed(self):
        self.assertEqual(scope.classify([
            "contracts/src/highcountry/competition/CompetitionEngine.sol",
            "contracts/src/highcountry/security/R04EmergencyConsumer.sol"], M), "full-level3")

    def test_unrelated_contract_fails_closed(self):
        self.assertEqual(scope.classify([
            "contracts/src/highcountry/competition/CompetitionEngine.sol",
            "contracts/src/token/Token420.sol"], M), "full-level3")

    def test_closeout_fails_closed(self):
        self.assertEqual(scope.classify([
            "contracts/config/compute-market/cmp-8-phase-closeout.json"], M), "full-level3")

    def test_docs_only_cannot_claim_qualification(self):
        self.assertEqual(scope.classify([
            "docs/highcountry/HC-NEXT-7.3-PREMIUM-EVENTS.md"], M), "full-level3")

    def test_ci_infra_change_fails_closed(self):
        self.assertEqual(scope.classify([
            "contracts/scripts/select-solidity-scope.py",
            "contracts/config/solidity-qualification-scopes.json"], M), "full-level3")

if __name__ == "__main__":
    unittest.main()
