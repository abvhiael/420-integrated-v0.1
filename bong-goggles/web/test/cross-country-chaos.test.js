import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGS,HAZARDS,FIXES,UPGRADES,LEGENDARIES,createChaosGame,takeChaosTurn,advanceChaosLeg,canFix,chaosLeaders,chaosActionOptions} from '../core/cross-country-chaos.js';
import {CLASSIC_COLLECTIONS,ALL_CLASSICS} from '../core/classics.js';
import {renderChaosGame,renderClassicsCatalogue} from '../core/classics-ui.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {GAME_TYPES} from '../core/games.js';

const start=()=>createChaosGame({names:['Alice','Bob','Charlie','Dana'],seed:54});
const override=(game,player,card)=>{game.players[player].hand=[card];return game;};
test('Canadian Classics catalogue records every approved regional tradition without falsely claiming a rules engine',()=>{
 const c=CLASSIC_COLLECTIONS.find(g=>g.id==='canadian');
 assert.deepEqual(c.games.map(x=>x.title),['Kaiser','Tarabish','Forty-Fives (45s)','120s','Deux Cents (200)','Hola','Rook','Nines','Cross-Country Chaos']);
 assert.equal(c.games.filter(x=>x.status==='local').length,1);
 for(const name of ['Crazy Eights','Euchre','Go Fish','Hearts','Spades','500','Canasta','Rummy','Asshole','Go','Four-Player Mahjong']){
  assert.ok(ALL_CLASSICS.some(x=>x.title===name),name);
 }
 assert.equal(GAME_TYPES.length,7,'do not expand the verified two-player contract enum by pretending 4-player games are canonical');
 assert.match(renderClassicsCatalogue(),/Planned — not yet playable/);
 assert.match(renderClassicsCatalogue(),/Play Cross-Country Chaos/);
});
test('Cross-Country Chaos validates drivers, creates consistent deterministic decks and zero-wager local state',()=>{
 assert.deepEqual(LEGS.map(x=>x.target),[2200,2100,2700]);
 assert.deepEqual(start(),start());
 const s=start();assert.equal(s.players.length,4);
 for(const p of s.players){assert.equal(p.hand.length,5);assert.equal(p.upgrades.length,1);assert.ok(p.legendary);assert.equal(p.points,0);}
 assert.throws(()=>createChaosGame({names:['solo']}),/2–4/);
 assert.throws(()=>createChaosGame({names:['same','SAME']}),/distinct/);
 assert.throws(()=>createChaosGame({names:['Alice','Bob'],seed:-1}),/seed/);
 assert.equal(s.phase,'playing');assert.ok(!('wager' in s));
});
test('regional decks each have hazards across multiple fix categories',()=>{
 assert.equal(Object.keys(HAZARDS).length,3);
 for(const leg of LEGS){const cards=HAZARDS[leg.id];assert.equal(cards.length,8);assert.ok(cards.every(c=>['block','slow','detour'].includes(c.kind)));assert.ok(cards.every(c=>['fuel','road','mechanical','weather','navigation'].includes(c.category)));}
 assert.ok(FIXES.some(f=>f.category==='all'));assert.equal(UPGRADES.length,8);assert.equal(LEGENDARIES.length,4);
 assert.equal(canFix({category:'weather'},{type:'fix',category:'weather'}),true);
 assert.equal(canFix({category:'weather'},{type:'fix',category:'mechanical'}),false);
 assert.equal(canFix(null,{type:'fix',category:'all'}),false);
});
test('one turn consumes a mileage card, draws two, rotates seats and cannot change prior state',()=>{
 const original=override(start(),0,{type:'mileage',km:200});
 const next=takeChaosTurn(original,{player:0,action:'drive',index:0});
 assert.equal(original.players[0].km,0);assert.equal(original.turn,0);
 assert.equal(next.players[0].km,200);assert.equal(next.turn,1);assert.equal(next.players[0].hand.length,2);
 assert.equal(next.turns,1);
 assert.throws(()=>takeChaosTurn(next,{player:0,action:'pass'}),/Not this driver/);
 assert.throws(()=>takeChaosTurn(next,{player:1,action:'teleport'}),/Unsupported action/);
});
test('hazard targeting respects turn, single active block, repairs and emergency recovery',()=>{
 const original=start();original.players[0].hand=[{type:'hazard',id:'flat',name:'Flat Tire',category:'mechanical',kind:'block'}];
 original.players[1].upgrades=[UPGRADES.find(x=>x.id==='road-atlas')];
 const attacked=takeChaosTurn(original,{player:0,action:'hazard',index:0,target:1});
 assert.equal(attacked.players[1].status.name,'Flat Tire');
 assert.throws(()=>takeChaosTurn(original,{player:0,action:'hazard',index:0,target:0}),/opponent/);
 attacked.players[1].hand=[{type:'mileage',km:200},{type:'fix',name:'Spare Tire',category:'mechanical'}];
 assert.throws(()=>takeChaosTurn(attacked,{player:1,action:'drive',index:0}),/Repair/);
 const fixed=takeChaosTurn(attacked,{player:1,action:'fix',index:1});
 assert.equal(fixed.players[1].status,null);
 const emergency=start();emergency.turn=1;emergency.players[1].status={name:'Fog',category:'weather',kind:'slow',amount:100};
 assert.equal(takeChaosTurn(emergency,{player:1,action:'recover'}).players[1].status,null);
 assert.throws(()=>takeChaosTurn(start(),{player:0,action:'recover'}),/No active hazard/);
});
test('one upgrade cancels a matching hazard per stage, without stacking extra turns',()=>{
 const s=start();s.players[0].hand=[{type:'hazard',id:'flat',name:'Pothole',category:'mechanical',kind:'block'}];
 s.players[1].upgrades=[UPGRADES.find(x=>x.id==='duct-tape')];s.players[1].used=[];
 const prevented=takeChaosTurn(s,{player:0,action:'hazard',index:0,target:1});
 assert.equal(prevented.players[1].status,null);assert.ok(prevented.players[1].used.includes('duct-tape'));
});
test('legendary cards are single use; the protection persists only until consumed',()=>{
 const s=start();s.players[0].legendary=LEGENDARIES.find(c=>c.id==='rodeo');
 const shielded=takeChaosTurn(s,{player:0,action:'legendary'});
 assert.equal(shielded.players[0].shield,2);assert.equal(shielded.players[0].legendary,null);
 const none=start();none.players[0].legendary=null;assert.throws(()=>takeChaosTurn(none,{player:0,action:'legendary'}),/No legendary/);
});
test('regional finishing scores accumulate while hazards, mileage and upgrade use reset between trips',()=>{
 let s=start();
 const legendary=s.players.map(p=>p.legendary?.id);
 for(let leg=0;leg<3;leg++){
  const first=s.turn,driver=s.players[first];
  driver.km=LEGS[leg].target-100;
  driver.hand=[{type:'mileage',km:100}];
  const complete=takeChaosTurn(s,{player:first,action:'drive',index:0});
  assert.equal(complete.results.length,leg+1);
  assert.ok(complete.players.some(p=>p.points===5||p.points>5));
  assert.equal(complete.phase,leg===2?'finished':'between');
  if(leg<2){
   s=advanceChaosLeg(complete);
   assert.equal(s.leg,leg+1);assert.equal(s.phase,'playing');
   assert.ok(s.players.every(p=>p.km===0&&!p.status&&p.used.length===0));
   assert.deepEqual(s.players.map(p=>p.legendary?.id),legendary);
   if(leg===0)assert.ok(s.players.every(p=>p.upgrades.length===2));
  }else{
   assert.equal(complete.results.length,3);
   assert.equal(chaosLeaders(complete).length,4);
   assert.throws(()=>advanceChaosLeg(complete),/No completed leg/);
  }
 }
});
test('options and local UI protect unrevealed hands, escape player labels and show regional results',()=>{
 const s=createChaosGame({names:['<img src=x>','Bob'],seed:3});
 const hidden=renderChaosGame({game:s,revealed:false});
 assert.match(hidden,/Pass the device/);assert.doesNotMatch(hidden,/<img src=x>/);
 assert.doesNotMatch(hidden,/Drive 100 km/);
 const shown=renderChaosGame({game:s,revealed:true});
 assert.match(shown,/Vehicle equipment/);assert.match(shown,/ccc-hand/);
 assert.ok(chaosActionOptions(s).some(x=>x.action==='pass'));
 assert.match(renderChaosGame(),/Start the cross-Canada championship/);
 const invalid=renderChaosGame({game:s,revealed:true,error:'<script>alert(1)</script>'});
 assert.doesNotMatch(invalid,/<script>/);
});
test('public local games route stays independent from wallet-only canonical games',()=>{
 assert.equal(resolveRoute('/classics').requiresSession,false);
 assert.equal(routeAccess(resolveRoute('/classics/cross-country-chaos'),{connected:false}).allowed,true);
 const html=renderApplicationShell({pathname:'/classics/cross-country-chaos',walletView:{connected:false}});
 assert.match(html,/Cross-Country Chaos/);
 assert.match(html,/Local pass-and-play only/);
 assert.match(renderApplicationShell({pathname:'/games',walletView:{connected:false}}),/Games require 420Wallet/);
});
