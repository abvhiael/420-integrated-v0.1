#!/usr/bin/env python3
import copy
import importlib.util
import pathlib
import unittest

FILE = pathlib.Path(__file__).with_name("verify-reg-audit-4-genesis-address-namespace.py")
spec = importlib.util.spec_from_file_location("reg_audit_4_namespace", FILE)
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)

class RegAudit4NamespaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.clean = validator.load()

    def docs(self):
        return copy.deepcopy(self.clean)

    def errors(self, docs):
        return validator.validate(docs)

    def test_current_repository_namespace_is_clean(self):
        self.assertEqual(self.errors(self.docs()), [])

    def test_registry_cannot_move_to_retired_0448(self):
        d = self.docs()
        d["namespace"]["canonicalRegistry"]["address"] = "0x0000000000000000000000000000000000000448"
        self.assertTrue(any("canonical Registry" in e for e in self.errors(d)))

    def test_system_mirror_drift_fails(self):
        d = self.docs()
        d["system_mirror"]["assignments"][20]["address"] = "0x0000000000000000000000000000000000000448"
        self.assertTrue(any("mirrors differ" in e for e in self.errors(d)))

    def test_predeploy_drift_fails(self):
        d = self.docs()
        reg = next(x for x in d["predeploy"]["predeploys"] if x["name"] == "ProtocolRegistry")
        reg["address"] = "0x0000000000000000000000000000000000000448"
        self.assertTrue(any("predeploy does not exactly match" in e for e in self.errors(d)))

    def test_deployment_manifest_drift_fails(self):
        d = self.docs()
        reg = next(x for x in d["deployment"]["contracts"] if x["name"] == "ProtocolRegistry")
        reg["address"] = "0x0000000000000000000000000000000000000448"
        self.assertTrue(any("deployment does not exactly match" in e for e in self.errors(d)))

    def test_bridge_cannot_collide_with_registry(self):
        d = self.docs()
        d["bridge"]["assignments"].append({"name": "BadBridge", "address": validator.REGISTRY})
        self.assertTrue(any("bridge collision" in e for e in self.errors(d)))

    def test_wallet_registry_reference_must_match(self):
        d = self.docs()
        d["wallet"]["walletAuthority"]["protocolRegistry"]["address"] = "0x0000000000000000000000000000000000000422"
        self.assertTrue(any("wallet Registry resident reference" in e for e in self.errors(d)))

    def test_stale_catalogue_example_fails(self):
        d = self.docs()
        reg = next(x for x in d["catalogue"]["contracts"] if x["name"] == "ProtocolRegistry")
        reg["address"] = "0x0000000000000000000000000000000000000420"
        self.assertTrue(any("catalogue Registry example" in e for e in self.errors(d)))

    def test_stale_manifest_example_fails(self):
        d = self.docs()
        d["manifest"]["contracts"]["Registry420"]["address"] = "0x0000000000000000000000000000000000000420"
        self.assertTrue(any("manifest Registry example" in e for e in self.errors(d)))

    def test_historical_migration_record_cannot_be_promoted(self):
        d = self.docs()
        d["global_candidate"]["status"] = "FROZEN_FOR_GENESIS"
        self.assertTrue(any("historical proposal is not explicitly superseded" in e for e in self.errors(d)))

    def test_registry_resolved_service_cannot_claim_fixed_address(self):
        d = self.docs()
        d["canonical"]["registry_resolved"][0]["address"] = "0x0000000000000000000000000000000000000450"
        self.assertTrue(any("registry-resolved service asserts fixed address" in e for e in self.errors(d)))

    def test_fixed_assignment_outside_reserved_range_fails(self):
        d = self.docs()
        d["system"]["assignments"][0]["address"] = "0x0000000000000000000000000000000000000410"
        d["system_mirror"]["assignments"][0]["address"] = "0x0000000000000000000000000000000000000410"
        d["namespace"]["fixedAssignments"][0]["address"] = "0x0000000000000000000000000000000000000410"
        d["predeploy"]["predeploys"][0]["address"] = "0x0000000000000000000000000000000000000410"
        d["deployment"]["contracts"][0]["address"] = "0x0000000000000000000000000000000000000410"
        self.assertTrue(any("outside reserved range" in e for e in self.errors(d)))

if __name__ == "__main__":
    unittest.main(verbosity=2)
