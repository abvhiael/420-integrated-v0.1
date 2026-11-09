import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteBetIdentityAuthority} from '../server/identity-authority-provider.mjs';
const A='0x'+'a'.repeat(40),B='0x'+'b'.repeat(40),S='0x'+'c'.repeat(64),T='0x'+'d'.repeat(64),D='0x'+'e'.repeat(64);
const TOKEN='s'.repeat(64);
function provider(options={}){
 const requests=[];
 const authority=createRemoteBetIdentityAuthority({origin:'https://authority.example/',chainId:'420',
  bearerToken:TOKEN,policyVersion:'bet-v1',policyApprovalDigest:D,
  fetcher:async(url,opts)=>{
   requests.push({url,opts});
   const data=JSON.parse(opts.body);
   let result;
   if(url.endsWith('/v1/wallet-subject'))
    result={account:data.account,chainId:'420',subjectId:S,revoked:options.revoked??false};
   else result={account:data.account,subjectId:data.subjectId,chainId:'420',
    policyVersion:options.version??'bet-v1',
    policyApprovalDigest:options.digest??D,
    authorized:options.authorized??true,revoked:options.revoked??false,
    authorizationVersion:'decision-4',expiresAt:Date.now()+60000};
   return {ok:true,text:async()=>JSON.stringify(result)};
  }
 });return {authority,requests};
}
test('remote subject and policy adapter checks authority, binding, version, signed-off digest and revocation',async()=>{
 const {authority,requests}=provider();
 assert.equal(await authority.resolveSubjectId({account:A,chainId:'420'}),S);
 const result=await authority.verifyPolicy({account:A,subjectId:S,chainId:'420',
  requiredCredentialTypes:[T],mode:'read-only'});
 assert.equal(result.authorized,true);assert.equal(result.authorizationVersion,'bet-v1:decision-4');
 assert.equal(requests[0].opts.headers.Authorization,'Bearer '+TOKEN);
 assert.equal(requests[1].opts.headers.Authorization,'Bearer '+TOKEN);
 assert.equal(JSON.parse(requests[1].opts.body).expectedPolicyApprovalDigest,D);
 assert(!requests[0].url.includes(A));
 await assert.rejects(authority.resolveSubjectId({account:B,chainId:'421'}));
});
test('remote authority fails closed on policy drift, wrong digest and revoked subject',async()=>{
 await assert.rejects(provider({digest:'0x'+'f'.repeat(64)}).authority.verifyPolicy({
  account:A,subjectId:S,chainId:'420',requiredCredentialTypes:[T],mode:'read-only'}),/mismatch/);
 await assert.rejects(provider({version:'other'}).authority.verifyPolicy({
  account:A,subjectId:S,chainId:'420',requiredCredentialTypes:[T],mode:'read-only'}),/mismatch/);
 const revoked=provider({revoked:true});
 await assert.rejects(revoked.authority.resolveSubjectId({account:A,chainId:'420'}));
 const denied=await provider({authorized:false}).authority.verifyPolicy({
  account:A,subjectId:S,chainId:'420',requiredCredentialTypes:[T],mode:'read-only'});
 assert.equal(denied.authorized,false);
 assert.throws(()=>createRemoteBetIdentityAuthority({origin:'http://authority.example',chainId:'420',
  bearerToken:TOKEN,policyVersion:'bet-v1',policyApprovalDigest:D}));
});
