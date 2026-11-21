import test from 'node:test';
import assert from 'node:assert/strict';

// Exercise the actual DOM module with controlled network completions. A
// private status response must not reappear after sign-out, including a
// POST that returns after a different member's browser session begins.
test('AUTH-12 420ID UI forgets pending reads and writes after logout',async()=>{
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 const nodes=new Map(),documentEvents=new Map(),pending=[];
 const element=id=>{
  if(!nodes.has(id))nodes.set(id,{
   id,checked:false,disabled:false,textContent:'',events:new Map(),
   addEventListener(type,callback){this.events.set(type,callback)},
   dispatch(type,ev={preventDefault(){}}){this.events.get(type)?.(ev)},
  });
  return nodes.get(id);
 };
 globalThis.document={
  visibilityState:'visible',
  getElementById:element,
  addEventListener(type,fn){documentEvents.set(type,fn)},
 };
 globalThis.fetch=(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}));
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const status={
  app:'bong-goggles',policyVersion:1,source:'420id-consent-v1',
  version:1,rewardOptIn:true,creatorOptIn:false,walletLinked:false,
  rewardStage:'wallet_required',creatorStage:'not_enrolled',
  canClaim:false,paid:false,paymentAuthorized:false,financialAuthority:false,
 };
 const answer=(i,payload,code=200)=>pending[i].resolve({
  ok:code>=200&&code<300,status:code,json:async()=>payload,
 });
 try{
  await import('./monetization-ui.mjs');
  assert.equal(pending.length,1);
  assert.equal(pending[0].url,'/v1/monetization/status');
  assert.equal(pending[0].options.cache,'no-store');
  element('logout').dispatch('click');
  answer(0,status);
  await flush();
  assert.equal(element('monetization-save').disabled,true);
  assert.equal(element('monetization-rewards').checked,false);
  assert.doesNotMatch(element('monetization-stage').textContent,/wallet required|creator programme/i);

  element('monetization-refresh').dispatch('click');
  assert.equal(pending.length,2);
  answer(1,status);
  await flush();
  assert.equal(element('monetization-save').disabled,false);
  assert.equal(element('monetization-rewards').checked,true);

  element('monetization-consent').checked=true;
  element('monetization-form').dispatch('submit');
  assert.equal(pending.length,3);
  assert.equal(pending[2].url,'/v1/monetization/consent');
  assert.equal(JSON.parse(pending[2].options.body).expectedVersion,1);
  element('logout-all').dispatch('click');
  answer(2,{...status,version:2,walletLinked:true,rewardStage:'canonical_verification_required'});
  await flush();
  assert.equal(element('monetization-save').disabled,true);
  assert.equal(element('monetization-consent').checked,false);
  assert.equal(element('monetization-rewards').checked,false);
  assert.doesNotMatch(element('monetization-stage').textContent,/canonical verification|required/i);

  // Inconsistent financial data must fail closed without retaining prior
  // member details or silently enabling financial actions in the UI.
  element('monetization-refresh').dispatch('click');
  assert.equal(pending.length,4);
  answer(3,{...status,canClaim:true,paid:true});
  await flush();
  assert.equal(element('monetization-save').disabled,true);
  assert.equal(element('monetization-rewards').checked,false);

  // Failed status on returning to a backgrounded tab must clear the view.
  element('monetization-refresh').dispatch('click');
  answer(4,status);
  await flush();
  assert.equal(element('monetization-save').disabled,false);
  globalThis.document.visibilityState='hidden';
  documentEvents.get('visibilitychange')();
  assert.equal(element('monetization-save').disabled,true);
  assert.equal(element('monetization-rewards').checked,false);
 }finally{
  globalThis.document=previousDocument;
  globalThis.fetch=previousFetch;
 }
});
