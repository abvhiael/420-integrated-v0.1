import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinalizedBetNotificationPublisher} from '../server/notifications-mail-source.mjs';
const H=n=>'0x'+n.toString(16).padStart(64,'0'),A=n=>'0x'+n.toString(16).padStart(40,'0');
function fixture({reorganized=false,badOwner=false,badRole=false,unauthorized=false}={}){
 const roles=['casino-router','casino-settlement','poker-ledger','fantasy-contest','sports-tickets'];
 const sources=roles.map((role,i)=>({id:'source-'+i,role,address:A(i+1),fromBlock:'1'}));
 const reader={config:{chainId:'420',contracts:sources.map(x=>({...x}))},
  readCheckpoint:async()=>({events:[]}),
  poll:async()=>({reorganized,state:{events:[{
   chainId:'420',gameId:'source-0',type:'WAGER_ACCEPTED',contract:A(1),
   role:badRole?'sports-tickets':'casino-router',
   gameVersionId:H(10),objectId:H(11),account:A(12),
   blockNumber:'99',blockHash:H(99),transactionHash:H(98),logIndex:'0'
  }]}})};
 const registry={result:{qualified:!unauthorized},config:{chainId:'420',sources,
  games:[{id:'casino-dice',vertical:'casino',gameVersionId:H(10)}]}};
 const requests=[],outbox={enqueue:async value=>{requests.push(value);return {created:true}},
  haltForReorg:async()=>{outbox.halted=true}};
 const pub=createFinalizedBetNotificationPublisher({
  reader,checkpointPath:'/secure/indexer.json',outbox,
  verifyRegistry:async()=>registry,
  resolveAudience:async()=>[{ownershipVerified:true,account:badOwner?A(13):A(12),
   gameVersionId:H(10),tenant:'420bet',userId:'verified-subject',
   subscriptions:[{id:'sub-4',channel:'mail',recipient:'recipient-7',policyVersion:'policy-2'}]}]
 });
 return {pub,requests,outbox};
}
test('only verified finalized Indexer source, signed registry and independently authorized owner can be enqueued',async()=>{
 const f=fixture();
 const result=await f.pub.publish();
 assert.equal(result.queued,1);
 assert.equal(f.requests.length,1);
 assert.equal(f.requests[0].kind,'wager-accepted');
 assert.equal(f.requests[0].event.account,A(12));
 assert.equal(f.requests[0].event.gameId,'casino-dice');
 assert.equal(f.requests[0].tenant,'420bet');
});
test('wrong event role is skipped, wrong account and unapproved registry fail closed',async()=>{
 assert.equal((await fixture({badRole:true}).pub.publish()).skipped,1);
 await assert.rejects(fixture({badOwner:true}).pub.publish(),/wrong owner account/);
 await assert.rejects(fixture({unauthorized:true}).pub.publish(),/unqualified Registry/);
});
test('reorganization automatically halts outgoing deliveries before accepting new audience',async()=>{
 const f=fixture({reorganized:true}),result=await f.pub.publish();
 assert.equal(result.halted,true);assert.equal(result.queued,0);
 assert.equal(f.outbox.halted,true);
 assert.equal(f.requests.length,0);
});
