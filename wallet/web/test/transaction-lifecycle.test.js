import test from 'node:test';
import assert from 'node:assert/strict';
import {assertWalletChain420,readWalletTransactionStatus420,waitForWalletReceipt420,PendingWalletTransaction420} from '../core/transaction-lifecycle.js';
const hash='0x'+'ab'.repeat(32),blockHash='0x'+'cd'.repeat(32);
test('chain guard rejects wrong chain and malformed data',async()=>{
  assert.equal(await assertWalletChain420({request:async()=> '0x01a4'},'0x1a4'),'0x1a4');
  await assert.rejects(assertWalletChain420({request:async()=> '0x1'},'0x1a4'),/chain changed/);
  await assert.rejects(assertWalletChain420({request:async()=> 'bad'},'0x1a4'),/invalid connected/);
});
test('pending is not failure or permission to rebroadcast',async()=>{
  await assert.rejects(waitForWalletReceipt420({request:async()=>null},hash,{attempts:1}),e=>e.code==='WALLET_TX_PENDING'&&e.txHash===hash);
});
test('reorganization invalidates initial included receipt',async()=>{
  const r={status:'0x1',transactionHash:hash,blockNumber:'0x9',blockHash};
  const p={request:async(method)=>method==='eth_getTransactionReceipt'?r:method==='eth_getBlockByNumber'?{hash:'0x'+'fe'.repeat(32)}:'0xa'};
  assert.equal((await readWalletTransactionStatus420(p,hash,{canonical:true})).status,'reorganized');
  await assert.rejects(waitForWalletReceipt420(p,hash,{canonical:true,attempts:1}),/reorganized/);
});
test('canonical receipt needs requested confirmations and stable second read',async()=>{
  const r={status:'0x1',transactionHash:hash,blockNumber:'0x9',blockHash};
  let reads=0;
  const p={request:async(method)=>{if(method==='eth_getTransactionReceipt'){reads++;return r;}
    if(method==='eth_getBlockByNumber')return{hash:blockHash};if(method==='eth_blockNumber')return'0xa';throw Error(method);}};
  const result=await waitForWalletReceipt420(p,hash,{canonical:true,confirmations:2,attempts:1});
  assert.equal(result.confirmations,2n);assert.equal(reads,2);
});
test('second receipt disappearing is a reorg',async()=>{
  let reads=0;const r={status:'0x1',transactionHash:hash,blockNumber:'0x9',blockHash};
  const p={request:async(method)=>method==='eth_getTransactionReceipt'?(++reads===1?r:null):method==='eth_getBlockByNumber'?{hash:blockHash}:'0x9'};
  assert.equal((await readWalletTransactionStatus420(p,hash,{canonical:true})).status,'reorganized');
});
test('reject receipt hash mismatch and missing canonical metadata',async()=>{
  await assert.rejects(readWalletTransactionStatus420({request:async()=>({status:'0x1',transactionHash:'0x'+'ff'.repeat(32)})},hash),/hash mismatch/);
  await assert.rejects(readWalletTransactionStatus420({request:async()=>({status:'0x1',transactionHash:hash})},hash,{canonical:true}),/missing block/);
});
test('polling cancellation is not chain cancellation',async()=>{
  await assert.rejects(waitForWalletReceipt420({request:async()=>{throw Error('unexpected rpc')}},hash,{cancelled:()=>true}),e=>e instanceof PendingWalletTransaction420&&/may still be mined/.test(e.message));
});
test('reverted receipt fails closed',async()=>{
  const r={status:'0x0',transactionHash:hash,blockNumber:'0x9',blockHash};
  const p={request:async(method)=>method==='eth_getTransactionReceipt'?r:method==='eth_getBlockByNumber'?{hash:blockHash}:'0x9'};
  await assert.rejects(waitForWalletReceipt420(p,hash,{attempts:1}),/reverted/);
});
