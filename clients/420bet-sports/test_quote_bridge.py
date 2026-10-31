import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from quote_bridge import signed_quote_digest,source_config_digest,validate_quote
from app import AdmissionRejected,VerifiedEvidence

H=lambda n:"0x"+format(n,"064x")
A=lambda n:"0x"+format(n,"040x")
class RPC:
    def __init__(self,market,odds,quote,terms):
        self.market,self.odds,self.quote,self.terms=market,odds,quote,terms
        self.usable=True
    def read(self,addr,method,*args):
        if method=="get":return ((H(5),),bytes.fromhex(self.terms[2:]))
        if method=="current":return self.quote,self.usable
        if method=="digest":return bytes.fromhex(self.quote["digest"][2:])
        raise AssertionError(method)
class QuoteBridgeTests(unittest.TestCase):
    def setUp(self):
        self.chain=420;self.odds=A(9);self.market=H(3);self.terms=H(4)
        self.config=(H(12),H(13),H(14))
        self.source=source_config_digest(*self.config)
        self.evidence=H(2)
        self.q={"quoteEpoch":1,"sequence":2,"observedAt":100,"validUntil":200,
                "sourceDigest":self.source,"evidenceDigest":self.evidence,"prices":[1850000,2000000]}
        self.q["digest"]=signed_quote_digest(self.chain,self.odds,self.market,self.terms,self.q)
        self.d=type("Deployment",(),{"chain_id":self.chain,"odds":self.odds,"markets":A(5)})()
        self.rpc=RPC(self.market,self.odds,self.q,self.terms)
        self.ev=VerifiedEvidence(self.source,self.evidence,self.market,2,100,200,"provider")
    def test_dual_domain_positive_binding(self):
        self.assertEqual(validate_quote(self.rpc,self.d,self.market,self.ev,self.config),self.q["digest"])
    def test_source_policy_tamper_fails(self):
        with self.assertRaises(AdmissionRejected):
            validate_quote(self.rpc,self.d,self.market,self.ev,(H(99),self.config[1],self.config[2]))
    def test_source_evidence_tamper_fails(self):
        ev=VerifiedEvidence(self.source,H(55),self.market,2,100,200,"provider")
        with self.assertRaises(AdmissionRejected):validate_quote(self.rpc,self.d,self.market,ev,self.config)
    def test_ecdsa_quote_digest_tamper_fails(self):
        for change in ({"prices":[1860000,2000000]},{"sequence":3},{"quoteEpoch":2},{"validUntil":199}):
            self.rpc.quote=dict(self.q,**change)
            with self.assertRaises(AdmissionRejected):validate_quote(self.rpc,self.d,self.market,self.ev,self.config)
    def test_wrong_domain_and_unusable_quote(self):
        self.d.chain_id=421
        with self.assertRaises(AdmissionRejected):validate_quote(self.rpc,self.d,self.market,self.ev,self.config)
        self.d.chain_id=420;self.rpc.usable=False
        with self.assertRaises(AdmissionRejected):validate_quote(self.rpc,self.d,self.market,self.ev,self.config)
    def test_cross_contract_and_chain_replay_changes_digest(self):
        self.assertNotEqual(self.q["digest"],signed_quote_digest(421,self.odds,self.market,self.terms,self.q))
        self.assertNotEqual(self.q["digest"],signed_quote_digest(420,A(10),self.market,self.terms,self.q))
if __name__=="__main__":unittest.main()
