import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReviewedEconomyCatalog} from '../src/reviewed-catalog.js';
import {BudsLedger,MemoryTransactionFixture} from '../src/buds-ledger.js';
test('verified reviewed catalogue limits inflation and rejects imported client claims',async()=>{
 const catalog=new ReviewedEconomyCatalog({
  sources:[{id:'reviewed:mission',maxAward:10,totalCap:20}],
  sinks:['reviewed:purchase'],
  verifyEvidence:(src,proof,owner,amount)=>proof==='verified:'+owner+':'+amount
 });
 const store=new MemoryTransactionFixture(),ledger=new BudsLedger(store,catalog);
 await assert.rejects(ledger.earn('bad','alice','reviewed:mission','client-save',10));
 await assert.rejects(ledger.earn('too-big','alice','reviewed:mission','verified:alice:30',30));
 await ledger.earn('a','alice','reviewed:mission','verified:alice:10',10);
 await assert.rejects(ledger.earn('a2','alice','reviewed:mission','verified:alice:10',10));
 await assert.rejects(ledger.spend('bad-sink','alice',1,'unknown:sink'));
 assert.equal(store.state.issued,10);
 assert.equal(store.state.operations.has('bad-sink'),false);
});
test('no default catalogue, invalid or duplicated limits are rejected',()=>{
 assert.throws(()=>new ReviewedEconomyCatalog({sources:[{id:'test',totalCap:0,maxAward:1}],sinks:[],verifyEvidence:()=>true}));
 assert.throws(()=>new ReviewedEconomyCatalog({sources:[{id:'x',totalCap:10,maxAward:2},{id:'x',totalCap:10,maxAward:2}],sinks:[],verifyEvidence:()=>true}));
});
