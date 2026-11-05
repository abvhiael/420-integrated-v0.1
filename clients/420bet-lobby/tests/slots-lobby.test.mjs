import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {SLOT_MACHINES,slotMachinePath,slotMachineFromHash,createSlotsLobby,createEmeraldLobbyPreview,EMERALD_LOBBY_BOARD,EMERALD_LOBBY_STOPS} from '../src/slots-lobby.js';
import {EMERALD_ASSETS} from '../src/emerald-slots-assets.js';
import {BASE_REELS,visibleGrid} from '../src/emerald-v2-strips.js';
import {readFileSync} from 'node:fs';

test('Slots lobby lists the completed Emerald Harvest machine with its own cabinet artwork',()=>{
 assert.equal(SLOT_MACHINES.length,3);
 assert.equal(SLOT_MACHINES[0].id,'emerald-harvest');
 assert.equal(SLOT_MACHINES[0].art,EMERALD_ASSETS.cabinet);
 assert.equal(SLOT_MACHINES[1].id,'mary-jane-sticky-wilds');
 assert.match(SLOT_MACHINES[1].art,/mj-concept-cabinet\.webp$/);
 const {document,window}=parseHTML('<html><body></body></html>');
 let chosen=null;
 const lobby=createSlotsLobby(document,machine=>{chosen=machine;});
 assert.equal(lobby.dataset.view,'slots-lobby');
 assert.match(lobby.textContent,/Slots Lobby/);
 assert.match(lobby.textContent,/Emerald Harvest/);
 const link=lobby.querySelector('a.slots-machine-link');
 assert.equal(link.getAttribute('href'),'#game=slots&machine=emerald-harvest');
 assert.match(link.getAttribute('aria-label'),/Emerald Harvest/);
 assert.equal(link.querySelector('.slots-emerald-cabinet').getAttribute('src'),EMERALD_ASSETS.cabinet);
 assert.equal(link.querySelectorAll('.slots-emerald-reel-grid .slots-emerald-symbol img').length,20);
 link.dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));
 assert.equal(chosen?.id,'emerald-harvest');
});

test('Slots lobby routes are scoped and unknown machine IDs fail closed to lobby',()=>{
 assert.equal(slotMachinePath('emerald-harvest'),'#game=slots&machine=emerald-harvest');
 assert.equal(slotMachineFromHash('#game=slots&machine=emerald-harvest')?.id,'emerald-harvest');
 assert.equal(slotMachineFromHash('#game=slots'),null);
 assert.equal(slotMachineFromHash('#game=slots&machine=not-configured'),null);
 assert.equal(slotMachineFromHash('#game=dice&machine=emerald-harvest'),null);
});

test('main game navigation keeps Slots lobby separate from the existing Emerald cabinet',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/createSlotsLobby\(document,launchSlotMachine\)/);
 assert.match(main,/selectedSlotMachine\?\.title/);
 assert.match(main,/selectedSlotMachine\?'← Slots Lobby'/);
 assert.match(main,/createPractice\('slots',document\)/);
 assert.match(main,/window\.addEventListener\('hashchange',restoreRoute\)/);
});

test('Emerald Harvest lobby preview shows a legitimate deterministic 5x4 gameplay outcome',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 assert.deepEqual([...EMERALD_LOBBY_BOARD],visibleGrid(BASE_REELS,EMERALD_LOBBY_STOPS));
 assert.equal(EMERALD_LOBBY_BOARD.length,20);
 const preview=createEmeraldLobbyPreview(document);
 assert.equal(preview.querySelectorAll('.slots-emerald-symbol').length,20);
 const images=[...preview.querySelectorAll('.slots-emerald-symbol img')];
 assert.equal(images.length,20);
 for(let i=0;i<images.length;i++)
  assert.equal(images[i].getAttribute('src'),EMERALD_ASSETS.symbols[EMERALD_LOBBY_BOARD[i]]);
 assert.equal(preview.querySelectorAll('img.slots-emerald-cabinet').length,1);
 assert.match(preview.getAttribute('aria-label'),/five reels, four rows/i);
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/\.slots-machine-art \.slots-emerald-reel-grid\{[^}]*left:13\.2%;top:24\.4%;width:73\.7%;height:53\.8%/);
 assert.match(css,/\.slots-machine-art \.slots-emerald-cabinet\{/);
 const lobby=createSlotsLobby(document);
 const cards=[...lobby.querySelectorAll('.slots-machine-card')];
 assert.equal(cards.length,3);
 assert.equal(cards.filter(card=>!card.hidden).length,3);
 assert.equal(SLOT_MACHINES[2].id,'dads-secret-stash');
 assert.equal(slotMachineFromHash('#game=slots&machine=dads-secret-stash')?.id,'dads-secret-stash');
 assert.match(cards[2].querySelector('img').getAttribute('src'),/dads-secret-stash/);
 assert(cards[0].querySelector('.slots-emerald-reel-grid'));
 assert.equal(cards[1].querySelector('.slots-emerald-reel-grid'),null,'Mary Jane art remains untouched');
});
