import test from 'node:test';
import assert from 'node:assert/strict';
import {
  confirmationCount,
  inspectAndReconcileTransaction,
  inspectTransactionLifecycle,
  normalizeReceipt,
  reconcileIndexedActivity,
} from '../core/transaction-lifecycle.js';

const hash=(byte)=>'0x'+byte.repeat(64);
const txHash=hash('a');
const blockHash=hash('b');
const nextHash=hash('c');

class MockProvider{
  constructor(handler){this.handler=handler;this.calls=[];}
  async request(payload){this.calls.push(payload);return this.handler(payload);}
}

function block(number,hashValue=blockHash){return {number:'0x'+BigInt(number).toString(16),hash:hashValue};}
function receipt({status='0x1',blockNumber='0xa',blockHash:blockHashValue=blockHash}={}){
  return {transactionHash:txHash,blockHash:blockHashValue,blockNumber,status,gasUsed:'0x5208',cumulativeGasUsed:'0x5208',logs:[]};
}

test('receipt normalization validates hash, block and status',()=>{
  const r=normalizeReceipt(receipt(),txHash);
  assert.equal(r.transactionHash,txHash);
  assert.equal(r.blockNumber,10n);
  assert.equal(r.status,1n);
  assert.throws(()=>normalizeReceipt({...receipt(),status:'0x2'},txHash));
});

test('confirmation count is inclusive and never negative',()=>{
  assert.equal(confirmationCount(10n,10n),1n);
  assert.equal(confirmationCount(10n,12n),3n);
  assert.equal(confirmationCount(12n,10n),0n);
});

test('pending and dropped transactions are distinguished when no receipt exists',async()=>{
  const pendingProvider=new MockProvider(({method})=>{
    if(method==='eth_getTransactionByHash') return {hash:txHash};
    if(method==='eth_getTransactionReceipt') return null;
    if(method==='eth_getBlockByNumber') return block(20,hash('d'));
  });
  const pending=await inspectTransactionLifecycle({provider:pendingProvider,txHash});
  assert.equal(pending.state,'PENDING');

  const droppedProvider=new MockProvider(({method})=>{
    if(method==='eth_getTransactionByHash') return null;
    if(method==='eth_getTransactionReceipt') return null;
    if(method==='eth_getBlockByNumber') return block(20,hash('d'));
  });
  const dropped=await inspectTransactionLifecycle({provider:droppedProvider,txHash});
  assert.equal(dropped.state,'DROPPED');
});

test('successful receipt promotes through included, confirmed, safe and finalized',async()=>{
  const makeProvider=({latest=10,safe=0,finalized=0}={})=>new MockProvider(({method,params})=>{
    if(method==='eth_getTransactionByHash') return {hash:txHash};
    if(method==='eth_getTransactionReceipt') return receipt();
    if(method==='eth_getBlockByNumber'){
      const tag=params[0];
      if(tag==='latest') return block(latest,hash('d'));
      if(tag==='safe') return safe?block(safe,hash('e')):null;
      if(tag==='finalized') return finalized?block(finalized,hash('f')):null;
      if(tag==='0xa') return block(10,blockHash);
    }
  });

  assert.equal((await inspectTransactionLifecycle({provider:makeProvider({latest:10}),txHash,minConfirmations:2})).state,'INCLUDED');
  assert.equal((await inspectTransactionLifecycle({provider:makeProvider({latest:11}),txHash,minConfirmations:2})).state,'CONFIRMED');
  assert.equal((await inspectTransactionLifecycle({provider:makeProvider({latest:12,safe:10}),txHash,minConfirmations:2})).state,'SAFE');
  assert.equal((await inspectTransactionLifecycle({provider:makeProvider({latest:12,safe:11,finalized:10}),txHash,minConfirmations:2})).state,'FINALIZED');
});

test('receipt status zero is REVERTED',async()=>{
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_getTransactionByHash') return {hash:txHash};
    if(method==='eth_getTransactionReceipt') return receipt({status:'0x0'});
    if(method==='eth_getBlockByNumber'){
      if(params[0]==='latest') return block(12,hash('d'));
      if(params[0]==='safe'||params[0]==='finalized') return null;
      if(params[0]==='0xa') return block(10,blockHash);
    }
  });
  const state=await inspectTransactionLifecycle({provider,txHash});
  assert.equal(state.state,'REVERTED');
  assert.equal(state.confirmations,3);
});

test('receipt whose inclusion block hash no longer matches is REORGED',async()=>{
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_getTransactionByHash') return null;
    if(method==='eth_getTransactionReceipt') return receipt();
    if(method==='eth_getBlockByNumber'){
      if(params[0]==='latest') return block(12,hash('d'));
      if(params[0]==='safe'||params[0]==='finalized') return null;
      if(params[0]==='0xa') return block(10,nextHash);
    }
  });
  const state=await inspectTransactionLifecycle({provider,txHash});
  assert.equal(state.state,'REORGED');
  assert.equal(state.canonical,false);
});

test('V13 reconciliation reports canonical, reorg, replacement and conflicts without overwriting RPC truth',()=>{
  const rpcLifecycle={state:'FINALIZED'};
  const canonical=[
    {recordId:'r1',kind:'TRADE',txHash,active:true,replacedBy:null},
    {recordId:'r2',kind:'FEE_ROUTING',txHash,active:true,replacedBy:null},
  ];
  const ok=reconcileIndexedActivity({txHash,rpcLifecycle,records:canonical});
  assert.equal(ok.status,'CANONICAL');
  assert.equal(ok.reconciled,true);
  assert.equal(ok.conflicts.length,0);

  const orphan=[{recordId:'old',kind:'TRADE',txHash,active:false,replacedBy:'new'}];
  const conflict=reconcileIndexedActivity({txHash,rpcLifecycle,records:orphan});
  assert.equal(conflict.status,'REORGED');
  assert.deepEqual(conflict.replacementRecordIds,['new']);
  assert.deepEqual(conflict.conflicts,['rpc-canonical-v13-reorg']);
  assert.equal(conflict.reconciled,false);
});

test('reverted RPC receipt conflicts with canonical success activity',()=>{
  const result=reconcileIndexedActivity({
    txHash,
    rpcLifecycle:{state:'REVERTED'},
    records:[{recordId:'fill',kind:'FILL',txHash,active:true}],
  });
  assert.deepEqual(result.conflicts,['reverted-rpc-has-canonical-success-activity']);
});

test('inspectAndReconcileTransaction combines canonical RPC and V13 history evidence',async()=>{
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_getTransactionByHash') return {hash:txHash};
    if(method==='eth_getTransactionReceipt') return receipt();
    if(method==='eth_getBlockByNumber'){
      if(params[0]==='latest') return block(15,hash('d'));
      if(params[0]==='safe') return block(12,hash('e'));
      if(params[0]==='finalized') return block(10,hash('f'));
      if(params[0]==='0xa') return block(10,blockHash);
    }
  });
  const calls=[];
  const exchangeClient={
    async history(query){
      calls.push(query);
      if(query.kind==='TRADE') return {records:[{recordId:'trade-1',subjectId:'m1',kind:'TRADE',txHash,active:true}],nextCursor:''};
      return {records:[],nextCursor:''};
    }
  };
  const result=await inspectAndReconcileTransaction({
    provider,exchangeClient,txHash,kinds:['TRADE','FILL'],
  });
  assert.equal(result.rpc.state,'FINALIZED');
  assert.equal(result.indexed.status,'CANONICAL');
  assert.equal(result.indexed.reconciled,true);
  assert.deepEqual(calls.map(x=>x.activeOnly),[false,false]);
});
