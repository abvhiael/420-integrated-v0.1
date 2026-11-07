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
 assert.equal(root.querySelector('.cc-left-rail .cc-title-logo').getAttribute('src'),'/assets/420bet/cannabis-cowboy/cannabis-cowboy-logo.png');
 assert.match(root.textContent,/3 Road Trip Tickets/);
});
test('M7 CSS supplies viewport-aware desktop, tablet and phone layouts with no hidden reel row',()=>{
 assert.match(css,/grid-template-rows:minmax\(0,1fr\) auto auto auto/);
 assert.match(css,/grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/);
 assert.match(css,/@media \(min-width:1051px\) and \(min-height:620px\)/);
 assert.match(css,/@media \(min-width:701px\) and \(max-width:1050px\)/);
 assert.match(css,/@media \(max-width:700px\)/);
 assert.match(css,/aspect-ratio:3 \/ 4/);
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

test('M8 square tiles and 68-percent images are enforced for resting and both spinning render paths',()=>{
 assert.match(css,/\.cc-game \.cc-middle \.cc-symbol-grid\{[\s\S]*?aspect-ratio:3 \/ 4/);
 assert.match(css,/\.cc-game \.cc-cell\{aspect-ratio:1 \/ 1/);
 assert.match(css,/\.cc-game \.cc-cell > \.cc-symbol-image\{[\s\S]*?width:68%;[\s\S]*?height:68%;/);
 assert.match(css,/\.cc-game \.cc-reel-token \.cc-symbol-image,\s*\.cc-game \.cc-column-token \.cc-symbol-image\{[\s\S]*?width:68%;[\s\S]*?height:68%;/);
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.equal(root.querySelectorAll('.cc-cell > .cc-symbol-image').length,48);
 assert.equal(root.querySelector('.cc-left-rail .cc-paytable')!==null,true);
});

test('ranch wallpaper remains visible behind game board rather than buried by opaque root',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.equal(root.querySelectorAll(':scope > .cc-ranch-wallpaper').length,1);
 assert.match(css,/\.cc-ranch-wallpaper\{position:absolute;z-index:0;/);
 assert.match(css,/\.cc-game > \.cc-stage,[\s\S]*?z-index:1/);
});

test('Cannabis Cowboy paints ranch wallpaper on root, independently of descendant stacking',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.equal(root.dataset.view,'cannabis-cowboy');
 assert.equal(root.querySelector('.cc-ranch-wallpaper')?.getAttribute('aria-hidden'),'true');
 assert.match(css,/\.cc-game\[data-view="cannabis-cowboy"\]\{[\s\S]*?background-image:/);
 assert.match(css,/radial-gradient\(ellipse at 74% 25%/);
 assert.match(css,/background-position:center/);
});
