import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocialHttpGateway} from '../src/social-http-gateway.js';
const session=async()=> 'user-token';
const transaction={from:'0x'+'1'.repeat(40),to:'0x'+'2'.repeat(40),chainId:420,value:'0x0',data:'0x12345678'};
test('wallet signer is required; browser cannot silently submit unsigned actions',()=>{
 assert.throws(()=>createSocialHttpGateway({getSession:session,fetchImpl:async()=>({})}),/session and transport/);
});
test('player signs server-bound transaction intent before the authenticated submission',async()=>{
 const events=[];
 const fetchImpl=async(url,opts)=>{
  const b=JSON.parse(opts.body);events.push({url,b,authorization:opts.headers.authorization});
  return {ok:true,json:async()=>({ok:true,result:url.endsWith('/authorize')?{allowed:true,proof:'p',transaction}:url.endsWith('/submit')?{operationId:'op'}:{}})};
 };
 const gateway=createSocialHttpGateway({getSession:session,fetchImpl,signTransaction:async intent=>{assert.deepEqual(intent,transaction);events.push({signed:true});return '0x1234';}});
 const permit=await gateway.authorize({principal:'alice',scope:'HC',action:'organization.join',payload:{organization:'org'}});
 await gateway.submit({principal:'alice',scope:'HC',action:'organization.join',payload:{organization:'org'},authorizationProof:permit.proof});
 assert.deepEqual(events.map(x=>x.signed?'signed':x.url.split('/').pop()),['authorize','signed','submit']);
 assert.equal(events[2].b.signedRawTransaction,'0x1234');
 assert.equal(events[2].authorization,'Bearer user-token');
 await assert.rejects(gateway.submit({principal:'alice',scope:'HC',action:'organization.join',payload:{},authorizationProof:'p'}),/signing intent missing/);
});
test('wallet refusing signature cannot reach network submission',async()=>{
 let sent=0;
 const gateway=createSocialHttpGateway({getSession:session,signTransaction:async()=>{throw Error('wallet rejected');},fetchImpl:async(url)=>{if(url.endsWith('/submit'))sent++;return {ok:true,json:async()=>({ok:true,result:{allowed:true,proof:'p',transaction}})};}});
 const permit=await gateway.authorize({principal:'alice',scope:'HC',action:'organization.join',payload:{}});
 await assert.rejects(gateway.submit({principal:'alice',scope:'HC',action:'organization.join',payload:{},authorizationProof:permit.proof}),/wallet rejected/);
 assert.equal(sent,0);
});
