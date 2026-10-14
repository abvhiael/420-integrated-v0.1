import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiderPreferenceService,validatePreferences,PreferenceError,defaultRiderPreferences} from '../src/rider-preferences.mjs';
function fixture(){
  const map=new Map();let calls=0;
  const svc=createRiderPreferenceService({
    authorize:async(token,{resource,action})=>token==='valid'&&resource==='account:owner'&&action==='account.preferences' ? {role:'rider',action,resource,accountId:'owner',subject:'owner'} : null,
    store:{
      read:async id=>map.get(id),
      compareAndSwap:async(id,rev,preferences)=>{
        const row=map.get(id);if((row?.revision??0)!==rev)return false;
        map.set(id,{revision:rev+1,preferences});calls++;return true;
      },
      delete:async id=>{map.delete(id);}
    }
  });
  return {svc,map,get calls(){return calls;}};
}
test('all preferences are private by default, including communications and history',()=>{
  assert.deepEqual(validatePreferences({}),defaultRiderPreferences);
});
test('owner can update, read, erase; changes require matching revision',async()=>{
  const f=fixture();
  const input={contactMethod:'email',tripNotifications:true,largeText:true};
  assert.equal((await f.svc.read('valid','owner')).revision,0);
  const changed=await f.svc.update('valid','owner',{preferences:input,expectedRevision:0});
  assert.equal(changed.revision,1);
  assert.equal((await f.svc.read('valid','owner')).preferences.largeText,true);
  await assert.rejects(f.svc.update('valid','owner',{preferences:input,expectedRevision:0}),e=>e.code==='STALE_REVISION');
  assert.equal(f.calls,1);
  assert.deepEqual(await f.svc.erase('valid','owner'),{deleted:true});
  assert.equal((await f.svc.read('valid','owner')).preferences.marketingConsent,false);
});
test('cross-account and missing sessions fail closed without touching store',async()=>{
  const f=fixture();
  for(const token of ['', 'forged',null])for(const id of ['owner','other']){
    await assert.rejects(f.svc.read(token,id),PreferenceError);
    await assert.rejects(f.svc.update(token,id,{preferences:{},expectedRevision:0}),PreferenceError);
    await assert.rejects(f.svc.erase(token,id),PreferenceError);
  }
  assert.equal(f.calls,0);
});
test('reject unauthorized and malformed fields, consent, revisions and accessors',async()=>{
  const f=fixture();
  for(const preferences of [
    {marketingConsent:'true'}, {locationHistoryConsent:1},{contactMethod:'push'},
    {tripNotifications:true}, {__proto__:null,unknown:true},
    Object.defineProperty({},'largeText',{get(){throw Error('getter')},enumerable:true})
  ]) await assert.rejects(f.svc.update('valid','owner',{preferences,expectedRevision:0}),PreferenceError);
  for(const expectedRevision of [-1,1.5,NaN,'0'])await assert.rejects(f.svc.update('valid','owner',{preferences:{},expectedRevision}),PreferenceError);
  assert.equal(f.calls,0);
});
