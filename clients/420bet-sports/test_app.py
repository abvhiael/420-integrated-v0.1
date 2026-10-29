import importlib.util
from hashlib import sha256
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("sportsapp", Path(__file__).with_name("app.py"))
mod = importlib.util.module_from_spec(spec)
import sys
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)
H = lambda n: "0x" + format(n, "064x")
A = lambda n: "0x" + format(n, "040x")

class RPC:
    def __init__(self, addresses):
        self.a = addresses
        self.values = {("vault", "admission"): "admission", ("vault", "markets"): "markets",
                       ("vault", "odds"): "odds", ("vault", "certification"): "certification",
                       ("admission", "odds"): "odds", ("oracle_gate", "vault"): "vault",
                       ("oracle_gate", "markets"): "markets", ("oracle_gate", "certification"): "certification",
                       ("oracle_gate", "oracle"): "oracle"}
        self.gate = True
        self.cap = 1000
        self.receipt = {"outcome": 2, "finalizedAt": 120, "executor": addresses["oracle_gate"]}
        self.state = 1
    def chain_id(self): return 420
    def code(self, address):
        return bytes([list(self.a.values()).index(address) + 1])
    def read(self, address, method, *args):
        who = next(k for k, v in self.a.items() if v == address)
        if (who, method) in self.values:
            return self.a[self.values[(who,method)]]
        if method == "oracleOnlyFunding": return self.gate
        if method == "current": return ({"sourceDigest": H(1), "evidenceDigest": H(2), "sequence": 1,
                                         "observedAt": 100, "validUntil": 200, "digest": H(3)}, True)
        if method == "preview": return (185, 85, True)
        if method == "marketOracleGate": return self.a["oracle_gate"]
        if method == "assetProfitCap": return self.cap
        if method == "assetProfitExposure": return 0
        if method == "get": return {"player": A(9), "state": self.state}
        if method == "settlementReceipt": return self.receipt
        raise AssertionError((who,method,args))

class Qualification(unittest.TestCase):
    def setUp(self):
        addresses = {k: A(i+1) for i,k in enumerate(("vault","admission","odds","markets","certification","oracle_gate","oracle","asset"))}
        hashes = {k:"0x"+sha256(bytes([i+1])).hexdigest() for i,k in enumerate(addresses)}
        self.d = mod.Deployment(420, **addresses, code_hashes=hashes)
        self.rpc=RPC(addresses)
        self.source= {"signed": True}
        self.ev=mod.VerifiedEvidence(H(1),H(2),H(4),1,100,200,"independently-authenticated-source")
        self.verifier=lambda source: self.ev if source.get("signed") else None
        self.app=mod.SportsbookClient(self.d,self.rpc,self.verifier)
        self.offer={"marketId":H(4),"nonce":H(5),"quoteDigest":H(3),"expiry":150,"stake":100}
    def test_preview_is_nonbroadcasting_and_vault_only(self):
        tx=self.app.prepare(A(9),self.offer,self.source,110)
        self.assertEqual((tx["to"],tx["method"],tx["from"]), (self.d.vault,"fund",A(9)))
        self.assertEqual(tx["consent"]["gross"],185)
    def test_source_signature_required(self):
        with self.assertRaises(mod.AdmissionRejected): self.app.prepare(A(9),self.offer,{"signed":False},110)
    def test_wrong_market_and_stale_source_rejected(self):
        self.ev=mod.VerifiedEvidence(H(1),H(2),H(12),1,100,200,"provider")
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
        self.ev=mod.VerifiedEvidence(H(1),H(2),H(4),1,100,105,"provider")
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
    def test_wrong_chain_and_code_hash_rejected(self):
        self.d=mod.Deployment(421,**self.rpc.a,code_hashes=self.d.code_hashes)
        with self.assertRaises(mod.AdmissionRejected):self.d.verify(self.rpc)
        self.d=mod.Deployment(420,**self.rpc.a,code_hashes=dict(self.app.deployment.code_hashes, vault=H(12)))
        with self.assertRaises(mod.AdmissionRejected):self.d.verify(self.rpc)
    def test_oracle_fuse_and_risk_freeze(self):
        self.rpc.gate=False
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
        self.rpc.gate=True;self.rpc.cap=0
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
    def test_funding_receipt_reorg_and_spoof_rejected(self):
        receipt={"finalized":True,"success":True,"to":self.d.vault,"ticketFunded":{"id":H(10)}}
        self.assertEqual(self.app.verify_funding(receipt,H(10),A(9))["state"],1)
        for changed in ({"orphaned":True},{"finalized":False},{"to":A(11)}):
            with self.assertRaises(mod.AdmissionRejected):
                self.app.verify_funding(dict(receipt,**changed),H(10),A(9))
    def test_recovery_oracle_only_and_refund(self):
        result=self.app.recovery(H(10))
        self.assertEqual(result["normalSettlementOnly"]["to"],self.d.oracle_gate)
        self.assertEqual(result["refundOnly"]["method"],"refund")
        self.rpc.state=2
        self.assertEqual(self.app.recovery(H(10))["state"],"TERMINAL")
        self.rpc.receipt=dict(self.rpc.receipt,executor=A(13))
        with self.assertRaises(mod.AdmissionRejected):self.app.recovery(H(10))
    def test_wrong_binding_rejected(self):
        self.rpc.values[("oracle_gate","vault")]="odds"
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
if __name__=="__main__":unittest.main()
