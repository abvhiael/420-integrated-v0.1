import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityConsentGuard} from '../src/identity-consent-guard.mjs';
const base={subject:'rider_1',accountId:'account_1',sessionId:'session_1',deviceId:'device_1',recoveryEpoch:1,role:'rider',action:'account.preferences',resource:'account:account_1',expiresAt:2000};
const input={token:'signed-token',accountId:'account_1',purpose:'location_history'};
const create=({actor=base,second=actor,consent=true,failAuth=false,failStore=false,clock=()=>1000}={})=>{
 let calls=0;
 return createIdentityConsentGuard({clock,authenticator:{authorize:async()=>{if(failAuth)throw Error('issuer offline');return ++calls===1?actor:second}},
 preferences:{read:async()=>{if(failStore)throw Error('storage offline');return {revision:3,preferences:{locationHistoryConsent:consent}}}}});
};
test('PT-01 requires explicit durable opt-in and rechecks signed session after I/O',async()=>{
 const result=await create().require(input);
 assert.equal(result.consentRevision,3);assert.equal(result.subject,'rider_1');
});
test('PT-01 defaults fail-closed on missing consent and rejects unsupported purposes',async()=>{
 await assert.rejects(()=>create({consent:false}).require(input),e=>e.code==='CONSENT_REQUIRED');
 await assert.rejects(()=>create().require({...input,purpose:'payment_approval'}),e=>e.code==='CONSENT_REQUEST_INVALID');
});
test('PT-01 rejects session/account/role/device/recovery changes and expiry',async()=>{
 for(const altered of [{...base,accountId:'other'},{...base,role:'operator'},{...base,expiresAt:900},{...base,deviceId:null},{...base,recoveryEpoch:-1}]){
  await assert.rejects(()=>create({actor:altered}).require(input),e=>e.code==='CONSENT_IDENTITY_DENIED');
 }
 for(const altered of [{...base,sessionId:'hijacked'},{...base,deviceId:'other'},{...base,recoveryEpoch:2},{...base,expiresAt:900},{...base,action:'operator.override'},{...base,resource:'account:other'}]){
  await assert.rejects(()=>create({second:altered}).require(input),e=>e.code==='CONSENT_SESSION_CHANGED');
 }
});
test('PT-01 treats provider/store outages as denial, never as implicit consent',async()=>{
 await assert.rejects(()=>create({failAuth:true}).require(input),e=>e.code==='CONSENT_IDENTITY_DENIED');
 await assert.rejects(()=>create({failStore:true}).require(input),e=>e.code==='CONSENT_STORE_UNAVAILABLE');
});
