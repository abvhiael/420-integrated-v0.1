import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {createCannabisCowboyShell,COWBOY_LAYOUT,COWBOY_PREVIEW_GRID,COWBOY_ART} from '../src/cannabis-cowboy-ui.js';

test('Cannabis Cowboy M2 screen uses approved asset and has an isolated 6x8 static display',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.equal(root.dataset.view,'cannabis-cowboy');
 assert.equal(root.dataset.mode,'visual-preview');
 assert.deepEqual(COWBOY_LAYOUT,{columns:6,rows:8,positions:48});
 assert.equal(COWBOY_PREVIEW_GRID.length,48);
 assert.equal(root.querySelectorAll('.cc-cell').length,48);
 assert.equal(root.querySelector('.cc-approved-cabinet').getAttribute('src'),COWBOY_ART.lobby);
 assert.equal(root.querySelectorAll('.cc-right-rail .cc-panel').length,3);
 assert.match(root.textContent,/ENDLESS HARVEST/);
 assert.match(root.textContent,/SMOKE RING WILDS/);
 assert.match(root.textContent,/ON THE ROAD AGAIN/);
});
test('M2 disables all round and bet controls and never presents credits as spendable',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 const controls=[...root.querySelectorAll('.cc-console button')];
 assert.equal(controls.length,6);
 assert.equal(controls.filter(b=>!b.disabled).length,1,'only information dialog can open');
 assert.equal(root.querySelector('.cc-spin').disabled,true);
 assert.equal(root.querySelector('.cc-readout strong').textContent,'$4.00');
 assert.match(root.textContent,/NO REAL OR PRACTICE WAGERING/);
 assert.equal(root.querySelector('.cc-info-panel').hidden,true);
 root.querySelector('.cc-info').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.cc-info-panel').hidden,false);
 root.querySelector('.cc-dismiss').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.cc-info-panel').hidden,true);
});
test('M2 mounts a dedicated Cannabis Cowboy visual shell, leaving other machines alone',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/createCannabisCowboyPractice\(document\)/);
 assert.match(main,/selectedSlotMachine\?\.id==='cannabis-cowboy'/);
 assert.match(main,/createMaryJanePractice\(document\)/);
 assert.match(main,/createDadsSecretStash\(document\)/);
 assert.match(main,/createPractice\('slots',document\)/);
});
