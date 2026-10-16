import test from 'node:test';
import assert from 'node:assert/strict';
import {createHttpHandler} from '../src/http.mjs';
import {createRiderPreferenceService} from '../src/rider-preferences.mjs';
const bearer='Bearer aaa.bbb.ccc';
function harness(){
  const entries=new Map();
  const prefs=createRiderPreferenceService({
    authorize:async(token,{action,resource})=>
      token==='aaa.bbb.ccc'&&action==='account.preferences'&&resource==='account:rider1'
       ? {role:'rider',subject:'rider1',accountId:'rider1',action,resource}:null,
    store:{
      read:async(id)=>entries.get(id)??null,
      compareAndSwap:async(id,revision,preferences)=>{
        if((entries.get(id)?.revision??0)!==revision)return false;
        entries.set(id,{revision:revision+1,preferences});return true;
      },
      delete:async id=>{const rev=entries.get(id)?.revision??0;entries.set(id,{revision:rev+1,preferences:{}});}
    }
  });
  return createHttpHandler({},null,null,null,null,null,prefs);
}
const req=(path,method='GET',token=bearer,body)=>new Request('https://liftd.invalid'+path,{
  method,headers:{authorization:token,...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
});
test('authenticated rider can read, opt in, revoke and erase preferences',async()=>{
  const app=harness(),path='/v1/rideshare/riders/rider1/preferences';
  let res=await app(req(path));assert.equal(res.status,200);assert.equal((await res.json()).preferences.marketingConsent,false);
  res=await app(req(path,'PUT',bearer,{expectedRevision:0,preferences:{contactMethod:'email',tripNotifications:true}}));
  assert.equal(res.status,200);assert.equal((await res.json()).revision,1);
  res=await app(req(path,'PUT',bearer,{expectedRevision:0,preferences:{marketingConsent:true}}));
  assert.equal(res.status,409);
  res=await app(req(path,'DELETE'));assert.equal(res.status,200);
  res=await app(req(path));assert.equal(res.status,200);assert.equal((await res.json()).preferences.tripNotifications,false);
});
test('missing or forged credentials, other account and unsupported verbs fail closed',async()=>{
  const app=harness(),p='/v1/rideshare/riders/rider1/preferences';
  assert.equal((await app(req(p,'GET',''))).status,401);
  assert.equal((await app(req('/v1/rideshare/riders/other/preferences'))).status,403);
  assert.equal((await app(req(p,'PATCH'))).status,405);
  assert.equal((await app(req(p+'?accountId=other'))).status,400);
  assert.equal((await app(req(p,'PUT',bearer,{expectedRevision:0,preferences:{marketingConsent:'yes'}}))).status,400);
  assert.equal((await app(req(p,'PUT',bearer,{expectedRevision:0,preferences:{contactMethod:'sms',tripNotifications:true}}))).status,200);
});
