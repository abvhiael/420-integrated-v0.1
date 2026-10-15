import test from 'node:test';import assert from 'node:assert/strict';
import {createHighCountryTransactionLifecycle420} from '../src/transaction.js';
const hash=n=>'0x'+n.repeat(64),tx=hash('a'),block=hash('b');
function fixture(){let receipt=null,head=1,actual='0x1',canonical=true,witness=true,offline=false,req=[];
 const client=createHighCountryTransactionLifecycle420({rpcUrl:'https://rpc.example',chainId:1,
  witness:async()=>witness,fetchImpl:async (url,opts)=>{if(offline)throw Error('offline');
   const body=JSON.parse(opts.body);req.push(body.method);
   let result;if(body.method==='eth_chainId')result=actual;
   else if(body.method==='eth_getTransactionReceipt')result=receipt;
   else if(body.method==='eth_getBlockByNumber')result=body.params[0]==='finalized'?{hash:block,number:'0x'+head.toString(16)}:
    {hash:canonical?block:hash('c'),number:'0x1'};
   return {ok:true,json:async()=>({jsonrpc:'2.0',id:body.id,result})};
  }});
 return {client,setReceipt:v=>receipt=v,setHead:v=>head=v,setChain:v=>actual=v,setCanonical:v=>canonical=v,setWitness:v=>witness=v,setOffline:v=>offline=v,req};
}
test('awaiting signature, submitted, pending, independently finalized; duplicate signing prohibited',async()=>{
 const f=fixture(),c=f.client;
 assert.equal(c.status('a').state,'empty');
 assert.equal(c.begin('a').state,'awaiting-signature');assert.throws(()=>c.begin('a'),/tx-duplicate-operation/);
 assert.equal((await c.submit('a',{requestSignature:async()=>({txHash:tx})})).state,'submitted');
 await assert.rejects(c.submit('a',{requestSignature:async()=>({txHash:tx})}),/tx-submission-not-authorized/);
 assert.equal((await c.refresh('a')).state,'pending');
 f.setReceipt({transactionHash:tx,blockHash:block,blockNumber:'0x1',status:'0x1'});
 assert.equal((await c.refresh('a')).state,'finalized');
 assert.equal(c.status('a').reason,'independently-finalized-inclusion-only');
});
test('reverted, reorged and unavailable do not falsely finalize',async()=>{
 const f=fixture(),c=f.client;c.observe('z',tx);
 f.setReceipt({transactionHash:tx,blockHash:block,blockNumber:'0x1',status:'0x0'});
 assert.equal((await c.refresh('z')).state,'reverted');
 f.setReceipt({transactionHash:tx,blockHash:block,blockNumber:'0x1',status:'0x1'});
 f.setCanonical(false);assert.equal((await c.refresh('z')).state,'reorged');
 f.setOffline(true);assert.equal((await c.refresh('z')).state,'unavailable');
 f.setOffline(false);f.setCanonical(true);f.setWitness(false);
 assert.equal((await c.refresh('z')).state,'unavailable');
});
test('lag, wrong network, unknown receipt and missing independent witness remain pending/unavailable',async()=>{
 const f=fixture(),c=f.client;c.observe('x',tx);
 f.setReceipt({transactionHash:tx,blockHash:block,blockNumber:'0x1',status:'0x1'});
 f.setHead(0);assert.equal((await c.refresh('x')).state,'pending');
 f.setChain('0x2');assert.equal((await c.refresh('x')).state,'unavailable');
 assert.throws(()=>c.observe('x',hash('c')),/tx-hash-conflict/);
});
test('rejected and ambiguous signature are not silently retried',async()=>{
 const f=fixture(),c=f.client;c.begin('a');
 assert.equal((await c.submit('a',{requestSignature:async()=>{throw Object.assign(Error('user-rejected'),{code:'user-rejected'});}})).state,'awaiting-signature');
 await assert.rejects(c.submit('a',{requestSignature:async()=>{throw Error('transport disappeared');}}),/transport disappeared/);
 assert.equal(c.status('a').state,'unavailable');
 assert.equal(f.req.filter(x=>x==='eth_chainId').length,2);
});

test('reorg after independently witnessed finalization clears finality and never authorizes payout',async()=>{
 const f=fixture(),c=f.client;c.observe('a',tx);
 f.setReceipt({transactionHash:tx,blockHash:block,blockNumber:'0x1',status:'0x1'});
 assert.equal((await c.refresh('a')).state,'finalized');
 f.setReceipt(null);assert.equal((await c.refresh('a')).state,'reorged');
 assert.notEqual(c.status('a').state,'finalized');
});
test('independent witness absent never claims finalized even when RPC says finalized',async()=>{
 let id=0;const c=createHighCountryTransactionLifecycle420({
  rpcUrl:'https://rpc.example',chainId:1,
  fetchImpl:async(url,opts)=>{const x=JSON.parse(opts.body);id++;
   const result=x.method==='eth_chainId'?'0x1':x.method==='eth_getTransactionReceipt'?
    {transactionHash:tx,blockHash:block,blockNumber:'0x1',status:'0x1'}:
    {hash:block,number:'0x1'};
   return {ok:true,json:async()=>({jsonrpc:'2.0',id:x.id,result})};
  }});
 c.observe('a',tx);
 const value=await c.refresh('a');assert.equal(value.state,'pending');assert.equal(value.reason,'independent-witness-not-configured');
 assert.ok(id>=4);
});
