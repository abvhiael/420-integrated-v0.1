import importlib.util
from hashlib import sha256
from pathlib import Path
import sys
import unittest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))
import app as mod
from source_verifier import SourcePolicy, SourceVerifier

H = lambda n: "0x" + format(n, "064x")
A = lambda n: "0x" + format(n, "040x")

class RPC:
    def __init__(self, addresses, evidence):
        self.a = addresses
        self.evidence = evidence
        self.values = {("vault", "admission"): "admission", ("vault", "markets"): "markets",
                       ("vault", "odds"): "odds", ("vault", "certification"): "certification",
                       ("admission", "odds"): "odds", ("oracle_gate", "vault"): "vault",
                       ("oracle_gate", "markets"): "markets", ("oracle_gate", "certification"): "certification",
                       ("oracle_gate", "oracle"): "oracle"}
        self.gate=True;self.cap=1000
        self.receipt={"outcome":2,"finalizedAt":120,"executor":addresses["oracle_gate"]}
        self.state=1
    def chain_id(self):return 420
    def code(self,address):return bytes([list(self.a.values()).index(address)+1])
    def read(self,address,method,*args):
        who=next(k for k,v in self.a.items() if v==address)
        if (who,method) in self.values:return self.a[self.values[(who,method)]]
        if method=="oracleOnlyFunding":return self.gate
        if method=="current":return ({"sourceDigest":H(1),"evidenceDigest":self.evidence,
            "sequence":1,"observedAt":100,"validUntil":200,"digest":H(3)},True)
        if method=="preview":return (185,85,True)
        if method=="marketOracleGate":return self.a["oracle_gate"]
        if method=="assetProfitCap":return self.cap
        if method=="assetProfitExposure":return 0
        if method=="get":return {"player":A(9),"state":self.state}
        if method=="settlementReceipt":return self.receipt
        raise AssertionError((who,method,args))

class Qualification(unittest.TestCase):
    def setUp(self):
        addresses={k:A(i+1) for i,k in enumerate(("vault","admission","odds","markets","certification","oracle_gate","oracle","asset"))}
        hashes={k:"0x"+sha256(bytes([i+1])).hexdigest() for i,k in enumerate(addresses)}
        self.d=mod.Deployment(420,**addresses,code_hashes=hashes)
        self.signer=Ed25519PrivateKey.generate()
        pub=self.signer.public_key().public_bytes(Encoding.Raw,PublicFormat.Raw).hex()
        self.verifier=SourceVerifier(SourcePolicy("licensed-source",pub,H(1),60,250))
        self.report={"provider":"licensed-source","marketId":H(4),"sequence":1,
            "observedAt":100,"validUntil":200,"sourceDigest":H(1),"evidence":{"result":"A"}}
        self.source=self.signed()
        evidence="0x"+sha256(mod.canonical(self.report["evidence"])).hexdigest()
        self.rpc=RPC(addresses,evidence)
        self.app=mod.SportsbookClient(self.d,self.rpc,self.verifier)
        self.offer={"marketId":H(4),"nonce":H(5),"quoteDigest":H(3),"expiry":150,"stake":100}
    def signed(self):
        return {"report":dict(self.report),"signature":self.signer.sign(
            b"420.BET.SPORT.SOURCE.V1\x00"+mod.canonical(self.report)).hex()}
    def test_preview_vault_fund_unsigned_only(self):
        tx=self.app.prepare(A(9),self.offer,self.source,110)
        self.assertEqual((tx["to"],tx["method"],tx["from"]),(self.d.vault,"fund",A(9)))
        self.assertEqual(tx["consent"]["gross"],185)
    def test_tampered_source_or_signature_rejected(self):
        for packet in ({"report":dict(self.report),"signature":"00"*64},
                       {"report":dict(self.report,marketId=H(20)),"signature":self.source["signature"]},
                       {"report":dict(self.report,evidence={"result":"B"}),"signature":self.source["signature"]}):
            with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,packet,110)
    def test_wrong_market_and_stale_source_rejected(self):
        self.report["marketId"]=H(12)
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.signed(),110)
        self.report["marketId"]=H(4);self.report["validUntil"]=105
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.signed(),110)
    def test_expired_entitlement_and_wrong_trust_root(self):
        wrong=SourceVerifier(SourcePolicy("licensed-source",Ed25519PrivateKey.generate().public_key().public_bytes(Encoding.Raw,PublicFormat.Raw).hex(),H(1),60,250))
        self.app.verifier=wrong
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
        self.app.verifier=self.verifier;self.report["validUntil"]=251
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.signed(),110)
    def test_wrong_chain_and_code_hash_rejected(self):
        bad=mod.Deployment(421,**self.rpc.a,code_hashes=self.d.code_hashes)
        with self.assertRaises(mod.AdmissionRejected):bad.verify(self.rpc)
        bad=mod.Deployment(420,**self.rpc.a,code_hashes=dict(self.d.code_hashes,vault=H(12)))
        with self.assertRaises(mod.AdmissionRejected):bad.verify(self.rpc)
    def test_oracle_fuse_and_risk_freeze(self):
        self.rpc.gate=False
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
        self.rpc.gate=True;self.rpc.cap=0
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
    def test_no_untrusted_verifier_bypass(self):
        self.app.verifier=lambda _:mod.VerifiedEvidence(H(1),self.rpc.evidence,H(4),1,100,200,"fake")
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
    def test_funding_receipt_reorg_and_spoof_rejected(self):
        receipt={"finalized":True,"success":True,"to":self.d.vault,"ticketFunded":{"id":H(10)}}
        self.assertEqual(self.app.verify_funding(receipt,H(10),A(9))["state"],1)
        for bad in ({"orphaned":True},{"finalized":False},{"to":A(11)}):
            with self.assertRaises(mod.AdmissionRejected):self.app.verify_funding(dict(receipt,**bad),H(10),A(9))
    def test_recovery_oracle_only_and_refund(self):
        self.assertEqual(self.app.recovery(H(10))["normalSettlementOnly"]["to"],self.d.oracle_gate)
        self.assertEqual(self.app.recovery(H(10))["refundOnly"]["method"],"refund")
        self.rpc.state=2
        self.assertEqual(self.app.recovery(H(10))["state"],"TERMINAL")
        self.rpc.receipt=dict(self.rpc.receipt,executor=A(13))
        with self.assertRaises(mod.AdmissionRejected):self.app.recovery(H(10))
    def test_wrong_binding_rejected(self):
        self.rpc.values[("oracle_gate","vault")]="odds"
        with self.assertRaises(mod.AdmissionRejected):self.app.prepare(A(9),self.offer,self.source,110)
if __name__=="__main__":unittest.main()
