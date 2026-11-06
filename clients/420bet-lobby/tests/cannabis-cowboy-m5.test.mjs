import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {
 CELL_COUNT,COLUMNS,WILD_SYMBOL,SCATTER_SYMBOL,MAX_FREE_SPINS,SCATTER_CHANCE,
 FREE_SPIN_AWARDS,makeScatterBoard,countScatters,awardedFreeSpins,
 resolveRound,resolveEndlessHarvest,dropAndRefill,playPracticeRound,createPracticeSession,findClusters
} from '../src/cannabis-cowboy-engine.js';
import {createCannabisCowboyPractice} from '../src/cannabis-cowboy-game.js';
import {COWBOY_SYMBOLS} from '../src/cannabis-cowboy-ui.js';
const seeded=(initial=123456789)=>{let state=initial>>>0;return ()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296)};
const patterned=()=>Array.from({length:CELL_COUNT},(_,i)=>(Math.floor(i/COLUMNS)*3+i%COLUMNS)%8);
const withScatters=(n)=>{const board=patterned();for(let i=0;i<n;i++)board[i]=SCATTER_SYMBOL;return board;};
test('scatter is tenth symbol: never pays clusters, and awards 8/12/16/20 free spins',()=>{
 assert.equal(SCATTER_SYMBOL,9);
 assert.equal(COWBOY_SYMBOLS[9].kind,'scatter');
 assert.equal(SCATTER_CHANCE,0.012);
 assert.deepEqual(FREE_SPIN_AWARDS,{3:8,4:12,5:16,6:20});
 for(const [count,want] of [[0,0],[1,0],[2,0],[3,8],[4,12],[5,16],[6,20],[15,20]]){
  assert.equal(countScatters(withScatters(count)),count);
  assert.equal(awardedFreeSpins(count),want);
 }
 assert.equal(findClusters(Array(CELL_COUNT).fill(SCATTER_SYMBOL)).length,0);
 const b=withScatters(5);
 const r=resolveRound(b,20,seeded(11));
 assert(r.steps.every(step=>step.clusters.every(cluster=>cluster.symbol!==SCATTER_SYMBOL)));
});
test('scatter RNG stays deterministic and rejects invalid values',()=>{
 assert.deepEqual(makeScatterBoard(seeded(33)),makeScatterBoard(seeded(33)));
 assert.equal(countScatters(makeScatterBoard(()=>0)),0);
 assert.equal(countScatters(makeScatterBoard(()=>0.9999)),48);
 assert.throws(()=>makeScatterBoard(()=>1),/RNG/);
});
test('free spins preserve fertile multiplier cells across rounds, never resetting within bonus',()=>{
 const wildBoard=patterned();
 wildBoard[0]=WILD_SYMBOL;
 for(const p of [1,6,7,12])wildBoard[p]=0;
 const plain=patterned();
 const boards=[wildBoard,plain,plain,plain,plain,plain,plain,plain];
 const result=resolveEndlessHarvest(8,20,seeded(19),{boardFactory:n=>boards[n-1]});
 assert.equal(result.played,8);
 assert.equal(result.awarded,8);
 assert.equal(result.spins[0].outcome.startingBoard[0],WILD_SYMBOL);
 assert(result.spins[0].outcome.steps.length>0);
 assert(result.spins[0].outcome.lockedWilds.includes(0));
 assert(result.spins[1].stickyBefore.includes(0));
 assert.equal(result.spins[1].outcome.startingBoard[0],WILD_SYMBOL);
 assert.deepEqual(result.spins[1].initialFertile,result.spins[0].outcome.fertile);
 assert.equal(result.spins.reduce((sum,s)=>sum+s.outcome.total,0),result.total);
 assert(result.spins.every(s=>s.outcome.lockedWilds.every(p=>s.outcome.board[p]===WILD_SYMBOL)));
});
test('sticky rings are retained at exact coordinates, gravity refills only between locked boundaries',()=>{
 const b=patterned(),pins=[12,30];for(const p of pins)b[p]=WILD_SYMBOL;
 const cleared=[0,6,18,24,36];
 const next=dropAndRefill(b,cleared,seeded(12),{lockedWilds:pins});
 assert.equal(next.board[12],WILD_SYMBOL);
 assert.equal(next.board[30],WILD_SYMBOL);
 assert.equal(next.refills.length,cleared.length);
 assert.throws(()=>dropAndRefill(b,[12],seeded(12),{lockedWilds:pins}),/cannot be removed/);
 assert.throws(()=>dropAndRefill(b,[],seeded(12),{lockedWilds:[11]}),/must contain wild/);
});
test('free spin retriggers are awarded from landed scatters, bounded at 100 spins',()=>{
 const base=patterned();
 const boardFactory=n=>{const b=base.slice();if(n===1)for(const p of [0,1,2])b[p]=SCATTER_SYMBOL;return b;};
 const f=resolveEndlessHarvest(8,20,seeded(17),{boardFactory,maxSpins:10});
 assert.equal(f.initialSpins,8);
 assert.equal(f.spins[0].retrigger,2);
 assert.equal(f.awarded,10);
 assert.equal(f.played,10);
 assert.equal(f.spins[9].remaining,0);
 assert(f.capReached);
 assert.throws(()=>resolveEndlessHarvest(MAX_FREE_SPINS+1,20,seeded(1)),/Invalid free-spin award/);
 assert.throws(()=>resolveEndlessHarvest(8,20,seeded(1),{maxSpins:7}),/Invalid free-spin cap/);
});
test('base trigger debits one practice bet and pays base+whole feature exactly once',()=>{
 const state=createPracticeSession({credits:500,bet:20,rng:seeded(2)});
 const result=playPracticeRound(state,seeded(8),{
  baseBoard:withScatters(3),
  featureOptions:{boardFactory:()=>patterned()}
 });
 assert.equal(result.accepted,true);
 assert.equal(result.outcome.scatterCount,3);
 assert.equal(result.outcome.freeSpinsAwarded,8);
 assert.equal(result.outcome.feature.played,8);
 assert.equal(result.outcome.total,result.outcome.baseTotal+result.outcome.feature.total);
 assert.equal(result.state.credits,480+result.outcome.total);
 assert.equal(state.credits,500);
 assert.equal(result.state.round,1);
 const normal=playPracticeRound(result.state,seeded(19),{
  baseBoard:patterned(),featureOptions:{boardFactory:()=>patterned()}
 });
 assert.equal(normal.outcome.feature,undefined,'next wager has no inherited sticky wilds or fertile cells');
});
test('Endless Harvest intro, all free-spin scenes, retrigger and end presentation run before replay unlocks',()=>{
 const {document,window}=parseHTML('<html><body></body></html>'),tasks=[],visited=[];
 const root=createCannabisCowboyPractice(document,{
  credits:500,bet:20,reducedMotion:true,rng:seeded(22),
  setTimeout:fn=>{tasks.push(fn);return tasks.length;},clearTimeout:()=>{},
  roundOptions:{baseBoard:withScatters(3),featureOptions:{
   boardFactory:n=>n===1?withScatters(3):patterned(),maxSpins:10
  }}
 });
 const spin=root.querySelector('.cc-spin');
 const before=root.getPracticeState();
 spin.dispatchEvent(new window.Event('click'));
 assert.equal(root.getPracticeState().round,1);
 assert(spin.disabled);
 let count=0;
 while(tasks.length&&count++<3000){tasks.shift()();visited.push(root.dataset.featurePhase);}
 assert(count<3000,'feature replay finishes without runaway scheduling');
 assert(visited.includes('intro'),'intro banner was shown');
 assert(visited.includes('bonus-spin'),'individual free spins were presented');
 assert(visited.includes('outro'),'end-of-feature result held on screen');
 assert.equal(root.getPracticeState().busy,false);
 assert.equal(root.getPracticeState().credits,before.credits-before.bet+root.getPracticeState().lastWin);
 assert(root.querySelector('.cc-feature-overlay').hidden);
 assert(root.querySelector('.cc-free-counter').hidden);
 assert.equal(spin.disabled,false);
 root.stopAnimation();
});
test('exit mid-feature cancels any future visual changes or duplicate awards',()=>{
 const {document,window}=parseHTML('<html><body></body></html>'),tasks=[];
 const root=createCannabisCowboyPractice(document,{
  rng:seeded(8),setTimeout:fn=>{tasks.push(fn);return tasks.length;},clearTimeout:()=>{},
  roundOptions:{baseBoard:withScatters(3),featureOptions:{boardFactory:()=>patterned()}}
 });
 root.querySelector('.cc-spin').dispatchEvent(new window.Event('click'));
 const state=root.getPracticeState();
 root.stopAnimation();
 for(const fn of tasks)fn();
 assert.equal(root.getPracticeState().credits,state.credits);
 assert(root.querySelector('.cc-feature-overlay').hidden);
});
