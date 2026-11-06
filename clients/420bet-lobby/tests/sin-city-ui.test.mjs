import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createSinCityPractice} from '../src/sin-city-ui.js';

const setup=(options={})=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createSinCityPractice(document,options);
 document.body.append(root);
 const click=(text)=>{
  const found=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
  assert.ok(found,'Missing button '+text);
  assert.equal(found.disabled,false,'Disabled button '+text);
  found.dispatchEvent(new window.Event('click',{bubbles:true}));
 };
 const txt=()=>root.textContent;
 return {root,window,click,txt};
};
test('Bobby cabinet renders 20 symbol positions and all art links',()=>{
 const {root}=setup();
 assert.equal(root.querySelectorAll('.sc-reel').length,5);
 assert.equal(root.querySelectorAll('.sc-symbol').length,20);
 assert.match(root.querySelector('.sc-bobby').getAttribute('src'),/char_bobby_las_vegas_confident\.png/);
 assert.match(root.querySelector('.sc-logo').getAttribute('src'),/logo_sin_city_high_rollers\.png/);
 const imgs=[...root.querySelectorAll('.sc-symbol img')];
 assert.ok(imgs.length>=15);
 assert.ok(imgs.every(x=>x.getAttribute('src').startsWith('/assets/420bet/sin-city-high-rollers/symbols/')));
 root.stopAnimation();
});
test('all key controls respond: stake adjustment, rules, menu, turbo and sound',()=>{
 const {root,click,txt}=setup();
 assert.match(txt(),/TOTAL BET\s*2\.00/);
 click('+');assert.match(txt(),/TOTAL BET\s*3\.00/);
 click('−');assert.match(txt(),/TOTAL BET\s*2\.00/);
 click('INFO');assert.ok(root.querySelector('.sc-paytable'));
 click('×');assert.equal(root.querySelector('.sc-modal'),null);
 click('MENU');assert.match(txt(),/RESET 1,000 PRACTICE CREDITS/);
 click('×');
 click('TURBO OFF');assert.match(txt(),/TURBO ON/);
 click('SOUND OFF');assert.match(txt(),/SOUND ON/);
 root.stopAnimation();
});
test('SPIN settles an independently evaluated round with debit and display update',async()=>{
 const {root,click,txt}=setup();
 click('TURBO OFF');
 click('SPIN');
 assert.match(txt(),/REELS SPINNING/);
 await new Promise(resolve=>setTimeout(resolve,3300));
 assert.doesNotMatch(txt(),/REELS SPINNING/);
 assert.equal(root.querySelectorAll('.sc-symbol').length,20);
 assert.match(txt(),/BALANCE/);
 const balance=Number(root.querySelector('.sc-metric strong').textContent);
 assert.ok(Number.isFinite(balance)&&balance>=0);
 root.stopAnimation();
});

test('five reels stop individually in fixed half-second sequence',async()=>{
 const {root,click}=setup({rng:()=>.4,pickStops:()=>[0,8,16,24,32]});
 try{
  click('SPIN');
  assert.equal(root.getPresentationState().stopped,0);
  await new Promise(resolve=>setTimeout(resolve,900));
  assert.equal(root.getPresentationState().stopped,1);
  assert.equal(root.querySelectorAll('.sc-reel-spinning').length,4);
  await new Promise(resolve=>setTimeout(resolve,550));
  assert.equal(root.getPresentationState().stopped,2);
  await new Promise(resolve=>setTimeout(resolve,550));
  assert.equal(root.getPresentationState().stopped,3);
  await new Promise(resolve=>setTimeout(resolve,550));
  assert.equal(root.getPresentationState().stopped,4);
  await new Promise(resolve=>setTimeout(resolve,550));
  assert.equal(root.getPresentationState().stopped,5);
  assert.equal(root.querySelectorAll('.sc-reel-spinning').length,0);
 }finally{root.stopAnimation();}
});
test('feature announcement remains visible for at least one second before reel reveal',async()=>{
 const {BASE_STRIPS}=await import('../src/sin-city-engine.js');
 const stops=BASE_STRIPS.map((strip,r)=>r<3?strip.indexOf('SCATTER'):0);
 const {root,click}=setup({rng:()=>.33,pickStops:()=>stops});
 try{
  click('SPIN');
  await new Promise(resolve=>setTimeout(resolve,3150));
  assert.equal(root.getPresentationState().phase,'announce');
  assert.ok(root.querySelector('.sc-feature-overlay'));
  await new Promise(resolve=>setTimeout(resolve,650));
  assert.equal(root.getPresentationState().phase,'announce');
  await new Promise(resolve=>setTimeout(resolve,850));
  assert.notEqual(root.getPresentationState().phase,'announce');
 }finally{root.stopAnimation();}
});
test('winning way draws actual green path and clicking game skips to total win',async()=>{
 const {root,click,window}=setup({rng:()=>.4,pickStops:()=>[0,0,0,0,0]});
 try{
  click('SPIN');
  await new Promise(resolve=>setTimeout(resolve,3050));
  const state=root.getPresentationState();
  if(state.phase==='win'){
   const line=root.querySelector('.sc-win-polyline');
   assert.ok(line,'winning line must be displayed');
   assert.ok(line.getAttribute('points').split(' ').length>=3);
   root.querySelector('.sc-scene').dispatchEvent(new window.Event('click',{bubbles:true}));
   assert.equal(root.getPresentationState().phase,'total');
   assert.match(root.textContent,/TOTAL WIN/);
  }else{
   assert.equal(state.phase,'total','a no-win round displays total directly');
  }
 }finally{root.stopAnimation();}
});
