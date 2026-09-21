#!/usr/bin/env python3
"""Synthetic W14.7.3 integrity checks; run with python3 scripts/test-wallet-w14-7-3-genesis.py."""
import copy
import hashlib
import importlib.util
import json
import pathlib
import unittest

FILE = pathlib.Path(__file__).with_name("verify-wallet-w14-7-3-genesis.py")
spec = importlib.util.spec_from_file_location("wallet_genesis_integrity", FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ADDR = "0x" + format(0x445, "040x")
SLOT = "0x" + "00" * 32
VALUE = "0x" + "01" * 32
CODE = "0x60016000"


def fixture():
    storage = {"Names420": {SLOT: VALUE}}
    genesis = {"alloc": {ADDR: {"code": CODE, "storage": copy.deepcopy(storage["Names420"])}}}
    raw = (json.dumps(genesis, indent=2) + "\n").encode()
    plan = {"status": "FROZEN_ADDRESS_MAP_ARTIFACTS_READY",
            "predeploys": [{"name": "Names420", "address": ADDR}]}
    manifest = {"schema": "420-genesis-predeploy-manifest-v2",
                "status": "GENERATED_NOT_DEPLOYMENT_ATTESTED",
                "on_chain_code_verified": False, "storage_simulation_verified": False,
                "genesis_sha256": hashlib.sha256(raw).hexdigest(),
                "predeploy_count": 1,
                "predeploys": [{"name": "Names420", "address": ADDR,
                                "runtime_code_sha256": hashlib.sha256(bytes.fromhex(CODE[2:])).hexdigest(),
                                "runtime_code_bytes": 4, "storage_slots": 1}]}
    return plan, genesis, raw, manifest, storage


class GenesisIntegrityRegression(unittest.TestCase):
    def check(self, args, needle):
        self.assertTrue(any(needle in error for error in module.verify(*args)), module.verify(*args))

    def test_valid_synthetic_candidate(self):
        self.assertEqual(module.verify(*fixture()), [])

    def test_unqualified_plan(self):
        args = fixture(); args[0]["status"] = "FROZEN_ADDRESS_MAP_ARTIFACTS_PENDING"
        self.check(args, "not qualified")

    def test_genesis_hash_mismatch(self):
        args = fixture(); args[3]["genesis_sha256"] = "0" * 64
        self.check(args, "SHA-256")

    def test_runtime_bytecode_mismatch(self):
        args = fixture(); args[1]["alloc"][ADDR]["code"] = "0x6002"
        self.check(args, "runtime code hash/size")

    def test_storage_mismatch(self):
        args = fixture(); args[1]["alloc"][ADDR]["storage"][SLOT] = SLOT
        self.check(args, "storage or slot count mismatch")

    def test_missing_predeploy_account(self):
        args = fixture(); args[1]["alloc"].clear()
        self.check(args, "allocation missing")

    def test_manifest_unapproved_address(self):
        args = fixture(); args[3]["predeploys"][0]["address"] = "0x" + format(0x435, "040x")
        self.check(args, "address differs")

    def test_duplicate_manifest_name(self):
        args = fixture(); args[3]["predeploys"].append(copy.deepcopy(args[3]["predeploys"][0]))
        self.check(args, "unknown or duplicate")

    def test_claimed_deployment_attestation(self):
        args = fixture(); args[3]["on_chain_code_verified"] = True
        self.check(args, "cannot claim")

    def test_invalid_storage_word(self):
        args = fixture(); args[1]["alloc"][ADDR]["storage"] = {"0x01": VALUE}
        self.check(args, "malformed")

    def test_missing_storage_contract(self):
        args = fixture(); args[4].clear()
        self.check(args, "storage names")

    def test_case_duplicate_allocation(self):
        args = fixture(); address = "0x" + "0000000000000000000000000000000000000ABC"
        args[1]["alloc"][address] = {"code": CODE, "storage": {}}
        args[1]["alloc"][address.lower()] = {"code": CODE, "storage": {}}
        self.check(args, "case-insensitive duplicate allocation")


if __name__ == "__main__":
    unittest.main()
