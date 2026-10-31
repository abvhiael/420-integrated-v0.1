"""Real ECDSA wallet-signing and RPC canonical receipt adapter acceptance.

The transport and event fixtures are simulated; the signed transaction is real.
Solidity EVM custody/settlement is certified separately by the inherited Foundry
suite, and this test must not be misrepresented as an official network receipt.
"""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from eth_account import Account
from eth_utils import keccak
from app import AdmissionRejected
from rpc import Web3SportsRPC,FinalityPolicy

A=lambda n:"0x"+format(n,"040x")
H=lambda n:"0x"+format(n,"064x")
class Function:
    def __init__(self,build=None,result=None):self._build,self._result=build,result
    def build_transaction(self,params):
        return dict(params, to=self._build, value=0, data="0x11223344")
    def call(self):return self._result
class Functions:
    def __init__(self,contract):self.c=contract
    def fund(self,*args):return Function(self.c.address)
    def allowance(self,*args):return Function(result=self.c.allowance)
    def balanceOf(self,*args):return Function(result=self.c.balance)
    def current(self,*args):return Function(result=self.c.current)
    def get(self,*args):return Function(result=self.c.ticket)
    def settlementReceipt(self,*args):return Function(result=self.c.receipt)
class EventProcessor:
    def __init__(self,events):self.events=events
    def process_receipt(self,receipt):return self.events
class Events:
    def __init__(self,c):self.c=c
    def TicketFunded(self):return EventProcessor(self.c.event_records)
class Contract:
    def __init__(self,address):
        self.address=address;self.allowance=999;self.balance=999
        self.functions=Functions(self);self.events=Events(self)
        self.current=((bytes.fromhex(H(1)[2:]), bytes.fromhex(H(2)[2:]),
            bytes.fromhex(H(3)[2:]),bytes.fromhex(H(4)[2:]),A(9),1,100,200,1,[1850000]),True)
        self.ticket=(A(7),bytes.fromhex(H(5)[2:]),bytes.fromhex(H(6)[2:]),bytes.fromhex(H(1)[2:]),
            bytes.fromhex(H(2)[2:]),bytes.fromhex(H(3)[2:]),100,185,85,1,1,1)
        self.receipt=(2,185,bytes.fromhex(H(4)[2:]),120,A(9))
        self.event_records=[]
class Eth:
    def __init__(self):
        self.chain_id=420;self.gas_price=1000000000;self.block_number=20
        self.block_hash=bytes.fromhex(H(60)[2:]);self.tx_hash=bytes.fromhex(H(61)[2:])
        self.signed_from=None
        self.transaction=None
        self.receipt={"blockNumber":15,"blockHash":self.block_hash,"status":1}
        self.contracts={}
    def get_code(self,address):return b"code"
    def get_transaction_count(self,address,state):
        assert state=="pending";return 0
    def contract(self,address,abi):return self.contracts.setdefault(address.lower(),Contract(address))
    def send_raw_transaction(self,raw):
        self.signed_from=Account.recover_transaction(raw)
        return self.tx_hash
    def get_transaction_receipt(self,tx_hash):return self.receipt
    def get_block(self,n):return {"hash":self.block_hash}
    def get_transaction(self,h):return self.transaction
class W3:
    def __init__(self):self.eth=Eth()
    def to_hex(self,x):return "0x"+bytes(x).hex()
class Wallet:
    def __init__(self):
        self.account=Account.from_key(bytes([3])*32)
        self.address=self.account.address
    def sign_transaction(self,tx):return self.account.sign_transaction(tx)
class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.w3=W3();self.vault=A(1);self.asset=A(2);self.wallet=Wallet()
        self.rpc=Web3SportsRPC(self.w3,{self.vault.lower():[],self.asset.lower():[]},FinalityPolicy(5))
        self.offer={"marketId":H(5),"selection":H(6),"quoteDigest":H(1),"stake":100,
            "minGrossReturn":185,"maxGrossReturn":185,"expiry":150,
            "nonce":H(7),"fundingReceipt":H(8)}
        self.tx={"to":self.vault,"from":self.wallet.address,"asset":self.asset,
                 "method":"fund","arguments":[self.offer]}
    def test_actual_ecdsa_wallet_signature_and_approval(self):
        self.assertEqual(self.rpc.submit_player_funding(self.tx,self.wallet,gas_limit=250000),H(61))
        self.assertEqual(self.w3.eth.signed_from.lower(),self.wallet.address.lower())
    def test_missing_allowance_and_balance_fail_without_broadcast(self):
        token=self.w3.eth.contract(self.asset,[])
        for field in ("allowance","balance"):
            old=getattr(token,field);setattr(token,field,0)
            with self.assertRaises(AdmissionRejected):
                self.rpc.submit_player_funding(self.tx,self.wallet,gas_limit=250000)
            setattr(token,field,old)
        self.assertIsNone(self.w3.eth.signed_from)
    def test_wrong_sender_and_accept_bypass_fail_without_broadcast(self):
        self.tx["from"]=A(11)
        with self.assertRaises(AdmissionRejected):
            self.rpc.submit_player_funding(self.tx,self.wallet,gas_limit=250000)
        self.tx["from"]=self.wallet.address;self.tx["method"]="accept"
        with self.assertRaises(AdmissionRejected):
            self.rpc.submit_player_funding(self.tx,self.wallet,gas_limit=250000)
    def test_abi_structs_are_canonically_decoded(self):
        quote,usable=self.rpc.read(self.asset,"current",H(5))
        self.assertTrue(usable)
        self.assertEqual(quote["digest"],H(1))
        ticket=self.rpc.read(self.asset,"get",H(99))
        self.assertEqual(ticket["state"],1)
        receipt=self.rpc.read(self.asset,"settlementReceipt",H(99))
        self.assertEqual(receipt["outcome"],2)
    def test_finality_reorg_and_event_reconciliation(self):
        ticket=H(71)
        self.w3.eth.transaction={"to":self.vault,"from":self.wallet.address,"blockHash":self.w3.eth.block_hash}
        vault=self.w3.eth.contract(self.vault,[])
        vault.event_records=[{"address":self.vault,"args":{"id":bytes.fromhex(ticket[2:])}}]
        self.assertEqual(self.rpc.reconcile_funding(self.w3.to_hex(self.w3.eth.tx_hash),ticket,
                    self.vault,self.wallet.address)["ticketFunded"]["id"],ticket)
        self.w3.eth.block_number=17
        with self.assertRaises(AdmissionRejected):
            self.rpc.reconcile_after_restart(H(61),ticket,self.vault,self.wallet.address)
        self.w3.eth.block_number=20;self.w3.eth.block_hash=bytes.fromhex(H(90)[2:])
        with self.assertRaises(AdmissionRejected):
            self.rpc.reconcile_after_restart(H(61),ticket,self.vault,self.wallet.address)
if __name__=="__main__":unittest.main()
