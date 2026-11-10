import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {
 createCatastropheJack,JACK_STOP_ORDER,JACK_STOP_DELAY_MS,JACK_LINES,JACK_CROSS,
 jackSpin,jackFeature,jackEvaluate,jackBellAward
} from '../src/catastrophe-jack.js';
import {SLOT_MACHINES,slotMachinePath,slotMachineFromHash,createSlotsLobby} from '../src/slots-lobby.js';
import {readFileSync} from 'node:fs';

test('Catastrophe Jack is ninth lobby machine with a direct playable practice route',()=>{
 assert.equal(SLOT_MACHINES.length,9);
 assert.equal(SLOT_MACHINES[8].id,'catastrophe-jack');
 assert.equal(SLOT_MACHINES[8].practiceBeta,true);
 assert.match(SLOT_MACHINES[8].art,/catastrophe_jack_logo\.png$/);
 assert.equal(slotMachinePath('catastrophe-jack'),'#game=slots&machine=catastrophe-jack');
 assert.equal(slotMachineFromHash('#game=slots&machine=catastrophe-jack')?.id,'catastrophe-jack');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/createCatastropheJack\(document\)/);
});
test('nine individually animated positions follow 4, 5, 6, 1, 2, 3, 7, 8, 9 with half-second gaps',()=>{
 assert.deepEqual(JACK_STOP_ORDER,[4,5,6,1,2,3,7,8,9]);
 assert.equal(JACK_STOP_DELAY_MS,500);
 assert.equal(JACK_LINES.length,8);
 assert.deepEqual(JACK_CROSS,[1,3,4,5,7]);
});
test('five-bell cross and either insurance diagonal are mutually prioritized',()=>{
 const bells=['FISH','BELL','FISH','BELL','BELL','BELL','FISH','BELL','FISH'];
 assert.equal(jackFeature(bells),'free');
 const insurance=['CLAIM','BUD','FISH','PIZZA','CLAIM','CASH','TICKET','BUD','CLAIM'];
 assert.equal(jackFeature(insurance),'insurance');
 assert.equal(jackFeature(['BUD','CASH','CLAIM','FISH','CLAIM','PIZZA','CLAIM','BUD','TICKET']),'insurance');
 assert.equal(jackFeature(['FISH','BUD','FISH','CASH','ANVIL','DYNAMITE','BUD','FISH','PIZZA']),'reversal');
});
test('line wins, bonus bell counts and feature modifiers have finite credit awards',()=>{
 const board=Array(9).fill('TICKET');
 assert.equal(jackEvaluate(board,1).total,64);
 assert.equal(jackBellAward(Array(9).fill('BELL'),1,9).amount,1250);
 assert.equal(jackBellAward(Array(9).fill('BELL'),1,6).amount,750);
 assert.equal(jackBellAward(Array(9).fill('BELL'),1,3).amount,500);
 const sample=jackSpin('base',()=>0);
 assert.deepEqual(sample,Array(9).fill('TICKET'));
});
test('game screen shows nine reel images, all three bonus test buttons and full bleed stage',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const stage=createCatastropheJack(document,{rng:()=>0});
 document.body.append(stage);
 assert.equal(stage.querySelectorAll('.cj-cell').length,9);
 assert.equal(stage.querySelectorAll('.cj-cell img').length,9);
 assert.equal(stage.dataset.mode,'base');
 const testButtons=[...stage.querySelectorAll('.cj-test')];
 assert.equal(testButtons.length,3);
 testButtons[0].dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(stage.dataset.mode,'free');
 assert.match(stage.style.getPropertyValue('--cj-wallpaper'),/background-nine-lives\.png/);
 stage.stopAnimation();
});

test('slot #9 appears only in the normal carousel and launches correctly',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let selected=null;
 const lobby=createSlotsLobby(document,machine=>{selected=machine;});
 assert.equal(lobby.querySelector('.slots-featured-launch'),null);
 const cards=[...lobby.querySelectorAll('.slots-machine-card')];
 assert.equal(cards.length,9);
 const last=cards[8];
 assert.equal(last.querySelector('a').getAttribute('href'),'#game=slots&machine=catastrophe-jack');
 const next=lobby.querySelectorAll('.slots-carousel-arrow')[1];
 for(let i=0;i<6;i++)next.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(last.hidden,false);
 last.querySelector('a').dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));
 assert.equal(selected?.id,'catastrophe-jack');
});
