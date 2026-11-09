import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileFinalizedEvents,projectPublicEventSummary} from '../server/ecosystem.mjs';
const h=n=>'0x'+n.repeat(64),a='0x'+'a'.repeat(40);
const base={chainId:'420',gameId:'dice',account:a,safeHead:'100'};
const e=(block,index=0,extra={})=>({chainId:'420',gameId:'dice',account:a,type:'WAGER_ACCEPTED',
 blockNumber:String(block),blockHash:h('b'),transactionHash:h('c'),logIndex:String(index),...extra});
const run=(other={})=>reconcileFinalizedEvents({...base,...other});
test('finalized event replay is idempotent and deterministic',()=>{
 const initial=run({events:[e(98,1),e(98,0,{transactionHash:h('d')})]});
 assert.deepEqual(initial.map(x=>x.logIndex),['0','1']);
 assert.deepEqual(run({previous:initial,rewindFrom:'98',events:[e(98,1),e(98,0,{transactionHash:h('d')})]}),initial);
 assert.deepEqual(projectPublicEventSummary(initial),{WAGER_ACCEPTED:2,WAGER_SETTLED:0,WAGER_VOIDED:0,GAME_PAUSED:0,GAME_RESUMED:0});
});
test('explicit rewind replaces orphaned events and handles empty replacement blocks',()=>{
 const old=run({events:[e(96),e(99,0,{transactionHash:h('e')})]});
 const replacement=run({previous:old,rewindFrom:'99',events:[]});
 assert.equal(replacement.length,1);assert.equal(replacement[0].blockNumber,'96');
 const reorg=run({previous:old,rewindFrom:'99',events:[e(99,0,{blockHash:h('f'),transactionHash:h('f')})]});
 assert.equal(reorg[1].blockHash,h('f'));
});
test('no unsafe finality, account, game or chain leakage',()=>{
 for(const bad of [
  e(101),e(99,0,{account:'0x'+'d'.repeat(40)}),e(99,0,{gameId:'keno'}),
  e(99,0,{chainId:'421'}),e(99,0,{type:'FUNDED_WITHDRAWAL'}),
  e(99,0,{transactionHash:'garbage'}),e(99,0,{logIndex:'-1'}),
  e(99,0,{blockNumber:'09'})
 ])assert.throws(()=>run({events:[bad]}));
});
test('conflicting block or event identity fails closed',()=>{
 assert.throws(()=>run({events:[e(99),e(99,1,{blockHash:h('f'),transactionHash:h('f')})]}));
 assert.throws(()=>run({events:[e(99),e(99,0,{type:'WAGER_SETTLED'})]}));
});
test('history must be rewound explicitly and validated again',()=>{
 const old=run({events:[e(95)]});
 assert.throws(()=>run({previous:old,safeHead:'94',rewindFrom:'94'}));
 assert.throws(()=>run({events:[e(99)],rewindFrom:'100'}));
 assert.throws(()=>run({events:Array(10001).fill(e(99))}));
});
