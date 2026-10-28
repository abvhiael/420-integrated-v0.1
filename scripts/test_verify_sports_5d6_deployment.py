#!/usr/bin/env python3
"""Bounded negative release-gate tests; no RPC, production secrets or chain required."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "verify-sports-5d6-deployment.py"
TEMPLATE = ROOT / "contracts" / "config" / "bet" / "sports-5d6-pretestnet-manifest.v1.json"


class SportsDeploymentGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = json.loads(TEMPLATE.read_text(encoding="utf-8"))

    def verify(self, payload, mode="prelaunch"):
        with tempfile.TemporaryDirectory() as d:
            target = Path(d) / "manifest.json"
            target.write_text(json.dumps(payload), encoding="utf-8")
            return subprocess.run([sys.executable, str(SCRIPT), "--manifest", str(target),
                                   "--mode", mode], capture_output=True, text=True)

    def test_prelaunch_manifest_passes_syntax(self):
        self.assertEqual(self.verify(self.template).returncode, 0)

    def test_prelaunch_never_passes_production_gate(self):
        self.assertNotEqual(self.verify(self.template, "production").returncode, 0)

    def test_oracle_only_cannot_be_disabled(self):
        payload = json.loads(json.dumps(self.template))
        payload["policy"]["oracle_only_funding"] = False
        self.assertNotEqual(self.verify(payload).returncode, 0)

    def test_result_mode_and_quorum_cannot_be_relaxed(self):
        for changes in ({"minimum_sources": 1},
                        {"minimum_confidence_bps": 0},
                        {"minimum_confidence_bps": 8999},
                        {"aggregation_mode": "AGGREGATION_MEDIAN_NUMERIC"},
                        {"max_age_seconds": 0},
                        {"max_age_seconds": 7201},
                        {"risk_policy_halted": True}):
            payload = json.loads(json.dumps(self.template))
            payload["policy"].update(changes)
            with self.subTest(changes=changes):
                self.assertNotEqual(self.verify(payload).returncode, 0)

    def test_invalid_addresses_cannot_be_declared(self):
        payload = json.loads(json.dumps(self.template))
        payload["artifacts"]["vault"]["address"] = "0x" + "00" * 20
        payload["artifacts"]["vault"]["code_hash"] = "0x" + "11" * 32
        self.assertNotEqual(self.verify(payload).returncode, 0)

    def test_market_without_legacy_revoke_blocks_prelaunch(self):
        payload = json.loads(json.dumps(self.template))
        payload["markets"] = [{"market_id": "0x" + "01" * 32,
                               "feed_id": "0x" + "02" * 32,
                               "risk_group_id": "0x" + "03" * 32,
                               "risk_group_limit": 500,
                               "oracle_gate_bound": True,
                               "risk_group_bound": True,
                               "direct_resolver_grants_revoked": False}]
        self.assertNotEqual(self.verify(payload).returncode, 0)

    def test_no_placeholder_hash_in_prelaunch(self):
        payload = json.loads(json.dumps(self.template))
        payload["artifacts"]["oracle_router"]["code_hash"] = "0x" + "00" * 32
        self.assertNotEqual(self.verify(payload).returncode, 0)


if __name__ == "__main__":
    unittest.main()
