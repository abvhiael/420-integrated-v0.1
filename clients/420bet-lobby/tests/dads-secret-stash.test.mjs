import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {SLOT_MACHINES,createSlotsLobby,slotMachineFromHash} from '../src/slots-lobby.js';
import {newGame,qualify,triggerCharacters,modifier,inspection,spin,evaluate} from '../src/dads-secret-stash-engine.js';
import {createDadsSecretStash} from '../src/dads-secret-stash-ui.js';
import {DSS_SYMBOL_ART,DSS_CAST_ART,DSS_TRANSITION_ART,DSS_BACKGROUND_ART,DSS_FEATURE_ART} from '../src/dads-secret-stash-assets.js';
import {SYMBOLS} from '../src/dads-secret-stash-engine.js';
const board=()=>Array(20).fill('A');const seq=(value)=>()=>value;
test('Slot #3 routes to own page and lobby keeps three cabinets in view',()=>{assert.equal(SLOT_MACHINES.length,3);assert.equal(SLOT_MACHINES[2].id,'dads-secret-stash');assert.equal(slotMachineFromHash('#game=slots&machine=dads-secret-stash')?.title,"Dad's Secret Stash");const {document}=parseHTML('<html><body></body></html>');const lobby=createSlotsLobby(document);assert.equal(lobby.querySelectorAll('.slots-machine-card').length,3);assert.equal([...lobby.querySelectorAll('.slots-machine-card')].filter(x=>!x.hidden).length,3);assert.equal(lobby.querySelectorAll('.slots-carousel-arrow').length,2);});
test('Character conditions require exact thresholds',()=>{const jen=board();jen[0]=jen[1]=jen[2]='jen';assert.equal(qualify(jen).jen,true);jen[2]='A';assert.equal(qualify(jen).jen,false);const family=board();family[3]='tyler';family[4]='emma';assert.equal(qualify(family).family,true);const k=board();k[0]=k[1]=k[2]='keller';assert.equal(qualify(k).keller,true);const bud=board();bud[0]=bud[1]=bud[2]='bud';assert.equal(qualify(bud).bud,true);});
test('25 percent conditional trigger independently applies to every feature',()=>{const grid=board();grid.splice(0,3,'jen','jen','jen');grid.splice(3,3,'keller','keller','keller');grid.splice(6,3,'bud','bud','bud');grid[9]='tyler';grid[10]='emma';assert.deepEqual(triggerCharacters(grid,seq(.249)),{jen:true,family:true,keller:true,bud:true});assert.deepEqual(triggerCharacters(grid,seq(.25)),{jen:false,family:false,keller:false,bud:false});});
test('Jen outcome selectors and fetch wild preserve 5x4 grid',()=>{const grid=board();const jen=modifier(grid,'jen',seq(.3));assert.equal(jen.label,'PANIC WILDS');assert(jen.grid.filter(s=>s==='wild').length>=2);const bud=modifier(grid,'bud',seq(.5));assert.equal(bud.label,'FETCH WILD!');assert(bud.grid.filter(s=>s==='wild').length>=2);});
test('HOA inspection only grants two to five respins and locks premiums',()=>{const grid=board();grid[0]='gary';for(const n of [.0,.99]){const out=inspection(grid,seq(n));assert(out.spins>=2&&out.spins<=5);assert.equal(out.boards.length,out.spins);assert(out.boards.every(b=>b.grid[0]==='gary'));}});
test('Practice spin debits simulated stake, returns no wallet data, and is capped',()=>{const before=newGame(),after=spin(before,seq(.55));assert.equal(after.rounds,1);assert.equal(before.balance,1000);assert(after.balance>=999);assert(after.last.grid.length===20);assert(after.last.win<=10000*after.bet);assert(!('wallet' in after));assert.equal(evaluate(Array(20).fill('A')).wins.length>0,true);});
test('New game renders controls and supports repeatable disposal',()=>{const {document}=parseHTML('<html><body></body></html>');const game=createDadsSecretStash(document);assert.equal(game.dataset.practiceGame,'dads-secret-stash');assert.equal(game.querySelectorAll('.dss-cell').length,20);assert.match(game.textContent,/SPIN/);assert.equal(typeof game.stopAnimation,'function');game.stopAnimation();});

test('All 20 reel symbols map to approved PNG files and cast art includes the teenage pair',()=>{
 for(const symbol of SYMBOLS) assert.match(DSS_SYMBOL_ART[symbol]??'',/\/assets\/420bet\/dads-secret-stash\/.+\.png$/);
 for(const type of ['jen','family','keller','bud'])assert.match(DSS_TRANSITION_ART[type],/\.png$/);
 assert.equal(DSS_CAST_ART.family.length,2);
 assert.equal(Object.keys(DSS_BACKGROUND_ART).length,4);
 assert.equal(Object.keys(DSS_FEATURE_ART).length,4);
});
test('Game creates image-backed reels and individual PNG character layer for sliding announcement',()=>{
 const {document}=parseHTML('<html><body></body></html>');const game=createDadsSecretStash(document);
 const symbolImages=[...game.querySelectorAll('img.dss-symbol-image')];
 assert.equal(symbolImages.length,20);
 assert.equal(symbolImages[0].getAttribute('src'),DSS_SYMBOL_ART.jar);
 assert(game.querySelector('.dss-portrait'));
 assert(game.querySelector('.dss-transition-backdrop'));
 assert(game.querySelector('.dss-feature-title-art'));
 assert.equal(game.querySelector('.dss-bubble').hidden,true);
 assert.match(game.querySelector('.dss-scene').getAttribute('style'),/garage_main\.png/);
 game.stopAnimation();
});
