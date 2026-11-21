import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGS,HAZARDS,FIXES,UPGRADES,LEGENDARIES,MILEAGE_COUNTS,STANDARD_DECK_SIZE,regionalDeck,
 createChaosGame,takeChaosTurn,advanceChaosLeg,canFix,chaosLeaders,chaosActionOptions} from '../core/cross-country-chaos.js';
import {CLASSIC_COLLECTIONS,ALL_CLASSICS} from '../core/classics.js';
import {renderChaosGame,renderClassicsCatalogue} from '../core/classics-ui.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {GAME_TYPES} from '../core/games.js';

const start=(count=4,seed=54)=>createChaosGame({names:['Alice','Bob','Charlie','Dana'].slice(0,count),seed});
let fixtureUid=900000;
const card=(type,extra={})=>({type,uid:++fixtureUid,...extra});
const put=(s,player,c,index=0)=>{s.players[player].hand[index]=c;return s;};
const discard=(s,idx=0)=>takeChaosTurn(s,{player:s.turn,action:'discard',index:idx});
const endDiscard=s=>{let result=s;while(result.phase==='playing'&&result.step==='discard')result=discard(result);return result;};
const setDistance=(p,km)=>{p.played=[{type:'mileage',km,uid:123456}];p.km=km;};

test('Canadian Classics catalogue retains planned/registry boundaries without expanding on-chain enum',()=>{
 const group=CLASSIC_COLLECTIONS.find(x=>x.id==='canadian');
 assert.deepEqual(group.games.map(x=>x.title),['Kaiser','Tarabish','Forty-Fives (45s)','120s','Deux Cents (200)','Hola','Rook','Nines','Cross-Country Chaos']);
 assert.equal(group.games.filter(x=>x.status==='local').length,1);
 for(const name of ['Crazy Eights','Euchre','Go Fish','Hearts','Spades','500','Canasta','Rummy','Asshole','Go','Four-Player Mahjong'])
  assert.ok(ALL_CLASSICS.some(x=>x.title===name),name);
 assert.equal(GAME_TYPES.length,7);
 assert.match(renderClassicsCatalogue(),/Planned — not yet playable/);
});
test('all three stages are 2,500 km and use deterministic 7-card opening hands',()=>{
 assert.deepEqual(LEGS.map(x=>x.target),[2500,2500,2500]);
 assert.deepEqual(start(),start());
 const s=start();
 assert.equal(s.version,2);assert.equal(s.phase,'playing');assert.equal(s.step,'play');
 assert.equal(s.players.length,4);assert.ok(!('wager' in s));
 assert.ok(s.players.every(p=>p.hand.length===7&&p.upgrades.length===0&&p.score===0&&!p.status));
 assert.ok(s.players.every(p=>!p.legendary));
 assert.throws(()=>createChaosGame({names:['solo']}),/2–4/);
 assert.throws(()=>createChaosGame({names:['Same','same']}),/distinct/);
 assert.throws(()=>createChaosGame({names:['Alice','Bob'],seed:-1}),/seed/);
});
test('each unified regional deck has 126 descending mileage, 72 hazards, 72 fixes, 8 power upgrades and 1–2 unique legends',()=>{
 const s=start(),legends=s.legendaryByLeg.flat();
 assert.deepEqual(s.legendaryByLeg.map(x=>x.length).sort(),[1,1,2]);
 assert.equal(legends.length,4);assert.equal(new Set(legends).size,4);
 assert.deepEqual(new Set(legends),new Set(LEGENDARIES.map(x=>x.id)));
 for(let leg=0;leg<3;leg++){
  const x=structuredClone(s);x.leg=leg;
  const deck=regionalDeck(x);
  assert.equal(deck.length,STANDARD_DECK_SIZE+s.legendaryByLeg[leg].length);
  assert.equal(new Set(deck.map(c=>c.uid)).size,deck.length);
  const tally=t=>deck.filter(c=>c.type===t).length;
  assert.equal(tally('mileage'),126);assert.equal(tally('hazard'),72);
  assert.equal(tally('fix'),72);assert.equal(tally('upgrade'),8);
  assert.equal(tally('legendary'),s.legendaryByLeg[leg].length);
  assert.deepEqual(MILEAGE_COUNTS.map(([km])=>deck.filter(c=>c.type==='mileage'&&c.km===km).length),MILEAGE_COUNTS.map(([,count])=>count));
  assert.ok(HAZARDS[LEGS[leg].id].every(h=>deck.filter(c=>c.type==='hazard'&&c.id===h.id).length===9));
  assert.ok(FIXES.every(f=>deck.filter(c=>c.type==='fix'&&c.id===f.id).length===12));
  assert.ok(UPGRADES.every(u=>deck.filter(c=>c.type==='upgrade'&&c.id===u.id).length===1));
 }
});
test('opening hands skip redraw once per seat; play then discard leaves five, next seats skip redraw',()=>{
 let s=start();
 put(s,0,card('mileage',{km:200}));
 const next=takeChaosTurn(s,{player:0,action:'drive',index:0});
 assert.equal(s.players[0].km,0,'previous state immutable');assert.equal(next.players[0].km,200);
 assert.equal(next.step,'discard');assert.equal(next.players[0].hand.length,6);
 s=discard(next);assert.equal(s.turn,1);assert.equal(s.step,'play');
 assert.equal(s.players[0].hand.length,5);assert.equal(s.players[1].hand.length,7);
 for(let player=1;player<4;player++){
  assert.equal(s.turn,player);assert.equal(s.step,'play');
  s=takeChaosTurn(s,{player,action:'pass'});assert.equal(s.discardsLeft,2);
  s=endDiscard(s);
 }
 assert.equal(s.turn,0);assert.equal(s.step,'draw');assert.equal(s.players[0].hand.length,5);
 assert.throws(()=>takeChaosTurn(s,{player:1,action:'draw',choice:'deck'}),/Not this driver/);
 assert.throws(()=>takeChaosTurn(s,{player:0,action:'drive',index:0}),/Choose how to draw/);
});
test('draw can choose top discard plus one deck card, or two deck cards; discarded card stays on top',()=>{
 let s=start();
 s.players[0].hand=s.players[0].hand.slice(0,5);s.step='draw';
 s.discard=[card('mileage',{km:500})];
 const chosen=takeChaosTurn(s,{player:0,action:'draw',choice:'discard'});
 assert.equal(chosen.players[0].hand.length,7);
 assert.ok(chosen.players[0].hand.some(c=>c.km===500));
 assert.equal(chosen.discard.length,0);assert.equal(chosen.step,'play');
 assert.equal(s.discard.length,1);
 let alt=start();alt.players[0].hand=alt.players[0].hand.slice(0,5);alt.step='draw';
 const deck=takeChaosTurn(alt,{player:0,action:'draw',choice:'deck'});
 assert.equal(deck.players[0].hand.length,7);
 assert.equal(deck.deck.length,alt.deck.length-2);
 assert.throws(()=>takeChaosTurn(alt,{player:0,action:'draw',choice:'discard'}),/Discard pile is empty/);
});
test('free newly drawn power installs immediately, replaces itself, chains, and later powers use a turn',()=>{
 let s=start();
 s.step='draw';s.players[0].hand=s.players[0].hand.slice(0,5);
 const a=card('upgrade',{id:'duct-tape',name:'Duct Tape',category:'mechanical'});
 const b=card('upgrade',{id:'winter-tires',name:'Winter Tires',category:'weather'});
 const m=card('mileage',{km:100});
 s.discard=[a];s.deck.push(m,b);
 s=takeChaosTurn(s,{player:0,action:'draw',choice:'discard'});
 assert.ok(s.fresh.includes(a.uid));assert.ok(s.fresh.includes(b.uid));
 s=takeChaosTurn(s,{player:0,action:'power',index:s.players[0].hand.findIndex(c=>c.uid===a.uid)});
 assert.equal(s.step,'play');assert.equal(s.players[0].hand.length,7);
 assert.ok(s.players[0].upgrades.some(c=>c.id==='duct-tape'));
 assert.ok(s.players[0].hand.some(c=>c.uid===m.uid));
 s=takeChaosTurn(s,{player:0,action:'power',index:s.players[0].hand.findIndex(c=>c.uid===b.uid)});
 assert.equal(s.step,'play');assert.equal(s.players[0].upgrades.length,2);
 assert.throws(()=>takeChaosTurn(s,{player:0,action:'power',index:99}),/Select a power card/);
 // Opening seven-card deals are also physical deck draws, so their powers can be free.
 const dealt=Array.from({length:80},(_,i)=>start(2,i+1)).find(g=>g.players[0].hand.some(c=>['upgrade','legendary'].includes(c.type)));
 assert.ok(dealt,'some deterministic opening hand should contain a power');
 const idx=dealt.players[0].hand.findIndex(c=>['upgrade','legendary'].includes(c.type));
 assert.ok(dealt.fresh.includes(dealt.players[0].hand[idx].uid));
 const activated=takeChaosTurn(dealt,{player:0,action:'power',index:idx});
 assert.equal(activated.step,'play');assert.equal(activated.players[0].hand.length,7);
 // A power kept past its immediate draw opportunity costs the normal play.
 let saved=start();put(saved,0,card('upgrade',{id:'thermos',name:'Thermos',category:'all'}));saved.fresh=[];
 saved=takeChaosTurn(saved,{player:0,action:'power',index:0});
 assert.equal(saved.step,'discard');assert.equal(saved.discardsLeft,1);
});
test('repairs only on owners turn; breakdown, road slowdown and permanent detours behave independently',()=>{
 let s=start();
 put(s,0,card('hazard',{id:'pothole',name:'Pothole',kind:'block',category:'mechanical'}));
 put(s,1,card('fix',{id:'toolbox',name:'Repair Kit',category:'mechanical'}));
 const hit=takeChaosTurn(s,{player:0,action:'hazard',index:0,target:1});
 assert.equal(hit.players[1].status.kind,'block');
 assert.throws(()=>takeChaosTurn(hit,{player:1,action:'fix',index:0}),/Not this driver/);
 s=discard(hit);
 assert.equal(s.turn,1);assert.equal(s.step,'play');
 const fixed=takeChaosTurn(s,{player:1,action:'fix',index:0});
 assert.equal(fixed.players[1].status,null);
 assert.equal(fixed.step,'discard');
 let detour=start();
 setDistance(detour.players[1],400);
 put(detour,0,card('hazard',{id:'cabot',name:'Detour',kind:'detour',amount:150,category:'navigation'}));
 put(detour,1,card('fix',{id:'atlas',name:'Local Knows a Shortcut',category:'navigation'}));
 detour=takeChaosTurn(detour,{player:0,action:'hazard',index:0,target:1});
 assert.equal(detour.players[1].km,250);assert.equal(detour.players[1].detourLoss,150);
 detour=discard(detour);
 detour=takeChaosTurn(detour,{player:1,action:'fix',index:0});
 assert.equal(detour.players[1].bonusKm,150);assert.equal(detour.players[1].detourLoss,150);
 assert.equal(detour.players[1].km,400);
 assert.equal(canFix({category:'navigation'},card('fix',{id:'atlas',category:'navigation'})),false);
});
test('detours can be repeated while blocked, cannot drive while blocked; slowdowns reduce one mileage play',()=>{
 let s=start();setDistance(s.players[1],100);
 s.players[1].status={id:'blocked',name:'Flat',category:'mechanical',kind:'block'};
 put(s,0,card('hazard',{id:'montreal',name:'Wrong Turn',kind:'detour',category:'navigation',amount:200}));
 s=takeChaosTurn(s,{player:0,action:'hazard',index:0,target:1});
 assert.equal(s.players[1].km,0);assert.equal(s.players[1].detourLoss,100);
 s=discard(s);put(s,1,card('mileage',{km:100}));
 assert.throws(()=>takeChaosTurn(s,{player:1,action:'drive',index:0}),/Repair the breakdown/);
 let slow=start();slow.players[0].status={id:'fog',name:'Fog',kind:'slow',amount:150,category:'weather'};
 put(slow,0,card('mileage',{km:200}));
 slow=takeChaosTurn(slow,{player:0,action:'drive',index:0});
 assert.equal(slow.players[0].km,50);assert.equal(slow.players[0].slowLoss,150);
 assert.equal(slow.players[0].status,null);
});
test('protective upgrades and legendary shields block eligible hazards and reset between regions',()=>{
 let s=start();s.players[1].upgrades=[{id:'duct-tape',category:'mechanical',name:'Duct Tape'}];
 put(s,0,card('hazard',{id:'pothole',name:'Pothole',kind:'block',category:'mechanical'}));
 s=takeChaosTurn(s,{player:0,action:'hazard',index:0,target:1});
 assert.equal(s.players[1].status,null);
 assert.ok(s.players[1].used.includes('duct-tape'));
 s=start();put(s,0,card('legendary',{id:'rodeo',name:'Not My First Rodeo'}));
 s=takeChaosTurn(s,{player:0,action:'power',index:0});
 assert.equal(s.players[0].shield,2);
 assert.deepEqual(s.retiredLegendaries,['rodeo']);
});
test('Truck, Sunshine and risky legendary Shortcut have exact one-use consequences',()=>{
 let truck=start();truck.players[0].status={id:'flat',name:'Flat tire',kind:'block',category:'mechanical'};
 put(truck,0,card('legendary',{id:'truck',name:'A Guy I Know Has a Truck'}));
 truck=takeChaosTurn(truck,{player:0,action:'power',index:0});
 assert.equal(truck.players[0].status,null);assert.equal(truck.players[0].km,100);
 assert.deepEqual(truck.retiredLegendaries,['truck']);
 let sun=start();sun.players[1].status={id:'fog',name:'Fog',category:'weather',kind:'slow',amount:150};
 sun.players[2].status={id:'whiteout',name:'Whiteout',category:'weather',kind:'block'};
 sun.players[3].status={id:'pothole',name:'Pothole',category:'mechanical',kind:'block'};
 put(sun,0,card('legendary',{id:'sunshine',name:'Would You Look at That!'}));
 sun=takeChaosTurn(sun,{player:0,action:'power',index:0});
 assert.equal(sun.players[1].status,null);assert.equal(sun.players[2].status,null);
 assert.ok(sun.players[3].status);assert.equal(sun.players[0].km,100);
 let shortcut=start();put(shortcut,0,card('legendary',{id:'shortcut',name:'Trust Me, I Know a Shortcut'}));
 shortcut=takeChaosTurn(shortcut,{player:0,action:'power',index:0});
 assert.equal(shortcut.players[0].bonusKm,300);
 assert.ok(shortcut.players[0].status||shortcut.players[0].detourLoss>0);
 assert.deepEqual(shortcut.retiredLegendaries,['shortcut']);
});
test('Station Wagon repairs only on owners turn and Shortcut Specialist boosts a single mileage action',()=>{
 let s=start();
 s.players[1].upgrades=[{id:'station-wagon',name:'Station Wagon',category:'mechanical'}];
 s.players[1].status={id:'flat',name:'Flat',category:'mechanical',kind:'block'};
 s=takeChaosTurn(s,{player:0,action:'pass'});s=endDiscard(s);
 assert.equal(s.turn,1);assert.equal(s.players[1].status,null);
 assert.ok(s.players[1].used.includes('station-wagon'));
 let boost=start();boost.players[0].upgrades=[{id:'shortcut-specialist',name:'Shortcut Specialist',category:'boost'}];
 put(boost,0,card('mileage',{km:200}));
 boost=takeChaosTurn(boost,{player:0,action:'drive',index:0,useBoost:true});
 assert.equal(boost.players[0].km,300);assert.ok(boost.players[0].used.includes('shortcut-specialist'));
 boost.step='play';put(boost,0,card('mileage',{km:100}));
 assert.throws(()=>takeChaosTurn(boost,{player:0,action:'drive',index:0,useBoost:true}),/boost unavailable/);
});
test('illegal extra upgrades, invalid targets and out-of-phase moves fail without mutating state',()=>{
 let s=start();
 s.players[0].upgrades=[{id:'thermos',name:'Thermos',category:'all'}];
 put(s,0,card('upgrade',{id:'thermos',name:'Thermos',category:'all'}));
 const before=structuredClone(s);
 assert.throws(()=>takeChaosTurn(s,{player:0,action:'power',index:0}),/already installed/);
 assert.deepEqual(s,before);
 put(s,0,card('hazard',{id:'pothole',name:'Pothole',kind:'block',category:'mechanical'}));
 assert.throws(()=>takeChaosTurn(s,{player:0,action:'hazard',index:0,target:0}),/eligible opponent/);
 s.players[1].status={id:'fog',name:'Fog',kind:'slow',category:'weather',amount:150};
 assert.throws(()=>takeChaosTurn(s,{player:0,action:'hazard',index:0,target:1}),/eligible opponent/);
 const submitted=takeChaosTurn(s,{player:0,action:'pass'});
 assert.throws(()=>takeChaosTurn(submitted,{player:0,action:'power',index:0}),/Discard one card/);
});
test('detours at zero do not create future debt; 400 km drive risks a regional self-hazard',()=>{
 let s=start();
 put(s,0,card('hazard',{id:'cabot',name:'Cabot',kind:'detour',amount:150,category:'navigation'}));
 s=takeChaosTurn(s,{player:0,action:'hazard',index:0,target:1});
 assert.equal(s.players[1].km,0);assert.equal(s.players[1].detourLoss,0);
 let risk=start();put(risk,0,card('mileage',{km:400}));
 risk=takeChaosTurn(risk,{player:0,action:'drive',index:0});
 assert.equal(risk.players[0].played[0].km,400);
 assert.ok(risk.players[0].status||risk.players[0].detourLoss>0);
 assert.ok(risk.log.some(message=>message.includes('risked a 400 km drive')));
});
test('winner banks 2,500 km, others bank capped effective mileage, and final round completes in equal turns',()=>{
 let s=start();setDistance(s.players[0],2350);setDistance(s.players[1],2450);
 setDistance(s.players[2],1950);setDistance(s.players[3],1000);
 put(s,0,card('mileage',{km:200}));put(s,1,card('mileage',{km:200}));
 s=takeChaosTurn(s,{player:0,action:'drive',index:0});
 assert.equal(s.finishPending,true);assert.equal(s.phase,'playing');
 s=discard(s);assert.equal(s.turn,1);
 s=takeChaosTurn(s,{player:1,action:'drive',index:0});
 s=discard(s);
 for(const i of [2,3]){assert.equal(s.turn,i);s=takeChaosTurn(s,{player:i,action:'pass'});s=endDiscard(s);}
 assert.equal(s.phase,'between');assert.equal(s.results.length,1);
 const rank=s.results[0].standings;
 assert.equal(rank[0].id,1);assert.equal(rank[0].km,2650);assert.equal(rank[0].banked,2500);
 assert.equal(rank.find(p=>p.id===0).banked,2500);
 assert.equal(rank.find(p=>p.id===2).banked,1950);
 assert.equal(s.players[1].wins,1);
 assert.equal(s.players[1].score,2500);
 assert.equal(s.turns,4);
 const progressed=advanceChaosLeg(s);
 assert.equal(progressed.leg,1);assert.equal(progressed.roundStart,1);
 assert.ok(progressed.players.every(p=>p.km===0&&p.played.length===0&&!p.status&&!p.upgrades.length&&!p.shield));
 assert.deepEqual(progressed.players.map(p=>p.score),s.players.map(p=>p.score));
 assert.equal(progressed.players[1].hand.length,7);
 assert.equal(progressed.step,'play');
});
test('exact stage ties share 2,500 km, while equal effective mileage uses raw played mileage to break ties',()=>{
 let shared=start(2);
 setDistance(shared.players[0],2400);setDistance(shared.players[1],2400);
 put(shared,0,card('mileage',{km:100}));put(shared,1,card('mileage',{km:100}));
 shared=takeChaosTurn(shared,{player:0,action:'drive',index:0});shared=discard(shared);
 shared=takeChaosTurn(shared,{player:1,action:'drive',index:0});shared=discard(shared);
 assert.equal(shared.phase,'between');
 assert.deepEqual(shared.results[0].winners,[0,1]);
 assert.deepEqual(shared.players.map(p=>p.score),[2500,2500]);
 assert.deepEqual(shared.players.map(p=>p.wins),[1,1]);
 let raw=start(2);
 setDistance(raw.players[0],2400);setDistance(raw.players[1],2600);
 raw.players[1].detourLoss=200;raw.players[1].km=2400;
 put(raw,0,card('mileage',{km:100}));put(raw,1,card('mileage',{km:100}));
 raw=takeChaosTurn(raw,{player:0,action:'drive',index:0});raw=discard(raw);
 raw=takeChaosTurn(raw,{player:1,action:'drive',index:0});raw=discard(raw);
 assert.deepEqual(raw.results[0].winners,[1]);
 assert.equal(raw.results[0].standings[0].id,1);
 assert.equal(raw.results[0].standings[0].rawKm,2700);
});
test('all stage results persist; championship orders by total km, wins and west-stage km',()=>{
 let s=start(2);
 for(let leg=0;leg<3;leg++){
  const startPlayer=s.turn,other=(startPlayer+1)%2;
  setDistance(s.players[startPlayer],2400);setDistance(s.players[other],2100);
  put(s,startPlayer,card('mileage',{km:100}));
  s=takeChaosTurn(s,{player:startPlayer,action:'drive',index:0});s=discard(s);
  assert.equal(s.finishPending,true);
  s=takeChaosTurn(s,{player:other,action:'pass'});s=endDiscard(s);
  assert.equal(s.results.length,leg+1);
  if(leg<2)s=advanceChaosLeg(s);
 }
 assert.equal(s.phase,'finished');
 assert.equal(s.results.length,3);
 assert.deepEqual(s.players.map(p=>p.score).sort((a,b)=>b-a),[7100,6700]);
 assert.equal(chaosLeaders(s).length,2);
 assert.throws(()=>advanceChaosLeg(s),/No completed stage/);
});
test('empty regional deck recycles eligible discard cards, retaining the last visible discard',()=>{
 let s=start();s.step='draw';s.players[0].hand=s.players[0].hand.slice(0,5);
 s.deck=[];s.discard=[card('mileage',{km:100}),card('mileage',{km:150}),card('mileage',{km:500})];
 s=takeChaosTurn(s,{player:0,action:'draw',choice:'deck'});
 assert.equal(s.players[0].hand.length,7);
 assert.equal(s.discard.length,1);assert.equal(s.discard[0].km,500);
});
test('fully exhausted stock with an empty hand cannot strand the turn cycle',()=>{
 let empty=start(2);
 empty.deck=[];empty.discard=[];empty.players[0].hand=[];empty.step='draw';
 empty=takeChaosTurn(empty,{player:0,action:'draw',choice:'deck'});
 assert.equal(empty.players[0].hand.length,0);assert.equal(empty.step,'play');
 const skipped=takeChaosTurn(empty,{player:0,action:'pass'});
 assert.equal(skipped.turn,1);
 assert.equal(skipped.step,'play','other seat still has its unused opening hand');
 assert.equal(skipped.players[1].hand.length,7);
});
test('visible player UI handles draw/discard phases and hides private cards',()=>{
 const s=createChaosGame({names:['<img src=x>','Bob'],seed:3});
 const hidden=renderChaosGame({game:s,revealed:false});
 assert.match(hidden,/Pass the device/);assert.doesNotMatch(hidden,/<img src=x>/);
 assert.doesNotMatch(hidden,/Drive 100 km/);
 const shown=renderChaosGame({game:s,revealed:true});
 assert.match(shown,/Vehicle equipment/);assert.match(shown,/ccc-hand/);assert.match(shown,/2,500 km/);
 assert.match(renderChaosGame(),/Start the cross-Canada championship/);
 assert.ok(chaosActionOptions(s).some(x=>x.action==='pass'));
 const invalid=renderChaosGame({game:s,revealed:true,error:'<script>alert(1)</script>'});
 assert.doesNotMatch(invalid,/<script>/);
 const drawing=structuredClone(s);drawing.step='draw';drawing.players[0].hand=drawing.players[0].hand.slice(0,5);
 assert.match(renderChaosGame({game:drawing,revealed:true}),/Draw two from deck/);
 const discardPhase=structuredClone(s);discardPhase.step='discard';discardPhase.discardsLeft=1;
 assert.match(renderChaosGame({game:discardPhase,revealed:true}),/Discard this card/);
});
test('public local game route remains separate from wallet-only and wager-bearing games',()=>{
 assert.equal(resolveRoute('/classics').requiresSession,false);
 assert.equal(routeAccess(resolveRoute('/classics/cross-country-chaos'),{connected:false}).allowed,true);
 const html=renderApplicationShell({pathname:'/classics/cross-country-chaos',walletView:{connected:false}});
 assert.match(html,/Cross-Country Chaos/);assert.match(html,/Local pass-and-play only/);
 assert.match(renderApplicationShell({pathname:'/games',walletView:{connected:false}}),/Games require 420Wallet/);
});
