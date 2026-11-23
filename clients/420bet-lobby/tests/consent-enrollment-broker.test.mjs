import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createBetConsentEnrollmentBroker,createGoConsentCommit} from '../server/consent-enrollment-broker.mjs';
const challengeKey='wallet-challenge-credential-00000000000000000000';
const assertionKey='go-assertion-credential-000000000000000000000';
const now=1762790400000;
const account='0x'+'a'.repeat(40);
const input={tenant:'420bet',account,action:'enroll',subscriptionId:'sub-1',
 recipient:'route-1',channel:'notifications',policyVersion:'policy-1',expectedRevision:0};
function harness({verified=true,user='subject-1',identityAccount=account,routeVerified=true}={}){
 const seen=[];
 const b=createBetConsentEnrollmentBroker({origin:'https://bet.example/',
  chainId:'420',challengeKey,assertionKey,now:()=>now,
  random:()=> 'f'.repeat(64),
  verifySignature:async p=>verified&&p.signature==='0x'+'12'.repeat(65)&&
   p.account===account&&p.message.includes('Policy version: policy-1'),
  resolveSubject:async()=>({verified:true,active:true,userId:user,account:identityAccount}),
  verifyRoute:async scope=>({...scope,verified:routeVerified,active:true,expiresAt:now+60000}),
  commit:async a=>{seen.push(a);return {accepted:true};}});
 return {b,seen};
}
test('wallet signed challenge proves consent for precise channel, route and policy',async()=>{
 const {b,seen}=harness();
 const proof=b.challenge(input);
 assert.match(proof.message,/Signing only controls 420Bet notifications/);
 assert.deepEqual(await b.confirm({...proof,walletSignature:'0x'+'12'.repeat(65)}),{accepted:true});
 assert.equal(seen.length,1);
 assert.equal(seen[0].userId,'subject-1');
 assert.equal(seen[0].action,'enroll');
 assert.match(seen[0].nonce,/^[a-f0-9]{64}$/);
 const p=seen[0],msg=['420BET-CONSENT-BROKER-V1',p.action,p.tenant,p.userId,
  p.subscriptionId,p.recipient,p.channel,p.policyVersion,p.nonce,
  String(p.expiresAt),String(p.expectedRevision)].join('\n');
 assert.equal(p.signature,createHmac('sha256',assertionKey).update(msg).digest('hex'));
});
test('wallet rejection, forged challenge, cross-subject account and route tamper fail closed',async()=>{
 let f=harness({verified:false});
 let proof=f.b.challenge(input);
 await assert.rejects(f.b.confirm({...proof,walletSignature:'0x'+'12'.repeat(65)}),/wallet owner/);
 f=harness();proof=f.b.challenge(input);
 await assert.rejects(f.b.confirm({...proof,challenge:{...proof.challenge,recipient:'route-2'},
  walletSignature:'0x'+'12'.repeat(65)}),/not issued/);
 f=harness({identityAccount:'0x'+'b'.repeat(40)});proof=f.b.challenge(input);
 await assert.rejects(f.b.confirm({...proof,walletSignature:'0x'+'12'.repeat(65)}),/binding/);
});
test('unverified recipient route cannot enroll another user; revocation remains possible',async()=>{
 const f=harness({routeVerified:false});
 const proof=f.b.challenge(input);
 await assert.rejects(f.b.confirm({...proof,walletSignature:'0x'+'12'.repeat(65)}),/route ownership/);
 assert.equal(f.seen.length,0);
 const revoke=f.b.challenge({...input,action:'revoke',expectedRevision:1});
 const out=await f.b.confirm({...revoke,walletSignature:'0x'+'12'.repeat(65)});
 assert.equal(out.accepted,true,'wallet owner must be able to revoke even after losing route');
});
test('private Go commit refuses unverified receipt, bare HTTP and unknown scope',async()=>{
 assert.throws(()=>createGoConsentCommit({origin:'http://local.test/',bearerToken:'a'.repeat(40)}),/HTTPS/);
 const token='service-authenticated-credential-0000000000',seen=[];
 const submit=createGoConsentCommit({origin:'https://notify.example/',bearerToken:token,
  fetcher:async(url,opts)=>{seen.push({url,opts});return {ok:true,text:async()=>JSON.stringify({
   tenant:'420bet',userId:'subject-1',subscriptionId:'sub-1',recipient:'route-1',
   channel:'notifications',policyVersion:'policy-1',revision:1,
   revoked:false,consent:true,active:true})};}});
 const assertn={tenant:'420bet',userId:'subject-1',subscriptionId:'sub-1',recipient:'route-1',
  channel:'notifications',policyVersion:'policy-1',expectedRevision:0,action:'enroll'};
 assert.equal((await submit(assertn)).consent,true);
 assert.equal(seen[0].opts.headers.Authorization,'Bearer '+token);
 await assert.rejects(submit({...assertn,recipient:'route-2'}),/not bound/);
});
