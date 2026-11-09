import test from 'node:test';
import assert from 'node:assert/strict';
import {createBetWalletSessions} from '../server/wallet-identity-sessions.mjs';
import {createCanonicalIdentityEligibility} from '../server/canonical-identity-eligibility.mjs';
import {eventTopic} from '../server/indexer-event-abi.mjs';

const A='0x'+'a'.repeat(40),B='0x'+'b'.repeat(40),TYPE='0x'+'c'.repeat(64),SUBJECT='0x'+'d'.repeat(64);
const SIGNATURE='0x'+'e'.repeat(130);
const policy={authorized:true,revoked:false,authorizationVersion:'policy-7',expiresAt:300000};
function fixture({verifySignature=async()=>true,verifyIdentity=async()=>policy}={}){
 let t=10000;
 const sessions=createBetWalletSessions({origin:'https://420bet.example',chainId:'420',clock:()=>t,verifySignature,verifyIdentity});
 return {sessions,time(v){t=v}};
}
test('domain bound challenge, one-time signature, reauthentication and no spending authority',async()=>{
 const {sessions}=fixture();
 const c=sessions.challenge({account:A,requestedChainId:'420'});
 assert.match(c.message,/Origin: https:\/\/420bet.example/);
 assert.match(c.message,/No wagering, signing delegation or spending authority/);
 const identity=await sessions.authenticate({account:A,requestedChainId:'420',nonce:c.nonce,signature:SIGNATURE});
 assert.equal(identity.account,A);
 const result=await sessions.authorize({account:A,requestedChainId:'420',token:identity.token});
 assert.deepEqual(result,{account:A,chainId:'420',expiresAt:identity.expiresAt,readOnly:true});
 await assert.rejects(sessions.authenticate({account:A,requestedChainId:'420',nonce:c.nonce,signature:SIGNATURE}),/replayed/);
 await assert.rejects(sessions.authorize({account:B,requestedChainId:'420',token:identity.token}),/invalid or expired session/);
 await assert.rejects(sessions.authorize({account:A,requestedChainId:'421',token:identity.token}),/scope denied/);
});
test('rejects signature mismatch; challenge is consumed before remote verifier settles',async()=>{
 let release;
 const {sessions}=fixture({verifySignature:()=>new Promise(r=>release=r)});
 const c=sessions.challenge({account:A,requestedChainId:'420'});
 const first=sessions.authenticate({account:A,requestedChainId:'420',nonce:c.nonce,signature:SIGNATURE});
 await assert.rejects(sessions.authenticate({account:A,requestedChainId:'420',nonce:c.nonce,signature:SIGNATURE}),/replayed/);
 release(false);
 await assert.rejects(first,/signature not verified/);
});
test('fails on expired challenge, revoked policy, epoch changes, explicit revoke and session expiry',async()=>{
 let approved=true;let version='v1';
 const ctx=fixture({verifyIdentity:async()=>({authorized:approved,revoked:!approved,authorizationVersion:version})});
 const {sessions}=ctx;
 let c=sessions.challenge({account:A,requestedChainId:'420'});
 ctx.time(c.expiresAt+1);
 await assert.rejects(sessions.authenticate({account:A,requestedChainId:'420',nonce:c.nonce,signature:SIGNATURE}));
 c=sessions.challenge({account:A,requestedChainId:'420'});
 const signed=await sessions.authenticate({account:A,requestedChainId:'420',nonce:c.nonce,signature:SIGNATURE});
 version='v2';
 await assert.rejects(sessions.authorize({account:A,requestedChainId:'420',token:signed.token}),/revoked or changed/);
 version='v1';approved=false;
 await assert.rejects(sessions.authorize({account:A,requestedChainId:'420',token:signed.token}),/revoked or changed/);
 approved=true;sessions.revoke({account:A,requestedChainId:'420',token:signed.token});
 await assert.rejects(sessions.authorize({account:A,requestedChainId:'420',token:signed.token}),/invalid or expired/);
 c=sessions.challenge({account:A,requestedChainId:'420'});sessions.revokeAll();
 await assert.rejects(sessions.authenticate({account:A,requestedChainId:'420',nonce:c.nonce,signature:SIGNATURE}));
});
test('cannot create sessions without qualified verifier and eligibility provider',()=>{
 assert.throws(()=>createBetWalletSessions({origin:'https://420bet.example',chainId:'420'}));
 assert.throws(()=>createBetWalletSessions({origin:'https://wrong.example/path',chainId:'420',verifySignature:async()=>true,verifyIdentity:async()=>policy}));
});
test('canonical Identity420 uses actual frozen hasValidCredential(bytes32,bytes32) selector',async()=>{
 const calls=[];
 const eligibility=createCanonicalIdentityEligibility({
  rpcUrl:'https://rpc.example/',chainId:'420',identityAddress:'0x'+'4'.repeat(40),
  credentialTypes:[TYPE],resolveSubjectId:async({account})=>account===A?SUBJECT:null,
  verifyPolicy:async()=>policy,fetcher:async(_url,options)=>{
   const req=JSON.parse(options.body);calls.push(req);
   let result;
   if(req.method==='eth_chainId')result='0x1a4';
   if(req.method==='eth_getCode')result='0x6001';
   if(req.method==='eth_call')result='0x'+'0'.repeat(63)+'1';
   return {ok:true,text:async()=>JSON.stringify({jsonrpc:'2.0',id:1,result})};
  }
 });
 assert.equal(eligibility.selector,eventTopic('hasValidCredential(bytes32,bytes32)').slice(0,10));
 const result=await eligibility.verifyIdentity({account:A,chainId:'420',mode:'read-only'});
 assert.equal(result.authorized,true);
 assert.deepEqual(calls.map(c=>c.method),['eth_chainId','eth_getCode','eth_call']);
 assert.equal(calls[2].params[0].data,eligibility.selector+SUBJECT.slice(2)+TYPE.slice(2));
 await assert.rejects(eligibility.verifyIdentity({account:B,chainId:'420',mode:'read-only'}));
});
test('Identity denial, RPC wrong-chain and independent policy denial all fail closed',async()=>{
 const build=(result,policyCheck=async()=>policy)=>createCanonicalIdentityEligibility({
  rpcUrl:'https://rpc.example/',chainId:'420',identityAddress:'0x'+'4'.repeat(40),credentialTypes:[TYPE],
  resolveSubjectId:async()=>SUBJECT,verifyPolicy:policyCheck,
  fetcher:async(_url,options)=>{
   const {method}=JSON.parse(options.body);
   const value=method==='eth_chainId'?result.chain:method==='eth_getCode'?'0x6001':result.credential;
   return {ok:true,text:async()=>JSON.stringify({jsonrpc:'2.0',id:1,result:value})};
  }
 });
 await assert.rejects(build({chain:'0x1',credential:'0x'+'0'.repeat(63)+'1'}).verifyIdentity({account:A,chainId:'420',mode:'read-only'}),/wrong chain/);
 const denied=await build({chain:'0x1a4',credential:'0x'+'0'.repeat(64)}).verifyIdentity({account:A,chainId:'420',mode:'read-only'});
 assert.equal(denied.authorized,false);
 const policyDenied=await build({chain:'0x1a4',credential:'0x'+'0'.repeat(63)+'1'},async()=>({authorized:false})).verifyIdentity({account:A,chainId:'420',mode:'read-only'});
 assert.equal(policyDenied.authorized,false);
});
