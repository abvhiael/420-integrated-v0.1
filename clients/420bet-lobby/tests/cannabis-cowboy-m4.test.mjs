import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {CELL_COUNT,COLUMNS,MAX_CLUSTER_MULTIPLIER,SMOKE_RING_MULTIPLIER,WILD_SYMBOL,SYMBOL_WEIGHTS,findClusters,resolveRound,weightedSymbol,dropAndRefill} from '../src/cannabis-cowboy-engine.js';
import {createCannabisCowboyPractice} from '../src/cannabis-cowboy-game.js';

const background=()=>Array.from({length:CELL_COUNT},(_,i)=>(Math.floor(i/COLUMNS)*3+i%COLUMNS)%8);
const seeded=(initial=123456789)=>{let state=initial>>>0;return ()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296)};
test('wild exists as the ninth, low-frequency paid-symbol substitute',()=>{
 assert.equal(WILD_SYMBOL,8);
 assert.equal(SYMBOL_WEIGHTS.length,9);
 assert.equal(SMOKE_RING_MULTIPLIER,2);
 assert.equal(weightedSymbol(()=>.99999),WILD_SYMBOL);
 assert.throws(()=>weightedSymbol(()=>1));
});
test('smoke wild joins 4 normal paying symbols orthogonally and pays exactly once',()=>{
 const board=background();
 for(const i of [0,1,6,7])board[i]=0;
 board[12]=WILD_SYMBOL;
 const clusters=findClusters(board);
 assert.equal(clusters.length,1);
 assert.equal(clusters[0].symbol,0);
 assert.equal(clusters[0].size,5);
 assert.deepEqual(clusters[0].wildPositions,[12]);
 const result=resolveRound(board,20,seeded(19));
 assert.equal(result.steps[0].clusters[0].wildCount,1);
 assert.equal(result.steps[0].clusters[0].smokeMultiplier,2);
 assert.equal(result.steps[0].clusters[0].multiplier,2);
 assert.equal(result.steps[0].clusters[0].payout,result.steps[0].clusters[0].base*2);
});
test('wild-only groups are not wins and a shared smoke ring is never claimed twice',()=>{
 const board=background();
 for(const p of [0,1,6,7,12,13,18])board[p]=WILD_SYMBOL;
 assert.equal(findClusters(board).length,0);
 const mix=background();
 for(const p of [0,1,2,6])mix[p]=0;
 for(const p of [4,5,10,11])mix[p]=1;
 mix[3]=WILD_SYMBOL;
 const clusters=findClusters(mix);
 const all=clusters.flatMap(c=>c.wildPositions);
 assert.equal(all.length,new Set(all).size);
 assert(all.filter(p=>p===3).length<=1);
});
test('fertile harvest progresses ×2 ×4 ×8 ×16 ×32 and stays position-bound',()=>{
 const board=background();for(const p of [0,1,6,7,12])board[p]=0;
 const result=resolveRound(board,20,seeded(17));
 const first=result.steps[0];
 for(const p of first.removed)assert.equal(first.fertile[p],2);
 assert(first.refills.every(p=>p>=0&&p<CELL_COUNT));
 for(const step of result.steps){
  for(const p of step.removed)assert([2,4,8,16,32].includes(step.fertile[p]));
  for(const c of step.clusters){
   assert(c.multiplier<=MAX_CLUSTER_MULTIPLIER);
   assert.equal(c.multiplier,Math.min(MAX_CLUSTER_MULTIPLIER,c.harvestMultiplier*c.smokeMultiplier));
  }
 }
 assert.deepEqual(result.steps.reduce((s,x)=>s+x.cascadeWin,0),result.total);
});
test('M4 visual effect phases reveal winning clusters before showing final results',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const tasks=[],cancelled=new Set();
 const root=createCannabisCowboyPractice(document,{
  bet:20,credits:200,rng:seeded(19),reducedMotion:true,
  setTimeout:fn=>{tasks.push(fn);return tasks.length;},clearTimeout:id=>cancelled.add(id)
 });
 assert.equal(root.querySelectorAll('.cc-cell').length,48);
 assert(root.querySelector('.cc-effect-banner'));
 const state=root.getPracticeState();
 root.querySelector('.cc-spin').dispatchEvent(new window.Event('click'));
 assert.equal(root.getPracticeState().round,1);
 assert.equal(root.querySelector('.cc-spin').disabled,true);
 let guard=0;
 while(tasks.length&&guard++<2000)tasks.shift()();
 assert(guard<2000,'visual replay finishes');
 assert.equal(root.getPracticeState().busy,false);
 assert.equal(root.getPracticeState().credits,state.credits-state.bet+root.getPracticeState().lastWin);
 root.stopAnimation();
});
test('unsafe permanent wins remain rejected without balance debit',()=>{
 const all=Array(CELL_COUNT).fill(0);
 assert.throws(()=>resolveRound(all,20,()=>0),/Cascade safety bound/);
 assert.throws(()=>dropAndRefill(background(),[49],seeded(1)));
});
