import test from 'node:test';
import assert from 'node:assert/strict';
import {create420NotificationsConsentAuthority} from '../server/notifications-consent-authority.mjs';
const request={tenant:'420bet',userId:'subject-1',subscriptionId:'sub-1',recipient:'route-1',
 channel:'notifications',kind:'wager-settled',policyVersion:'policy-1'};
function fixture(change={},ok=true){
 const seen=[];
 const check=create420NotificationsConsentAuthority({origin:'https://notifications.example/',
  bearerToken:'x'.repeat(40),
  fetcher:async(url,options)=>{seen.push({url,options});return {
   ok,text:async()=>JSON.stringify({...request,active:true,muted:false,revoked:false,consent:true,...change})
  }}
 });
 return {check,seen};
}
test('private authenticated 420Notifications approval uses exact subscription scope',async()=>{
 const f=fixture();const decision=await f.check(request);
 assert.equal(decision.consent,true);
 assert.equal(f.seen[0].url,'https://notifications.example/v1/420bet/subscriptions/check');
 assert.equal(f.seen[0].options.headers.Authorization,'Bearer '+'x'.repeat(40));
 assert.deepEqual(JSON.parse(f.seen[0].options.body),request);
});
test('revoked, muted and withdrawn consent are never transformed to opt-in',async()=>{
 for(const values of [{revoked:true,consent:false,active:false},{muted:true},{consent:false}]){
  const decision=await fixture(values).check(request);
  assert.equal(decision.revoked===false&&decision.muted===false&&decision.consent===true&&decision.active===true,false);
 }
});
test('wrong tenant, recipient, policy version, channel and provider outage fail closed',async()=>{
 for(const change of [{userId:'subject-2'},{tenant:'another'},{recipient:'route-2'},
 {policyVersion:'policy-2'},{channel:'mail'},{active:'yes'}])
  await assert.rejects(fixture(change).check(request),/consent response scope mismatch/);
 await assert.rejects(fixture({},false).check(request),/unavailable/);
 await assert.rejects(fixture().check({...request,tenant:'external'}),/scope/);
 assert.throws(()=>create420NotificationsConsentAuthority({origin:'http://notifications.example/',bearerToken:'x'.repeat(40)}),/HTTPS/);
});
