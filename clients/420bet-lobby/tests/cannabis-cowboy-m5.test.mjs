import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {
 CELL_COUNT,COLUMNS,WILD_SYMBOL,SCATTER_SYMBOL,MAX_FREE_SPINS,SCATTER_CHANCE,
 FREE_SPIN_AWARDS,makeScatterBoard,countScatters,awardedFreeSpins,
 resolveRound,resolveEndlessHarvest,dropAndRefill,playPracticeRound,createPracticeSession,findClusters,
 SYMBOL_WEIGHTS,HARVEST_SYMBOL_WEIGHTS,weightedSymbol
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
test('free spins preserve multiplier frames but never preserve wild symbols across rounds',()=>{
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
 assert.deepEqual(result.spins[0].outcome.lockedWilds,[],'wild is not pinned');
 assert.deepEqual(result.spins[1].stickyBefore,[],'no wild persists into next spin');
 assert.equal(result.spins[1].outcome.startingBoard[0],plain[0],'next spin uses its own natural symbol');
 assert.deepEqual(result.spins[1].initialFertile,result.spins[0].outcome.fertile);
 assert.equal(result.spins.reduce((sum,s)=>sum+s.outcome.total,0),result.total);
 assert(result.spins.every(s=>s.outcome.lockedWilds.length===0&&s.stickyBefore.length===0));
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
 while(count++<3000){
  if(root.getPracticeState().freeSpinReady){
   root.querySelector('.cc-free-spin-button').dispatchEvent(new window.Event('click'));
  }
  if(root.getPracticeState().bonusSplashVisible){
   assert.match(root.querySelector('.cc-bonus-total-splash').textContent,/CREDITS/);
   root.querySelector('.cc-bonus-total-splash').dispatchEvent(new window.Event('click'));
  }
  if(!tasks.length&&root.getPracticeState().busy)continue;
  if(!tasks.length)break;
  tasks.shift()();visited.push(root.dataset.featurePhase);
 }
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


test('Endless Harvest adds one per repeatedly hit frame with a 10x cap',()=>{
 const b=patterned();
 for(const p of [0,1,6,7,12])b[p]=0;
 const result=resolveRound(b,20,seeded(73),{bonusMode:true,initialFertile:Array(CELL_COUNT).fill(9)});
 assert(result.steps.length>0);
 assert(result.fertile.every(x=>x>=9&&x<=10));
 assert(result.steps.every(step=>step.clusters.every(cluster=>cluster.harvestMultiplier<=10)));
 const once=resolveRound(b,20,seeded(73),{bonusMode:true});
 assert(once.steps.length>0);
 assert(once.steps[0].fertile.some(x=>x===1));
});
test('free spins require player input and stay on coin-total splash until dismissed',()=>{
 const {document,window}=parseHTML('<html><body></body></html>'),tasks=[];
 const root=createCannabisCowboyPractice(document,{
  rng:seeded(22),credits:500,bet:20,reducedMotion:true,
  setTimeout:fn=>{tasks.push(fn);return tasks.length;},clearTimeout:()=>{},
  roundOptions:{baseBoard:withScatters(3),featureOptions:{boardFactory:()=>patterned()}}
 });
 root.querySelector('.cc-spin').dispatchEvent(new window.Event('click'));
 const drain=()=>{let n=0;while(tasks.length&&n++<5000)tasks.shift()();assert(n<5000);};
 drain();
 assert(root.getPracticeState().freeSpinReady);
 assert.equal(root.getPracticeState().bonusIndex,0);
 assert(root.querySelector('.cc-free-spin-button').hidden===false);
 assert.match(root.querySelector('.cc-free-spin-button').textContent,/FREE SPIN 1 OF 8/);
 assert.match(root.querySelector('.cc-free-spin-button').textContent,/LAST SPIN: 0 CREDITS/);
 for(let i=0;i<8;i++){
  const beforeSpin=root.getPracticeState();
  const button=root.querySelector('.cc-free-spin-button');
  assert.match(button.textContent,new RegExp('FREE SPIN '+(i+1)+' OF 8'));
  if(i>0)assert.match(button.textContent,new RegExp('LAST SPIN: '+beforeSpin.lastFreeSpinWin.toLocaleString('en-US')+' CREDITS'));
  button.dispatchEvent(new window.Event('click'));
  drain();
 }
 assert(root.getPracticeState().bonusSplashVisible);
 assert.equal(root.getPracticeState().busy,true);
 const splash=root.querySelector('.cc-bonus-total-splash');
 assert.equal(splash.dataset.bonus,'harvest');
 assert.match(splash.textContent,/ENDLESS HARVEST COMPLETE/);
 assert.match(splash.textContent,/TOTAL BONUS WIN/);
 assert.match(splash.textContent,/CREDITS/);
 assert.match(splash.textContent,/CLICK ANYWHERE TO CONTINUE/);
 assert.match(splash.querySelector('.cc-bonus-cowboy').getAttribute('src'),/cannabis-cowboy-cole-haze\.png$/);
 assert.equal(splash.querySelector('.cc-bonus-total-amount').textContent,
  root.getPracticeState().bonusWin.toLocaleString('en-US')+' CREDITS');
 root.querySelector('.cc-bonus-total-splash').dispatchEvent(new window.Event('click'));
 assert.equal(root.getPracticeState().bonusSplashVisible,false);
 assert.equal(root.getPracticeState().busy,false);
 root.stopAnimation();
});

test('Endless Harvest does not retain or pin any wilds, including newly landed wilds',()=>{
 const first=patterned();first[0]=WILD_SYMBOL;
 for(const p of [1,6,7,12])first[p]=0;
 const second=patterned();
 const f=resolveEndlessHarvest(8,20,seeded(19),{boardFactory:n=>n===1?first:second});
 assert(f.spins.every(spin=>spin.stickyBefore.length===0&&spin.outcome.lockedWilds.length===0));
 assert.equal(f.spins[1].outcome.startingBoard[0],second[0]);
 assert.equal(f.stickyWilds.length,0);
 assert(f.spins[0].outcome.steps[0].removed.includes(0),'winning wild is cleared like any other symbol');
});

test('Endless Harvest doubles only wild weighting on initial reels and cascade refills',()=>{
 assert.equal(HARVEST_SYMBOL_WEIGHTS[WILD_SYMBOL],2*SYMBOL_WEIGHTS[WILD_SYMBOL]);
 assert.deepEqual(HARVEST_SYMBOL_WEIGHTS.slice(0,WILD_SYMBOL),SYMBOL_WEIGHTS.slice(0,WILD_SYMBOL));
 const baseTotal=SYMBOL_WEIGHTS.reduce((n,x)=>n+x,0);
 const bonusTotal=HARVEST_SYMBOL_WEIGHTS.reduce((n,x)=>n+x,0);
 const baseWildRate=SYMBOL_WEIGHTS[WILD_SYMBOL]/baseTotal;
 const harvestWildRate=HARVEST_SYMBOL_WEIGHTS[WILD_SYMBOL]/bonusTotal;
 assert(harvestWildRate>baseWildRate*1.9 && harvestWildRate<baseWildRate*2.05);
 const threshold=1-3/bonusTotal;
 assert.equal(weightedSymbol(()=>threshold,false),7,'base symbols not reweighted');
 assert.equal(weightedSymbol(()=>threshold,true),WILD_SYMBOL,'bonus uses enlarged wild band');
 const baseBoard=makeScatterBoard(()=>threshold,false);
 const bonusBoard=makeScatterBoard(()=>threshold,true);
 assert.equal(baseBoard.filter(x=>x===WILD_SYMBOL).length,0);
 assert.equal(bonusBoard.filter(x=>x===WILD_SYMBOL).length,CELL_COUNT);
 const board=patterned();for(const p of [0,1,6,7,12])board[p]=0;
 const feature=resolveRound(board,20,()=>threshold,{bonusMode:true});
 assert(feature.steps[0].refills.length>0);
 assert(feature.steps[0].refills.every(pos=>feature.steps[0].after[pos]===WILD_SYMBOL),'bonus refills use feature wild weights');
});


test('Endless Harvest spin control uses approved illustrated PNG and opaque live counters',()=>{
 const css=readFileSync(new URL('../src/cannabis-cowboy.css',import.meta.url),'utf8');
 const path='/assets/420bet/cannabis-cowboy/cannabis-cowboy-endless-harvest-spin-button.png';
 const asset=readFileSync(new URL('../public'+path,import.meta.url));
 assert.equal(asset.subarray(0,8).toString('hex'),'89504e470d0a1a0a','approved button is a valid PNG');
 const live=css.slice(css.lastIndexOf('/* Endless Harvest approved illustrated spin button'));
 assert.match(live,/cannabis-cowboy-endless-harvest-spin-button\.png/);
 assert.match(live,/\.cc-free-spin-progress\{[\s\S]*?background:linear-gradient\(180deg,#512809,#311909\)/);
 assert.match(live,/\.cc-free-spin-last\{[\s\S]*?background:linear-gradient\(180deg,#542a11,#2f170b\)/);
 assert.match(live,/\.cc-free-spin-action\{[\s\S]*?opacity:0/);
 assert.match(live,/aspect-ratio:3 \/ 2/);
});
