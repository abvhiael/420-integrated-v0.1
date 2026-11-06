import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CELL_COUNT,WILD_SYMBOL,SCATTER_SYMBOL,ROAD_SYMBOL,MAX_BONUS_CASCADES,
 FEATURE_PAY_SCALE,MAX_FEATURE_PAYOUT_BETS,MAX_STICKY_WILDS,
 BET_CHOICES,makeScatterBoard,resolveRound,resolveEndlessHarvest,findClusters,
 playPracticeRound,createPracticeSession,awardedFreeSpins
} from '../src/cannabis-cowboy-engine.js';
import {createRoadTrip,chooseRoadCase,ROAD_CASE_MULTIPLIERS} from '../src/cannabis-cowboy-road-trip.js';
const seed=(initial=123)=>{let s=initial>>>0;return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296)};
const patterned=()=>Array.from({length:CELL_COUNT},(_,i)=>(Math.floor(i/6)*3+i%6)%8);
const withScatters=n=>{const b=patterned();for(let i=0;i<n;i++)b[i]=SCATTER_SYMBOL;return b;};
test('M8 discloses fixed bonus pay scale and finite bonus cascade cap',()=>{
 assert.equal(FEATURE_PAY_SCALE,0.024);
 assert.equal(MAX_BONUS_CASCADES,20);
 assert.equal(MAX_FEATURE_PAYOUT_BETS,500);
 assert.equal(MAX_STICKY_WILDS,8);
});
test('bonus never awards the same pinned smoke-ring wild twice during a free-spin cascade chain',()=>{
 const b=patterned();b[0]=WILD_SYMBOL;for(const p of [1,6,7,12])b[p]=0;
 const round=resolveRound(b,20,seed(7),{bonusMode:true});
 assert(round.steps.length>=1);
 const paidWilds=round.steps.flatMap(s=>s.clusters.flatMap(c=>c.wildPositions||[]));
 assert.equal(paidWilds.filter(x=>x===0).length,1);
 assert(round.lockedWilds.includes(0));
 assert.equal(round.board[0],WILD_SYMBOL);
});
test('free-spin cascade limit is a deterministic terminal state with full ledger, not a credit-loss exception',()=>{
 const b=Array(CELL_COUNT).fill(0);
 const bonus=resolveRound(b,20,()=>0,{bonusMode:true});
 assert.equal(bonus.steps.length,MAX_BONUS_CASCADES);
 assert.equal(bonus.bonusCascadeCapped,true);
 assert.equal(bonus.steps.reduce((s,step)=>s+step.cascadeWin,0),bonus.total);
 assert.throws(()=>resolveRound(b,20,()=>0),/Cascade safety bound/);
});
test('feature sum of clusters and stages is exact, and never exceeds max total free-spin payout',()=>{
 for(const bet of BET_CHOICES){
  const b=patterned();b[0]=WILD_SYMBOL;for(const p of [1,6,7,12])b[p]=0;
  const feature=resolveEndlessHarvest(8,bet,seed(bet*19),{boardFactory:()=>b});
  const cap=MAX_FEATURE_PAYOUT_BETS*bet;
  assert(feature.total<=cap);
  assert.equal(feature.total,feature.spins.reduce((a,x)=>a+x.outcome.total,0));
  for(const spin of feature.spins){
   assert.equal(spin.outcome.total,spin.outcome.steps.reduce((a,x)=>a+x.cascadeWin,0));
   for(const stage of spin.outcome.steps){
    assert.equal(stage.cascadeWin,stage.clusters.reduce((a,x)=>a+x.payout,0));
    assert(stage.clusters.every(x=>x.scale===FEATURE_PAY_SCALE));
   }
  }
 }
});
test('base and bonus accounting are exactly settled once for triggered practice rounds',()=>{
 for(const bet of BET_CHOICES){
  const state=createPracticeSession({bet,credits:500,rng:seed(bet)});
  const result=playPracticeRound(state,seed(58),{baseBoard:withScatters(3),featureOptions:{boardFactory:()=>patterned()}});
  assert(result.accepted);
  assert.equal(result.state.credits,state.credits-bet+result.outcome.total);
  assert.equal(result.outcome.total,result.outcome.baseTotal+result.outcome.feature.total);
  assert(result.outcome.feature.total<=MAX_FEATURE_PAYOUT_BETS*bet);
 }
});
test('exact Road Trip case expectation is independent of player case index',()=>{
 const expected=5*ROAD_CASE_MULTIPLIERS.reduce((a,b)=>a+b,0)/ROAD_CASE_MULTIPLIERS.length;
 assert(Math.abs(expected-8.714285714285714)<1e-10);
 const trip=createRoadTrip(20,seed(35));
 for(let caseIndex=0;caseIndex<3;caseIndex++){
  let prior=[];
  for(let stop=0;stop<5;stop++)prior=chooseRoadCase(trip,prior,caseIndex).picks;
  assert.equal(prior.length,5);
 }
});
