"""ARB-PRE-11 negative evidence schema and immutable policy regression checks."""
import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "scripts/verify-arbitration-pre11-handoff.py"
spec = importlib.util.spec_from_file_location("arb_pre11_handoff", MODULE)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class ArbitrationPre11HandoffTest(unittest.TestCase):
    def setUp(self):
        self.original = json.loads(verify.TEMPLATE.read_text())

    def reject_template(self, modify):
        modified = copy.deepcopy(self.original)
        modify(modified)
        with self.assertRaises((AssertionError, ValueError, KeyError, TypeError)):
            verify.validate_template(modified)

    def test_blank_template_and_trusted_local_history(self):
        result = verify.validate_template(self.original)
        self.assertEqual(result["result"], "PASS")
        self.assertEqual(result["liveNetworkEvidenceFieldsPopulated"], 0)
        self.assertFalse(result["liveQualified"])
        self.assertEqual(result["scenarios"], 10)
        self.assertEqual(result["contracts"], 4)

    def test_operational_runbook_and_actual_sources(self):
        result = verify.validate_runbook()
        self.assertEqual(result["result"], "PASS")
        self.assertGreaterEqual(result["operationalTopics"], 15)

    def test_rejects_claimed_live_qualification(self):
        self.reject_template(lambda m: m.__setitem__("liveQualified", True))

    def test_rejects_fabricated_live_network_id(self):
        self.reject_template(lambda m: m["live"].__setitem__("chainId", 31337))

    def test_rejects_fabricated_deployment_address(self):
        self.reject_template(lambda m: m["live"]["deployedContracts"]
                             ["ArbitrationRouter420"].__setitem__("address", "0x" + "a" * 40))

    def test_rejects_any_supplied_test_result(self):
        self.reject_template(lambda m: m["live"]["testScenarios"]
                             ["standardDispute"].__setitem__("passed", True))

    def test_rejects_unapproved_fixed_contract_address_policy(self):
        self.reject_template(lambda m: m.__setitem__(
            "addressModel", "FIXED_PREDEPLOY_ARBITRATION_ROUTER"))

    def test_rejects_missing_scenario_record(self):
        self.reject_template(lambda m: m["live"]["testScenarios"].pop("reorganizationRebuild"))

    def test_rejects_missing_ruling_registry_artifact(self):
        self.reject_template(lambda m: m["live"]["deployedContracts"].pop(
            "ArbitrationRulingRegistry420"))

    def test_rejects_changed_compiler(self):
        self.reject_template(lambda m: m["sourceAuthority"].__setitem__("compiler", "0.8.25"))

    def test_rejects_unverified_candidate_even_when_status_looks_ready(self):
        m = copy.deepcopy(self.original)
        m["status"] = "CAPTURED_PENDING_INDEPENDENT_ONCHAIN_VERIFICATION"
        self.assertRaises(AssertionError, verify.validate_candidate, m)

    def test_rejects_candidate_that_claims_qualification(self):
        m = copy.deepcopy(self.original)
        m["status"] = "CAPTURED_PENDING_INDEPENDENT_ONCHAIN_VERIFICATION"
        m["liveQualified"] = True
        self.assertRaises(AssertionError, verify.validate_candidate, m)

    def test_rejects_candidate_missing_evidence_schema_field(self):
        m = copy.deepcopy(self.original)
        m["live"].pop("workflowEvidence")
        self.assertRaises(AssertionError, verify.validate_candidate, m)


if __name__ == "__main__":
    unittest.main()
