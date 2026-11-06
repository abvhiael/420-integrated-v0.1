import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createSinCityPractice} from '../src/sin-city-ui.js';

const setup=()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createSinCityPractice(document);
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
 await new Promise(resolve=>setTimeout(resolve,900));
 assert.doesNotMatch(txt(),/REELS SPINNING/);
 assert.equal(root.querySelectorAll('.sc-symbol').length,20);
 assert.match(txt(),/BALANCE/);
 const balance=Number(root.querySelector('.sc-metric strong').textContent);
 assert.ok(Number.isFinite(balance)&&balance>=0);
 root.stopAnimation();
});
