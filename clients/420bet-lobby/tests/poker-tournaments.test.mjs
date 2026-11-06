import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {createPokerTournamentsPreview,TOURNAMENT_FORMATS,TOURNAMENT_RULES} from '../src/poker-tournaments-ui.js';

test('Tournament preview offers approved scheduled, sit-and-go, rebuy and prefunded free structures',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createPokerTournamentsPreview(document);
 assert.equal(root.dataset.practiceGame,'poker-tournaments');
 assert.equal(root.dataset.previewOnly,'true');
 assert.deepEqual(TOURNAMENT_FORMATS.map(f=>f.id),['scheduled','sit-and-go','rebuy','freeroll']);
 assert.equal(root.querySelectorAll('.pt-choice').length,4);
 assert.equal(root.querySelector('.pt-detail-title h2').textContent,'THE GREEN ROOM');
 for(const [i,id] of TOURNAMENT_FORMATS.map(x=>x.id).entries()){
  const choice=root.querySelectorAll('.pt-choice')[i];
  choice.click();
  assert.equal(root.querySelectorAll('.pt-choice')[i].getAttribute('aria-pressed'),'true');
  assert.equal(root.querySelector('.pt-detail-title h2').textContent,TOURNAMENT_FORMATS[i].name);
  assert.equal(root.querySelectorAll('.pt-feature-pill').length,4);
  assert.equal(root.querySelector('.pt-tag').textContent,TOURNAMENT_FORMATS[i].tag);
 }
});
test('Unlaunched tournaments do not advertise invented event identities or accept entry',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createPokerTournamentsPreview(document);
 assert.match(root.textContent,/TESTNET PREVIEW/);
 assert.match(root.textContent,/REGISTRATION OFFLINE/);
 assert.match(root.textContent,/NO VERIFIED ROSTER/);
 assert.match(root.textContent,/NOT SCHEDULED/);
 assert.match(root.textContent,/NOT ANNOUNCED/);
 assert.match(root.textContent,/NO VERIFIED EVENTS/);
 assert.match(root.textContent,/No live event was announced/);
 assert.equal(root.querySelectorAll('.pt-actions button').length,2);
 for(const button of root.querySelectorAll('.pt-actions button'))assert.equal(button.disabled,true);
 const source=readFileSync(new URL('../src/poker-tournaments-ui.js',import.meta.url),'utf8');
 assert(!source.includes('new WebSocket'));
 assert(!source.includes('fetch('));
 assert(!source.includes('eth_sendTransaction'));
});
test('Tournament policy labels preserve the frozen 5C.1/5C.3 rules, not fabricated event data',()=>{
 const text=TOURNAMENT_RULES.map(x=>x.join(' ')).join(' | ');
 assert.match(text,/2:1/);
 assert.match(text,/no ante/i);
 assert.match(text,/100% of buy-ins/i);
 assert.match(text,/3% development fee/i);
 assert.match(text,/prefunded/i);
 assert.match(text,/not redeemable/i);
 assert.match(text,/pauses do not extend/i);
 assert.match(text,/unique verified finishers/i);
});
test('Tournament lobby route launches an independent preview, leaves cash room and video poker untouched',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const catalogue=readFileSync(new URL('../src/catalogue.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/poker-tournaments.css',import.meta.url),'utf8');
 assert(main.includes("active.id==='poker-tournaments'"));
 assert(main.includes('createPokerTournamentsPreview(document)'));
 assert(main.includes('Explore Tournaments'));
 assert(main.includes('Testnet preview'));
 assert(main.includes('createPokerRoomLive(document'));
 assert(main.includes('createRoyalKushTable(document'));
 assert(catalogue.includes("['poker-tournaments','Poker Tournaments','Poker'"));
 assert(css.includes('.pt-root'));
 assert(css.includes('@media(max-width:720px)'));
});
