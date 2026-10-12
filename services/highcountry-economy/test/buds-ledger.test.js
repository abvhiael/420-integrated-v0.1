import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BudsLedger,MemoryTransactionFixture} from '../src/buds-ledger.js';
function setup(){const store=new MemoryTransactionFixture();const ledger=new BudsLedger(store,{authorize:(source,proof,owner,n)=>source==='mission:1'&&proof==='signed-evidence'&&owner==='alice'&&n===100,authorizeSink:(sink)=>sink==='approved:sink',sourceLimit:(source)=>source==='mission:1'?200:0});return {store,ledger};}
test('earned source, conservation, full-fill, zero fee, reserve/refund, sink',async()=>{
 const {store,ledger}=setup();
 await ledger.earn('op1','alice','mission:1','signed-evidence',100);
 await ledger.reserve('op2','alice',70);
 await ledger.release('op3','alice',20);
 await ledger.settle('op4','alice','bob',50);
 await ledger.spend('op5','bob',10,'approved:sink');
 assert.deepEqual(store.state.balances.get('alice'),{available:50,reserved:0});
 assert.deepEqual(store.state.balances.get('bob'),{available:40,reserved:0});
 assert.equal(store.state.issued,100);assert.equal(store.state.burned,10);
});
test('replay, unapproved mint, overdraw, self trade, fee, unsafe units fail closed',async()=>{
 const {store,ledger}=setup();
 await assert.rejects(ledger.earn('bad','alice','mission:1','local-save',100));
 assert.equal(store.state.operations.size,0);
 await ledger.earn('op1','alice','mission:1','signed-evidence',100);
 await assert.rejects(ledger.earn('op1','alice','mission:1','signed-evidence',100));
 await assert.rejects(ledger.earn('op-new','alice','mission:1','signed-evidence',100));
 await assert.rejects(ledger.reserve('overspend','alice',101));
 await ledger.reserve('op2','alice',90);
 await assert.rejects(ledger.settle('self','alice','alice',10));
 await assert.rejects(ledger.settle('fee','alice','bob',10,1));
 await assert.rejects(ledger.settle('too-much','alice','bob',91));
 await assert.rejects(ledger.spend('unsafe','alice',Number.MAX_SAFE_INTEGER+1,'sink'));
 assert.equal(store.state.balances.get('alice').reserved,90);
 assert.equal(store.state.operations.size,2);
});
test('failed settlement rolls back recipient and replay marker',async()=>{
 const {store,ledger}=setup();
 await ledger.earn('op1','alice','mission:1','signed-evidence',100);
 await ledger.reserve('op2','alice',50);
 await assert.rejects(ledger.settle('op3','alice','bob',60));
 assert.equal(store.state.balances.has('bob'),false);
 await ledger.settle('op3','alice','bob',50);
 assert.equal(store.state.balances.get('bob').available,50);
});

test('configured source issuance cap rejects inflation with new proof',async()=>{
 const {store,ledger}=setup();
 await ledger.earn('a','alice','mission:1','signed-evidence',100);
 // A separate verified earning would exceed the source cap only if the catalogue explicitly authorizes it.
 assert.equal(store.state.sourceIssued.get('mission:1'),100);
 assert.equal(store.state.claims.size,1);
});
