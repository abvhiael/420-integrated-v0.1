import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame,takeChaosTurn,advanceChaosLeg} from '../core/cross-country-chaos.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {renderChaosHighway,chaosRoutePosition} from '../core/chaos-board.js';
import {CHAOS_VEHICLES,CHAOS_VEHICLE_COLORS,CHAOS_VEHICLE_ASSETS,CHAOS_VEHICLE_SOURCE_SHA,
 chaosVehicle,chaosVehicleHeading,applyChaosVehicleSelection} from '../core/chaos-vehicles.js';
import {verifyChaosVehicleArt} from '../scripts/verify-chaos-vehicle-art.mjs';

const root=resolve(import.meta.dirname,'..');
const start=n=>createChaosGame({names:['A','B','C','D'].slice(0,n),seed:42});
test('CCC-ART-3: exactly six self-contained 100×64 transparent illustrated vehicle SVGs have pinned identities',async()=>{
 assert.deepEqual(await verifyChaosVehicleArt(),{tokens:6,bytes:7795,transparent:true,orientation:'eight-way live vector'});
 assert.equal(CHAOS_VEHICLES.length,6);
 assert.equal(new Set(CHAOS_VEHICLES.map(v=>v.id)).size,6);
 assert.equal(new Set(CHAOS_VEHICLE_ASSETS).size,6);
 assert.ok(Object.isFrozen(CHAOS_VEHICLES)&&Object.isFrozen(CHAOS_VEHICLE_COLORS)&&Object.isFrozen(CHAOS_VEHICLE_SOURCE_SHA));
 for(const v of CHAOS_VEHICLES){
  assert.ok(Object.isFrozen(v));
  assert.match(v.id,/^[a-z-]+$/);
  assert.equal(v.src,'/assets/games/cross-country-chaos/vehicles/'+v.id+'.svg');
  assert.match(CHAOS_VEHICLE_SOURCE_SHA[v.id],/^[0-9a-f]{40}$/);
  const svg=await readFile(resolve(root,v.src.slice(1)),'utf8');
  assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/viewBox="0 0 100 64"/);
  assert.match(svg,/<path/);
  assert.doesNotMatch(svg,/\b(onload|onclick|href|src)=|<script|<foreignObject|<style|<image|<animate|<use/i);
  assert.doesNotMatch(svg,/<rect[^>]*width="100"[^>]*height="64"/);
 }
});
test('CCC-ART-3: vehicle selection is available for every human player, six choices per player, with live preview',()=>{
 const html=renderChaosGame();
 assert.equal((html.match(/data-chaos-vehicle-pick="/g)||[]).length,4);
 assert.equal((html.match(/class="ccc-vehicle-picker-preview"/g)||[]).length,4);
 assert.equal((html.match(/class="ccc-driver-setup"/g)||[]).length,4);
 for(let i=0;i<4;i++){
  const section=html.split('data-chaos-driver="'+i+'"')[1].split('</div>')[0];
  assert.equal((section.match(/<option value="/g)||[]).length,6);
  assert.match(section,new RegExp('name="vehicle'+i+'"'));
  assert.ok(section.includes(chaosVehicle(null,i).src));
 }
 for(const v of CHAOS_VEHICLES)assert.ok(html.includes(v.name));
});
test('CCC-ART-3: rejecting forged vehicles leaves rules unchanged; selected cosmetics persist across draw, turns and stages',()=>{
 const a=start(4),baseline=structuredClone(a);
 const choices=['pickup','compact','convertible','minibus'];
 assert.throws(()=>applyChaosVehicleSelection(a,choices.slice(0,3)),/Choose a vehicle/);
 assert.throws(()=>applyChaosVehicleSelection(a,['../evil',...choices.slice(1)]),/Unknown/);
 assert.deepEqual(a,baseline,'validation failures must not mutate the deterministic game');
 applyChaosVehicleSelection(a,choices);
 for(let i=0;i<4;i++)assert.equal(a.players[i].vehicle,choices[i]);
 assert.equal(a.seed,baseline.seed);
 assert.deepEqual(a.deck,baseline.deck);
 assert.deepEqual(a.legendaryByLeg,baseline.legendaryByLeg);
 assert.deepEqual(a.players.map(p=>p.hand),baseline.players.map(p=>p.hand));
 const after=takeChaosTurn(a,{player:0,action:'pass'});
 assert.deepEqual(after.players.map(p=>p.vehicle),choices,'turn clones retain cosmetic vehicle IDs');
 after.phase='between';
 const next=advanceChaosLeg(after);
 assert.equal(next.leg,1);
 assert.deepEqual(next.players.map(p=>p.vehicle),choices,'stage resets keep each player selected vehicle');
 assert.deepEqual(next.players.map(p=>p.km),[0,0,0,0]);
});
test('CCC-ART-3: 2–4 game drivers receive distinct coloured numbers, shadows and transparent original pieces',()=>{
 const vehicles=['wagon','compact','pickup','camper'];
 for(const count of [2,3,4]){
  const game=start(count);
  applyChaosVehicleSelection(game,vehicles.slice(0,count));
  const html=renderChaosHighway(game);
  assert.equal((html.match(/class="ccc-map-vehicle ccc-map-vehicle--/g)||[]).length,count);
  assert.equal((html.match(/class="ccc-vehicle-ground-shadow"/g)||[]).length,count);
  assert.equal((html.match(/class="ccc-vehicle-seat-halo"/g)||[]).length,count);
  assert.equal((html.match(/class="ccc-vehicle-art"/g)||[]).length,count);
  assert.equal((html.match(/class="ccc-vehicle-number-disc"/g)||[]).length,count);
  for(let i=0;i<count;i++){
   assert.ok(html.includes(chaosVehicle(vehicles[i],i).src));
   assert.ok(html.includes('stroke="'+CHAOS_VEHICLE_COLORS[i]+'"'));
   assert.ok(html.includes('>'+String(i+1)+'</text>'));
   assert.ok(html.includes(chaosVehicle(vehicles[i]).name));
  }
  assert.match(html,/pointer-events="none"/);
  assert.match(html,/preserveAspectRatio="xMidYMid meet"/);
  assert.match(html,/ccc-highway-shadow/);
  assert.match(html,/ccc-highway-centre/);
 }
});
test('CCC-ART-3: vehicle heading remains road-aligned through eight directions, including westbound, without rotating player numbers',()=>{
 assert.deepEqual([0,45,90,135,180,225,270,315].map(chaosVehicleHeading),[0,1,2,3,4,5,6,7]);
 assert.equal(chaosVehicleHeading(-90),6);
 assert.equal(chaosVehicleHeading(359),0);
 assert.throws(()=>chaosVehicleHeading(NaN),/Invalid highway direction/);
 for(let leg=0;leg<3;leg++){
  const state=start(4);state.leg=leg;
  state.players[0].km=1100;
  const before=chaosRoutePosition(['east','ontario','west'][leg],1100);
  const html=renderChaosHighway(state);
  assert.match(html,new RegExp('data-heading="'+chaosVehicleHeading(before.angle)+'" transform="rotate\\('+before.angle+'\\)"'));
  assert.match(html,/class="ccc-map-seat" x="0" y="-21"/);
  assert.equal(html.split('<circle class="ccc-map-stop"').length,1,'stop SVG structure remains unchanged');
 }
});
test('CCC-ART-3: selected vehicle labels are public, while hands remain private and invalid IDs are safely replaced',()=>{
 const state=start(2);
 applyChaosVehicleSelection(state,['camper','minibus']);
 state.players[0].hand[0]={type:'fix',id:'toolbox',name:'SECRET_CARD_550',uid:900,category:'mechanical'};
 const hidden=renderChaosGame({game:state,revealed:false});
 assert.match(hidden,/Prairie Camper/);
 assert.match(hidden,/Touring Minibus/);
 assert.doesNotMatch(hidden,/SECRET_CARD_550|data-chaos-move|ccc-hand-card/);
 const shown=renderChaosGame({game:state,revealed:true});
 assert.match(shown,/SECRET_CARD_550/);
 state.players[0].vehicle='<script>evil</script>';
 assert.ok(!renderChaosHighway(state).includes('<script>'));
 assert.ok(renderChaosHighway(state).includes(CHAOS_VEHICLES[0].src));
});
test('CCC-ART-3: static publishing allows only approved SVGs; browser accessibility and forced-colour fallback remain',async()=>{
 const css=await readFile(resolve(root,'classics.css'),'utf8');
 const build=await readFile(resolve(root,'scripts/build.mjs'),'utf8');
 const qualify=await readFile(resolve(root,'scripts/qualify-web.mjs'),'utf8');
 const app=await readFile(resolve(root,'app.js'),'utf8');
 assert.match(css,/\.ccc-driver-setup\[hidden\]/);
 assert.match(css,/\.ccc-vehicle-ground-shadow|\.ccc-vehicle-art/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/\.ccc-vehicle-art\{display:none\}/);
 assert.match(build,/await verifyChaosVehicleArt\(\)/);
 assert.match(build,/CHAOS_VEHICLE_ASSETS/);
 assert.match(qualify,/vehicleTotal:16\*1024/);
 assert.match(qualify,/vehicleAllowlist\.size!==6/);
 assert.match(qualify,/Published vehicle token differs from approved source/);
 assert.match(app,/applyChaosVehicleSelection/);
 assert.match(app,/data-chaos-vehicle-pick/);
 assert.match(app,/data-chaos-driver/);
});
