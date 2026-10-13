import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanonicalSettlementWorker} from '../src/canonical-settlement-worker.js';
import {MemoryTransactionFixture} from '../src/buds-ledger.js';
function setup(){
 const store=new MemoryTransactionFixture();
 store.state.transferIntents.set('transfer:1',{status:'prepared',listingId:'listing',buyer:'bob'});
 const state={finalized:false,cancelled:false,submissions:0};
 const settlement={
  finalize:async()=>{store.state.transferIntents.get('transfer:1').status='finalized';return 'ok';},
  abort:async()=>{store.state.transferIntents.get('transfer:1').status='cancelled';return 'returned';}
 };
 const authority={
  confirmedReservedTransfer:async()=>state.finalized,
  proveUnexecutedAndCancelled:async()=>state.cancelled
 };
 const worker=new CanonicalSettlementWorker({store,settlement,authority,leaseMs:1000,clock:()=>1000,
  submitCanonical:async()=>{state.submissions++;return {txHash:'tx:1'};}});
 return {store,state,worker};
}
test('durable dispatch records transaction hash and never rebroadcasts automatically',async()=>{
 const {store,state,worker}=setup();
 assert.equal((await worker.tick('transfer:1')).status,'submitted');
 assert.equal(store.state.settlementJobs.get('transfer:1').txHash,'tx:1');
 assert.equal((await worker.tick('transfer:1')).status,'awaiting-finality');
 assert.equal(state.submissions,1);
 state.finalized=true;
 assert.equal((await worker.tick('transfer:1')).status,'finalized');
 assert.equal((await worker.tick('transfer:1')).status,'resolved');
});
test('irreversibly cancelled intent is recovered without chain submission',async()=>{
 const {state,worker,store}=setup();state.cancelled=true;
 assert.equal((await worker.tick('transfer:1')).status,'cancelled');
 assert.equal(state.submissions,0);
 assert.equal(store.state.transferIntents.get('transfer:1').status,'cancelled');
});
test('an active transaction lease prevents overlapping workers',async()=>{
 const {store}=setup();let unlock;
 const pending=new Promise(resolve=>{unlock=resolve;});
 const authority={confirmedReservedTransfer:async()=>false,proveUnexecutedAndCancelled:async()=>false};
 const settlement={finalize:async()=>{},abort:async()=>{}};
 const worker=new CanonicalSettlementWorker({store,settlement,authority,leaseMs:1000,clock:()=>1000,
  submitCanonical:async()=>pending});
 const running=worker.tick('transfer:1');
 for(let i=0;i<20 && !store.state.settlementJobs.has('transfer:1');i++)await Promise.resolve();
 assert.equal((await worker.tick('transfer:1')).status,'leased');
 unlock({txHash:'tx:2'});
 assert.equal((await running).status,'submitted');
});
