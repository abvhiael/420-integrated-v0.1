import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileExtensionTransaction420,extensionTransactionInFlight420} from '../core/extension-transaction-activity.js';
const hash='0x'+'ab'.repeat(32),blockHash='0x'+'cd'.repeat(32),chainId='0x1a4';
const entry={id:'send-1',status:'submitted',hash,chainId,recipient:'0x'+'11'.repeat(20)};
const receipt={status:'0x1',transactionHash:hash,blockNumber:'0x9',blockHash};
function provider({r=receipt,tip='0xa',block={hash:blockHash},onReceipt}={}){
  return {request:async(method)=>{
    if(method==='eth_chainId')return chainId;
    if(method==='eth_getTransactionReceipt')return onReceipt?onReceipt():r;
    if(method==='eth_getBlockByNumber')return block;
    if(method==='eth_blockNumber')return tip;
    throw Error('unexpected method '+method);
  }};
}
test('submitted transaction remains pending while receipt is absent',async()=>{
  const result=await reconcileExtensionTransaction420(entry,{provider:provider({r:null}),chainId});
  assert.equal(result.status,'pending');assert.equal(result.confirmations,'0');
});
test('receipt inclusion is distinct from canonical two-block confirmation',async()=>{
  const included=await reconcileExtensionTransaction420(entry,{provider:provider({tip:'0x9'}),chainId});
  assert.equal(included.status,'included');assert.equal(included.confirmations,'1');
  const final=await reconcileExtensionTransaction420(included,{provider:provider(),chainId});
  assert.equal(final.status,'confirmed');assert.equal(final.confirmations,'2');
});
test('canonical execution revert is recorded as reverted',async()=>{
  const result=await reconcileExtensionTransaction420(entry,{provider:provider({r:{...receipt,status:'0x0'}}),chainId});
  assert.equal(result.status,'reverted');
});
test('orphaned block is tracked as reorganization, never confirmed',async()=>{
  const result=await reconcileExtensionTransaction420(entry,{provider:provider({block:{hash:'0x'+'ef'.repeat(32)}}),chainId});
  assert.equal(result.status,'reorganized');assert.equal(result.confirmations,'0');
});
test('receipt disappearing during canonical second read is a reorganization',async()=>{
  let n=0;const result=await reconcileExtensionTransaction420(entry,{provider:provider({onReceipt:()=>++n===1?receipt:null}),chainId});
  assert.equal(result.status,'reorganized');
});
test('refuses wrong chain or malformed hash and does not query another network',async()=>{
  await assert.rejects(reconcileExtensionTransaction420(entry,{provider:provider(),chainId:'0x1'}),/another chain/);
  await assert.rejects(reconcileExtensionTransaction420({...entry,hash:'garbage'},{provider:provider(),chainId}),/invalid transaction hash/);
});
test('stable states are not downgraded, and missing receipts never imply dropped/replaced/cancelled',async()=>{
  for(const status of ['confirmed','reverted','dropped','replaced','cancelled']){
    const stable={...entry,status};assert.deepEqual(await reconcileExtensionTransaction420(stable,{provider:provider({r:null}),chainId}),stable);
  }
});
test('in-flight status classification is explicit',()=>{
  assert.equal(extensionTransactionInFlight420('submitted'),true);
  assert.equal(extensionTransactionInFlight420('reorganized'),true);
  assert.equal(extensionTransactionInFlight420('confirmed'),false);
});
