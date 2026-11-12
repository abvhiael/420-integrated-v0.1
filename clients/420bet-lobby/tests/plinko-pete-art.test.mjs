import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {createPlinkoBoard,plinkoBallSkin} from '../src/plinko-board.js';
import {plinkoExpectedReturn,plinkoSchedule} from '../src/plinko-practice-paytable.js';

test('Pete Plinko renders the approved artwork, dynamic board and compact solo-host layout',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:true});
 const root=createPlinkoBoard(document);
 document.body.append(root);
 assert.equal(root.querySelector('.pete-plinko-fullbody').getAttribute('src'),'/assets/420bet/prickly-pete-plinko/characters/pete_fullbody.png');
 assert.equal(root.querySelector('.pete-plinko-logo').getAttribute('src'),'/assets/420bet/prickly-pete-plinko/branding/logo.png');
 assert.equal(root.querySelectorAll('.pete-plinko-logo').length,1);
 assert.equal(root.querySelector('.pete-plinko-logo').parentElement,root.querySelector('.pete-plinko-host'));
 assert.equal(root.querySelector('.pete-plinko-logo').nextElementSibling,root.querySelector('.pete-plinko-fullbody'));
 assert.equal(root.querySelector('.pete-plinko-header .pete-plinko-logo'),null);
 assert.equal(root.querySelector('.pete-plinko-reaction-image').getAttribute('src'),'/assets/420bet/prickly-pete-plinko/reactions/reaction_bored.png');
 assert.equal(root.querySelectorAll('.plinko-peg').length,136);
 assert.equal(root.querySelectorAll('.plinko-bucket').length,17);
 assert.match(root.textContent,/PICK YOUR RISK/);
 assert.match(root.textContent,/PRACTICE CREDITS/);
 assert.match(root.textContent,/NOT approved for live settlement/);
 assert(!root.querySelector('[data-wallet-action]'));
 const css=readFileSync(new URL('../src/prickly-pete-plinko.css',import.meta.url),'utf8');
 assert.match(css,/punk_stage_wallpaper\.png/);
 assert.match(css,/button_drop\.png/);
 assert.match(css,/max-height:118px/);
 assert.match(css,/max-height:51vh/);
});

test('Pete Plinko visible risk and row controls reconfigure the actual paytable',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:true});
 const root=createPlinkoBoard(document);
 const selects=[...root.querySelectorAll('.pete-plinko-controls select')];
 assert.equal(selects.length,3);
 const minus=root.querySelectorAll('.pete-step')[0];
 for(let i=0;i<9;i++)minus.dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.plinko-bucket').length,8);
 assert.equal(root.querySelectorAll('.plinko-peg').length,28);
 const before=root.querySelectorAll('.plinko-bucket')[0].textContent;
 root.querySelectorAll('.pete-risk-button')[2].dispatchEvent(new window.Event('click'));
 assert.notEqual(root.querySelectorAll('.plinko-bucket')[0].textContent,before);
 assert.equal(root.querySelectorAll('.pete-risk-button[aria-pressed="true"]').length,1);
 assert.equal(root.querySelector('.pete-row-count').textContent,'7');
 assert(Math.abs(plinkoExpectedReturn(8,'riot')-.96)<.0001);
 assert(plinkoSchedule(8,'riot')[0]>plinkoSchedule(8,'soundcheck')[0]);
});

