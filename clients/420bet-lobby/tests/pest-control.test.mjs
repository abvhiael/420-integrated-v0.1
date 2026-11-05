import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {PC_RULES,createPestControl,pestAction,survivalProbability,payoutMultiplier,nextPickProbability,shuffledHazards} from '../src/pest-control-engine.js';
import {createPestControlTable} from '../src/pest-control-ui.js';
import {readFileSync} from 'node:fs';
const rng=()=>0;
test('Pest Control board and 96% combinatorial RTP at every legal cashout depth',()=>{
 assert.equal(PC_RULES.tiles,25);assert.equal(PC_RULES.rtp,.96);
 for(let h=1;h<=24;h++)for(let k=1;k<=25-h;k++){
  const p=survivalProbability(h,k),m=payoutMultiplier(h,k);
  assert(Math.abs(p*m-.96)<1e-10);
  assert(p>0&&p<=1&&m>=.96);
 }
 assert.equal(payoutMultiplier(5,1),1.2);
 assert.equal(payoutMultiplier(24,1),24);
 assert.equal(nextPickProbability(5,4),16/21);
 assert.equal(nextPickProbability(24,1),null);
});
test('Exactly requested hazard counts: unique, in range; invalid requests rejected',()=>{
 for(let h=1;h<=24;h++){const set=shuffledHazards(h,rng);assert.equal(set.size,h);assert([...set].every(n=>n>=0&&n<25));}
 assert.throws(()=>shuffledHazards(0,rng),RangeError);
 assert.throws(()=>shuffledHazards(25,rng),RangeError);
});
test('Bet, hazards and refund locked after first reveal; losing tile loses full stake',()=>{
 const g=createPestControl({rng,balance:100});
 assert(pestAction(g,'bet',10));assert(pestAction(g,'hazards',5));
 assert(pestAction(g,'start'));assert.equal(g.balance,90);
 assert.equal(pestAction(g,'bet',100),false);
 assert.equal(pestAction(g,'hazards',24),false);
 const losing=[...g.hazardTiles][0];
 assert(pestAction(g,'pick',losing));
 assert.equal(g.result,'infested');assert.equal(g.return,0);assert.equal(g.balance,90);
 assert.equal(pestAction(g,'harvest'),false);
 assert.equal(pestAction(g,'pick',losing),false);
});
test('Successful harvest returns wager plus winnings exactly once; new round possible',()=>{
 const g=createPestControl({rng,balance:100});
 pestAction(g,'start');const safe=Array.from({length:25},(_,i)=>i).find(i=>!g.hazardTiles.has(i));
 assert(pestAction(g,'pick',safe));assert.equal(g.picks.length,1);
 assert.equal(pestAction(g,'pick',safe),false);
 assert(pestAction(g,'harvest'));assert.equal(g.return,12);assert.equal(g.balance,102);
 assert.equal(pestAction(g,'harvest'),false);assert.equal(g.balance,102);
 assert(pestAction(g,'start'));assert.equal(g.round,2);
});
test('Zero-pick cancellation refunds original bet; cancellation unavailable after a pick',()=>{
 const g=createPestControl({rng,balance:100});
 pestAction(g,'start');assert(pestAction(g,'cancel'));assert.equal(g.balance,100);
 assert.equal(g.result,'cancelled');assert.equal(pestAction(g,'cancel'),false);
 pestAction(g,'start');const safe=Array.from({length:25},(_,i)=>i).find(i=>!g.hazardTiles.has(i));
 pestAction(g,'pick',safe);assert.equal(pestAction(g,'cancel'),false);
});
test('Single safe tile auto-harvests at 24 hazards and pays exact 24x',()=>{
 const g=createPestControl({rng,balance:100});
 pestAction(g,'bet',1);pestAction(g,'hazards',24);pestAction(g,'start');
 const safe=Array.from({length:25},(_,i)=>i).find(i=>!g.hazardTiles.has(i));
 assert(pestAction(g,'pick',safe));assert.equal(g.phase,'finished');assert.equal(g.result,'harvest');
 assert.equal(g.return,24);assert.equal(g.balance,123);
});
test('UI displays full 25-tile playfield, practice controls and authored art',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createPestControlTable(document,{rng,balance:100});
 document.body.append(root);
 assert.equal(root.dataset.practiceGame,'pest-control');
 assert.equal(root.querySelectorAll('.pc-tile').length,25);
 assert.match(root.textContent,/PEST CONTROL/);
 assert.match(root.textContent,/PRACTICE ONLY/);
 assert(root.querySelector('.pc-mascot-art').src.includes('buddy-bloom.svg'));
 assert(root.querySelector('.pc-primary'));
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert(main.includes("active.id==='mines'?createPestControlTable(document)"));
 const css=readFileSync(new URL('../src/pest-control.css',import.meta.url),'utf8');
 assert(css.includes('grid-template-columns:repeat(5'));
 root.querySelector('.pc-primary').click();
 assert.equal(root.gameState.phase,'active');
 assert.equal(root.querySelectorAll('.pc-tile:disabled').length,0);
 const safe=Array.from({length:25},(_,i)=>i).find(i=>!root.gameState.hazardTiles.has(i));
 root.querySelector('[data-tile="'+safe+'"]').click();
 assert.equal(root.gameState.picks.length,1);
 assert(root.querySelector('.pc-harvest'));
 root.querySelector('.pc-harvest').click();
 assert.equal(root.gameState.result,'harvest');
 root.stopAnimation();
});

test('Auto pick chooses one unopened tray without leaking hazard contents',()=>{
 const g=createPestControl({rng,balance:100});
 pestAction(g,'start');
 assert(pestAction(g,'auto-pick'));
 assert.equal(g.picks.length,1);
 assert.equal(new Set(g.picks).size,1);
 assert.equal(pestAction(g,'auto-pick'),g.phase==='active');
});
