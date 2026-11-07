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


test('M9 uses the committed PNG wallpaper across the game surface, not synthetic CSS scenery',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.equal(root.dataset.view,'cannabis-cowboy');
 assert.match(css,/\.cc-game\[data-view="cannabis-cowboy"\]\{\s*background:#101b18 url\('\/assets\/420bet\/backgrounds\/420bet_slots_wallpaper\.png'\)/);
 assert.match(css,/\.immersive:has\(\.cc-game\) \.view-scroll\{\s*background:#101b18 url\('\/assets\/420bet\/backgrounds\/420bet_slots_wallpaper\.png'\)/);
 assert.match(css,/\.cc-game\[data-view="cannabis-cowboy"\] > \.cc-ranch-wallpaper,[\s\S]*?display:none/);
 assert.ok(root.querySelector('.cc-left-rail .cc-paytable-table tbody'));
 assert.equal(root.querySelector('.cc-stage').children.length,2);
 assert.match(css,/grid-template-columns: minmax\(310px,325px\) minmax\(0,1fr\)/);
});

test('M9 a single immersive wallpaper spans navigation and game without mismatched crops',()=>{
 assert.match(css,/\.immersive:has\(\.cc-game\)\{\s*background:#101b18 url\('\/assets\/420bet\/backgrounds\/420bet_slots_wallpaper\.png'\) center center \/ cover no-repeat/);
 assert.match(css,/\.immersive:has\(\.cc-game\) \.view-scroll\{\s*background:transparent/);
 assert.match(css,/\.immersive:has\(\.cc-game\) \.cc-game\[data-view="cannabis-cowboy"\]\{\s*background:transparent/);
});


test('uploaded Cannabis Cowboy ranch wallpaper overlays shared base across the full immersive view',()=>{
 const marker=css.lastIndexOf('/* Cannabis Cowboy approved ranch wallpaper');
 assert.notEqual(marker,-1);
 const activeRules=css.slice(marker);
 assert.match(activeRules,/cannabis-cowboy\/cannabis-cowboy-wallpaper\.png/);
 assert.match(activeRules,/backgrounds\/420bet_slots_wallpaper\.png/);
 assert.ok(activeRules.indexOf('cannabis-cowboy/cannabis-cowboy-wallpaper.png')<
           activeRules.indexOf('backgrounds/420bet_slots_wallpaper.png'),
           'new wallpaper must be the first/top background image');
 assert.match(activeRules,/background-size:cover,cover/);
 assert.match(activeRules,/min-height:100dvh/);
 assert.match(activeRules,/\.view-scroll,[\s\S]*?\.cc-game\[data-view="cannabis-cowboy"\]\{\s*background:transparent;/);
 assert.match(activeRules,/\.cc-game > \.cc-ranch-wallpaper\{\s*display:none;/);
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.ok(root.querySelector('.cc-left-rail .cc-title-logo'));
 assert.ok(root.querySelector('.cc-left-rail .cc-paytable'));
 assert.equal(root.querySelectorAll('.cc-cell').length,48);
});


test('Cowboy desktop layout puts logo, paytable and reel board inside one left-aligned cabinet',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 const stage=root.querySelector('.cc-stage');
 assert.equal(stage.children.length,2);
 assert.equal(stage.children[0].className,'cc-left-rail');
 assert.equal(stage.children[1].className,'cc-middle');
 assert.equal(stage.querySelector('.cc-left-rail .cc-title-logo').getAttribute('src'),
  '/assets/420bet/cannabis-cowboy/cannabis-cowboy-logo.png');
 assert.ok(stage.querySelector('.cc-left-rail .cc-paytable-table'));
 assert.equal(stage.querySelectorAll('.cc-symbol-grid > .cc-cell').length,48);
 const desktop=css.slice(css.lastIndexOf('/* Cowboy stage composition:'));
 assert.match(desktop,/width:min\(1180px,calc\(100% - clamp\(240px,23vw,440px\)\)\)/);
 assert.match(desktop,/justify-self:start/);
 assert.match(desktop,/border:8px ridge var\(--cc-gold\)/);
 assert.match(desktop,/\.cc-middle\{[\s\S]*?border:0/);
 assert.match(desktop,/\.cc-console\{[\s\S]*?width:100%/);
});


test('Cowboy reel stage and symbol cells are transparent while left paytable and bonus panels stay opaque',()=>{
 const marker='/* Transparent Cowboy play surface.';
 const start=css.lastIndexOf(marker);
 assert(start>=0,'final transparency overrides must exist');
 const live=css.slice(start);
 for(const name of ['cc-stage','cc-middle','cc-symbol-grid','cc-left-rail','cc-sidebar-brand']){
  assert(live.includes('.cc-'+name),'missing transparent '+name);
 }
 assert.match(live,/\.cc-sidebar-brand\{\s*background:transparent;/);
 assert.match(live,/\.cc-symbol-grid > \.cc-cell,[\s\S]*?background:transparent;/);
 assert.match(live,/\.cc-cell\.cc-winning\{\s*background:rgba\(48,123,54,\.22\)/);
 assert.match(live,/\.cc-left-rail \.cc-paytable,[\s\S]*?\.cc-left-rail \.cc-sidebar-features \.cc-panel\{\s*background:#25180f;/);
 const {document}=parseHTML('<html><body></body></html>');
 const root=createCannabisCowboyShell(document);
 assert.equal(root.querySelectorAll('.cc-symbol-grid > .cc-cell').length,48);
 assert.ok(root.querySelector('.cc-left-rail .cc-paytable'));
 assert.equal(root.querySelectorAll('.cc-sidebar-features .cc-panel').length,3);
});
