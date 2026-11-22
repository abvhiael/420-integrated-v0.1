import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame} from '../core/cross-country-chaos.js';
import {chaosMapArt,CHAOS_MAP_ART,CHAOS_MAP_ASSETS,CHAOS_MAP_DIMENSIONS} from '../core/chaos-map-art.js';
import {chaosRoutePosition,renderChaosHighway} from '../core/chaos-board.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {verifyMapRegistry,verifyChaosMapArt} from '../scripts/verify-chaos-map-art.mjs';

const root=resolve(import.meta.dirname,'..');
const regions=['east','ontario','west'];
test('CCC-ART-2: all six uploaded WebPs are exact approved masters: format, dimensions, alpha, size and Git blob integrity',async()=>{
 const result=await verifyChaosMapArt();
 assert.deepEqual(result,{regions:3,layers:6,expectedBytes:2646094,verifiedBytes:2646094});
 assert.deepEqual(verifyMapRegistry(),{regions:3,layers:6,expectedBytes:2646094});
 assert.deepEqual(CHAOS_MAP_DIMENSIONS,{width:1920,height:830,svgWidth:960,svgHeight:415});
 assert.equal(new Set(CHAOS_MAP_ASSETS.map(a=>a.path)).size,6);
 assert.ok(CHAOS_MAP_ASSETS.every(a=>a.url==='/'+a.path&&a.path.endsWith('.webp')));
 assert.ok(CHAOS_MAP_ASSETS.reduce((n,a)=>n+a.bytes,0)<=12*1024*1024);
});
test('CCC-ART-2: map registry is an immutable region-specific allowlist, never a user-constructed URL',()=>{
 assert.ok(Object.isFrozen(CHAOS_MAP_ART));
 assert.ok(Object.isFrozen(CHAOS_MAP_ASSETS));
 for(const region of regions){
  const entry=chaosMapArt(region);
  assert.ok(Object.isFrozen(entry)&&Object.isFrozen(entry.underlay)&&Object.isFrozen(entry.foreground));
  assert.equal(entry.region,region);
  assert.equal(entry.underlay.transparent,false);
  assert.equal(entry.foreground.transparent,true);
  assert.deepEqual([entry.underlay.width,entry.underlay.height],[1920,830]);
  assert.deepEqual([entry.foreground.width,entry.foreground.height],[1920,830]);
  assert.equal(entry.underlay.path,'assets/games/cross-country-chaos/maps/'+region+'-atlas-underlay.webp');
  assert.equal(entry.foreground.path,'assets/games/cross-country-chaos/maps/'+region+'-atlas-foreground.webp');
 }
 assert.equal(chaosMapArt('__proto__'),null);
 assert.equal(chaosMapArt('other'),null);
 assert.equal(chaosMapArt('../east'),null);
});
test('CCC-ART-2: each printed atlas covers obsolete SVG road, markers and foreground, but not cars',()=>{
 for(let index=0;index<3;index++){
  const state=createChaosGame({names:['Driver A','Driver B','Driver C','Driver D'],seed:113});
  state.leg=index;
  const region=regions[index],map=chaosMapArt(region),html=renderChaosHighway(state);
  const road=html.indexOf('class="ccc-highway-shadow"'),stops=html.indexOf('class="ccc-map-stop"');
  const underlay=html.indexOf('class="ccc-map-underlay"'),cars=html.indexOf('class="ccc-map-vehicle');
  assert.ok(road>=0&&road<stops&&stops<underlay&&underlay<cars,
   'opaque atlas hides obsolete road/stops, but live cars are painted above it');
  assert.equal(html.split('class="ccc-map-underlay"').length-1,1);
  assert.equal(html.split('class="ccc-map-foreground"').length-1,0);
  assert.ok(html.includes('href="'+map.underlay.url+'"'));
  assert.ok(!html.includes('href="'+map.foreground.url+'"'));
  assert.match(html,/preserveAspectRatio="xMidYMid meet"/);
  assert.match(html,/pointer-events="none"/);
  assert.match(html,/viewBox="0 0 960 415"/);
  assert.match(html,/2,500 game km/);
  assert.equal((html.match(/class="ccc-map-stop"/g)||[]).length,[7,9,7][index]);
  assert.equal((html.match(/class="ccc-map-vehicle ccc-map-vehicle--/g)||[]).length,4);
  for(const other of regions.filter(x=>x!==region))
   assert.ok(!html.includes(other+'-atlas-underlay.webp'));
 }
});

test('CCC-ART-2: atlas layers appear with public board during private handoff without exposing hidden cards',()=>{
 const game=createChaosGame({names:['Driver One','Driver Two'],seed:4});
 const hidden=renderChaosGame({game,revealed:false});
 const shown=renderChaosGame({game,revealed:true});
 for(const html of [hidden,shown]){
  assert.match(html,/east-atlas-underlay.webp/);
  assert.doesNotMatch(html,/east-atlas-foreground.webp/);
  assert.match(html,/ccc-highway-road/);
 }
 assert.match(hidden,/Pass the device/);
 assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move/);
 assert.match(shown,/ccc-hand-card/);
});
test('CCC-ART-2: mileage traces the approved road right-to-left on all three maps',()=>{
 const expected={east:[873,110],ontario:[914,44],west:[908,104]};
 for(const region of regions){
  const a=chaosRoutePosition(region,0),b=chaosRoutePosition(region,1250),c=chaosRoutePosition(region,2500);
  assert.equal(a.x,expected[region][0]);
  assert.equal(c.x,expected[region][1]);
  assert.ok(a.x>b.x&&b.x>c.x,region);
  assert.deepEqual(chaosRoutePosition(region,-40),a);
  assert.deepEqual(chaosRoutePosition(region,3500),c);
  assert.equal(b.progress,.5);
  for(let km=0;km<=2500;km+=50){
   const pos=chaosRoutePosition(region,km);
   assert.ok(pos.x>=0&&pos.x<=960&&pos.y>=0&&pos.y<=415);
   assert.ok(Number.isFinite(pos.angle));
  }
 }
});

test('CCC-ART-2: production bundle copies only pinned maps, with their own budget and decorative forced-colours fallback',async()=>{
 const css=await readFile(resolve(root,'classics.css'),'utf8');
 const build=await readFile(resolve(root,'scripts/build.mjs'),'utf8');
 const gate=await readFile(resolve(root,'scripts/qualify-web.mjs'),'utf8');
 assert.match(css,/\.ccc-map-underlay/);
 assert.match(css,/\.ccc-map-foreground/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/\.ccc-map-foreground\{display:none\}/);
 assert.match(build,/await verifyChaosMapArt\(\)/);
 assert.match(build,/for\(const layer of CHAOS_MAP_ASSETS\)/);
 assert.match(gate,/mapTotal:12\*1024\*1024/);
 assert.match(gate,/mapFiles.length!==6/);
 assert.match(gate,/Boolean\(meta.hasAlpha\)!==asset.transparent/);
 assert.match(gate,/!mapAllowlist.has\(name\)/);
});
