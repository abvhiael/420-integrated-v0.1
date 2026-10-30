"""Bounded session acceptance tests; no self-declared network qualification."""
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parent))
from app import AdmissionRejected
from identity import PlayerBinding
from rpc import Web3SportsRPC, FinalityPolicy
import session as session_module
from session import FundedSportsSession
from unittest.mock import patch

A=lambda n:"0x"+format(n,"040x")
H=lambda n:"0x"+format(n,"064x")
class Chain:
    def __init__(self):
        self.identity=A(1);self.asset=A(2);self.player=A(3);self.issuer=A(4)
        self.cred=H(5);self.profile=H(6);self.ctype=H(7);self.issuer_id=H(8)
        self.active=True;self.issuer_active=True;self.valid=True;self.credentials_ok=True
    def code(self,address):return b"valid" if address==self.identity else b""
    def read(self,address,name,*args):
        if name=="profiles":return (self.player,A(0),H(1),H(1),1,1,self.active)
        if name=="issuers":return (self.issuer,H(1),2,self.issuer_active)
        if name=="credentials":return (bytes.fromhex(self.issuer_id[2:]),bytes.fromhex(self.profile[2:]),bytes.fromhex(self.ctype[2:]),H(1),1,1000,0,False)
        if name=="credentialValid":return self.valid
        if name=="hasValidCredential":return self.credentials_ok
        raise AssertionError(name)
    def binding(self):
        return PlayerBinding(self.identity,self.profile,self.cred,self.ctype,self.issuer_id,self.asset,self.issuer)
class Wallet:
    def __init__(self,address,consent=True):self.address=address;self.consent=consent
    def confirm_terms(self,terms):return self.consent
class Runtime(Web3SportsRPC):
    def __init__(self,chain):
        self.chain=chain;self.sent=0
    def read(self,address,name,*args):
        if name=="get":
            config=(H(1),H(2),H(3),H(4),H(5),H(6),self.chain.asset,0,500)
            return (config,)
        return self.chain.read(address,name,*args)
    def code(self,address):return self.chain.code(address)
    def canonical_source_config(self,markets,market_id):return (H(1),H(2),H(3))
    def submit_player_funding(self,planned,wallet,*,gas_limit):
        self.sent+=1
        if planned["method"]!="fund" or planned["from"]!=wallet.address:raise AdmissionRejected("invalid funding intent")
        return H(99)
class App:
    def __init__(self,chain):
        self.deployment=type("D",(),{"markets":A(9),"vault":A(10),"asset":chain.asset,"verify":lambda self,rpc:None})()
        self.rpc=Runtime(chain);self.chain=chain
        self.verifier=type("V",(),{"verify":lambda self,source,now:object()})()
    def prepare(self,player,offer,source,now):
        return {"to":self.deployment.vault,"from":player,"method":"fund",
                "arguments":[offer],"consent":{"oddsDigest":H(11),"stake":100,"gross":190}}
    def verify_funding(self,receipt,ticket,player):return {"player":player,"ticket":ticket,"receipt":receipt}
    def recovery(self,ticket):return {"ticket":ticket,"oracleOnly":True}
class SessionTests(unittest.TestCase):
    def setUp(self):
        self.chain=Chain();self.app=App(self.chain)
        self.session=FundedSportsSession(self.app,self.chain.binding())
        self.quote_patch=patch.object(session_module,"validate_quote",return_value=H(11))
        self.quote_patch.start()
        self.addCleanup(self.quote_patch.stop)
    def test_authorized_wallet_funds_once(self):
        self.assertEqual(self.session.admit(Wallet(self.chain.player),{"marketId":H(1),"quoteDigest":H(11)},{},100,gas_limit=500000),H(99))
        self.assertEqual(self.app.rpc.sent,1)
    def test_declined_consent_is_not_broadcast(self):
        with self.assertRaises(AdmissionRejected):
            self.session.admit(Wallet(self.chain.player,False),{"marketId":H(1)},{},100,gas_limit=500000)
        self.assertEqual(self.app.rpc.sent,0)
    def test_wrong_wallet_revoked_issuer_and_credential_fail_closed(self):
        for changed in ("player","issuer_active","valid","active","credentials_ok"):
            old=getattr(self.chain,changed)
            setattr(self.chain,changed,A(12) if changed=="player" else False)
            with self.assertRaises(AdmissionRejected):
                self.session.admit(Wallet(self.chain.player if changed!="player" else A(3)),
                    {"marketId":H(1)},{},100,gas_limit=500000)
            setattr(self.chain,changed,old)
        self.assertEqual(self.app.rpc.sent,0)
    def test_noncanonical_asset_rejected(self):
        self.app.deployment.asset=A(12)
        with self.assertRaises(AdmissionRejected):
            self.session.admit(Wallet(self.chain.player),{"marketId":H(1)},{},100,gas_limit=500000)
    def test_invalid_finality_policy_rejected(self):
        for n in (0,4097):
            with self.assertRaises(AdmissionRejected):FinalityPolicy(n)
if __name__=="__main__":unittest.main()
