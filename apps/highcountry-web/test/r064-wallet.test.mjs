import test from 'node:test';import assert from 'node:assert/strict';import {createOptionalWallet420} from '../src/wallet.js';
const game='0x'+'a'.repeat(64),wallet='0x'+'1'.repeat(40);
test('no automatic wallet prompt; connection is voluntary and wrong chain rejects',async()=>{
 const calls=[];let chain='0x2';
 const provider={request:async x=>{calls.push(x.method);return x.method==='eth_chainId'?chain:[wallet];}};
 const w=createOptionalWallet420({provider,authenticate:async()=>'valid',apiUrl:'https://api.example',gameId:game,chainId:1});
 assert.deepEqual(calls,[]);await assert.rejects(w.connect(),/wallet-wrong-network/);
 assert.deepEqual(calls,['eth_chainId']);chain='0x1';assert.equal(await w.connect(),wallet);
 w.disconnect();assert.equal(w.getSelected(),null);
});
test('challenge binding and signature rejection never completes link',async()=>{
 let completed=false;
 const provider={request:async x=>x.method==='eth_chainId'?'0x1':x.method==='eth_requestAccounts'?[wallet]:null};
 const w=createOptionalWallet420({provider,authenticate:async()=>'valid',apiUrl:'https://api.example',gameId:game,chainId:1,
  fetchImpl:async url=>{if(String(url).endsWith('/v1/wallet/complete'))completed=true;
   return {ok:true,json:async()=>({result:{wallet,chainId:'1',challengeId:'challenge',message:'wrong game scope'}})};}});
 await w.connect();await assert.rejects(w.link({consentAccepted:true,consentId:'consent',policyHash:game}),/wallet-challenge-invalid/);
 assert.equal(completed,false);
});
test('explicit disconnect retains local gameplay ownership, no RPC spending operations',async()=>{
 const methods=[];const provider={request:async x=>{methods.push(x.method);return x.method==='eth_chainId'?'0x1':[wallet];}};
 const w=createOptionalWallet420({provider,authenticate:async()=>'ok',apiUrl:'https://api.example',gameId:game,chainId:1});
 await w.connect();w.disconnect();assert.deepEqual(methods,['eth_chainId','eth_requestAccounts','eth_chainId']);
});
