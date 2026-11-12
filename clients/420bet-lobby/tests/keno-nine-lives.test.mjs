import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceNineLives,nineLivesRound,nineLivesExpectedRtp,nineLivesCandidateMultiplier,hypergeometricProbability} from '../src/keno-nine-lives.js';

test('only non-paying 0-hit and 1-hit draws add a life; 2+ hits with no pay hold',()=>{
 assert.deepEqual(advanceNineLives(0,0,false),{progress:1,bonusApplied:false,bonusReady:false});
 assert.deepEqual(advanceNineLives(5,1,false),{progress:6,bonusApplied:false,bonusReady:false});
 assert.deepEqual(advanceNineLives(5,2,false),{progress:5,bonusApplied:false,bonusReady:false});
 assert.deepEqual(advanceNineLives(8,0,false),{progress:9,bonusApplied:false,bonusReady:true});
 assert.deepEqual(advanceNineLives(9,0,false),{progress:9,bonusApplied:false,bonusReady:true});
 assert.deepEqual(advanceNineLives(9,3,false),{progress:9,bonusApplied:false,bonusReady:true});
});
test('any paying draw resets, and full meter doubles only the next paying draw',()=>{
 assert.deepEqual(advanceNineLives(5,3,true),{progress:0,bonusApplied:false,bonusReady:false});
 const early=nineLivesRound(8,5,3);
 assert.equal(early.progress,0);assert.equal(early.bonusApplied,false);
 const charged=nineLivesRound(9,5,2);
 assert.equal(charged.progress,9);assert.equal(charged.bonusApplied,false);
 const win=nineLivesRound(9,5,4);
 assert.equal(win.progress,0);assert.equal(win.bonusApplied,true);
 assert.equal(win.effectiveMultiplier,Number((2*win.baseMultiplier).toFixed(4)));
});
test('non-paying multipliers and invalid state input',()=>{
 assert.throws(()=>advanceNineLives(10,0,false));
 assert.throws(()=>advanceNineLives(0,-1,false));
 assert.throws(()=>advanceNineLives(0,0,0));
 assert.equal(nineLivesCandidateMultiplier(5,0),0);
 assert.equal(nineLivesCandidateMultiplier(5,2),0);
 assert.throws(()=>nineLivesCandidateMultiplier(11,1));
});
test('exact 80 choose 20 hypergeometric distributions sum to one',()=>{
 for(let picks=1;picks<=10;picks++){
  const sum=Array.from({length:picks+1},(_,hits)=>hypergeometricProbability(picks,hits)).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(sum-1)<1e-10,`picks ${picks}`);
 }
});
test('95% long-run RTP including a nine-qualifying-0-or-1-hit-draw 2x bonus across 1-10 picks',()=>{
 for(let picks=1;picks<=10;picks++){
  const result=nineLivesExpectedRtp(picks);
  assert.ok(result.combined>=0.94&&result.combined<=0.96,`picks ${picks} RTP ${result.combined}`);
  assert.ok(Math.abs(result.bonusReadyProbability-(result.chargingProbability/(result.chargingProbability+result.payingProbability))**9)<1e-12);
  assert.ok(result.bonus>=0);
 }
});
test('browser UI charges on 9 zero-hit rounds, pays 2x on next win, resets and persists reset',async()=>{
 const {parseHTML}=await import('linkedom');
 const {createNeonKeno}=await import('../src/keno-neon.js');
 const {document,window}=parseHTML('<html><body></body></html>');
 const values=new Map();
 window.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 // Deterministic RNG always draws 1..20. Selecting 61..70 guarantees no hits.
 const root=createNeonKeno(document,{random:()=>0});
 const click=node=>{assert(node);node.dispatchEvent(new window.Event('click'));};
 const selectNumbers=(numbers)=>{for(const n of numbers)click([...root.querySelectorAll('.ls-number')][n-1]);};
 selectNumbers([61,62,63,64,65,66,67,68,69,70]);
 for(let i=0;i<9;i++){
  click(root.querySelector('.ls-draw'));
  assert.equal(root.querySelectorAll('.ls-life-icon[src*="life_lit"]').length,i+1);
 }
 assert.match(root.querySelector('.ls-meter-caption').textContent,/READY/);
 const key='420bet:catastrophe-jack:keno:nine-lives:zero-one-hit:v3';
 assert.equal(JSON.parse(values.get(key)).progress,9);
 click(root.querySelector('.ls-draw')); // one more failing draw doesn't consume it
 assert.equal(JSON.parse(values.get(key)).progress,9);
 // Remove ten selections, then select 1..10, all paying.
 click(root.querySelector('.ls-clear'));
 selectNumbers([1,2,3,4,5,6,7,8,9,10]);
 click(root.querySelector('.ls-draw'));
 assert.equal(root.querySelectorAll('.ls-life-icon[src*="life_unlit"]').length,9);
 assert.match(root.querySelector('.ls-meter-caption').textContent,/RESET TO 0/);
 assert.match(root.querySelector('.ls-dialogue').textContent,/doubles the winning draw/i);
 assert.equal(JSON.parse(values.get(key)).progress,0);
 const reopened=createNeonKeno(document,{random:()=>0});
 assert.match(reopened.querySelector('.ls-meter-caption').textContent,/0 \/ 9/);
});
test('paying draw before full meter resets without double payout',async()=>{
 const {parseHTML}=await import('linkedom');
 const {createNeonKeno}=await import('../src/keno-neon.js');
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createNeonKeno(document,{random:()=>0});
 const click=node=>node.dispatchEvent(new window.Event('click'));
 for(const n of [61,62,63,64,65,66,67,68,69,70])click([...root.querySelectorAll('.ls-number')][n-1]);
 for(let i=0;i<3;i++)click(root.querySelector('.ls-draw'));
 click(root.querySelector('.ls-clear'));
 for(let n=1;n<=10;n++)click([...root.querySelectorAll('.ls-number')][n-1]);
 click(root.querySelector('.ls-draw'));
 assert.equal(root.querySelectorAll('.ls-life-icon[src*="life_lit"]').length,0);
 assert.doesNotMatch(root.querySelector('.ls-dialogue').textContent,/doubles the winning draw/i);
});

test('one matching number charges only when nonpaying; paying one-hit draw resets',()=>{
 // With five spots, 1 hit is nonpaying; with one spot, 1 hit is a win.
 assert.equal(nineLivesRound(3,5,1).progress,4);
 assert.equal(nineLivesRound(3,5,2).progress,3);
 assert.equal(nineLivesRound(3,1,1).progress,0);
 assert.equal(nineLivesRound(9,1,1).bonusApplied,true);
});
