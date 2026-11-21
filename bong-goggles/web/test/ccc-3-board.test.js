import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
 LEGS,HAZARDS,FIXES,UPGRADES,LEGENDARIES,
 createChaosGame,takeChaosTurn,advanceChaosLeg
} from '../core/cross-country-chaos.js';
import {chaosCardArt} from '../core/chaos-card-art.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {chaosRoutePosition,renderChaosHighway,renderChaosTable,keepChaosHandRevealed} from '../core/chaos-board.js';

const names=['Alice','Bob','Charlie','Dana'];
let uid=100000;
const fixture=(type,props={})=>({type,uid:++uid,...props});
const starter=(n=4)=>createChaosGame({names:names.slice(0,n),seed:42});
const replace=(s,seat,card)=>{s.players[seat].hand[0]=card;return s;};
const play=(s,action,rest={})=>takeChaosTurn(s,{player:s.players[s.turn].id,action,...rest});
const moveTo=(s,seat)=>{s.turn=seat;s.step='play';return s;};
const mileage=(p,km=1000)=>{p.played=[fixture('mileage',{km})];p.km=km;};

test('CCC-3: all three 2,500-km route maps have their own scenery and named schematic highway stops',()=>{
 const stops=[["St. John's",'Gander','FERRY','Montréal'],['Ottawa','North Bay','Lake Superior','Kenora'],['Winnipeg','Regina','ROCKIES','Vancouver']];
 for(let leg=0;leg<3;leg++){
  const s=starter();s.leg=leg;
  const html=renderChaosHighway(s);
  assert.match(html,new RegExp('ccc-highway--'+LEGS[leg].id));
  assert.match(html,/2,500 game km/);
  assert.match(html,/schematic, not to scale/);
  assert.match(html,/role="img"/);
  assert.match(html,/class="ccc-highway-centre"/);
  for(const stop of stops[leg])assert.ok(html.toLowerCase().includes(stop.replaceAll("'",'&#39;').toLowerCase()),stop);
  assert.equal((html.match(/class="ccc-map-vehicle /g)||[]).length,4);
  assert.equal((html.match(/class="ccc-road-driver"/g)||[]).length,4);
 }
});
test('CCC-3: car positions follow cumulative road distance, clamp negative/overshoot and offset overlapping seats',()=>{
 for(const leg of LEGS){
  const start=chaosRoutePosition(leg.id,0),middle=chaosRoutePosition(leg.id,1250),end=chaosRoutePosition(leg.id,2500);
  assert.deepEqual(chaosRoutePosition(leg.id,-100),start);
  assert.deepEqual(chaosRoutePosition(leg.id,9000),end);
  assert.ok(start.x<middle.x&&middle.x<end.x,leg.id);
  assert.equal(start.progress,0);assert.equal(middle.progress,.5);assert.equal(end.progress,1);
  assert.ok(Number.isFinite(middle.angle)&&Number.isFinite(middle.y));
  assert.throws(()=>chaosRoutePosition('fake',100),/Unknown highway/);
  assert.throws(()=>chaosRoutePosition(leg.id,NaN),/invalid mileage/);
  const s=starter();s.leg=LEGS.indexOf(leg);
  const origin=renderChaosHighway(s);
  const positions=[...origin.matchAll(/class="ccc-map-vehicle ccc-map-vehicle--\d" transform="translate\(([^)]+)\)"/g)].map(m=>m[1]);
  assert.equal(positions.length,4);
  assert.equal(new Set(positions).size,4,'multiple cars at start must be individually visible');
  s.players[2].km=1800;
  assert.notEqual(renderChaosHighway(s),origin);
  assert.match(renderChaosHighway(s),/1,800 km/);
 }
});
test('CCC-3: 2, 3 and 4 human players each have public boards, distinct vehicle tokens, and a seven-card private hand',()=>{
 for(const n of [2,3,4]){
  const s=starter(n),html=renderChaosGame({game:s,revealed:true});
  assert.equal((html.match(/class="ccc-seat-mat/g)||[]).length,n);
  assert.equal((html.match(/class="ccc-map-vehicle ccc-map-vehicle/g)||[]).length,n);
  assert.equal((html.match(/class="ccc-hand-card/g)||[]).length,7);
  assert.match(html,/Regional draw deck/);
  assert.match(html,/Face-up discard/);
  assert.match(html,/Recently played cards/);
  assert.match(html,/Vehicle equipment/);
  assert.match(html,/Road conditions/);
  assert.match(html,/Mileage · highest first/);
 }
});
test('CCC-3: handoff hides all players private cards while public hazards, used cards and mileage remain displayed',()=>{
 const s=starter();
 const secret='PRIVATE_HIDDEN_CARD_982';
 const foreign='OPPONENT_HIDDEN_CARD_619';
 s.players[0].hand[0]=fixture('fix',{id:'toolbox',name:secret,category:'mechanical'});
 s.players[1].hand[0]=fixture('fix',{id:'jerry',name:foreign,category:'fuel'});
 mileage(s.players[1],700);
 s.players[1].status={...HAZARDS.east[0],type:'hazard'};
 s.spent=[fixture('fix',{...FIXES[2],name:'Public Plow Repair'})];
 s.discard=[fixture('mileage',{km:400})];
 const hidden=renderChaosGame({game:s,revealed:false});
 assert.match(hidden,/Pass the device/);
 assert.match(hidden,/ccc-highway/);
 assert.match(hidden,/mileage-700|mileage/);
 assert.match(hidden,/hazard-east-ferry-cancelled\.webp/);
 assert.match(hidden,/fix-plows\.webp/);
 assert.match(hidden,/mileage-400\.webp/);
 assert.doesNotMatch(hidden,/PRIVATE_HIDDEN_CARD_982|OPPONENT_HIDDEN_CARD_619|ccc-hand-card|data-chaos-move/);
 const revealed=renderChaosGame({game:s,revealed:true});
 assert.match(revealed,/PRIVATE_HIDDEN_CARD_982/);
 assert.doesNotMatch(revealed,/OPPONENT_HIDDEN_CARD_619/);
});
test('CCC-3: visible vehicle equipment, loss counters, hazard cards and mileage denomination stacks track public state',()=>{
 const s=starter();
 s.players[0].played=[
  fixture('mileage',{km:500}),fixture('mileage',{km:250}),
  fixture('mileage',{km:500}),fixture('mileage',{km:100})
 ];
 s.players[0].km=1050;s.players[0].detourLoss=200;s.players[0].slowLoss=100;
 s.players[0].upgrades=[fixture('upgrade',{...UPGRADES[2]})];
 s.players[0].used=['winter-tires'];s.players[0].shield=2;
 s.players[0].status={...HAZARDS.east[2],type:'hazard'};
 const table=renderChaosTable(s);
 const mat=table.split('class="ccc-seat-mat')[1].split('</section></div></section>')[0];
 assert.match(mat,/500 km × 2/);
 assert.match(mat,/250 km × 1/);
 assert.match(mat,/100 km × 1/);
 assert.ok(mat.indexOf('500 km × 2')<mat.indexOf('250 km × 1'));
 assert.ok(mat.indexOf('250 km × 1')<mat.indexOf('100 km × 1'));
 assert.match(mat,/Detours −200 km/);
 assert.match(mat,/Slowdowns −100 km/);
 assert.match(mat,/Legendary hazard shields: 2/);
 assert.match(mat,/Winter Tires · Used/);
 assert.match(mat,/hazard-east-fog-thicker-than-pea-soup\.webp/);
 assert.match(mat,/upgrade-winter-tires\.webp/);
});
test('CCC-3: each of 24 regional hazard cards applies the corresponding block, slowdown, or irreversible detour and displays its art',()=>{
 for(let leg=0;leg<3;leg++){
  for(const h of HAZARDS[LEGS[leg].id]){
   let s=starter();s.leg=leg;
   mileage(s.players[1],1000);
   s=replace(s,0,fixture('hazard',{...h}));
   s=play(s,'hazard',{index:0,target:1});
   const victim=s.players[1];
   assert.equal(s.step,'discard');
   if(h.kind==='detour'){
    assert.equal(victim.km,1000-h.amount,h.id);
    assert.equal(victim.detourLoss,h.amount,h.id);
    assert.equal(victim.status,null);
    assert.match(renderChaosTable(s),new RegExp('Detours −'+h.amount+' km'));
   }else{
    assert.equal(victim.status.id,h.id);
    assert.equal(victim.km,1000);
    assert.ok(renderChaosTable(s).includes(chaosCardArt({...h,type:'hazard'},LEGS[leg].id)),h.id);
    if(h.kind==='slow'){
     s=moveTo(s,1);
     s=replace(s,1,fixture('mileage',{km:200}));
     s=play(s,'drive',{index:0});
     assert.equal(s.players[1].slowLoss,Math.min(200,h.amount));
     assert.equal(s.players[1].status,null);
     assert.equal(s.players[1].km,1200-Math.min(200,h.amount));
    }else{
     s=moveTo(s,1);
     s=replace(s,1,fixture('mileage',{km:200}));
     assert.throws(()=>play(s,'drive',{index:0}),/Repair the breakdown/);
    }
   }
  }
 }
});
test('CCC-3: every common repair works only on the owner turn and records visible played artwork',()=>{
 for(const fix of FIXES){
  let s=starter();
  const p=s.players[0];mileage(p,500);p.detourLoss=100;p.km=400;
  p.status={...HAZARDS.east[0],type:'hazard'};
  if(fix.id!=='atlas'){
   const category=fix.category==='all'?'mechanical':fix.category;
   p.status={id:'test',type:'hazard',kind:'block',category,name:'Test roadside hazard'};
  }
  s=replace(s,0,fixture('fix',{...fix}));
  const before=s.players[0].status;
  s=play(s,'fix',{index:0});
  if(fix.id==='atlas'){
   assert.deepEqual(s.players[0].status,before);
   assert.equal(s.players[0].bonusKm,150);
   assert.equal(s.players[0].km,550);
  }else{
   assert.equal(s.players[0].status,null,fix.id);
  }
  assert.equal(s.players[0].detourLoss,100,'a repair never refunds detour mileage');
  assert.ok(renderChaosTable(s).includes(chaosCardArt({type:'fix',id:fix.id},'east')),fix.id);
  assert.equal(s.spent.at(-1).id,fix.id);
  const wrong=starter();
  wrong.players[1].status={id:'blocked',name:'Blocked',type:'hazard',kind:'block',category:'mechanical'};
  wrong.players[0].hand[0]=fixture('fix',{...fix});
  assert.throws(()=>takeChaosTurn(wrong,{player:1,action:'fix',index:0}),/Not this driver/);
 }
});
test('CCC-3: all eight upgrades are visible when installed; defenses, auto-recovery and driving boost apply exactly once',()=>{
 for(const up of UPGRADES){
  let s=starter();s=replace(s,0,fixture('upgrade',{...up}));s.fresh=[];
  s=play(s,'power',{index:0});
  assert.equal(s.players[0].upgrades[0].id,up.id);
  assert.ok(renderChaosTable(s).includes(chaosCardArt({type:'upgrade',id:up.id},'east')),up.id);
 }
 const defenses=UPGRADES.filter(u=>!['station-wagon','shortcut-specialist'].includes(u.id));
 for(const up of defenses){
  let s=starter();mileage(s.players[1],1000);
  s.players[1].upgrades=[{...up,type:'upgrade'}];
  const h=up.category==='all'?HAZARDS.east[0]:
   up.category==='navigation'?HAZARDS.east[3]:
    HAZARDS.east.find(q=>q.category===up.category);
  assert.ok(h,up.id);
  s=replace(s,0,fixture('hazard',{...h}));
  s=play(s,'hazard',{index:0,target:1});
  assert.equal(s.players[1].status,null,up.id);
  assert.equal(s.players[1].detourLoss,0,up.id);
  assert.ok(s.players[1].used.includes(up.id),up.id);
  assert.match(renderChaosTable(s),/Used/);
 }
 let wagon=starter();wagon.players[1].upgrades=[{...UPGRADES.find(u=>u.id==='station-wagon'),type:'upgrade'}];
 wagon.players[1].status={id:'flat',name:'Flat Tire',kind:'block',type:'hazard',category:'mechanical'};
 wagon=play(wagon,'pass');
 wagon=play(wagon,'discard',{index:0});wagon=play(wagon,'discard',{index:0});
 assert.equal(wagon.turn,1);assert.equal(wagon.players[1].status,null);
 assert.ok(wagon.players[1].used.includes('station-wagon'));
 let boost=starter();boost.players[0].upgrades=[{...UPGRADES.find(u=>u.id==='shortcut-specialist'),type:'upgrade'}];
 boost=replace(boost,0,fixture('mileage',{km:200}));boost=play(boost,'drive',{index:0,useBoost:true});
 assert.equal(boost.players[0].km,300);assert.ok(boost.players[0].used.includes('shortcut-specialist'));
});
test('CCC-3: each unique legendary card resolves its own effect and appears publicly in the played-card area',()=>{
 for(const card of LEGENDARIES){
  let s=starter();s.fresh=[];
  s.players[0].status={id:'flat',name:'Flat tire',kind:'block',type:'hazard',category:'mechanical'};
  if(card.id==='sunshine'){
   s.players[1].status={...HAZARDS.east[2],type:'hazard'};
   s.players[2].status={...HAZARDS.east[6],type:'hazard'};
  }
  s=replace(s,0,fixture('legendary',{...card}));
  s=play(s,'power',{index:0});
  assert.ok(s.retiredLegendaries.includes(card.id));
  assert.ok(renderChaosTable(s).includes(chaosCardArt({type:'legendary',id:card.id},'east')));
  assert.equal(s.spent.at(-1).id,card.id);
  if(card.id==='truck'){assert.equal(s.players[0].km,100);assert.equal(s.players[0].status,null);}
  if(card.id==='rodeo')assert.equal(s.players[0].shield,2);
  if(card.id==='shortcut'){assert.equal(s.players[0].bonusKm,300);assert.ok(s.players[0].status||s.players[0].detourLoss>=0);}
  if(card.id==='sunshine'){
   assert.equal(s.players[1].status,null);
   assert.equal(s.players[2].status.category,'mechanical');
   assert.equal(s.players[0].km,100);
  }
 }
});
test('CCC-3: all stage transitions replace the highway and visible table but preserve championship points',()=>{
 let s=starter();s.players[0].score=1700;s.players[0].km=2000;
 const a=renderChaosTable(s);
 for(let leg=1;leg<3;leg++){
  s.phase='between';s=advanceChaosLeg(s);
  assert.equal(s.leg,leg);assert.equal(s.players[0].score,1700);
  assert.ok(s.players.every(p=>p.km===0&&p.played.length===0&&!p.upgrades.length&&!p.status));
  const next=renderChaosTable(s);
  assert.notEqual(next,a);
  assert.ok(next.includes('data-region="'+LEGS[leg].id+'"'));
 }
});
test('CCC-3: keep the current player's hand open through draw/play/discard, then hide it at a true seat handoff',()=>{
 let s=starter(2);
 let next=play(s,'pass');
 assert.equal(keepChaosHandRevealed(s,next,true),true);
 assert.equal(keepChaosHandRevealed(s,next,false),false);
 assert.equal(keepChaosHandRevealed(null,next,true),false);
 next=play(next,'discard',{index:0});
 assert.equal(keepChaosHandRevealed(s,next,true),true);
 const previous=next;
 next=play(next,'discard',{index:0});
 assert.equal(next.turn,1);
 assert.equal(keepChaosHandRevealed(previous,next,true),false);
 const afterStage=structuredClone(previous);afterStage.phase='between';
 assert.equal(keepChaosHandRevealed(previous,afterStage,true),false);
 const nextLeg=structuredClone(previous);nextLeg.leg=1;
 assert.equal(keepChaosHandRevealed(previous,nextLeg,true),false);
});
test('CCC-3: renderers escape hostile names, remain wallet-free, and support mobile/reduced-motion/forced-colors styling',async()=>{
 let s=createChaosGame({names:['<b>X</b>','Bob'],seed:5});
 const html=renderChaosGame({game:s,revealed:true});
 assert.doesNotMatch(html,/<b>X<\/b>/);
 assert.match(html,/&lt;b&gt;X&lt;\/b&gt;/);
 assert.doesNotMatch(html,/data-wallet|data-wager|data-bet=/);
 const css=await readFile(resolve(import.meta.dirname,'..','classics.css'),'utf8');
 assert.match(css,/\.ccc-player-table/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/@media\(forced-colors:active\)/);
});
