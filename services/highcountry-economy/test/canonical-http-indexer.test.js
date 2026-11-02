import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalHttpIndexer} from '../src/canonical-http-indexer.js';
const id='0x'+'ab'.repeat(32),escrow='0x'+'cd'.repeat(20);
const response=(data,status=200)=>({ok:status===200,status,
 headers:{get:()=>null},text:async()=>JSON.stringify(data)});
test('indexer transport pins chain contract and result without granting payout authority',async()=>{
 const calls=[];
 const indexer=new CanonicalHttpIndexer({baseUrl:'https://indexer.example/v1',
  chainId:420,escrow,token:'test-auth',
  fetchImpl:async(url,opts)=>{calls.push({url,opts});
   return response({chainId:420,escrow,result:{id,status:'active'}});}});
 assert.equal((await indexer.listing(id)).status,'active');
 assert.equal(calls[0].url,'https://indexer.example/v1/escrow/listings/'+id);
 assert.equal(calls[0].opts.headers.authorization,'Bearer test-auth');
});
test('indexer transport fails closed for mismatched chain, contract and malformed payload',async()=>{
 const bad=[{chainId:421,escrow,result:{}},{chainId:420,escrow:'0x'+'ee'.repeat(20),result:{}},
  {chainId:420,escrow,result:null}];
 for(const data of bad){
  const adapter=new CanonicalHttpIndexer({baseUrl:'https://indexer.example',
   chainId:420,escrow,fetchImpl:async()=>response(data)});
  await assert.rejects(adapter.transfer(id),/indexer network or escrow mismatch/);
 }
 assert.throws(()=>new CanonicalHttpIndexer({baseUrl:'http://indexer.example',chainId:420,escrow}),/unsafe canonical indexer/);
 assert.throws(()=>new CanonicalHttpIndexer({baseUrl:'https://user:pass@indexer.example',chainId:420,escrow}),/unsafe canonical indexer/);
});
test('indexer transport rejects oversized, invalid and unavailable responses',async()=>{
 const payload={chainId:420,escrow,result:{id}};
 const adapter=new CanonicalHttpIndexer({baseUrl:'https://indexer.example',
  chainId:420,escrow,fetchImpl:async()=>response(payload,500)});
 await assert.rejects(adapter.listing(id),/indexer unavailable/);
 adapter.fetchImpl=async()=>({ok:true,headers:{get:()=>String(20000)},text:async()=>''});
 await assert.rejects(adapter.listing(id),/oversized indexer/);
 adapter.fetchImpl=async()=>({ok:true,headers:{get:()=>null},text:async()=>'{bad'});
 await assert.rejects(adapter.listing(id),/malformed indexer/);
});
