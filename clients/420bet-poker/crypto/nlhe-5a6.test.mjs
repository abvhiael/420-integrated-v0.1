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
