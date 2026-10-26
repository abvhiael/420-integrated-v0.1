"""RPC fault fixtures exercise monitoring only; no simulated cryptographic acceptance."""
import copy,importlib.util,unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('monitor',Path(__file__).with_name('monitor-poker-5c8.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class RPC:
 def __init__(self):self.chain=420;self.head=20;self.hash='0x'+'11'*32;self.genesis='0x'+'22'*32;self.code='0x6000';self.snapshot='0x'+'33'*32;self.calls=0;self.reorg=False
 def __call__(self,method,params):
  if method=='eth_chainId':return hex(self.chain)
  if method=='eth_blockNumber':return hex(self.head)
  if method=='eth_getCode':return self.code
  if method=='eth_call':return self.snapshot
  if method=='eth_getBlockByNumber':
   if params[0]=='0x0':return {'number':'0x0','hash':self.genesis}
   self.calls+=1
   return {'number':params[0],'hash':('0x'+'44'*32)if self.reorg and self.calls>1 else self.hash}
  raise AssertionError(method)
class MonitorTests(unittest.TestCase):
 def setUp(self):
  self.rpc=RPC();self.cfg={'chainId':420,'genesisHash':self.rpc.genesis,'eventId':'0x'+'55'*32,'table':0,'confirmations':2,'bindings':{name:{'address':'0x'+format(i+1,'040x'),'runtimeKeccak256':m.k256(bytes.fromhex('6000'))}for i,name in enumerate(['coordinator','bank','host','engine','entropy'])}}
 def bad(self,config=None,previous=None):
  with self.assertRaises(m.UnsafeObservation):m.observe(self.rpc,config or self.cfg,previous)
 def testFinalizedReadOnlyObservation(self):
  r=m.observe(self.rpc,self.cfg);self.assertEqual(r['blockNumber'],18);self.assertFalse(r['transactionSubmissionEnabled']);self.assertFalse(r['officialTestnetAccepted'])
 def testRestartMatchesCanonicalCheckpoint(self):
  first=m.observe(self.rpc,self.cfg);self.assertEqual(first,m.observe(self.rpc,self.cfg,first))
 def testWrongChain(self):self.rpc.chain=421;self.bad()
 def testWrongGenesis(self):self.rpc.genesis='0x'+'00'*32;self.bad()
 def testNoConfirmations(self):self.cfg['confirmations']=0;self.bad()
 def testInsufficientHeight(self):self.rpc.head=1;self.bad()
 def testCodeMutation(self):self.rpc.code='0x6001';self.bad()
 def testAbsentCode(self):self.rpc.code='0x';self.bad()
 def testReorgDuringRead(self):self.rpc.reorg=True;self.bad()
 def testReorgAcrossRestart(self):
  r=m.observe(self.rpc,self.cfg);self.rpc.hash='0x'+'66'*32;self.bad(previous=r)
 def testFinalityRegression(self):
  r=m.observe(self.rpc,self.cfg);self.rpc.head=19;self.bad(previous=r)
 def testConfigMutation(self):
  r=m.observe(self.rpc,self.cfg);self.cfg['table']=1;self.bad(previous=r)
 def testRPCSnapshotDisagreement(self):
  other=RPC();other.snapshot='0x'+'77'*32
  with self.assertRaises(m.UnsafeObservation):m.consensus([self.rpc,other],self.cfg)
 def testRPCBlockDisagreement(self):
  other=RPC();other.hash='0x'+'77'*32
  with self.assertRaises(m.UnsafeObservation):m.consensus([self.rpc,other],self.cfg)
 def testTwoRPCRequired(self):
  with self.assertRaises(m.UnsafeObservation):m.consensus([self.rpc],self.cfg)
 def testIdenticalRPCViewsAccepted(self):self.assertEqual(m.observe(RPC(),self.cfg),m.consensus([self.rpc,RPC()],self.cfg))
 def testInvalidSnapshot(self):self.rpc.snapshot='0x';self.bad()
 def testInvalidEvent(self):self.cfg['eventId']='0x'+'00'*32;self.bad()
 def testOutOfBoundTable(self):self.cfg['table']=65;self.bad()
 def testZeroBinding(self):self.cfg['bindings']['engine']['address']='0x'+'00'*20;self.bad()
if __name__=='__main__':unittest.main(verbosity=2)
