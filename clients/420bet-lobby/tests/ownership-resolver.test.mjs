import test from 'node:test';
import assert from 'node:assert/strict';
import {createRemoteBetOwnershipResolver} from '../server/ownership-resolver.mjs';
const H=n=>'0x'+n.toString(16).padStart(64,'0');
const A=n=>'0x'+n.toString(16).padStart(40,'0');
const roles=['casino-router','casino-settlement','poker-ledger','poker-canonical','fantasy-contest','sports-tickets'];
const vertical={'casino-router':'casino','casino-settlement':'casino','poker-ledger':'poker','poker-canonical':'poker','fantasy-contest':'fantasy','sports-tickets':'sportsbook'};
const time=1762718400000;
function fixture(role,{account=A(8),eventVersion=H(10),bad=null,backendFailure=false}={}){
 const event={chainId:'420',role,sourceId:'approved-source',sourceAddress:A(2),
  gameVersionId:eventVersion,objectId:H(30),account,kind:'wager-settled',
  blockNumber:'111',blockHash:H(111),transactionHash:H(55),logIndex:'2'};
 const owner={ownershipVerified:true,revoked:false,tenant:'420bet',userId:'subject-1',
  account:A(8),gameVersionId:H(10),subscriptions:[
   {id:'subscription-1',recipient:'route-1',channel:'notifications',policyVersion:'policy-1'}],
  proof:{objectId:event.objectId,sourceAddress:event.sourceAddress,blockHash:event.blockHash,
   transactionHash:event.transactionHash,logIndex:event.logIndex,ownerAccount:A(8),verified:true}};
 const response={...event,vertical:vertical[role],authoritative:true,finalized:true,revoked:false,
  verifiedAt:time,owners:[owner]};
 if(bad==='wrong-owner')owner.account=A(9);
 if(bad==='forged-proof')owner.proof.transactionHash=H(99);
 if(bad==='stale')response.verifiedAt=time-31000;
 if(bad==='wrong-chain')response.chainId='421';
 if(bad==='wrong-object')response.objectId=H(88);
 if(bad==='wrong-vertical')response.vertical='poker';
 if(bad==='unverified')owner.ownershipVerified=false;
 if(bad==='revoked')owner.revoked=true;
 if(bad==='duplicate')response.owners.push({...owner});
 const calls=[];
 const resolver=createRemoteBetOwnershipResolver({
  origin:'https://owner.example/',bearerToken:'a'.repeat(40),chainId:'420',now:()=>time,
  fetcher:async(url,options)=>{calls.push({url,options});
   return {ok:!backendFailure,text:async()=>JSON.stringify(response)};}
 });
 return {resolver,event,calls};
}
test('exact private owner proof resolved for casino, poker, fantasy and sportsbook roles',async()=>{
 for(const role of roles){
  const f=fixture(role);
  const owners=await f.resolver(f.event);
  assert.equal(owners.length,1);
  assert.equal(owners[0].userId,'subject-1');
  assert.equal(owners[0].subscriptions[0].channel,'notifications');
  assert.equal(f.calls[0].url,'https://owner.example/v1/420bet/ownership/resolve');
  assert.equal(JSON.parse(f.calls[0].options.body).objectId,H(30));
  assert.equal(f.calls[0].options.headers.Authorization,'Bearer '+'a'.repeat(40));
 }
});
test('unverified, cross-account, cross-chain, cross-vertical and stale proofs fail closed',async()=>{
 for(const bad of ['wrong-owner','forged-proof','stale','wrong-chain','wrong-object',
  'wrong-vertical','unverified','revoked','duplicate']){
  const f=fixture('casino-router',{bad});
  await assert.rejects(f.resolver(f.event),/420Bet ownership:/,bad);
 }
});
test('refuses missing account topic unless independently proven for exact object',async()=>{
 const f=fixture('poker-ledger',{account:null});
 assert.equal((await f.resolver(f.event))[0].account,A(8));
 const g=fixture('poker-ledger',{account:null,bad:'forged-proof'});
 await assert.rejects(g.resolver(g.event),/ownership proof/);
});
test('backend outage, wrong chain and incomplete source binding cannot result in a recipient',async()=>{
 await assert.rejects(fixture('sports-tickets',{backendFailure:true}).resolver(fixture('sports-tickets').event),/unavailable/);
 const f=fixture('sports-tickets');
 await assert.rejects(f.resolver({...f.event,sourceAddress:null}),/invalid event identity/);
 await assert.rejects(f.resolver({...f.event,chainId:'421'}),/unapproved chain/);
 assert.throws(()=>createRemoteBetOwnershipResolver({origin:'http://owner.example/',bearerToken:'a'.repeat(40),chainId:'420'}),/HTTPS/);
});
