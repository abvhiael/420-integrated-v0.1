import test from 'node:test';
import assert from 'node:assert/strict';
import {
 BASE_PAY_SCALE,HARVEST_PAY_SCALE,CLUSTER_PAYS,HARVEST_CLUSTER_PAYS,
 clusterPayout,SYMBOL_WEIGHTS,HARVEST_SYMBOL_WEIGHTS,WILD_SYMBOL,
 SCATTER_CHANCE,ROAD_CHANCE,MAX_CASCADES,MAX_FREE_SPINS,
 SCATTER_SYMBOL,makeScatterBoard,resolveRound,resolveEndlessHarvest
} from '../src/cannabis-cowboy-engine.js';
import {createRoadTrip,chooseRoadCase,ROAD_CASE_MULTIPLIERS,ROAD_STACKABLE_MULTIPLIERS} from '../src/cannabis-cowboy-road-trip.js';
const seed=n=>{let s=n>>>0;return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296)};
test('base and Endless Harvest cluster tables are independently calibrated and exposed',()=>{
 assert.equal(BASE_PAY_SCALE,2.23);
 assert.equal(HARVEST_PAY_SCALE,2);
 assert.equal(CLUSTER_PAYS.length,8);
 assert.equal(HARVEST_CLUSTER_PAYS.length,8);
 assert.equal(clusterPayout(0,5,20),18);
 assert.equal(clusterPayout(0,5,20,true),16);
 assert.equal(clusterPayout(7,20,20),1784);
 assert.equal(clusterPayout(7,20,20,true),1600);
 assert(CLUSTER_PAYS.every((row,i)=>row.every((value,k)=>value>=HARVEST_CLUSTER_PAYS[i][k])));
});
test('calibration leaves wild weighting, feature trigger probabilities, and Road Trip multipliers intact',()=>{
 assert.equal(HARVEST_SYMBOL_WEIGHTS[WILD_SYMBOL],SYMBOL_WEIGHTS[WILD_SYMBOL]*2);
 assert.equal(SCATTER_CHANCE,.012);
 assert.equal(ROAD_CHANCE,.008);
 assert.deepEqual(ROAD_STACKABLE_MULTIPLIERS,[2,3,5,10]);
 assert.deepEqual(ROAD_CASE_MULTIPLIERS,[0,.5,1,1.5,2,3,4.2]);
 assert.equal(MAX_FREE_SPINS,100);
 assert.equal(MAX_CASCADES,200);
});
test('100 free-spin limit survives aggressive scripted retriggers without sticky wilds',()=>{
 const rng=seed(1005420);
 const result=resolveEndlessHarvest(20,20,rng,{maxSpins:100,boardFactory:n=>{
  const board=makeScatterBoard(rng,true);
  if(n<=5)for(let i=0;i<6;i++)board[i]=SCATTER_SYMBOL;
  return board;
 }});
 assert.equal(result.played,100);
 assert.equal(result.awarded,100);
 assert.equal(result.capReached,true);
 assert.equal(result.stickyWilds.length,0);
 assert(Number.isSafeInteger(result.total)&&result.total>=0);
});
test('pathological infinite cascade rejects safely at 200, never silently pays',()=>{
 const board=makeScatterBoard(()=>0);
 assert.throws(()=>resolveRound(board,20,()=>0,{bonusMode:true}),/Cascade safety bound reached/);
});
test('Road Trip extreme is exactly 252 times bet and uses additive multipliers',()=>{
 const trip=createRoadTrip(20,seed(17));
 trip.stops.forEach(stop=>{
  stop.multiplierCase=0;stop.multiplier=10;stop.caseValues=[0,84,84];
 });
 for(const nMultiplier of [2,3]){
  let picks=[],result;
  for(let i=0;i<5;i++){
   result=chooseRoadCase(trip,picks,i<nMultiplier?0:1);
   picks=result.picks;
  }
  assert.equal(result.stackedMultiplier,nMultiplier*10);
  assert.equal(result.total,5040);
 }
});
