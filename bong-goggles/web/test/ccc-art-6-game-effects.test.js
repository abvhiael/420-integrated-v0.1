import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame,takeChaosTurn,HAZARDS,FIXES,UPGRADES,LEGENDARIES} from '../core/cross-country-chaos.js';
import {chaosRoutePosition,renderChaosHighway} from '../core/chaos-board.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {deriveChaosGameEffects,renderChaosGameEffects,renderChaosFinishEffects,chaosEffectKinds}
 from '../core/chaos-game-effects.js';
import {chaosMotionFrames,playChaosMotion} from '../core/chaos-motion.js';

const names=['Annie','Bobby','Casey','Dee'];
const start=n=>createChaosGame({names:names.slice(0,n),seed:19});
let serial=91000;
const c=(type,x={})=>({type,uid:++serial,...x});
const turn=(g,action,extra={})=>takeChaosTurn(g,{player:g.players[g.turn].id,action,...extra});
const kinds=fx=>fx?.events.map(x=>x.kind)||[];
const main=fx=>fx?.events[0];

test('CCC-ART-6: cosmetic effect catalogue is closed, immutable, and never mutates the rules state',()=>{
 const old=start(2);
 const state=structuredClone(old);
 assert.deepEqual(chaosEffectKinds(),['drive','breakdown','detour','slowdown','defended','repair',
  'shortcut','power','legendary','shield','checkpoint','finish']);
 assert.ok(Object.isFrozen(chaosEffectKinds()));
 assert.equal(deriveChaosGameEffects(null,state,{action:'drive',index:0}),null);
 assert.equal(deriveChaosGameEffects(state,state,null),null);
 assert.equal(deriveChaosGameEffects(state,state,{action:'draw'}),null);
 assert.deepEqual(old,state);
});
test('CCC-ART-6: normal and risky drives animate actual positive mileage but preserve regional hazard resolution',()=>{
 for(const km of [100,500]){
  const old=start(3);
  old.players[0].hand[0]=c('mileage',{km});
  const snapshot=structuredClone(old);
  const after=turn(old,'drive',{index:0});
  const fx=deriveChaosGameEffects(old,after,{action:'drive',index:0});
  assert.equal(main(fx).kind,'drive');
  assert.deepEqual(main(fx).seats,[0]);
  assert.equal(fx.moves[0].id,0);
  assert.equal(fx.moves[0].from,0);
  assert.equal(fx.moves[0].to,after.players[0].km);
  if(km>300){
   assert.ok(kinds(fx).some(k=>['breakdown','detour','slowdown','defended'].includes(k)));
  }
  assert.deepEqual(old,snapshot,'deriving animations does not consume RNG or mutate the original state');
  assert.ok(Object.isFrozen(fx)&&Object.isFrozen(fx.moves)&&Object.isFrozen(fx.events));
 }
});
test('CCC-ART-6: incoming block, slow and permanent detour display the true target and loss',()=>{
 for(const kind of ['block','slow','detour']){
  const before=start(2);
  const hazard=HAZARDS.east.find(h=>h.kind===kind);
  before.players[0].hand[0]=c('hazard',hazard);
  before.players[1].played=[c('mileage',{km:500})];before.players[1].km=500;
  const after=turn(before,'hazard',{index:0,target:1});
  const fx=deriveChaosGameEffects(before,after,{action:'hazard',index:0,target:1});
  assert.ok(fx,'public status must create visible effect');
  assert.equal(main(fx).kind,kind==='block'?'breakdown':kind==='slow'?'slowdown':'detour');
  assert.deepEqual(main(fx).seats,[1]);
  if(kind==='detour'){
   assert.equal(after.players[1].status,null);
   assert.ok(after.players[1].detourLoss>0);
   assert.ok(fx.moves.some(m=>m.id===1&&m.to<m.from),'detour animates the backwards movement');
   assert.match(main(fx).detail,/Permanent|this stage/);
  }else assert.equal(after.players[1].status.kind,kind);
 }
});
test('CCC-ART-6: real equipment and legendary shields block a hazard without a fake breakdown',()=>{
 for(const protect of ['upgrade','shield']){
  const before=start(2),hazard=HAZARDS.east.find(h=>h.kind==='block');
  before.players[0].hand[0]=c('hazard',hazard);
  if(protect==='upgrade')before.players[1].upgrades=[c('upgrade',UPGRADES.find(u=>u.category===hazard.category))];
  else before.players[1].shield=1;
  const after=turn(before,'hazard',{index:0,target:1});
  const fx=deriveChaosGameEffects(before,after,{action:'hazard',index:0,target:1});
  assert.deepEqual(kinds(fx),['defended']);
  assert.equal(after.players[1].status,null);
  assert.equal(fx.moves.length,0);
  if(protect==='upgrade')assert.equal(after.players[1].used.length,1);
  else assert.equal(after.players[1].shield,0);
 }
});
test('CCC-ART-6: real repairs, emergency recovery and 150 km shortcut have different truthful cues',()=>{
 const trouble=HAZARDS.east.find(h=>h.kind==='block');
 let before=start(2);before.players[0].status=c('hazard',trouble);
 const fix=FIXES.find(f=>f.category===trouble.category);
 before.players[0].hand[0]=c('fix',fix);
 let after=turn(before,'fix',{index:0});
 let fx=deriveChaosGameEffects(before,after,{action:'fix',index:0});
 assert.deepEqual(kinds(fx),['repair']);
 assert.equal(after.players[0].status,null);
 before=start(2);before.players[0].status=c('hazard',trouble);
 after=turn(before,'recover');
 fx=deriveChaosGameEffects(before,after,{action:'recover'});
 assert.deepEqual(kinds(fx),['repair']);
 assert.match(main(fx).detail,/normal action/);
 before=start(2);before.players[0].hand[0]=c('fix',FIXES.find(f=>f.id==='atlas'));
 before.players[0].detourLoss=200;
 after=turn(before,'fix',{index:0});
 fx=deriveChaosGameEffects(before,after,{action:'fix',index:0});
 assert.deepEqual(kinds(fx),['shortcut']);
 assert.equal(after.players[0].km,0,'permanent detour still clamps effective mileage');
 assert.equal(after.players[0].bonusKm,150);
 assert.equal(fx.moves.length,0,'never animate movement not earned');
});
test('CCC-ART-6: freshly drawn power replacement still triggers its true equipment installation effect',()=>{
 const before=start(2),power=c('upgrade',UPGRADES.find(u=>u.id==='winter-tires'));
 before.players[0].hand[0]=power;before.fresh=[power.uid];
 const after=turn(before,'power',{index:0});
 assert.equal(after.players[0].hand.length,before.players[0].hand.length,'free power gets replacement draw');
 assert.ok(after.players[0].upgrades.some(u=>u.uid===power.uid));
 const fx=deriveChaosGameEffects(before,after,{action:'power',index:0});
 assert.deepEqual(kinds(fx),['power']);
 assert.match(main(fx).detail,/Canadian Winter Tires/);
 assert.equal(fx.moves.length,0);
});
test('CCC-ART-6: all four unique legendaries announce activation and only observed side effects',()=>{
 for(const legend of LEGENDARIES){
  const before=start(3),power=c('legendary',legend);
  before.players[0].hand[0]=power;before.fresh=[power.uid];
  if(legend.id==='truck')before.players[0].status=c('hazard',{...HAZARDS.east.find(h=>h.kind==='block')});
  if(legend.id==='sunshine')before.players[1].status=c('hazard',{...HAZARDS.east.find(h=>h.category==='weather')});
  const after=turn(before,'power',{index:0});
  const fx=deriveChaosGameEffects(before,after,{action:'power',index:0});
  assert.ok(fx,'legendary '+legend.id);
  assert.equal(main(fx).kind,'legendary');
  assert.equal(main(fx).detail,legend.name);
  assert.ok(after.retiredLegendaries.includes(legend.id));
  if(legend.id==='rodeo'){
   assert.ok(kinds(fx).includes('shield'));
   assert.equal(after.players[0].shield,2);
  }
  if(legend.id==='truck'||legend.id==='sunshine')assert.ok(kinds(fx).includes('repair'));
  if(legend.id==='shortcut'){
   assert.ok(fx.moves.some(m=>m.id===0),'movement depends on effective gain');
   const sideEffect=kinds(fx).filter(k=>['breakdown','detour','slowdown','defended'].includes(k));
   assert.ok(sideEffect.length<=1,'random regional hazard must resolve exactly once');
  }
 }
});
test('CCC-ART-6: Station Wagon automatic repair after discard remains attributed to the next driver',()=>{
 let before=start(2);
 const repair=UPGRADES.find(u=>u.id==='station-wagon');
 before.players[1].upgrades=[c('upgrade',repair)];
 before.players[1].status=c('hazard',{...HAZARDS.east.find(h=>h.kind==='block'&&h.category==='mechanical')});
 before=turn(before,'pass');
 before=turn(before,'discard',{index:0});
 const after=turn(before,'discard',{index:0});
 const fx=deriveChaosGameEffects(before,after,{action:'discard',index:0});
 assert.deepEqual(kinds(fx),['repair']);
 assert.deepEqual(main(fx).seats,[1]);
 assert.equal(after.players[1].status,null);
});
test('CCC-ART-6: finish line marker precedes genuine end-of-round celebration and champions derive from standings',()=>{
 let state=start(2);
 state.players[0].played=[c('mileage',{km:2400})];state.players[0].km=2400;
 state.players[0].hand[0]=c('mileage',{km:100});
 let before=state,after=turn(state,'drive',{index:0});
 let fx=deriveChaosGameEffects(before,after,{action:'drive',index:0});
 assert.ok(kinds(fx).includes('checkpoint'));
 assert.ok(!kinds(fx).includes('finish'),'a 2500-km hit does not prematurely award championship points');
 assert.equal(after.phase,'playing');
 before=after;after=turn(after,'discard',{index:0});
 assert.equal(after.phase,'playing');
 before=after;after=turn(after,'pass');
 before=after;after=turn(after,'discard',{index:0});
 before=after;after=turn(after,'discard',{index:0});
 fx=deriveChaosGameEffects(before,after,{action:'discard',index:0});
 assert.equal(after.phase,'between');
 assert.deepEqual(kinds(fx),['finish']);
 assert.deepEqual(main(fx).seats,after.results[0].winners);
 const finish=renderChaosFinishEffects(fx);
 assert.match(finish,/ccc-finish-celebration/);
 assert.match(finish,/Regional stage complete/);
 assert.equal((finish.match(/ccc-finish-confetti-piece ccc-finish-confetti-piece--/g)||[]).length,14);
 const ui=renderChaosGame({game:after,revealed:false,effects:fx});
 assert.match(ui,/ccc-finish-celebration/);
 assert.match(ui,/Regional finish line/);
 assert.doesNotMatch(ui,/ccc-hand-card|data-chaos-move/);
});
test('CCC-ART-6: SVG frames match the exact highway, lane offsets and both movement directions',()=>{
 for(const region of ['east','ontario','west']){
  for(const seats of [2,3,4]){
   for(let seat=0;seat<seats;seat++){
    const frames=chaosMotionFrames(region,100,1900,seat,seats);
    const old=chaosRoutePosition(region,100),end=chaosRoutePosition(region,1900);
    const lane=(seat-(seats-1)/2)*15;
    assert.equal(frames[0].x,Math.round((old.x-Math.sin(old.angle*Math.PI/180)*lane)*100)/100);
    assert.equal(frames.at(-1).y,Math.round((end.y+Math.cos(end.angle*Math.PI/180)*lane)*100)/100);
    assert.ok(frames.length>=3&&frames.length<=29);
    assert.ok(frames.some(f=>f.y!==frames[0].y),'actual curves, not straight screen interpolation');
    assert.deepEqual(chaosMotionFrames(region,1900,100,seat,seats).at(-1),frames[0]);
   }
  }
 }
 assert.throws(()=>chaosMotionFrames('east',0,50,4,2),/Invalid cosmetic/);
 assert.throws(()=>chaosMotionFrames('east',NaN,50,0,2),/Invalid cosmetic/);
 assert.throws(()=>chaosMotionFrames('unknown',0,50,0,2),/Unknown highway/);
});
test('CCC-ART-6: browser playback creates route-aligned SVG translate/rotate and skips all reduced-motion settings',()=>{
 const created=[];
 const mk=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;},appendChild(x){this.child=x;}});
 const direction=mk(),group={...mk(),querySelector:()=>direction};
 const root={ownerDocument:{createElementNS:(ns,name)=>{
  assert.equal(ns,'http://www.w3.org/2000/svg');assert.equal(name,'animateTransform');
  const result=mk();created.push(result);return result;
 }},querySelector:sel=>sel==='.ccc-map-vehicle--0'?group:null};
 const g=start(2);
 const fx={moves:[{id:0,from:100,to:1200}]};
 assert.equal(playChaosMotion(root,fx,g,{reducedMotion:true}),0);
 assert.equal(created.length,0);
 assert.equal(playChaosMotion(root,fx,g),1);
 assert.equal(created.length,2);
 assert.equal(created[0].attrs.type,'translate');
 assert.equal(created[1].attrs.type,'rotate');
 assert.equal(created[0].attrs.fill,'remove');
 assert.equal(created[1].attrs.dur,created[0].attrs.dur);
 assert.equal(created[0].attrs.values.split(';').length,
  chaosMotionFrames('east',100,1200,0,2).length);
 assert.equal(playChaosMotion(root,null,g),0);
});
test('CCC-ART-6: all effects are public/escaped, purely presentational and never reveal private hands',()=>{
 const old=start(2);
 old.players[0].hand[0]=c('hazard',{...HAZARDS.east[0]});
 const after=turn(old,'hazard',{index:0,target:1});
 const fx=deriveChaosGameEffects(old,after,{action:'hazard',index:0,target:1});
 const hidden=renderChaosGame({game:after,revealed:false,effects:fx});
 const shown=renderChaosGame({game:after,revealed:true,effects:fx});
 for(const html of [hidden,shown]){
  assert.match(html,/ccc-game-effect-aura/);
  assert.match(html,/ccc-effects-rail/);
  assert.ok(html.indexOf('class="ccc-game-effect-auras"')<html.indexOf('class="ccc-map-vehicle'));
 }
 assert.match(hidden,/Pass the device/);
 assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move|data-chaos-action="draw"/);
 assert.match(shown,/ccc-hand-card/);
 const hostile={events:[{kind:'breakdown',seats:[0],title:'<img onerror=1>',detail:'<script>danger()</script>'}]};
 const result=renderChaosGameEffects(hostile);
 assert.doesNotMatch(result,/<script>|<img onerror/);
 assert.match(result,/&lt;script&gt;/);
 assert.match(result,/&lt;img onerror=1&gt;/);
 assert.equal(renderChaosGameEffects({events:[{kind:'bogus',seats:[0],title:'fake',detail:'fake'}]}),'');
});
test('CCC-ART-6: event CSS, preference suppression and bounded production qualification',async()=>{
 const root=resolve(import.meta.dirname,'..');
 const css=await readFile(resolve(root,'ccc-tabletop.css'),'utf8');
 const app=await readFile(resolve(root,'app.js'),'utf8');
 const gate=await readFile(resolve(root,'scripts/qualify-web.mjs'),'utf8');
 const engine=await readFile(resolve(root,'core/cross-country-chaos.js'),'utf8');
 for(const marker of ['ccc-game-effect--breakdown','ccc-game-effect--detour','ccc-game-effect--repair',
  'ccc-game-effect--power','ccc-game-effect--legendary','ccc-finish-celebration','ccc-finish-confetti-piece'])
  assert.ok(css.includes(marker),marker);
 for(const marker of ['prefers-reduced-motion:reduce','[data-motion="reduce"]','forced-colors:active'])
  assert.ok(css.includes(marker));
 assert.match(app,/chaosEffects=deriveChaosGameEffects\(previous,updated,move\)/);
 assert.match(app,/playChaosMotion\(root,effect,chaosGame,\{reducedMotion:reduced\}\)/);
 assert.match(app,/chaosEffects=null;chaosRepairCue=null/);
 assert.match(gate,/baseTotal:1093\*1024/);
 assert.match(gate,/^const limits=Object\.freeze\(\{singleJs:/m,'asset cap declaration must remain executable');
 assert.match(gate,/chaosEffectKinds\(\).length!==12/);
 assert.match(gate,/!tabletopCss.includes\('\[data-motion="reduce"\]'\)/);
 assert.doesNotMatch(engine,/import .*chaos-game-effects|animationState|animateTransform/);
});
