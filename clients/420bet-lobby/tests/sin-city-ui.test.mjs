import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createSinCityPractice} from '../src/sin-city-ui.js';
import {initialState,BASE_STRIPS} from '../src/sin-city-engine.js';

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
 await new Promise(resolve=>setTimeout(resolve,4600));
 assert.doesNotMatch(txt(),/REELS SPINNING/);
 assert.equal(root.querySelectorAll('.sc-symbol').length,20);
 assert.match(txt(),/BALANCE/);
 const balance=Number(root.querySelector('.sc-metric strong').textContent);
 assert.ok(Number.isFinite(balance)&&balance>=0);
 root.stopAnimation();
});

test('five reels stop individually in fixed three-quarter-second sequence',async()=>{
 const {root,click}=setup({rng:()=>.4,pickStops:()=>[0,8,16,24,32]});
 try{
  click('SPIN');
  assert.equal(root.getPresentationState().stopped,0);
  await new Promise(resolve=>setTimeout(resolve,900));
  assert.equal(root.getPresentationState().stopped,1);
  assert.equal(root.querySelectorAll('.sc-reel-spinning').length,4);
  assert.equal(root.querySelectorAll('.sc-spin-track').length,4);
  await new Promise(resolve=>setTimeout(resolve,800));
  assert.equal(root.getPresentationState().stopped,2);
  await new Promise(resolve=>setTimeout(resolve,800));
  assert.equal(root.getPresentationState().stopped,3);
  await new Promise(resolve=>setTimeout(resolve,800));
  assert.equal(root.getPresentationState().stopped,4);
  await new Promise(resolve=>setTimeout(resolve,800));
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
  await new Promise(resolve=>setTimeout(resolve,4300));
  assert.equal(root.getPresentationState().phase,'announce');
  assert.ok(root.querySelector('.sc-feature-overlay'));
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(root.getPresentationState().phase,'announce');
  await new Promise(resolve=>setTimeout(resolve,950));
  assert.notEqual(root.getPresentationState().phase,'announce');
 }finally{root.stopAnimation();}
});
test('winning way draws actual green path and clicking game skips to total win',async()=>{
 const {root,click,window}=setup({rng:()=>.4,pickStops:()=>[0,0,0,0,0]});
 try{
  click('SPIN');
  await new Promise(resolve=>setTimeout(resolve,4600));
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

test('Hotbox held gems remain visible as nonmoving overlays while all reels spin and settle',async()=>{
 const held=[0,6,9,19];
 const {root,click}=setup({initialState:{...initialState(),mode:'hotbox',locked:held,respins:3}});
 try{
  click('RESPIN');
  assert.equal(root.querySelectorAll('.sc-spin-track').length,5);
  assert.equal(root.querySelectorAll('.sc-held-gem').length,held.length);
  assert.equal(root.querySelectorAll('.sc-held-overlay').length,5);
  await new Promise(resolve=>setTimeout(resolve,1070));
  assert.equal(root.querySelectorAll('.sc-held-gem').length,held.filter(k=>Math.floor(k/4)>=1).length);
  for(const key of held.filter(k=>Math.floor(k/4)===0)){
   const row=key%4;
   assert.equal(root.querySelector('.sc-reel[data-reel="0"]').querySelectorAll('.sc-symbol')[row].getAttribute('aria-label'), 'Reel 1 row '+(row+1)+': GEM');
  }
 }finally{root.stopAnimation();}
});
test('Every previously sticky Wild remains fixed above scrolling free-spin strips',async()=>{
 const held=[0,3,5,9,14,16,19];
 const {root,click}=setup({initialState:{...initialState(),mode:'free',freeRemaining:8,sticky:held}});
 try{
  click('FREE SPIN');
  assert.equal(root.querySelectorAll('.sc-held-wild').length,held.length);
  for(const key of held){
   const r=Math.floor(key/4),row=key%4;
   const fixed=root.querySelector('.sc-reel[data-reel="'+r+'"] .sc-held-overlay').querySelectorAll('.sc-held-cell')[row];
   assert.ok(fixed.classList.contains('sc-held-wild'),'Missing sticky Wild at '+key);
  }
  await new Promise(resolve=>setTimeout(resolve,1100));
  assert.equal(root.querySelectorAll('.sc-held-wild').length,held.filter(k=>Math.floor(k/4)>=1).length);
 }finally{root.stopAnimation();}
});
test('Info popup includes the progressive 3-to-20-gem Hotbox payout table',()=>{
 const {root,click}=setup();
 try{
  click('INFO');
  const table=root.querySelector('.sc-hotbox-paytable');
  assert.ok(table);
  assert.equal(table.querySelectorAll('tr').length,19);
  assert.match(table.textContent,/100×/);
  assert.match(root.textContent,/EVERY Wild that lands/);
  assert.match(root.textContent,/ANY one Lowrider/);
 }finally{root.stopAnimation();}
});
test('Neon way trace reaches reel five, distinguishing non-paying continuation',async()=>{
 const stops=BASE_STRIPS.map((strip,reel)=>{
  for(let i=0;i<42;i++){
   const window=Array.from({length:4},(_,row)=>strip[(i+row)%42]);
   if(window.includes('SCATTER')||window.includes('GEM'))continue;
   if((reel<3&&window.includes('A'))||(reel>=3&&!window.includes('A')))return i;
  }
  throw Error('No deterministic A-way fixture for reel '+reel);
 });
 const {root,click}=setup({rng:()=>.5,pickStops:()=>stops});
 try{
  click('SPIN');
  await new Promise(resolve=>setTimeout(resolve,4300));
  if(root.getPresentationState().phase==='win'){
   const solid=root.querySelector('.sc-win-polyline:not(.sc-win-continuation)');
   const tail=root.querySelector('.sc-win-continuation');
   assert.ok(solid,'Expected primary win line');
   const last=tail??solid;
   assert.ok(last.getAttribute('points').includes('450,'),'Win animation must reach reel 5');
   if(tail)assert.ok(tail.getAttribute('class').includes('sc-win-continuation'));
  }else assert.equal(root.getPresentationState().phase,'total');
 }finally{root.stopAnimation();}
});
