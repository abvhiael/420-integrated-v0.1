import test from 'node:test';
import assert from 'node:assert/strict';
import {settleWithRake,canonicalRake} from './nlhe-economics.mjs';
import {referenceAward} from './nlhe-pot-reference.mjs';

test('nine tiers never charge more rake than a side pot contains',()=>{
 for(let bps=0;bps<=10000;bps++){
  const x=settleWithRake({contributions:[10,11,12,13,14,15,16,17,17],
   folded:Array(9).fill(false),ranks:Array(9).fill([1]),button:8,
   flopSeen:true,rakeBps:bps,rakeCap:1000});
  assert.equal(x.payouts.reduce((a,b)=>a+b,0)+x.rake,125);
  assert.ok(x.pots.every(p=>p.cut>=0&&p.cut<=p.gross));
 }
});
test('independent chip-layer oracle splits each complete pot once',()=>{
 const data={contributions:[5,5,5],folded:[false,false,true],ranks:[[1],[1],null],button:0};
 assert.deepEqual(referenceAward(data),[7,8,0]);
});
test('rake remains exact at the safe integer limit',()=>{
 const pot=Number.MAX_SAFE_INTEGER;
 for(const bps of [1,333,700,9999,10000])assert.equal(
  canonicalRake({grossPot:pot,flopSeen:true,bps,cap:pot}),Number(BigInt(pot)*BigInt(bps)/10000n));
});
test('invalid button and unsafe cumulative chips fail closed',()=>{
 const data={contributions:[5,5],folded:[false,false],ranks:[[1],[1]],button:2,
  flopSeen:true,rakeBps:0,rakeCap:0};
 assert.throws(()=>settleWithRake(data),/invalid seats/);
 assert.throws(()=>settleWithRake({...data,button:0,contributions:[Number.MAX_SAFE_INTEGER,1]}),/invalid chips/);
});

import {verifyShowdownSettlement} from './nlhe-independent-verifier.mjs';
import {independentSeven} from './nlhe-reference.mjs';
test('authenticated showdown interpreter agrees on nine-tier cumulative rake',()=>{
 const board=[1,2,3,4,5],holeCards=[[12,25],[11,24],[10,23],[9,22],[8,21],[7,20],[6,19],[17,30],[18,31]];
 const contributions=[10,11,12,13,14,15,16,17,17],folded=Array(9).fill(false),button=3;
 const actual=verifyShowdownSettlement({board,holeCards,contributions,folded,button,rake:8});
 const expected=settleWithRake({contributions,folded,button,ranks:holeCards.map(x=>independentSeven([...x,...board])),
  flopSeen:true,rakeBps:700,rakeCap:1000});
 assert.deepEqual(actual.payouts,expected.payouts);
});
test('showdown rejects duplicate cards across different seats and invalid buttons',()=>{
 const data={board:[1,2,3,4,5],holeCards:[[12,25],[12,24]],contributions:[10,10],folded:[false,false],button:0};
 assert.throws(()=>verifyShowdownSettlement(data),/duplicate across opened seats/);
 assert.throws(()=>verifyShowdownSettlement({...data,button:2}),/seat identity/);
});
