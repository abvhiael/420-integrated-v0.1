import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame,takeChaosTurn,advanceChaosLeg,chaosActionOptions} from '../core/cross-country-chaos.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {renderChaosHighway} from '../core/chaos-board.js';
import {CHAOS_COMPUTER_LEVELS,configureChaosComputerSeats,isChaosComputer,
 chooseChaosComputerMove,advanceChaosComputerTurns} from '../core/chaos-computer.js';

const names=['Alex','Blair','Casey','Drew'];
const game=(levels=['hard','human'],seed=42)=>{
 const original=createChaosGame({names:names.slice(0,levels.length),seed});
 return configureChaosComputerSeats(original,levels);
};
const card=(type,extra={})=>({type,uid:92703,...extra});
const chooseMove=(s)=>chooseChaosComputerMove(s);
test('CCC-4: 2–4 seats are strictly configured with one human and validated difficulty',()=>{
 assert.deepEqual(CHAOS_COMPUTER_LEVELS,['easy','normal','hard']);
 for(const levels of [['human','easy'],['hard','human','normal'],['easy','normal','hard','human']]){
  const plain=createChaosGame({names:names.slice(0,levels.length),seed:66}),old=structuredClone(plain);
  const selected=configureChaosComputerSeats(plain,levels);
  assert.deepEqual(plain,old,'controller setup does not mutate deterministic original state');
  assert.deepEqual(selected.players.map(p=>p.controller),levels.map(l=>l==='human'?'human':'computer'));
  assert.deepEqual(selected.players.map(p=>p.difficulty),levels.map(l=>l==='human'?null:l));
  assert.deepEqual(selected.deck,old.deck,'deck order is unchanged');
  assert.deepEqual(selected.legendaryByLeg,old.legendaryByLeg);
  assert.deepEqual(selected.players.map(p=>p.hand),old.players.map(p=>p.hand));
 }
 assert.throws(()=>configureChaosComputerSeats(createChaosGame({names:names.slice(0,2)}),['hard','easy']),/at least one human/);
 assert.throws(()=>configureChaosComputerSeats(createChaosGame({names:names.slice(0,2)}),['hard','expert']),/at least one human/);
 assert.throws(()=>configureChaosComputerSeats(createChaosGame({names:names.slice(0,2)}),['human']),/at least one human/);
 assert.equal(isChaosComputer({controller:'computer',difficulty:'hard'}),true);
 assert.equal(isChaosComputer({controller:'computer',difficulty:'unknown'}),false);
 assert.equal(isChaosComputer({controller:'human',difficulty:null}),false);
});
test('CCC-4: Easy, Normal and Hard only submit action choices accepted by the CCC-1 engine',()=>{
 for(const level of CHAOS_COMPUTER_LEVELS){
  const state=game([level,'human']),unchanged=structuredClone(state),move=chooseMove(state);
  assert.ok(chaosActionOptions(state).some(o=>o.action===move.action&&o.index===move.index&&
   o.target===move.target&&o.choice===move.choice),level+' selected an illegal opening action');
  assert.deepEqual(state,unchanged);
  const next=takeChaosTurn(state,{player:state.players[state.turn].id,...move});
  assert.notDeepEqual(next,state);
  assert.equal(state.turn,0);
  assert.deepEqual(state,unchanged);
 }
});
test('CCC-4: each difficulty resolves the draw, play and discard phases legally',()=>{
 for(const level of CHAOS_COMPUTER_LEVELS){
  let s=game([level,'human']);
  s.step='draw';s.players[0].openingTurn=false;s.discard=[card('mileage',{km:300})];
  let result=chooseMove(s);
  assert.equal(result.action,'draw');
  s=takeChaosTurn(s,{player:0,...result});
  assert.equal(s.step,'play');
  let n=0;
  while(s.phase==='playing'&&s.turn===0&&n++<32){
   const move=chooseMove(s);
   s=takeChaosTurn(s,{player:0,...move});
  }
  assert.equal(s.turn,1,'bot turn did not resolve');
  assert.equal(s.step,'play');
 }
});
test('CCC-4: Easy decisions vary deterministically without accessing hidden deck seed',()=>{
 const s=game(['easy','human'],23);
 const first=chooseMove(s);
 assert.deepEqual(chooseMove(structuredClone(s)),first);
 const other=structuredClone(s);other.seed=90000011;other.deck.reverse();other.players[1].hand.reverse();
 assert.deepEqual(chooseMove(other),first,'hidden deck order, opponent hand and RNG cannot influence bot choice');
});
test('CCC-4: Hard uses public road hazards for targeted sabotage and prioritizes immediate finish',()=>{
 const s=game();
 s.players[0].hand=[
  card('hazard',{id:'pothole',name:'Pothole',kind:'block',category:'mechanical'}),
  card('mileage',{km:300,uid:92704})];
 s.fresh=[];s.players[1].km=2350;s.players[0].km=200;
 assert.deepEqual(chooseMove(s),{action:'hazard',index:0,target:1});
 s.players[0].km=2250;
 assert.deepEqual(chooseMove(s),{action:'drive',index:1});
});
test('CCC-4: Hard repairs active breakdowns, avoids risky drives when possible and saves matching fixes',()=>{
 const s=game();
 s.players[0].status={kind:'block',category:'mechanical',name:'Pothole',id:'pothole'};
 s.players[0].hand=[
  card('fix',{id:'help',category:'all',name:'Roadside assistance'}),
  card('hazard',{id:'ferry',kind:'block',category:'road',uid:92704})];
 s.fresh=[];
 assert.deepEqual(chooseMove(s),{action:'fix',index:0});
 s.step='discard';assert.deepEqual(chooseMove(s),{action:'discard',index:1});
 s.status=null;s.step='play';s.players[0].status=null;
 s.players[0].hand=[card('mileage',{km:400}),card('mileage',{km:300,uid:92704})];
 assert.deepEqual(chooseMove(s),{action:'drive',index:1},'Hard should prefer safe 300 km to a marginal risky 400 km');
});
test('CCC-4: Normal also makes risk-aware plays, Hard draws useful visible discard and spends boost near finish',()=>{
 const s=game(['normal','human']);
 s.players[0].hand=[card('mileage',{km:400}),card('mileage',{km:300,uid:92704})];s.fresh=[];
 assert.deepEqual(chooseMove(s),{action:'drive',index:1});
 s.players[0].difficulty='hard';s.step='draw';
 s.discard=[card('upgrade',{id:'winter-tires',category:'weather',name:'Winter tires'})];
 assert.deepEqual(chooseMove(s),{action:'draw',choice:'discard'});
 s.step='play';s.players[0].km=1900;
 s.players[0].upgrades=[card('upgrade',{id:'shortcut-specialist',category:'boost',uid:92706})];
 assert.deepEqual(chooseMove(s),{action:'drive',index:1,useBoost:true});
});
test('CCC-4: choose never peeks at stock, rival hidden hands or global seed for strategic choices',()=>{
 const s=game();
 s.players[1].hand=new Proxy([],{get(){throw Error('peeked rival hand');}});
 s.deck=new Proxy([],{get(){throw Error('peeked stock');}});
 const move=chooseMove(s);
 assert.ok(move.action);
 assert.ok(chaosActionOptions(s).some(o=>o.action===move.action));
});
test('CCC-4: computer turns progress automatically to the next human without leaking private hands',()=>{
 const s=game(['easy','normal','hard','human'],1972),before=structuredClone(s);
 const result=advanceChaosComputerTurns(s,{maxActions:96});
 assert.ok(result.moves.length>=6&&result.moves.length<96);
 assert.equal(result.pending,false);
 assert.equal(result.game.turn,3);
 assert.equal(result.game.step,'play');
 assert.equal(result.game.phase,'playing');
 assert.deepEqual(s,before);
 const html=renderChaosGame({game:s,revealed:true});
 assert.match(html,/Computer driving/);
 assert.doesNotMatch(html,/ccc-hand-card|data-chaos-action="reveal"|data-chaos-move=/);
 assert.match(html,/ccc-highway-road/);
 assert.equal((renderChaosHighway(result.game).match(/class="ccc-map-vehicle ccc-map-vehicle--/g)||[]).length,4);
 assert.match(renderChaosGame({game:result.game,revealed:false}),/Pass the device to Drew/);
});
test('CCC-4: between-stage standings and selected computer seats survive stage transition',()=>{
 const s=game(['normal','human','hard']);
 const ids=s.players.map(p=>[p.controller,p.difficulty]);
 s.phase='between';s.results=[{leg:0,winners:[0],standings:[]}];
 const after=advanceChaosLeg(s);
 assert.equal(after.leg,1);
 assert.deepEqual(after.players.map(p=>[p.controller,p.difficulty]),ids);
 assert.equal(after.players[0].km,0);
 assert.ok(after.players.every(p=>p.hand.length===7));
});
test('CCC-4: bounded execution refuses invalid caps and rejects human turns',()=>{
 const s=game(['human','hard']);
 assert.throws(()=>chooseMove(s),/not a valid computer/);
 assert.throws(()=>advanceChaosComputerTurns(s,{maxActions:0}),/Invalid computer action limit/);
 const result=advanceChaosComputerTurns(s);
 assert.strictEqual(result.game,s);
 assert.deepEqual(result.moves,[]);
});
test('CCC-4: human setup, bot controls, accessibility and privacy integrate without altering prior media',async()=>{
 const base=resolve(import.meta.dirname,'..');
 const [ui,app,css,gate,rule]=await Promise.all([
  'core/classics-ui.js','app.js','ccc-tabletop.css','scripts/qualify-web.mjs',
  'core/cross-country-chaos.js'].map(p=>readFile(resolve(base,p),'utf8')));
 for(const level of ['easy','normal','hard'])assert.match(renderChaosGame(),new RegExp('value="'+level+'"'));
 assert.match(renderChaosGame(),/data-chaos-controller-pick="0"/);
 assert.match(renderChaosGame(),/Local pass-and-play/);
 assert.match(app,/configureChaosComputerSeats/);
 assert.match(app,/advanceChaosComputerTurns/);
 assert.match(app,/scheduleChaosComputer/);
 assert.match(app,/chaosComputerErrorStop/);
 assert.match(ui,/isChaosComputer\(p\)/);
 assert.match(css,/\.ccc-computer-turn/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(gate,/baseTotal:1141\*1024/);
 assert.doesNotMatch(rule,/computerDifficulty|controller==='computer'/);
});