test('Pete Plinko multi-ball deductions and awards are virtual, bounded, and independent',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:true});
 const root=createPlinkoBoard(document);
 document.body.append(root);
 root.querySelectorAll('.pete-ball-button')[3].dispatchEvent(new window.Event('click'));
 const before=root.querySelector('.pete-balance-value').textContent;
 assert.equal(before,'10,000.00');
 root.querySelector('.plinko-drop').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.plinko-drop').disabled,false);
 assert.equal(root.querySelectorAll('.plinko-bucket').length,17);
 assert.match(root.querySelector('.practice-message').textContent,/25 simulated balls landed/);
 assert.match(root.querySelector('.pete-plinko-history').textContent,/×/);
 assert.equal(root.querySelector('.pete-total-balls').textContent,'25');
 assert.equal(root.querySelectorAll('.plinko-financial-row').length,10);
 assert.equal(root.querySelector('.pete-total-cost-value').textContent,'250.00');
 assert.match(root.querySelector('.pete-total-win-value').textContent,/^[0-9,.]+$/);
 assert.match(root.textContent,/No funds/);
 assert.doesNotMatch(readFileSync(new URL('../src/plinko-board.js',import.meta.url),'utf8'),/fetch\(|eth_sendTransaction|eth_requestAccounts/);
});

test('every ball in 10- and 25-drop batches has a valid visible sprite and paced trajectory',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=1000, frames=[],cancelled=[];
 const clock={
  matchMedia:()=>({matches:false}),
  requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},
  cancelAnimationFrame:id=>cancelled.push(id)
 };
 const root=createPlinkoBoard(document,{view:clock});document.body.append(root);
 for(const count of [10,25]){
  const button=[...root.querySelectorAll('.pete-ball-button')].find(b=>b.textContent===String(count));
  button.dispatchEvent(new window.Event('click'));
  assert.equal(root.querySelector('.pete-total-cost-value').textContent,count===10?'100.00':'250.00');
  root.querySelector('.plinko-drop').dispatchEvent(new window.Event('click'));
  assert(root.querySelector('.plinko-drop').disabled,'drop is locked while animation is in progress');
  for(let i=0;i<count;i++){
   assert.equal(plinkoBallSkin(i),plinkoBallSkin(i%7));
   assert(root.querySelectorAll('.plinko-ball').length===count);
   const sprite=root.querySelectorAll('.plinko-ball image')[i];
   assert(sprite.getAttribute('href')?.endsWith(plinkoBallSkin(i)),'every ball has a real PNG sprite');
   assert(!sprite.getAttribute('href').includes('undefined'));
  }
  // The first ball is still on the board after 3000ms: drop duration is > 3000ms.
  frames.shift()(now);
  now+=3000;
  frames.shift()(now);
  assert(root.querySelector('.plinko-drop').disabled,'slower drop has not completed by three seconds');
  root.querySelector('.pete-plinko-stop').dispatchEvent(new window.Event('click'));
  assert.equal(root.querySelector('.plinko-drop').disabled,false);
  assert.equal(root.querySelector('.pete-total-cost-value').textContent,count===10?'100.00':'250.00');
  assert.match(root.querySelector('.pete-total-win-value').textContent,/^[0-9,.]+$/);
  assert(root.querySelectorAll('.plinko-bucket.landed').length>0);
  frames=[];now+=5000;
 }
 assert(cancelled.length>=2);
});

test('per-ball cost scales before drop and total wins update after virtual settlement',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:true});
 const root=createPlinkoBoard(document);document.body.append(root);
 const choose=[...root.querySelectorAll('.pete-ball-button')];
 choose[0].dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.pete-total-cost-value').textContent,'10.00');
 root.querySelectorAll('.pete-bet-step')[1].dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.pete-total-cost-value').textContent,'11.00');
 assert.equal(root.querySelector('.pete-total-win-value').textContent,'0.00');
 root.querySelector('.plinko-drop').dispatchEvent(new window.Event('click'));
 const cost=root.querySelector('.pete-total-cost-value').textContent;
 const win=root.querySelector('.pete-total-win-value').textContent;
 assert.equal(cost,'11.00');
 assert.match(root.querySelector('.practice-message').textContent,/Cost 11\.00 credits\. Total wins/);
 assert.equal(root.querySelector('.pete-total-win').classList.contains('settled'),true);
 const balance=Number(root.querySelector('.pete-balance-value').textContent.replaceAll(',',''));
 assert(Math.abs(balance-(10000-11+Number(win.replaceAll(',',''))))<0.011);
});
