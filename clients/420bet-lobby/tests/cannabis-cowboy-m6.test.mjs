import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {createReelSequence,REEL_STOP_DELAYS,REEL_STOP_TIMES,drawClusterPaths,clearClusterPaths} from '../src/cannabis-cowboy-reels.js';
import {createRoadTrip,chooseRoadCase,ROAD_STOPS,roadStopBackground,roadCaseArtwork} from '../src/cannabis-cowboy-road-trip.js';
import {createCannabisCowboyPractice} from '../src/cannabis-cowboy-game.js';
import {CELL_COUNT,COLUMNS,ROAD_SYMBOL,SCATTER_SYMBOL,countRoadTickets,playPracticeRound,createPracticeSession} from '../src/cannabis-cowboy-engine.js';
const seed=(initial=123456)=>{let state=initial>>>0;return ()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296)};
const pattern=()=>Array.from({length:CELL_COUNT},(_,i)=>(Math.floor(i/COLUMNS)*3+i%COLUMNS)%8);
const ticketBoard=()=>{const a=pattern();for(const p of [0,1,2])a[p]=ROAD_SYMBOL;return a;};
const winBoard=()=>{const a=pattern();for(const p of [0,1,6,7,12])a[p]=0;return a;};
function harness(options={}){
 const {document,window}=parseHTML('<html><body></body></html>'),tasks=[];
 const root=createCannabisCowboyPractice(document,{rng:seed(93),credits:1000,bet:20,reducedMotion:true,
  setTimeout:(fn,ms)=>{tasks.push({fn,ms});return tasks.length;},clearTimeout:()=>{},...options});
 const drain=(limit=6000)=>{let n=0;while(tasks.length&&n++<limit)tasks.shift().fn();assert(n<limit,'timers must finish without loops');};
 return {document,window,root,tasks,drain};
}
test('reel stop schedule: first at 700ms; second 500ms later; reels three to six 750ms apart',()=>{
 assert.deepEqual([...REEL_STOP_DELAYS],[700,500,750,750,750,750]);
 assert.deepEqual([...REEL_STOP_TIMES],[700,1200,1950,2700,3450,4200]);
 const {document}=parseHTML('<html><body></body></html>');
 const cells=Array.from({length:48},()=>document.createElement('div')),tasks=[],events=[];
 createReelSequence({doc:document,cells,board:pattern(),schedule:(fn,ms)=>tasks.push({fn,ms}),onStop:(c,t)=>events.push([c,t]),done:times=>events.push(times)});
 assert.equal(tasks[0].ms,700);
 for(let c=0;c<6;c++){
  assert.equal(tasks[0].ms,REEL_STOP_DELAYS[c]);
  tasks.shift().fn();
 }
 assert.deepEqual(events.slice(0,6),REEL_STOP_TIMES.map((t,c)=>[c,t]));
});
test('staggered reels reveal each entire column in the intended order, without disturbing locked wilds',()=>{
 const {document}=parseHTML('<html><body></body></html>'),cells=Array.from({length:48},()=>document.createElement('div')),tasks=[],stops=[];
 const pinned=[0,6,12,18,24,30,36,42];
 cells.forEach(c=>document.body.append(c));
 createReelSequence({doc:document,cells,board:pattern(),locked:pinned,schedule:(fn,ms)=>tasks.push({fn,ms}),onStop:(c,t)=>stops.push([c,t]),done:times=>stops.push(['done',times])});
 assert.equal(cells[0].querySelector('.cc-reel-mask'),null);
 assert(cells[1].querySelector('.cc-reel-mask'));
 for(let col=0;col<6;col++){
  assert.equal(tasks.length,1);
  assert.equal(tasks[0].ms,REEL_STOP_DELAYS[col]);
  tasks.shift().fn();
  for(let r=0;r<8;r++)assert.equal(cells[r*6+col].querySelector('.cc-reel-mask'),null);
  if(col<5)assert(cells[col+1].querySelector('.cc-reel-mask'));
 }
 assert.deepEqual(stops.slice(0,6),REEL_STOP_TIMES.map((t,c)=>[c,t]));
 assert.deepEqual(stops[6],['done',[...REEL_STOP_TIMES]]);
});
test('neon cluster connectors follow orthogonal neighbors, not arbitrary diagonal paylines',()=>{
 const {document}=parseHTML('<html><body></body></html>'),grid=document.createElement('div');
 document.body.append(grid);
 const count=drawClusterPaths(document,grid,[{positions:[0,1,6,7,12]}]);
 assert.equal(count,4);
 assert.equal(grid.querySelectorAll('.cc-win-path').length,4);
 assert(grid.querySelectorAll('.cc-path-horizontal').length>0);
 assert(grid.querySelectorAll('.cc-path-vertical').length>0);
 clearClusterPaths(grid);assert.equal(grid.querySelectorAll('.cc-win-path').length,0);
});
test('M6 Road Trip is 5 stops with precommitted case values and one pick per stop',()=>{
 const trip=createRoadTrip(20,seed(12));
 assert.deepEqual(trip.stops.map(s=>s.name),ROAD_STOPS.map(s=>s.name));
 assert.equal(trip.stops.length,5);
 assert(trip.stops.every(s=>s.caseValues.length===3));
 let picks=[],total=0;
 for(let i=0;i<5;i++){
  const result=chooseRoadCase(trip,picks,i%3);
  picks=result.picks;total=result.total;
  assert.equal(result.done,i===4);
  assert.equal(picks[i].award,trip.stops[i].caseValues[i%3]);
 }
 assert.equal(total,picks.reduce((n,p)=>n+p.award,0));
 assert.throws(()=>chooseRoadCase(trip,picks,0),/Invalid Road Trip progress/);
 assert.throws(()=>chooseRoadCase(trip,[],3),/Invalid case choice/);
 assert.deepEqual(createRoadTrip(20,seed(12)),trip,'case values predetermined by RNG');
});
test('three Road Trip tickets trigger independent feature; credits not paid before player picks',()=>{
 const state=createPracticeSession({credits:500,bet:20,rng:seed(8)});
 const outcome=playPracticeRound(state,seed(13),{baseBoard:ticketBoard()});
 assert.equal(countRoadTickets(ticketBoard()),3);
 assert.equal(outcome.outcome.roadTicketCount,3);
 assert.equal(outcome.outcome.roadTripTriggered,true);
 assert.equal(outcome.state.credits,500-20+outcome.outcome.total);
 assert.equal(outcome.state.round,1);
});
test('clicking screen dismisses neon payline and reveals total, no second wager or payout',()=>{
 const h=harness({roundOptions:{baseBoard:winBoard()}});
 const spin=h.root.querySelector('.cc-spin');
 spin.dispatchEvent(new h.window.Event('click'));
 assert.equal(h.root.getPracticeState().round,1);
 h.drain();
 assert.equal(h.root.dataset.featurePhase,'win-review');
 assert.equal(spin.disabled,true);
 assert(h.root.querySelectorAll('.cc-win-path').length>0);
 const before=h.root.getPracticeState();
 h.root.querySelector('.cc-symbol-grid').dispatchEvent(new h.window.Event('click',{bubbles:true}));
 assert.equal(h.root.querySelectorAll('.cc-win-path').length,0);
 assert.equal(h.root.dataset.featurePhase,'none');
 assert.equal(h.root.getPracticeState().busy,false);
 assert.equal(h.root.getPracticeState().credits,before.credits);
 assert.equal(h.root.getPracticeState().round,1);
 h.root.stopAnimation();
});
test('interactive Road Trip reveals five guitar case choices, cannot double-pick or double-credit',()=>{
 const h=harness({roundOptions:{baseBoard:ticketBoard()}});
 const before=h.root.getPracticeState();
 h.root.querySelector('.cc-spin').dispatchEvent(new h.window.Event('click'));
 h.drain();
 assert.equal(h.root.getPracticeState().roadActive,true);
 assert.equal(h.root.querySelector('.cc-road-panel').hidden,false);
 for(let i=0;i<5;i++){
  const choices=[...h.root.querySelectorAll('.cc-road-case')];
  assert.equal(choices.length,3);
  choices[0].dispatchEvent(new h.window.Event('click'));
  choices[0].dispatchEvent(new h.window.Event('click'));
  assert.equal(h.root.getPracticeState().roadStopsCompleted,i+1);
  const next=h.root.querySelector('.cc-road-next');
  assert(next);
  next.dispatchEvent(new h.window.Event('click'));
  if(i===4)h.drain();
 }
 const final=h.root.getPracticeState();
 assert.equal(final.roadStopsCompleted,5);
 assert.equal(final.round,1);
 assert.equal(final.busy,false);
 assert.equal(final.credits,final.lastWin+before.credits-before.bet);
 assert.equal(h.root.querySelector('.cc-road-panel').hidden,true);
 h.root.stopAnimation();
});
test('base and free-spin screens both invoke staggered reel stops',()=>{
 const b=pattern();for(let p=0;p<3;p++)b[p]=SCATTER_SYMBOL;
 const h=harness({roundOptions:{baseBoard:b,featureOptions:{boardFactory:()=>pattern()}}});
 h.root.querySelector('.cc-spin').dispatchEvent(new h.window.Event('click'));
 const phases=[];
 let guard=0;
 while(h.tasks.length&&guard++<8000){
  if(h.root.querySelectorAll('.cc-reel-rolling').length>0)phases.push(h.root.dataset.featurePhase);
  h.tasks.shift().fn();
 }
 assert(guard<8000);
 assert(phases.includes('base'),'base reels animated');
 assert(phases.includes('bonus-spin'),'free-spin reels animated');
 h.root.stopAnimation();
});

