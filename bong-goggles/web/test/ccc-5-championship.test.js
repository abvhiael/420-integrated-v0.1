import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
 createChaosGame,takeChaosTurn,advanceChaosLeg,chaosLeaders,chaosFinalRoundProgress,LEGS
} from '../core/cross-country-chaos.js';
import {configureChaosComputerSeats} from '../core/chaos-computer.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {
 chaosChampionshipPlacings,chaosProvisionalPlacings,
 renderChaosCumulativeStandings,renderChaosChampionshipResults
} from '../core/chaos-results.js';

const names=['Alex','Blair','Casey','Drew'];
let uid=460000;
const card=(type,fields={})=>({type,uid:++uid,...fields});
const start=(n=4,seed=19)=>createChaosGame({names:names.slice(0,n),seed});
const act=(s,action,extra={})=>takeChaosTurn(s,{player:s.players[s.turn].id,action,...extra});
function completeDiscards(s){
 const actor=s.players[s.turn].id;
 while(s.phase==='playing'&&s.turn===actor&&s.step==='discard')s=act(s,'discard',{index:0});
 return s;
}
function completedStage(s){
 const first=s.roundStart;
 assert.equal(s.turn,first,'every stage must start at its rotated opening seat');
 const p=s.players[first];
 p.played=[card('mileage',{km:2400})];p.km=2400;
 p.hand[0]=card('mileage',{km:100});
 s=act(s,'drive',{index:0});
 assert.equal(s.finishPending,true);
 const initialProgress=chaosFinalRoundProgress(s);
 assert.equal(initialProgress.turnsRemaining,s.players.length);
 s=completeDiscards(s);
 while(s.phase==='playing'){
  const actor=s.turn;
  s=act(s,'pass');
  s=completeDiscards(s);
  assert.ok(s.phase!=='playing'||s.turn!==actor,'no stranded final turn');
 }
 assert.equal(s.results.at(-1).leg,s.leg);
 assert.equal(s.results.at(-1).winners.length,1);
 assert.equal(s.results.at(-1).winners[0],first);
 return s;
}
test('CCC-5: crossing 2,500 on a risky drive latches the final round before its self-detour',()=>{
 let s=start(2);
 s.players[0].played=[card('mileage',{km:2200})];s.players[0].km=2200;
 s.players[0].hand[0]=card('mileage',{km:400});
 // First risk roll in the East picks Cabot Trail, a 150 km detour.
 s.seed=359;
 const original=structuredClone(s);
 s=act(s,'drive',{index:0});
 assert.equal(s.players[0].detourLoss,150);
 assert.equal(s.players[0].km,2450,'risk detour lowered the driver below the goal');
 assert.equal(s.finishPending,true,'first crossing of the goal cannot be retracted');
 assert.deepEqual(original.players[0].km,2200);
 assert.deepEqual(chaosFinalRoundProgress(s),
  {roundStart:0,activeSeat:0,turnsRemaining:2});
 s=completeDiscards(s);
 assert.deepEqual(chaosFinalRoundProgress(s),
  {roundStart:0,activeSeat:1,turnsRemaining:1});
 s=act(s,'pass');s=completeDiscards(s);
 assert.equal(s.phase,'between');
 assert.equal(s.results[0].standings[0].km,2450);
 assert.equal(s.results[0].standings[0].banked,2500,
  'stage victory banks 2,500 even after a post-crossing detour');
 assert.equal(chaosFinalRoundProgress(s),null);
});
test('CCC-5: a legendary Shortcut also latches the finish before immediate road risk',()=>{
 let s=start(2);
 s.players[0].played=[card('mileage',{km:2300})];s.players[0].km=2300;
 s.players[0].hand[0]=card('legendary',{id:'shortcut',name:'Trust Me, I Know a Shortcut'});
 s.fresh=[];s.seed=359;
 s=act(s,'power',{index:0});
 assert.equal(s.players[0].bonusKm,300);
 assert.equal(s.players[0].detourLoss,150);
 assert.equal(s.players[0].km,2450);
 assert.equal(s.finishPending,true);
 assert.equal(s.step,'discard');
 assert.ok(s.retiredLegendaries.includes('shortcut'));
});
test('CCC-5: later rival sabotage cannot revoke the finish latch',()=>{
 let s=start(3);
 s.players[0].played=[card('mileage',{km:2400})];s.players[0].km=2400;
 s.players[0].hand[0]=card('mileage',{km:100});
 s=act(s,'drive',{index:0});
 assert.equal(s.players[0].km,2500);
 s=completeDiscards(s);
 s.players[1].hand[0]=card('hazard',{id:'cabot',name:'Detour',kind:'detour',
  category:'navigation',amount:150});
 s=act(s,'hazard',{index:0,target:0});
 assert.equal(s.players[0].km,2350);
 assert.equal(s.finishPending,true);
 s=completeDiscards(s);
 s=act(s,'pass');s=completeDiscards(s);
 assert.equal(s.phase,'between');
 assert.deepEqual(s.results[0].winners,[0]);
 assert.equal(s.results[0].standings[0].banked,2500);
});
test('CCC-5: countdown follows the rotated first driver and current discard phase; no premature results',()=>{
 const s=start(4);
 assert.equal(chaosFinalRoundProgress(s),null);
 s.finishPending=true;
 for(const [seat,remaining] of [[0,4],[1,3],[2,2],[3,1]]){
  s.turn=seat;
  assert.equal(chaosFinalRoundProgress(s)?.turnsRemaining,remaining);
  const html=renderChaosGame({game:s,revealed:false});
  assert.match(html,/FINAL ROUND/);
  assert.match(html,new RegExp(remaining+' driver turn'+(remaining===1?'':'s')+' remaining'));
  assert.doesNotMatch(html,/ccc-results-screen--regional|ccc-hand-card/);
 }
 s.leg=1;s.roundStart=1;
 for(const [seat,remaining] of [[1,4],[2,3],[3,2],[0,1]]){
  s.turn=seat;assert.equal(chaosFinalRoundProgress(s).turnsRemaining,remaining);
 }
 const bad=structuredClone(s);bad.roundStart=100;
 assert.equal(chaosFinalRoundProgress(bad),null);
 bad.roundStart=0;bad.phase='between';
 assert.equal(chaosFinalRoundProgress(bad),null);
});
test('CCC-5: all three real stages bank exact mileage, reset regional state and rotate starts',()=>{
 let s=configureChaosComputerSeats(start(4,91),['human','easy','normal','hard']);
 s.players[0].vehicle='wagon';
 const controllers=s.players.map(p=>[p.controller,p.difficulty]);
 const recorded=[];
 for(let leg=0;leg<3;leg++){
  assert.equal(s.leg,leg);
  assert.equal(s.roundStart,leg);
  s=completedStage(s);
  assert.equal(s.phase,leg===2?'finished':'between');
  assert.equal(s.results.length,leg+1);
  assert.equal(s.results[leg].standings.find(row=>row.winner).banked,2500);
  for(const p of s.players){
   const awards=s.results.reduce((sum,r)=>sum+r.standings.find(row=>row.id===p.id).banked,0);
   assert.equal(p.score,awards,'no lost or duplicate stage awards');
   assert.equal(p.wins,s.results.filter(r=>r.winners.includes(p.id)).length);
  }
  recorded.push(structuredClone(s.results.at(-1)));
  if(leg<2){
   const html=renderChaosGame({game:s,revealed:true});
   assert.match(html,/Regional finish line!/);
   assert.match(html,/Championship standings/);
   assert.match(html,/Continue to/);
   assert.doesNotMatch(html,/ccc-hand-card|data-chaos-move=/);
   const provisional=chaosProvisionalPlacings(s);
   assert.equal(provisional.length,4);
   assert.equal(provisional[0].score,2500);
   const old=s;
   s=advanceChaosLeg(s);
   assert.equal(old.phase,'between');
   assert.equal(s.roundStart,leg+1);
   assert.equal(s.finishPending,false);
   assert.equal(s.step,'play');
   assert.deepEqual(s.players.map(p=>[p.controller,p.difficulty]),controllers);
   assert.equal(s.players[0].vehicle,'wagon');
   assert.equal(s.results.length,leg+1);
   assert.deepEqual(s.results[leg],recorded[leg]);
   for(const p of s.players){
    assert.equal(p.km,0);assert.equal(p.hand.length,7);
    assert.equal(p.played.length,0);assert.equal(p.bonusKm,0);
    assert.equal(p.detourLoss,0);assert.equal(p.slowLoss,0);
    assert.equal(p.status,null);assert.deepEqual(p.upgrades,[]);
    assert.deepEqual(p.used,[]);assert.equal(p.shield,0);
   }
   assert.equal(s.discard.length,0);assert.equal(s.spent.length,0);
  }
 }
 assert.deepEqual(s.players.map(p=>p.score),[2500,2500,2500,0]);
 assert.deepEqual(s.players.map(p=>p.wins),[1,1,1,0]);
 assert.equal(s.phase,'finished');assert.equal(s.results.length,3);
 assert.deepEqual(s.results,recorded);
 assert.deepEqual(chaosChampionshipPlacings(s).filter(p=>p.winner).map(p=>p.id),[2],
  'equal total and wins break on Western stage banked km');
 assert.equal(chaosLeaders(s)[0].id,2);
 assert.match(renderChaosChampionshipResults(s),/Grand champion/);
 assert.match(renderChaosGame({game:s,revealed:true}),/Coast-to-coast championship complete/);
 assert.doesNotMatch(renderChaosGame({game:s,revealed:true}),/ccc-hand-card|data-chaos-action="draw"/);
 assert.throws(()=>advanceChaosLeg(s),/No completed stage/);
 assert.throws(()=>act(s,'pass'),/Race is not accepting turns/);
});
test('CCC-5: provisional standings are read-only, tie-aware and do not imply early champions',()=>{
 const s=start(3,97);
 s.phase='between';s.leg=1;
 s.results=[{leg:0,winners:[0],standings:[]},{leg:1,winners:[1],standings:[]}];
 s.players[0].score=4800;s.players[0].wins=1;
 s.players[1].score=4800;s.players[1].wins=1;
 s.players[2].score=4600;s.players[2].wins=0;
 s.players[1].name='<img src=x onerror=alert(1)>';
 s.players[1].hand=[card('mileage',{km:500,name:'SECRET_PRIVATE_CARD_5'})];
 const before=structuredClone(s);
 const ranks=chaosProvisionalPlacings(s);
 assert.deepEqual(ranks.map(x=>x.place),[1,1,3]);
 const html=renderChaosCumulativeStandings(s);
 assert.match(html,/Provisional championship standings/);
 assert.match(html,/4,800 km/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(html,/<img src=x onerror|SECRET_PRIVATE_CARD_5|ccc-podium-place/);
 assert.deepEqual(s,before,'read-only results must not mutate any stage record');
 const active=structuredClone(s);active.phase='playing';
 assert.equal(renderChaosCumulativeStandings(active),'');
 assert.equal(chaosProvisionalPlacings(active).length,0);
});
test('CCC-5: final tiebreak priority is cumulative km, wins, Western mileage, then shared title',()=>{
 const s=start(3);
 s.leg=2;s.phase='finished';
 s.results=[
  {leg:0,standings:[],winners:[]},{leg:1,standings:[],winners:[]},
  {leg:2,winners:[],standings:[
   {id:0,banked:2300},{id:1,banked:2500},{id:2,banked:2000}
  ]}
 ];
 for(const p of s.players){p.score=6000;p.wins=1}
 assert.equal(chaosChampionshipPlacings(s)[0].id,1,'west mileage breaks total/win tie');
 s.players[2].wins=2;
 assert.equal(chaosChampionshipPlacings(s)[0].id,2,'stage wins trump west mileage');
 s.players[0].score=6001;
 assert.equal(chaosChampionshipPlacings(s)[0].id,0,'one banked km trumps wins and west');
 s.players[0].score=6000;s.players[2].wins=1;
 s.results[2].standings[0].banked=2500;
 const placings=chaosChampionshipPlacings(s);
 assert.deepEqual(placings.filter(p=>p.winner).map(p=>p.id),[0,1]);
 assert.deepEqual(placings.filter(p=>p.winner).map(p=>p.place),[1,1]);
 assert.match(renderChaosChampionshipResults(s),/Joint grand champions/);
});
test('CCC-5: source-integrity gate protects threshold latching and local public championship views',async()=>{
 const root=resolve(import.meta.dirname,'..');
 const [engine,results,ui,css,gate]=await Promise.all([
  'core/cross-country-chaos.js','core/chaos-results.js','core/classics-ui.js',
  'ccc-tabletop.css','scripts/qualify-web.mjs'
 ].map(x=>readFile(resolve(root,x),'utf8')));
 assert.match(engine,/gain\(p,300\);markFinish\(s\);risky\(s,p,500\)/);
 assert.match(engine,/refresh\(p\);markFinish\(s\);risky\(s,p,c\.km\)/);
 assert.match(ui,/chaosFinalRoundProgress\(game\)/);
 assert.match(ui,/renderChaosCumulativeStandings\(game\)/);
 assert.match(results,/chaosProvisionalPlacings/);
 assert.match(results,/renderChaosCumulativeStandings/);
 assert.doesNotMatch(results,/\.hand\b|\.deck\b|\bfetch\s*\(|\bsetTimeout\s*\(/);
 assert.match(css,/\.ccc-final-round/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(gate,/CCC-5 championship final-round and standings qualification failed/);
 assert.match(gate,/baseTotal:1157\*1024/);
});
