import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {SLOT_MACHINES,slotMachinePath,slotMachineFromHash,createSlotsLobby} from '../src/slots-lobby.js';
import {EMERALD_ASSETS} from '../src/emerald-slots-assets.js';
import {readFileSync} from 'node:fs';

test('Slots lobby lists the completed Emerald Harvest machine with its own cabinet artwork',()=>{
 assert.equal(SLOT_MACHINES.length,2);
 assert.equal(SLOT_MACHINES[0].id,'emerald-harvest');
 assert.equal(SLOT_MACHINES[0].art,EMERALD_ASSETS.cabinet);
 assert.equal(SLOT_MACHINES[1].id,'mary-jane-sticky-wilds');
 assert.match(SLOT_MACHINES[1].art,/mary-jane-lobby\.svg$/);
 const {document,window}=parseHTML('<html><body></body></html>');
 let chosen=null;
 const lobby=createSlotsLobby(document,machine=>{chosen=machine;});
 assert.equal(lobby.dataset.view,'slots-lobby');
 assert.match(lobby.textContent,/Slots Lobby/);
 assert.match(lobby.textContent,/Emerald Harvest/);
 const link=lobby.querySelector('a.slots-machine-link');
 assert.equal(link.getAttribute('href'),'#game=slots&machine=emerald-harvest');
 assert.match(link.getAttribute('aria-label'),/Emerald Harvest/);
 assert.equal(link.querySelector('img').getAttribute('src'),EMERALD_ASSETS.cabinet);
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
