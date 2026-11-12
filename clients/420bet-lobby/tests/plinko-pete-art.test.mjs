import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {createPlinkoBoard} from '../src/plinko-board.js';
import {plinkoExpectedReturn,plinkoSchedule} from '../src/plinko-practice-paytable.js';

test('Pete Plinko renders the approved artwork, dynamic board and compact solo-host layout',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:true});
 const root=createPlinkoBoard(document);
 document.body.append(root);
 assert.equal(root.querySelector('.pete-plinko-fullbody').getAttribute('src'),'/assets/420bet/prickly-pete-plinko/characters/pete_fullbody.png');
 assert.equal(root.querySelector('.pete-plinko-logo').getAttribute('src'),'/assets/420bet/prickly-pete-plinko/branding/logo.png');
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
});

test('Pete Plinko visible risk and row controls reconfigure the actual paytable',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:true});
 const root=createPlinkoBoard(document);
 const s=[...root.querySelectorAll('.pete-plinko-controls select')];
 assert.equal(s.length,3);
 s[0].value='8';s[0].dispatchEvent(new window.Event('change'));
 assert.equal(root.querySelectorAll('.plinko-bucket').length,8);
 assert.equal(root.querySelectorAll('.plinko-peg').length,28);
 const before=root.querySelectorAll('.plinko-bucket')[0].textContent;
 s[1].value='riot';s[1].dispatchEvent(new window.Event('change'));
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
 const select=[...root.querySelectorAll('.pete-plinko-controls select')][2];
 select.value='25';select.dispatchEvent(new window.Event('change'));
 const before=root.querySelector('.pete-balance-value').textContent;
 assert.equal(before,'10,000.00');
 root.querySelector('.plinko-drop').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.plinko-drop').disabled,false);
 assert.equal(root.querySelectorAll('.plinko-bucket').length,17);
 assert.match(root.querySelector('.practice-message').textContent,/25 simulated balls landed/);
 assert.match(root.querySelector('.pete-plinko-history').textContent,/×/);
 assert.equal(root.querySelector('.pete-total-balls').textContent,'25');
 assert.equal(root.querySelectorAll('.plinko-financial-row').length,7);
 assert.match(root.textContent,/No funds/);
 assert.doesNotMatch(readFileSync(new URL('../src/plinko-board.js',import.meta.url),'utf8'),/fetch\(|eth_sendTransaction|eth_requestAccounts/);
});
