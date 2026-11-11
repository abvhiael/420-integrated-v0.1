import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceNineLives,nineLivesRound,nineLivesExpectedRtp,nineLivesCandidateMultiplier,hypergeometricProbability} from '../src/keno-nine-lives.js';

test('accumulates hit counts across draws and caps at nine',()=>{
 assert.deepEqual(advanceNineLives(4,3,true),{progress:7,bonusApplied:false,bonusReady:false});
 assert.deepEqual(advanceNineLives(8,4,true),{progress:9,bonusApplied:false,bonusReady:true});
});
test('triggering draw is not doubled; next paying draw doubles and resets',()=>{
 const trigger=nineLivesRound(8,5,3);
 assert.equal(trigger.progress,9);assert.equal(trigger.bonusApplied,false);
 assert.equal(trigger.effectiveMultiplier,trigger.baseMultiplier);
 const miss=nineLivesRound(9,5,0);
 assert.equal(miss.progress,9);assert.equal(miss.bonusApplied,false);
 const noPayHit=nineLivesRound(9,5,1);
 assert.equal(noPayHit.progress,9);assert.equal(noPayHit.bonusApplied,false);
 const win=nineLivesRound(9,5,4);
 assert.equal(win.progress,0);assert.equal(win.bonusApplied,true);
 assert.equal(win.effectiveMultiplier,Number((2*win.baseMultiplier).toFixed(4)));
});
test('invalid input rejected and non-paying rows stay at zero',()=>{
 assert.throws(()=>advanceNineLives(10,0,false));
 assert.throws(()=>advanceNineLives(0,-1,false));
 assert.equal(nineLivesCandidateMultiplier(5,0),0);
 assert.throws(()=>nineLivesCandidateMultiplier(11,1));
});
test('exact hypergeometric probabilities sum to one',()=>{
 for(let picks=1;picks<=10;picks++){
  const total=Array.from({length:picks+1},(_,hits)=>hypergeometricProbability(picks,hits)).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(total-1)<1e-10,'picks '+picks);
 }
});
test('long-run RTP including the persistent 2x bonus is between 94 and 96 percent for every fixed pick count',()=>{
 for(let picks=1;picks<=10;picks++){
  const result=nineLivesExpectedRtp(picks);
  assert.ok(result.combined>=0.94&&result.combined<=0.96,'picks '+picks+' RTP '+result.combined);
  assert.ok(result.bonus>0&&result.bonusReadyProbability>0);
 }
});
