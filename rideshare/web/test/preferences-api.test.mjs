import test from 'node:test';import assert from 'node:assert/strict';
import {createRiderPreferencesApi} from '../preferences-api.mjs';
test('same-origin calls pass ephemeral bearer and do not send cookies',async()=>{
 const events=[];
 const api=createRiderPreferencesApi({getAccessToken:async()=> 'aaa.bbb.ccc'},{
   origin:'https://rides.example',
   fetchImpl:async(url,opts)=>{events.push({url:String(url),opts});return {ok:true,json:async()=>({revision:1,preferences:{}})};}
 });
 assert.equal((await api.getPreferences({accountId:'owner'})).revision,1);
 await api.savePreferences({accountId:'owner',expectedRevision:0,preferences:{marketingConsent:false}});
 await api.erasePreferences({accountId:'owner'});
 assert.deepEqual(events.map(e=>e.opts.method),['GET','PUT','DELETE']);
 for(const e of events){
   assert.equal(e.url,'https://rides.example/v1/rideshare/riders/owner/preferences');
   assert.equal(e.opts.credentials,'omit');assert.equal(e.opts.cache,'no-store');assert.equal(e.opts.redirect,'error');
   assert.equal(e.opts.headers.authorization,'Bearer aaa.bbb.ccc');
 }
});
test('rejects unsupported sessions and account injections before network access',async()=>{
 let called=false;
 const api=createRiderPreferencesApi({getAccessToken:async()=> 'bad'},{
 origin:'https://rides.example',fetchImpl:async()=>{called=true;throw Error('unexpected');}
 });
 await assert.rejects(api.getPreferences({accountId:'owner'}));
 await assert.rejects(api.getPreferences({accountId:'../operator'}));
 assert.equal(called,false);
 assert.equal(createRiderPreferencesApi({}, {origin:'https://rides.example'}),null);
});
