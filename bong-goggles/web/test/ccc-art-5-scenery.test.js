import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame} from '../core/cross-country-chaos.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {chaosRoutePosition,renderChaosHighway} from '../core/chaos-board.js';
import {CHAOS_SCENERY,CHAOS_SCENERY_COUNT,chaosSceneryFeatures,renderChaosScenery}
 from '../core/chaos-region-scenery.js';

const regions=['east','ontario','west'];
const expected={
 east:['ferry','moose'],
 ontario:['forest','goose'],
 west:['elevators','potholes','mountains','pass']
};
const game=()=>createChaosGame({names:['Alice','Bob','Claire','Dave'],seed:420});

test('CCC-ART-5: exactly eight immutable, region-specific Canadian illustrated landmarks',()=>{
 assert.equal(CHAOS_SCENERY_COUNT,8);
 assert.equal(Object.isFrozen(CHAOS_SCENERY),true);
 assert.deepEqual(Object.keys(CHAOS_SCENERY),regions);
 const ids=[];
 for(const region of regions){
  const list=chaosSceneryFeatures(region);
  assert.ok(Object.isFrozen(list));
  assert.deepEqual(list.map(f=>f.id),expected[region]);
  for(const item of list){
   assert.ok(Object.isFrozen(item),item.id);
   assert.match(item.id,/^[a-z]+$/);
   assert.ok(item.label.length>=8);
   assert.ok(Number.isFinite(item.x)&&Number.isFinite(item.y)&&Number.isFinite(item.scale));
   assert.ok(item.x>70&&item.x<900&&item.y>60&&item.y<380&&item.scale>=.75&&item.scale<=1.05);
   ids.push(item.id);
  }
 }
 assert.equal(new Set(ids).size,8);
 assert.equal(chaosSceneryFeatures('__proto__'),null);
 assert.equal(chaosSceneryFeatures('../west'),null);
 assert.equal(renderChaosScenery('__proto__'),'');
});
test('CCC-ART-5: ferry and moose decorate the Atlantic route, and no other region',()=>{
 const east=renderChaosScenery('east');
 assert.match(east,/data-scenery="ferry"/);
 assert.match(east,/data-scenery="moose"/);
 assert.match(east,/Atlantic ferry/);
 assert.match(east,/Eastern moose/);
 assert.match(east,/q24-6 45 0/,'ferry has a water-wake detail');
 assert.match(east,/q-12-9-12-23/,'moose has original antler and body contours');
 for(const wrong of ['forest','goose','elevators','potholes','mountains','pass'])
  assert.ok(!east.includes('data-scenery="'+wrong+'"'),wrong);
});
test('CCC-ART-5: Wawa Goose and deep northern woods are distinct Ontario vignettes',()=>{
 const ontario=renderChaosScenery('ontario');
 assert.match(ontario,/data-scenery="forest"/);
 assert.match(ontario,/data-scenery="goose"/);
 assert.match(ontario,/Northern Ontario forest/);
 assert.match(ontario,/Wawa Goose/);
 assert.match(ontario,/<path d="M-45-45/,'forest contains hand-drawn pines');
 assert.match(ontario,/fill="#e0d8bc"/,'goose has a recognisable pale silhouette');
 for(const wrong of ['ferry','moose','elevators','potholes','mountains','pass'])
  assert.ok(!ontario.includes('data-scenery="'+wrong+'"'),wrong);
});
test('CCC-ART-5: elevators, Saskatchewan potholes, Rockies and mountain passes have independent Western artwork',()=>{
 const west=renderChaosScenery('west');
 for(const id of expected.west)assert.match(west,new RegExp('data-scenery="'+id+'"'));
 for(const word of ['Prairie grain elevators','Saskatchewan potholes','Rocky Mountains','Rocky Mountain pass'])
  assert.ok(west.includes(word));
 assert.match(west,/fill="#d4a85f"/,'prairie grain elevator details');
 assert.match(west,/<ellipse cx="-22" cy="18"/,'road potholes are illustrated, not a gameplay trap');
 assert.match(west,/M-74 20-48-18/,'snowy mountain silhouettes');
 assert.match(west,/>PASS<\/text>/,'mountain pass has its own scenery sign');
 assert.ok(!west.includes('data-scenery="ferry"'));
 assert.ok(!west.includes('data-scenery="goose"'));
});
test('CCC-ART-5: decorative vectors never cover the qualified road, stops or moving cars',()=>{
 for(let i=0;i<regions.length;i++){
  const state=game();state.leg=i;
  const html=renderChaosHighway(state),region=regions[i];
  const back=html.indexOf('class="ccc-map-foreground"');
  const scenic=html.indexOf('class="ccc-illustrated-scenery"');
  const road=html.indexOf('class="ccc-highway-shadow"');
  const centre=html.indexOf('class="ccc-highway-centre"');
  const towns=html.indexOf('class="ccc-map-stop"');
  const cars=html.indexOf('class="ccc-map-vehicle');
  assert.ok(back<scenic&&scenic<road&&road<centre&&centre<towns&&towns<cars,
   'Road and gameplay must appear above decorative scenery: '+region);
  assert.equal((html.match(/class="ccc-scenery-vignette /g)||[]).length,expected[region].length);
  assert.match(html,/class="ccc-illustrated-scenery" aria-hidden="true" pointer-events="none"/);
  assert.match(html,/<desc>Illustrated roadside scenery:/);
  assert.match(html,/live game elements.<\/desc>/);
  assert.match(html,/viewBox="0 0 960 415"/);
  assert.match(html,/2,500 game km/);
  assert.equal((html.match(/class="ccc-map-vehicle ccc-map-vehicle--/g)||[]).length,4);
  assert.equal((html.match(/class="ccc-map-stop"/g)||[]).length,[6,7,7][i]);
  for(const id of expected[region])assert.ok(html.includes('data-scenery="'+id+'"'));
  for(const other of regions.filter(x=>x!==region))
   for(const id of expected[other])assert.ok(!html.includes('data-scenery="'+id+'"'),id);
 }
});
test('CCC-ART-5: vignette anchors remain clear of the normalized driving corridor',()=>{
 for(const region of regions){
  for(const item of chaosSceneryFeatures(region)){
   let nearest=Infinity;
   for(let km=0;km<=2500;km+=10){
    const pos=chaosRoutePosition(region,km);
    nearest=Math.min(nearest,Math.hypot(pos.x-item.x,pos.y-item.y));
   }
   assert.ok(nearest>55,'Artwork crowds game highway: '+region+'/'+item.id+' ('+nearest.toFixed(1)+' px)');
  }
 }
});
test('CCC-ART-5: static scenery never depends on player state or leaks hidden hands',()=>{
 for(let i=0;i<3;i++){
  const s=game();s.leg=i;
  const before=structuredClone(s);
  const html=renderChaosHighway(s);
  s.players[0].km=1800;
  const moved=renderChaosHighway(s),scenic=renderChaosScenery(regions[i]);
  assert.notEqual(moved,html,'vehicle location changes with genuine mileage');
  assert.ok(html.includes(scenic)&&moved.includes(scenic),'fixed scenery must not move with players');
  assert.equal(s.leg,before.leg);
  assert.deepEqual(s.players[0].hand,before.players[0].hand);
  const hidden=renderChaosGame({game:s,revealed:false});
  assert.match(hidden,/Pass the device/);
  assert.match(hidden,/ccc-illustrated-scenery/);
  assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move|data-chaos-action="draw"/);
 }
});
test('CCC-ART-5: vectors are transparent, local, self-contained, accessible and high-contrast safe',async()=>{
 const root=resolve(import.meta.dirname,'..');
 const source=await readFile(resolve(root,'core/chaos-region-scenery.js'),'utf8');
 const css=await readFile(resolve(root,'ccc-tabletop.css'),'utf8');
 const build=await readFile(resolve(root,'scripts/build.mjs'),'utf8');
 const gate=await readFile(resolve(root,'scripts/qualify-web.mjs'),'utf8');
 for(const region of regions){
  const art=renderChaosScenery(region);
  assert.match(art,/pointer-events="none"/);
  assert.match(art,/aria-hidden="true"/);
  assert.match(art,/<path/);
  assert.match(art,/<text/);
  assert.doesNotMatch(art,/<image|<script|<foreignObject|url\(|href=|https?:\/\/|<animate|<style/i);
  assert.doesNotMatch(art,/<rect[^>]*width="960"[^>]*height="415"/);
 }
 assert.match(css,/\.ccc-scenery-label/);
 assert.match(css,/\.ccc-illustrated-scenery\{display:none\}/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/@keyframes ccc-scenery/);
 assert.match(gate,/CHAOS_SCENERY_COUNT!==8/);
 assert.match(gate,/baseTotal:1125\*1024/);
 assert.match(build,/CHAOS_MAP_ASSETS/);
 assert.ok(Buffer.byteLength(source)<12*1024);
});
