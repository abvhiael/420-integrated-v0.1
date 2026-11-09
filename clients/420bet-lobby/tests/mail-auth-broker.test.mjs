import test from 'node:test';
import assert from 'node:assert/strict';
import {createVerified420MailActorBroker} from '../server/mail-auth-broker.mjs';
const token='actual-server-held-mail-credential-with-sufficient-length';
const scope={tenant:'420bet',userId:'subject-1',recipient:'recipient-1',channel:'mail'};
function setup({actor='420bet-service',service='420/service/mail/v1',verified=true,ok=true}={}){
 const calls=[];
 const broker=createVerified420MailActorBroker({
  origin:'https://mail.example/',sender:'420bet-service',serviceToken:token,
  fetcher:async(url,opts)=>{calls.push({url,opts});
   return {ok,text:async()=>JSON.stringify({actor,service,verified})};
  }});
 return {broker,calls};
}
test('verified sender is vouched for by actual 420Mail actor route, not requested by player',async()=>{
 const f=setup();
 const credential=await f.broker.authorizeActor(scope);
 assert.deepEqual(credential,{sender:'420bet-service',authorization:'Bearer '+token});
 assert.equal(f.calls[0].url,'https://mail.example/v1/auth/actor');
 assert.equal(f.calls[0].opts.method,'GET');
 assert.equal(f.calls[0].opts.headers.Authorization,'Bearer '+token);
 assert.equal(f.calls[0].opts.credentials,'omit');
 await f.broker.checkReadiness();
 assert.equal(f.calls.length,2);
});
test('forged Mail sender, wrong Mail service, missing verification, unavailable auth fail closed',async()=>{
 for(const opts of [{actor:'attacker'},{verified:false},{service:'other'},{ok:false}]){
  await assert.rejects(setup(opts).broker.authorizeActor(scope),/Mail broker:/);
 }
});
test('wrong tenant, recipient, user, channel and insecure source fail closed before auth',async()=>{
 const f=setup();
 for(const altered of [{tenant:'other'},{userId:''},{recipient:'foo@example.com'},{channel:'notifications'}]){
  await assert.rejects(f.broker.authorizeActor({...scope,...altered}),/invalid owner-scoped Mail delivery request/);
 }
 assert.equal(f.calls.length,0);
 assert.throws(()=>createVerified420MailActorBroker({origin:'http://mail.example/',sender:'420bet-service',serviceToken:token}),/HTTPS/);
 assert.throws(()=>createVerified420MailActorBroker({origin:'https://mail.example/',sender:'420bet-service',serviceToken:'short'}),/credential/);
});
test('credential rotation or revocation is checked on each Mail operation',async()=>{
 let attempts=0;
 const broker=createVerified420MailActorBroker({origin:'https://mail.example/',sender:'420bet-service',serviceToken:token,
  fetcher:async()=>{attempts++;return {ok:attempts===1,text:async()=>JSON.stringify({
   actor:'420bet-service',service:'420/service/mail/v1',verified:true})};
  }});
 assert.equal((await broker.authorizeActor(scope)).sender,'420bet-service');
 await assert.rejects(broker.authorizeActor(scope),/unavailable/);
});
