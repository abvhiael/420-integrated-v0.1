"""Real local-chain deployment/authority preparation and fail-closed attestation tests."""
import copy
import json
import os
from pathlib import Path
import unittest
from eth_account import Account
from web3 import Web3
from local_fixture import LocalFixture
from chain import Chain
from deployment import (MODULES, STEPS, address, artifact, bundle, canonical, contract,
                        creation_transaction, digest, export_application, hx, role_plan,
                        oracle_authority_plan, revocation_transaction, runtime_matches, snapshot_manifest, verify, word)


class DeploymentReadiness(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.build = Path(os.environ["FANTASY_READINESS_BUILD"])
        cls.output = Path(os.environ["FANTASY_READINESS_OUTPUT"])
        cls.fixture = f = LocalFixture(os.environ["FANTASY_READINESS_RPC"], cls.build, os.environ["FANTASY_READINESS_PRIVATE"], asset_kind="wrapped-native")
        cls.config = f.setup()
        cls.w3 = w3 = f.w3
        cls.modules = {n: c.address for n, c in f.contracts.items()}
        # Reuse canonical core and asset, but deploy the four fantasy modules through
        # the same unsigned transaction builder that operators will use on testnet.
        cls.parameters = p = {"assetKind": "wrapped-native", "chainID": 31337, "issuer": hx(f.issuer), "userType": hx(f.user_type),
            "resolverType": hx(f.resolver_type), "community": f.accounts[9],
            "developmentBeneficiary": f.accounts[8], "assetDecimals": 18,
            "governance": f.admin, "publisherMinimumGasWei": str(10**17),
            "slate": next(iter(f.slates)), "pool": f.pools[0], "pools": f.pools[:2], "claim": None}
        cls.config = copy.deepcopy(cls.config)
        cls.config.update(slates={p["slate"]: cls.config["slates"][p["slate"]]}, plannedPools=p["pools"],
                          candidateFeeds={pid: cls.config["candidateFeeds"][pid] for pid in p["pools"]})
        cls.receipts = {}
        constructor_plans = []
        receipt_evidence = []
        for name in STEPS:
            tx = creation_transaction(cls.build, name, cls.modules, p, f.admin)
            constructor_plans.append({"module": name, "transaction": dict(tx)})
            tx.update(gas=25000000)
            receipt = w3.eth.wait_for_transaction_receipt(w3.eth.send_transaction(tx))
            if receipt.status != 1:
                raise AssertionError("actual planned deployment reverted: " + name)
            cls.modules[name] = receipt.contractAddress
            cls.receipts[name] = hx(receipt.transactionHash)
            receipt_evidence.append({"module": name, "transactionHash": hx(receipt.transactionHash), "blockHash": hx(receipt.blockHash), "blockNumber": receipt.blockNumber, "contractAddress": receipt.contractAddress, "status": receipt.status})
        (cls.output/"constructor-transactions.json").write_text(json.dumps(constructor_plans, indent=2)+"\n")
        (cls.output/"receipt-evidence.json").write_text(json.dumps(receipt_evidence, indent=2)+"\n")
        engine = contract(w3, cls.build, "FantasyContestEngine420", cls.modules["FantasyContestEngine420"])
        for name, getter in [("FantasyAdmission420", "admission"), ("FantasyRankingBook420", "rankings"), ("FantasyPayoutPolicy420", "payoutPolicy")]:
            cls.modules[name] = getattr(engine.functions, getter)().call()
        validator = Account.from_key(bytes.fromhex((f.private/"validator.key").read_text()))
        publisher = Account.from_key(bytes.fromhex((f.private/"publisher.key").read_text()))
        # Reuse the actual verified custodian from the complete application fixture.
        subject = word(f.validator_profile['subject'])
        credential = word(f.validator_profile['credential'])
        for s, c in [(subject, credential), (word(f.profiles[4]["subject"]), word(f.profiles[4]["credential"]))]:
            f.tx(engine.functions.registerIdentity(s, c))
        cls.roles = {"administrator": f.admin, "validator": validator.address, "publisher": publisher.address,
            "resolver": f.accounts[4], "reporterA": f.accounts[5], "reporterB": f.accounts[6],
            "validatorSubject": hx(subject), "validatorCredential": hx(credential), "validatorUserCredential": hx(credential),
            "resolverSubject": f.profiles[4]["subject"], "resolverCredential": f.profiles[4]["resolverCredential"],
            "resolverUserCredential": f.profiles[4]["credential"]}
        for pool in f.pools:
            scope = f.auth.functions.scopeForContest(word(pool)).call()
            old_grant = f.cap.functions.activeGrantId(f.accounts[4], word("0x"+Web3.keccak(text="420.BET.CORE").hex().removeprefix("0x")), Web3.keccak(text="BET_FANTASY_ENTER"), scope).call()
            if int.from_bytes(old_grant, "big"): f.tx(f.cap.functions.revokeGrant(old_grant))
        for slate in f.slates:
            scope = f.auth.functions.scopeForContest(word(slate)).call()
            old_grant = f.cap.functions.activeGrantId(validator.address, word("0x"+Web3.keccak(text="420.BET.CORE").hex().removeprefix("0x")), f.book.functions.VALIDATE_LINEUP().call(), scope).call()
            if int.from_bytes(old_grant, "big"): f.tx(f.cap.functions.revokeGrant(old_grant))
        now = w3.eth.get_block("latest").timestamp
        cls.grants = role_plan(w3, cls.build, cls.modules, cls.roles, p["slate"], p["pools"], None, now, now+3*86400)
        for g in cls.grants:
            tx = dict(g["transaction"], gas=500000)
            receipt = w3.eth.wait_for_transaction_receipt(w3.eth.send_transaction(tx))
            if receipt.status != 1: raise AssertionError("bounded role provisioning failed")
        book = contract(w3, cls.build, "FantasySlateBook420", cls.modules["FantasySlateBook420"])
        sid = word(p["slate"])
        old = f.book.functions.slateOf(sid).call()
        meta = f.slates[p["slate"]]
        custodian_key = contract(w3, cls.build, "FantasyAdmission420", cls.modules["FantasyAdmission420"]).functions.currentUserKey(subject).call()
        f.tx(book.functions.publish(sid, word(meta["feed"]), old[2], custodian_key, validator.address, old[6], [(word(meta["game"]), meta["lockAt"])], [(a["id"], word(meta["game"]), a["positions"]) for a in meta["athletes"]]))
        f.tx(book.functions.sealSlate(sid))
        p.update(slateManifest=hx(book.functions.slateOf(sid).call()[0]), custodianKeyHash=hx(old[2]))
        cls.providers = []
        for i in range(2):
            pid = Web3.keccak(text="daily-operator-"+str(i))
            cls.providers.append({"id": hx(pid), "epoch": f.providers.functions.providerEpoch(pid).call(), "metadata": hx(f.providers.functions.providers(pid).call()[1]), "upstream": "sportradar"})
        cls.feeds = []
        for feed in sorted(set(cls.config["candidateFeeds"].values()) | {s["feed"] for s in f.slates.values()}):
            fid = word(feed)
            f.tx(f.risk.functions.setPolicy(fid, 10000, 0, False))
            v = f.feeds.functions.feeds(fid).call()
            cls.feeds.append({"id": feed, "type": hx(v[0]), "aggregation": hx(v[1]), "metadata": hx(v[2]),
                "heartbeat": v[3], "revision": v[4], "decimals": v[5], "quorum": v[6],
                "sourceEpochs": {v["id"]: f.feeds.functions.sourceEpoch(fid, word(v["id"])).call() for v in cls.providers},
                "risk": list(f.risk.functions.policy(fid).call())})
        cls.manifest = snapshot_manifest(w3, cls.build, cls.modules, p, cls.roles, cls.feeds, cls.providers, cls.grants, cls.receipts, True)
        (cls.output/"local-deployment-manifest.json").write_text(json.dumps(cls.manifest, indent=2)+"\n", encoding="utf-8")
        (cls.output/"offline-bundle.json").write_text(json.dumps(bundle(cls.build), indent=2)+"\n", encoding="utf-8")
        (cls.output/"unsigned-authority-plan.json").write_text(json.dumps(cls.grants, indent=2)+"\n", encoding="utf-8")

    def setUp(self):
        self.snapshot = self.w3.provider.make_request("evm_snapshot", [])["result"]

    def tearDown(self):
        self.w3.provider.make_request("evm_revert", [self.snapshot])

    def reseal(self, m):
        m["intentDigest"] = digest({k: v for k, v in m.items() if k != "intentDigest"})
        return m

    def reject(self, mutate):
        value = copy.deepcopy(self.manifest)
        mutate(value)
        with self.assertRaises((ValueError, KeyError)):
            verify(self.w3, self.build, self.reseal(value))

    def test_real_deployment_and_all_bindings(self):
        result = verify(self.w3, self.build, self.manifest)
        self.assertEqual(result["status"], "LOCAL_DEPLOYMENT_VERIFIED")
        self.assertFalse(result["productionAuthorized"])
        (self.output/"local-attestation.json").write_text(json.dumps(result, indent=2)+"\n")

    def test_export_integrates_existing_application_client(self):
        config = export_application(self.w3, self.build, self.manifest, self.config)
        client = Chain(config)
        self.assertEqual(client.engine.address, self.modules["FantasyContestEngine420"])
        self.assertEqual(config["genesisHash"], self.manifest["genesisHash"])
        self.assertEqual(config["plannedPools"], self.parameters["pools"])
        bad = copy.deepcopy(self.config)
        bad['plannedPools'].append(self.fixture.pools[2])
        with self.assertRaises(ValueError): export_application(self.w3, self.build, self.manifest, bad)
        (self.output/"application-config.json").write_text(json.dumps(config, indent=2)+"\n")

    def test_local_evidence_never_attests_official_deployment(self):
        with self.assertRaises(ValueError): verify(self.w3, self.build, self.manifest, official=True)

    def test_reject_wrong_chain(self): self.reject(lambda m: m.update(chainID=420))
    def test_reject_wrong_genesis(self):
        self.reject(lambda m: m.update(genesisHash=hx(Web3.keccak(text="other genesis"))))
        config = export_application(self.w3, self.build, self.manifest, self.config)
        config['genesisHash'] = hx(Web3.keccak(text="other genesis"))
        with self.assertRaises(ValueError): Chain(config)
    def test_reject_snapshot_reorg(self): self.reject(lambda m: m.update(blockHash=hx(Web3.keccak(text="other block"))))
    def test_reject_runtime_hash(self): self.reject(lambda m: m["modules"]["FantasyNHLScoring420"].update(runtimeKeccak=hx(bytes(32))))
    def test_reject_missing_module(self): self.reject(lambda m: m["modules"].pop("FantasyAdmission420"))
    def test_reject_wrong_beneficiary(self): self.reject(lambda m: m["parameters"].update(developmentBeneficiary=self.fixture.accounts[7]))
    def test_reject_wrong_community(self): self.reject(lambda m: m["parameters"].update(community=self.fixture.accounts[7]))
    def test_reject_wrong_asset_precision(self): self.reject(lambda m: m["parameters"].update(assetDecimals=6))
    def test_reject_operator_key_conflict(self): self.reject(lambda m: m["roles"].update(resolver=m["roles"]["validator"]))
    def test_reject_operator_credential_substitution(self): self.reject(lambda m: m["roles"].update(resolverCredential=m["roles"]["validatorCredential"]))
    def test_reject_wrong_custodian_encryption_key(self): self.reject(lambda m: m["parameters"].update(custodianKeyHash=hx(Web3.keccak(text="wrong key"))))
    def test_reject_provider_epoch_drift(self): self.reject(lambda m: m["providers"][0].update(epoch=99))
    def test_reject_false_upstream_independence(self): self.reject(lambda m: m["providers"][1].update(upstream="independent-provider"))
    def test_reject_feed_revision_drift(self): self.reject(lambda m: m["feeds"][0].update(revision=99))
    def test_reject_source_epoch_drift(self): self.reject(lambda m: m["feeds"][0]["sourceEpochs"].update({m["providers"][0]["id"]:99}))
    def test_reject_missing_receipt(self): self.reject(lambda m: m["receipts"].pop("FantasyContestEngine420"))
    def test_reject_wrong_receipt(self): self.reject(lambda m: m["receipts"].update(FantasyContestEngine420=m["receipts"]["FantasyNHLScoring420"]))
    def test_reject_production_activation(self): self.reject(lambda m: m.update(productionAuthorized=True))
    def test_reject_publisher_without_gas(self): self.reject(lambda m: m["parameters"].update(publisherMinimumGasWei=str(10**30)))

    def test_actual_grant_revocation_fails_closed(self):
        tx = revocation_transaction(self.w3, self.build, self.modules, self.grants[0]["id"], self.fixture.admin)
        r = self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_transaction(dict(tx, gas=500000)))
        self.assertEqual(r.status, 1)
        with self.assertRaises(ValueError): verify(self.w3, self.build, self.manifest)

    def test_actual_provider_rotation_fails_closed(self):
        self.fixture.tx(self.fixture.providers.functions.setProvider(word(self.providers[0]["id"]), self.fixture.accounts[7], Web3.keccak(text="rotated"), bytes(32), True))
        with self.assertRaises(ValueError): verify(self.w3, self.build, self.manifest)

    def test_actual_expired_authority_fails_closed(self):
        self.fixture.advance(self.grants[0]["validUntil"])
        with self.assertRaises(ValueError): verify(self.w3, self.build, self.manifest)

    def test_actual_unapproved_operational_authority_fails_closed(self):
        self.fixture.grant(self.roles["publisher"], self.fixture.engine.functions.CREATE().call(), self.fixture.auth.functions.scopeGlobal().call())
        with self.assertRaises(ValueError): verify(self.w3, self.build, self.manifest)

    def test_actual_circuit_breaker_fails_closed(self):
        self.fixture.tx(self.fixture.risk.functions.setPolicy(word(self.feeds[0]["id"]), 10000, 0, True))
        with self.assertRaises(ValueError): verify(self.w3, self.build, self.manifest)

    def test_reject_missing_source_or_compiler_identity(self):
        self.reject(lambda m: m["bundle"]["sources"].pop(next(iter(m["bundle"]["sources"]))))
        tampered = self.output / "tampered-artifact-build"
        for name in MODULES:
            target = tampered / (name+".sol") / (name+".json")
            target.parent.mkdir(parents=True, exist_ok=True)
            item = artifact(self.build, name)
            if name == MODULES[0]:
                first = next(iter(item["metadata"]["sources"]))
                item["metadata"]["sources"][first]["keccak256"] = hx(bytes(32))
            target.write_text(json.dumps(item), encoding="utf-8")
        with self.assertRaises(ValueError): bundle(tampered)

    def test_no_resolution_grant_for_a_nonexistent_claim(self):
        now = self.w3.eth.get_block("latest").timestamp
        with self.assertRaises(ValueError): role_plan(self.w3, self.build, self.modules, self.roles, self.parameters["slate"], self.parameters["pool"], hx(Web3.keccak(text="nonexistent claim")), now, now+3600)

    def test_unsigned_plan_has_no_publisher_custody_or_wildcard_grants(self):
        self.assertEqual(len(self.grants), 9)
        self.assertNotIn(self.roles["publisher"], [g["principal"] for g in self.grants])
        with self.assertRaises(ValueError): role_plan(self.w3, self.build, self.modules, self.roles, self.parameters["slate"], self.parameters["pool"], None, 1, 0)
        with self.assertRaises(ValueError): creation_transaction(self.build, "Wrapped420", self.modules, self.parameters, self.fixture.admin)

    def test_runtime_template_rejects_unrelated_genuine_contract(self):
        code = self.w3.eth.get_code(self.modules["FantasyNHLScoring420"])
        with self.assertRaises(ValueError): runtime_matches(self.build, "OracleRiskPolicy420", code)

    def test_real_unsigned_oracle_provisioning_and_stale_plan_rejection(self):
        providers = [{"id": p["id"], "upstream": "sportradar", "expectedEpoch": p["epoch"], "metadata": hx(Web3.keccak(text="public local provenance"))} for p in self.providers]
        feed = {"id": hx(Web3.keccak(text="fresh deployment feed")), "expectedRevision": 0, "heartbeat": 3600, "metadata": hx(Web3.keccak(text="frozen initial feed policy"))}
        plan = oracle_authority_plan(self.w3, self.build, self.modules, self.roles, providers, [feed], self.fixture.admin)
        for tx in plan:
            receipt = self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_transaction(dict(tx, gas=500000)))
            self.assertEqual(receipt.status, 1)
        self.assertEqual(self.fixture.feeds.functions.minSourcesOf(word(feed["id"])).call(), 2)
        self.assertEqual(self.fixture.risk.functions.policy(word(feed["id"])).call(), [10000, 0, False, True])
        with self.assertRaises(ValueError): oracle_authority_plan(self.w3, self.build, self.modules, self.roles, providers, [feed], self.fixture.admin)


if __name__ == "__main__":
    unittest.main(verbosity=2)
