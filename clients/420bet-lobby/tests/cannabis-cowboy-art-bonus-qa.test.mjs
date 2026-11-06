import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {COWBOY_SYMBOL_ART,COWBOY_ASSET_ROOT,COWBOY_SYMBOLS,createCannabisCowboyShell} from '../src/cannabis-cowboy-ui.js';
import {createCannabisCowboyPractice} from '../src/cannabis-cowboy-game.js';
import {createReelSequence,makeColumnReelStrip,REEL_STOP_TIMES} from '../src/cannabis-cowboy-reels.js';
import {CLUSTER_PAYS} from '../src/cannabis-cowboy-engine.js';
const css=readFileSync(new URL('../src/cannabis-cowboy.css',import.meta.url),'utf8');
const seed=(initial=123)=>{let s=initial>>>0;return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296)};
const makeHarness=()=>{
 const {document,window}=parseHTML('<html><body></body></html>'),tasks=[];
 const root=createCannabisCowboyPractice(document,{credits:1000,bet:20,rng:seed(73),reducedMotion:true,
  setTimeout:(fn,ms)=>{tasks.push({fn,ms});return tasks.length;},clearTimeout:()=>{}});
 const drain=(limit=4000)=>{let i=0;while(tasks.length&&i++<limit)tasks.shift().fn();assert(i<limit,'scheduled visual feature must terminate');};
 return {document,window,root,tasks,drain};
};
test('all 11 full transparent symbol PNGs exist on main and match the engine index',()=>{
 assert.equal(COWBOY_SYMBOL_ART.length,11);
 assert.equal(COWBOY_SYMBOLS.length,11);
 for(const filename of COWBOY_SYMBOL_ART)assert(existsSync(new URL('../public'+COWBOY_ASSET_ROOT+filename,import.meta.url)),filename);
 assert(COWBOY_SYMBOL_ART[8].includes('smoke-ring-wild'));
 assert(COWBOY_SYMBOL_ART[9].includes('tour-bus-scatter'));
 assert(COWBOY_SYMBOL_ART[10].includes('route-420-road-trip'));
 assert(existsSync(new URL('../public/assets/420bet/dads-secret-stash/spin-button-gold.svg',import.meta.url)));
});
test('every game symbol uses its separate full-size PNG rather than cropped cabinet or emoji',()=>{
 const h=makeHarness();
 const imgs=[...h.root.querySelectorAll('.cc-cell .cc-symbol-image')];
 assert.equal(imgs.length,48);
 assert(imgs.every(img=>img.getAttribute('src').startsWith(COWBOY_ASSET_ROOT)));
 assert(!imgs.some(img=>img.getAttribute('src').includes('slots-lobby')));
 assert.equal(h.root.querySelectorAll('.cc-cell .cc-cell-glyph').length,0);
 h.root.stopAnimation();
});
test('game-side paytable lists each paying symbol and all five actual pay brackets',()=>{
 const h=makeHarness();
 const table=h.root.querySelector('.cc-paytable-table');
 assert(table);
 assert.equal(table.querySelectorAll('tbody tr').length,8);
 assert.equal(table.querySelectorAll('tbody tr:first-child td').length,5);
 assert.equal(table.querySelectorAll('tbody .cc-symbol-image').length,8);
 assert.equal(CLUSTER_PAYS.length,8);
 assert.match(table.textContent,/30×/);
 assert.match(css,/cc-paytable-table/);
 assert.match(css,/spin-button-gold\.svg/);
 h.root.stopAnimation();
});
test('screen uses six composited scrolling column overlays and retains staggered stops',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const grid=document.createElement('div');grid.className='cc-symbol-grid';
 const cells=[];
 for(let i=0;i<48;i++){const el=document.createElement('div');grid.append(el);cells.push(el);}
 const tasks=[],stops=[];
 createReelSequence({doc:document,cells,board:Array(48).fill(0),schedule:(fn,ms)=>tasks.push({fn,ms}),done:times=>stops.push(times),onStop:col=>stops.push(col)});
 assert.equal(grid.querySelectorAll('.cc-column-mask').length,6);
 assert.equal(grid.querySelectorAll('.cc-column-token').length,96);
 assert.equal(grid.querySelectorAll('.cc-reel-mask').length,0);
 for(let col=0;col<6;col++){assert.equal(tasks[0].ms,col===0?700:col===1?500:750);tasks.shift().fn();}
 assert.equal(grid.querySelectorAll('.cc-column-mask').length,0);
 assert.deepEqual(stops.at(-1),[...REEL_STOP_TIMES]);
 assert.match(css,/cc-column-flow/);
 assert.equal(makeColumnReelStrip(document).querySelectorAll('img').length,16);
});
test('free-spin tester plays an actual feature without modifying credits or paid spin count',()=>{
 const h=makeHarness(),before=h.root.getPracticeState();
 const select=h.root.querySelector('.cc-bonus-select');
 select.querySelector('option[value="free"]').setAttribute('selected','selected');
 h.root.querySelector('.cc-bonus-preview-button').dispatchEvent(new h.window.Event('click'));
 assert.equal(h.root.getPracticeState().credits,before.credits);
 assert.equal(h.root.getPracticeState().round,before.round);
 h.drain();
 assert.equal(h.root.getPracticeState().credits,before.credits);
 assert.equal(h.root.getPracticeState().round,before.round);
 assert.equal(h.root.getPracticeState().busy,false,'feature preview must release spin controls');
 h.root.stopAnimation();
});
test('five-stop Road Trip tester reveals selectable cases but never credits the balance',()=>{
 const h=makeHarness(),before=h.root.getPracticeState();
 const select=h.root.querySelector('.cc-bonus-select');select.querySelector('option[value="road"]').setAttribute('selected','selected');
 h.root.querySelector('.cc-bonus-preview-button').dispatchEvent(new h.window.Event('click'));
 h.drain();
 assert.equal(h.root.getPracticeState().roadActive,true);
 for(let i=0;i<5;i++){
  const cases=h.root.querySelectorAll('.cc-road-case');assert.equal(cases.length,3);
  cases[0].dispatchEvent(new h.window.Event('click'));
  h.root.querySelector('.cc-road-next').dispatchEvent(new h.window.Event('click'));
  h.drain();
 }
 assert.equal(h.root.getPracticeState().round,before.round);
 assert.equal(h.root.getPracticeState().credits,before.credits);
 assert.equal(h.root.getPracticeState().busy,false);
 h.root.stopAnimation();
});
