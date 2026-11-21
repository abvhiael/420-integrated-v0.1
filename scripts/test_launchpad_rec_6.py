#!/usr/bin/env python3
"""Negative and deterministic checks on the actual compiled REC-6 artifact inventory."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("rec6_verifier", Path(__file__).with_name("verify-launchpad-rec-6.py"))
rec6 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rec6)
SHA = "1234567890abcdef1234567890abcdef12345678"
SOURCE = rec6.ROOT / "contracts/out"


class LaunchpadRec6VerifierTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reference = rec6.verify_artifacts(SOURCE, SHA)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        for name, _ in rec6.CONTRACTS:
            source = SOURCE / f"{name}.sol" / f"{name}.json"
            dest = self.dir / f"{name}.sol" / f"{name}.json"
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)

    def mutate(self, name, transform):
        p = self.dir / f"{name}.sol" / f"{name}.json"
        artifact = json.loads(p.read_text())
        transform(artifact)
        p.write_text(json.dumps(artifact))

    def test_manifest_determinism(self):
        self.assertEqual(rec6.verify_artifacts(self.dir, SHA), self.reference)
        self.assertEqual(len(self.reference["contracts"]), 6)
        self.assertIsNone(self.reference["chain_evidence"])

    def test_reject_wrong_constructor_binding(self):
        def corrupt(artifact):
            item = next(i for i in artifact["abi"] if i["type"] == "constructor")
            item["inputs"][0]["type"] = "uint256"
        self.mutate("LaunchpadCrowdfundingIntegration420", corrupt)
        with self.assertRaisesRegex(ValueError, "constructor ABI"):
            rec6.verify_artifacts(self.dir, SHA)

    def test_reject_missing_reputation_event(self):
        def corrupt(artifact):
            artifact["abi"] = [i for i in artifact["abi"]
                               if not (i.get("type") == "event" and
                                       i.get("name") == "ReputationEvidencePublished")]
        self.mutate("LaunchpadCrowdfundingIntegration420", corrupt)
        with self.assertRaisesRegex(ValueError, "canonical ABI event missing"):
            rec6.verify_artifacts(self.dir, SHA)

    def test_reject_missing_canonical_payment_function(self):
        def corrupt(artifact):
            artifact["abi"] = [i for i in artifact["abi"]
                               if not (i.get("type") == "function" and
                                       i.get("name") == "contribute")]
        self.mutate("LaunchpadAllocationRegistry420", corrupt)
        with self.assertRaisesRegex(ValueError, "canonical ABI function missing"):
            rec6.verify_artifacts(self.dir, SHA)

    def test_reject_unlinked_runtime(self):
        self.mutate("LaunchpadRouter420",
                    lambda a: a["deployedBytecode"].update({"object": "0x__$library$__"}))
        with self.assertRaisesRegex(ValueError, "invalid deployedBytecode"):
            rec6.verify_artifacts(self.dir, SHA)

    def test_reject_unapproved_compiler_flags(self):
        def corrupt(artifact):
            m = artifact["metadata"]
            m = json.loads(m) if isinstance(m, str) else m
            m["settings"]["optimizer"]["runs"] = 201
            artifact["metadata"] = json.dumps(m)
        self.mutate("LaunchpadSaleRegistry420", corrupt)
        with self.assertRaisesRegex(ValueError, "compiler metadata setting drift"):
            rec6.verify_artifacts(self.dir, SHA)

    def test_reject_missing_artifact_and_unqualified_sha(self):
        (self.dir / "LaunchpadRouter420.sol" / "LaunchpadRouter420.json").unlink()
        with self.assertRaisesRegex(ValueError, "compiled artifact missing"):
            rec6.verify_artifacts(self.dir, SHA)
        with self.assertRaisesRegex(ValueError, "exact git SHA"):
            rec6.verify_artifacts(SOURCE, "local")


if __name__ == "__main__":
    unittest.main()
