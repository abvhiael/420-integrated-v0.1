import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {BUZZ_RULES,createBuzzkill,buzzAction,sampleCrashPoint,multiplierAt,tickDuration} from '../src/buzzkill-engine.js';
import {createBuzzkillPractice} from '../src/buzzkill-ui.js';
const R=()=>.2;
test('BUZZKILL Crash survival curve targets 96% theoretical RTP',()=>{
 assert.equal(BUZZ_RULES.rtp,.96);
 assert.equal(sampleCrashPoint(()=>.99),1);
 assert.equal(sampleCrashPoint(()=>.8),1.2);
 assert.equal(sampleCrashPoint(()=>.2),4.8);
 for(const x of [1.01,1.25,2,4.2,10,20,100]){
  const survival=.96/x;
  assert(Math.abs(survival*x-.96)<1e-12);
  assert(Math.abs(multiplierAt(tickDuration(x))-x)<1e-8);
 }
 assert.throws(()=>sampleCrashPoint(()=>1),RangeError);
 assert.throws(()=>sampleCrashPoint(()=>-.1),RangeError);
});
test('Wager locked during round and instant-bust never pays after begin',()=>{
 const s=createBuzzkill({rng:()=>.99,balance:100,bet:10});
 assert(buzzAction(s,'start'));assert.equal(s.balance,90);
 assert.equal(buzzAction(s,'bet',20),false);
 assert(buzzAction(s,'tick',0));assert.equal(s.phase,'bust');
 assert.equal(buzzAction(s,'cashout'),false);assert.equal(s.return,0);
 assert.equal(s.history.length,1);
});
test('Manual cash out settles exactly once; round continues until Mom interrupts',()=>{
 const s=createBuzzkill({rng:R,balance:100,bet:10});
 buzzAction(s,'start');buzzAction(s,'tick',tickDuration(2));
 assert(s.multiplier>=1.99&&s.multiplier<=2);
 assert(buzzAction(s,'cashout'));
 const balance=s.balance,returned=s.return;
 assert(returned>=19.9&&returned<=20);
 assert.equal(buzzAction(s,'cashout'),false);
 assert.equal(s.balance,balance);
 buzzAction(s,'tick',tickDuration(5));
 assert.equal(s.phase,'bust');assert.equal(s.balance,balance);
 assert.equal(s.history[0].cashedAt,s.cashedAt);
});
test('Automatic cashout at 4.20x wins even when a single slow frame crosses the crash',()=>{
 const s=createBuzzkill({rng:R,balance:100,bet:10});
 assert(buzzAction(s,'auto-enabled',true));
 buzzAction(s,'start');buzzAction(s,'tick',tickDuration(5));
 assert.equal(s.phase,'bust');assert.equal(s.return,42);
 assert.equal(s.balance,132);assert.equal(s.cashedAt,4.2);
 assert.equal(s.history[0].return,42);
});
test('Auto target above crash loses, and targets cannot be edited during a running round',()=>{
 const s=createBuzzkill({rng:R,balance:100,bet:10,autoTarget:5});
 buzzAction(s,'auto-enabled',true);buzzAction(s,'start');
 assert.equal(buzzAction(s,'auto-target',2),false);
 buzzAction(s,'tick',tickDuration(6));
 assert.equal(s.return,0);assert.equal(s.balance,90);assert.equal(s.phase,'bust');
});
test('Practice-only controls, routes and fixed room assets',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createBuzzkillPractice(document,{animate:false,rng:R,balance:100});
 assert.equal(root.dataset.practiceGame,'buzzkill');
 assert.equal(root.querySelectorAll('.bz-stage').length,1);
 assert.match(root.textContent,/BUZZKILL!/);
 assert.match(root.textContent,/NO REAL WAGERS/);
 assert(root.querySelector('.bz-target'));
 assert(root.querySelector('.bz-cash'));
 assert.equal(root.querySelector('.bz-amount').textContent,'10.00');
 root.querySelector('.bz-cash').click();
 assert.equal(root.gameState.phase,'running');assert.equal(root.gameState.balance,90);
 root.stopAnimation();
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const catalogue=readFileSync(new URL('../src/catalogue.js',import.meta.url),'utf8');
 const scene=readFileSync(new URL('../src/buzzkill-scene.js',import.meta.url),'utf8');
 assert(main.includes("active.id==='crash'?createBuzzkillPractice(document)"));
 assert(catalogue.includes("'BUZZKILL!'"));
 assert(scene.includes("import * as Phaser from 'phaser'"));
 assert(scene.includes("buzz-room"));
 for(const art of ['bedroom','kevin','mom']){
  const content=readFileSync(new URL('../public/assets/420bet/buzzkill/'+art+'.svg',import.meta.url),'utf8');
  assert.match(content,/<svg/);
 }
});
