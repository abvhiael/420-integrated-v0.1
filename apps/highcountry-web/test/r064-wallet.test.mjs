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


test('explicit signed challenge follows authenticated R05 link, then unlink; never requests transaction signing',async()=>{
 const calls=[],api=[];
 const signature='0x'+'ab'.repeat(65);
 const provider={request:async ({method,params})=>{
  calls.push(method);
  if(method==='eth_chainId')return '0x1';
  if(method==='eth_requestAccounts')return [wallet];
  if(method==='personal_sign'){assert.ok(params[0].includes(game));assert.equal(params[1],wallet);return signature;}
  throw Error('unreviewed method');
 }};
 const w=createOptionalWallet420({provider,authenticate:async()=>'short-session',apiUrl:'https://api.example',gameId:game,chainId:1,
  fetchImpl:async (url,opts)=>{
   api.push({url:String(url),opts});
   if(String(url).endsWith('/v1/wallet/challenge'))return {ok:true,json:async()=>({result:{wallet,chainId:'1',challengeId:'id_one',message:'High Country '+game}})};
   if(String(url).endsWith('/v1/wallet/complete'))return {ok:true,json:async()=>({result:{wallet_account:wallet}})};
   if(String(url).endsWith('/v1/wallet/unlink'))return {ok:true,json:async()=>({result:{unlinked:true}})};
   if(String(url).endsWith('/v1/session'))return {ok:true,json:async()=>({result:{gameId:game,wallet:wallet}})};
   throw Error('unexpected route');
  }});
 await w.connect();
 assert.ok(await w.link({consentAccepted:true,consentId:'approved_consent',policyHash:game}));
 assert.equal((await w.session()).gameId,game);
 assert.equal(await w.unlink(),true);
 assert.equal(w.getSelected(),null);
 assert.deepEqual(calls,['eth_chainId','eth_requestAccounts','eth_chainId','eth_chainId','personal_sign','eth_chainId']);
 assert.deepEqual(api.map(x=>new URL(x.url).pathname),['/v1/wallet/challenge','/v1/wallet/complete','/v1/session','/v1/wallet/unlink']);
 assert.ok(api.every(x=>x.opts.headers.authorization==='Bearer short-session'&&x.opts.credentials==='omit'));
});


test('scoped read-only activity never accepts caller account identifiers or trusts bad server responses',async()=>{
 let seen;
 const w=createOptionalWallet420({provider:{request:async()=>{throw Error('not used');}},authenticate:async()=>'issuer-token',
  apiUrl:'https://api.example',gameId:game,chainId:1,fetchImpl:async(url,opts)=>{
   seen={url:String(url),opts};return {ok:true,json:async()=>({events:[{kind:'projection',gameId:game}]})};
  }});
 assert.equal((await w.scopedActivity({limit:1})).length,1);
 assert.equal(new URL(seen.url).pathname,'/events');
 assert.equal(new URL(seen.url).searchParams.get('limit'),'1');
 assert.equal(new URL(seen.url).searchParams.has('accountId'),false);
 assert.equal(seen.opts.headers.authorization,'Bearer issuer-token');
 await assert.rejects(w.scopedActivity({limit:101}),/wallet-activity-limit-invalid/);
 const forged=createOptionalWallet420({provider:{request:async()=>null},authenticate:async()=>'issuer-token',
  apiUrl:'https://api.example',gameId:game,chainId:1,fetchImpl:async()=>({ok:true,json:async()=>({events:'forged'})})});
 await assert.rejects(forged.scopedActivity({limit:10}),/wallet-activity-invalid/);
});


test('finalized scoped feature proof is validated, requires deliberate connection and never authorizes spending',async()=>{
 let chain='0x1',requested=[];
 const provider={request:async ({method})=>{
  requested.push(method);return method==='eth_chainId'?chain:[wallet];
 }};
 const h='0x'+'c'.repeat(64);
 const service=createOptionalWallet420({provider,authenticate:async()=>'token',apiUrl:'https://api.example',gameId:game,chainId:1,
  fetchImpl:async (url,opts)=>{
   assert.ok(String(url).endsWith('/v1/features/entitlement'));
   assert.equal(opts.method,'POST');assert.equal(opts.headers.authorization,'Bearer token');
   assert.deepEqual(Object.keys(JSON.parse(opts.body)).sort(),['contentId','entitlementId','entitlementType','profileId']);
   return {ok:true,json:async()=>({result:{accepted:true,kind:'entitlement',gameId:game,chainId:'1',
    blockHash:h,evidenceDigest:h}})};
  }});
 const q={profileId:game,entitlementId:game,entitlementType:game,contentId:game};
 await assert.rejects(service.canonicalProof('entitlement',q),/wallet-not-connected/);
 await service.connect();
 assert.equal((await service.canonicalProof('entitlement',q)).kind,'entitlement');
 chain='0x2';await assert.rejects(service.canonicalProof('entitlement',q),/wallet-wrong-network/);
 assert.deepEqual(requested,['eth_chainId','eth_requestAccounts','eth_chainId','eth_chainId','eth_chainId']);
});
test('wrong-game finalized feature response fails closed and disallows unsafe methods',async()=>{
 const provider={request:async x=>x.method==='eth_chainId'?'0x1':[wallet]};
 const s=createOptionalWallet420({provider,authenticate:async()=>'token',apiUrl:'https://api.example',gameId:game,chainId:1,
  fetchImpl:async()=>({ok:true,json:async()=>({result:{accepted:true,kind:'ownership',gameId:'0x'+'b'.repeat(64),chainId:'1',
   blockHash:game,evidenceDigest:game}})})});
 await s.connect();
 await assert.rejects(s.canonicalProof('ownership',{profileId:game}),/wallet-feature-unverified/);
 await assert.rejects(s.canonicalProof('market',{profileId:game}),/wallet-feature-invalid/);
});
