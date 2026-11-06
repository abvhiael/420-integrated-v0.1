import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {createCannabisCowboyShell} from '../src/cannabis-cowboy-ui.js';
import {createCannabisCowboyPractice} from '../src/cannabis-cowboy-game.js';
import {makeReelStrip,REEL_STOP_TIMES} from '../src/cannabis-cowboy-reels.js';

const css=readFileSync(new URL('../src/cannabis-cowboy.css',import.meta.url),'utf8');
const seed=(initial=37)=>{let s=initial>>>0;return ()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296)};
test('M7 layout keeps all 48 symbols and correct accessibility descriptions',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.equal(root.querySelectorAll('.cc-cell').length,48);
 assert.equal(root.querySelector('.cc-symbol-grid').getAttribute('role'),'group');
 assert.match(root.querySelector('.cc-symbol-grid').getAttribute('aria-label'),/eight-row/);
 assert.equal(root.querySelector('.cc-approved-cabinet').getAttribute('src'),'/assets/420bet/slots-lobby/cannabis-cowboy-lobby-cabinet.png');
 assert.match(root.textContent,/3 Road Trip Tickets/);
});
test('M7 CSS supplies viewport-aware desktop, tablet and phone layouts with no hidden reel row',()=>{
 assert.match(css,/grid-template-rows:auto minmax\(0,1fr\) auto auto auto/);
 assert.match(css,/grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/);
 assert.match(css,/@media \(min-width:1051px\) and \(min-height:620px\)/);
 assert.match(css,/@media \(min-width:701px\) and \(max-width:1050px\)/);
 assert.match(css,/@media \(max-width:700px\)/);
 assert.match(css,/object-position:23% 26%/);
 assert.match(css,/max-height:calc\(100% - 20px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.immersive:has\(\.cc-game\) \.gamebar/);
});
test('M7 preserves working practice controls, reel stop timing and info presentation',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyPractice(document,{rng:seed(29),reducedMotion:true});
 assert.equal(root.querySelector('.cc-spin').disabled,false);
 assert.equal(root.querySelectorAll('.cc-cell').length,48);
 const info=root.querySelector('.cc-info-panel');
 root.querySelector('.cc-info').dispatchEvent(new window.Event('click'));
 assert.equal(info.hidden,false);
 assert.match(info.textContent,/On the Road Again/);
 info.querySelector('.cc-dismiss').dispatchEvent(new window.Event('click'));
 assert.equal(info.hidden,true);
 root.stopAnimation();
});

test('M7 reel animations have duplicate symbol cycles, never jolt on wrap',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const strip=makeReelStrip(document,2);
 const tokens=[...strip.querySelectorAll('.cc-reel-token')];
 assert.equal(tokens.length,12);
 assert.deepEqual(tokens.slice(0,6).map(x=>x.className),tokens.slice(6).map(x=>x.className));
 assert.deepEqual(tokens.slice(0,6).map(x=>x.textContent),tokens.slice(6).map(x=>x.textContent));
 assert.deepEqual([...REEL_STOP_TIMES],[700,1200,1950,2700,3450,4200]);
 assert.match(css,/height:1200%;animation:cc-reel-loop/);
 assert.match(css,/translate3d\(0,-50%,0\)/);
});