test('Road Trip provides five unique backgrounds and three unique image assets per stop',()=>{
 const scenes=ROAD_STOPS.map((stop,i)=>roadStopBackground(i));
 assert.equal(new Set(scenes).size,5);
 assert(scenes.every(path=>path.startsWith('/assets/420bet/cannabis-cowboy/on-the-road-again/')));
 for(let i=0;i<5;i++){
  const cases=[0,1,2].map(j=>roadCaseArtwork(i,j));
  assert.equal(new Set(cases).size,3);
  assert(cases.every(path=>path.endsWith('.png')));
 }
 const h=harness({roundOptions:{baseBoard:ticketBoard()}});
 h.root.querySelector('.cc-spin').dispatchEvent(new h.window.Event('click'));
 h.drain();
 assert.equal(h.root.querySelector('.cc-road-scene').getAttribute('src'),scenes[0]);
 assert.equal(h.root.querySelectorAll('.cc-road-case-art').length,3);
 assert.deepEqual([...h.root.querySelectorAll('.cc-road-case-art')].map(x=>x.getAttribute('src')),
  [0,1,2].map(j=>roadCaseArtwork(0,j)));
 h.root.stopAnimation();
});
test('Endless Harvest keeps multiplier labels in an independent overlay above reel masks',()=>{
 const game=readFileSync(new URL('../src/cannabis-cowboy-game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/cannabis-cowboy.css',import.meta.url),'utf8');
 assert.match(game,/multiplierLayer\.className='cc-multiplier-layer'/);
 assert.match(game,/showMultiplierFrames\(fertile\)/);
 assert.match(css,/\.cc-symbol-grid > \.cc-multiplier-layer\{[\s\S]*?z-index:22/);
 assert.match(css,/\.cc-column-mask\{[\s\S]*?z-index:9/);
 assert.match(game,/const previewRun=trial\?\+\+previewRuns:0/);
 assert.match(game,/weightedSymbol\(testRng\)/);
});


test('all five Road Trip scenes and fifteen guitar-case PNGs are committed and loadable',()=>{
 const paths=ROAD_STOPS.flatMap((_,index)=>[
  roadStopBackground(index),
  ...[0,1,2].map(caseIndex=>roadCaseArtwork(index,caseIndex))
 ]);
 assert.equal(paths.length,20);
 assert.equal(new Set(paths).size,20);
 for(const asset of paths){
  const bytes=readFileSync(new URL('../public'+asset,import.meta.url));
  assert(bytes.length>1000,'missing or truncated asset '+asset);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','not a PNG '+asset);
 }
});
