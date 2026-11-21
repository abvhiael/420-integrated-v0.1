import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame,takeChaosTurn,advanceChaosLeg,chaosActionOptions} from '../core/cross-country-chaos.js';
import {configureChaosComputerSeats,advanceChaosComputerTurns} from '../core/chaos-computer.js';
import {applyChaosVehicleSelection} from '../core/chaos-vehicles.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {CHAOS_SAVE_FORMAT,CHAOS_TAB_KEY,CHAOS_DEVICE_KEY,CHAOS_SAVE_MAX_BYTES,
 beginChaosJournal,replayChaosJournal,appendChaosJournal,encodeChaosJournal,
 decodeChaosJournal,readChaosStorage,writeChaosStorage,removeChaosStorage} from '../core/chaos-save.js';

const plan=(controllers=['human','normal'])=>({
 names:['Alice','Bobby','Casey','Drew'].slice(0,controllers.length),
 seed:4626,
 controllers,
 vehicles:['wagon','compact','pickup','camper'].slice(0,controllers.length)
});
const begin=(p=plan())=>{
 const game=configureChaosComputerSeats(
  applyChaosVehicleSelection(createChaosGame({names:p.names,seed:p.seed}),p.vehicles),p.controllers);
 return {game,journal:beginChaosJournal(p)};
};
const play=(state,move)=>{
 const previous=state.game,player=previous.players[previous.turn].id;
 const after=takeChaosTurn(previous,{player,...move});
 return {game:after,journal:appendChaosJournal(state.journal,previous,after,
  [{kind:'move',player,move}])};
};
const finishDiscard=state=>{
 let s=state,guard=0;
 while(s.game.phase==='playing'&&s.game.step==='discard'){
  assert.ok(guard++<8);
  s=play(s,{action:'discard',index:0});
 }
 return s;
};
const memory=()=>{
 const saved=new Map();
 return {saved,getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),
  removeItem:k=>saved.delete(k)};
};

test('CCC-6: save journal reconstructs canonical seeded game and no field can override rules',()=>{
 const p=plan(['human','easy','hard']);
 const original=begin(p),saved=encodeChaosJournal(original.journal);
 const loaded=decodeChaosJournal(saved);
 assert.equal(CHAOS_SAVE_FORMAT,'ccc-6-offline-journal-v1');
 assert.deepEqual(loaded.game,original.game);
 assert.deepEqual(loaded.journal,original.journal);
 assert.notStrictEqual(loaded.game,original.game);
 assert.equal(loaded.game.players[2].controller,'computer');
 assert.equal(loaded.game.players[2].difficulty,'hard');
 assert.ok(saved.includes('ccc-6-offline-journal-v1'));
 assert.ok(!saved.includes('Alice\\n<script>'));
 assert.throws(()=>beginChaosJournal({...p,seed:-1}),/invalid|damaged/);
 assert.throws(()=>beginChaosJournal({...p,controllers:['easy','normal','hard']}),/invalid|damaged/);
 assert.throws(()=>beginChaosJournal({...p,vehicles:['wagon','compact','fake']}),/invalid|damaged/);
 assert.throws(()=>beginChaosJournal({...p,names:['Alice','Alice','Drew']}),/distinct/);
});
test('CCC-6: save/resume an interrupted discard and subsequent stock draw without losing a card',()=>{
 let state=begin();
 state=play(state,{action:'pass'});
 assert.equal(state.game.step,'discard');
 assert.equal(state.game.discardsLeft,2);
 const recovered=decodeChaosJournal(encodeChaosJournal(state.journal));
 assert.deepEqual(recovered.game,state.game,'crash mid-turn must preserve exact discard count');
 state={game:recovered.game,journal:recovered.journal};
 state=finishDiscard(state);
 assert.equal(state.game.turn,1);
 state=play(state,{action:'pass'});
 state=finishDiscard(state);
 assert.equal(state.game.turn,0);
 assert.equal(state.game.step,'draw');
 state=play(state,{action:'draw',choice:'deck'});
 assert.equal(state.game.step,'play');
 assert.equal(state.game.players[0].hand.length,7);
 const second=decodeChaosJournal(encodeChaosJournal(state.journal));
 assert.deepEqual(second.game,state.game);
 assert.deepEqual(second.journal.events.at(-1).move,{action:'draw',choice:'deck'});
});
test('CCC-6: robot batch interrupted/resumed is replayable without revealing computer hands',()=>{
 let state=begin(plan(['easy','normal','human']));
 const result=advanceChaosComputerTurns(state.game,{maxActions:96});
 assert.ok(result.moves.length>=4);
 const events=[];let cursor=state.game;
 for(const move of result.moves){
  const player=cursor.players[cursor.turn].id;
  events.push({kind:'move',player,move});
  cursor=takeChaosTurn(cursor,{player,...move});
 }
 assert.deepEqual(cursor,result.game);
 state={game:result.game,journal:appendChaosJournal(state.journal,state.game,result.game,events)};
 const saved=decodeChaosJournal(encodeChaosJournal(state.journal));
 assert.deepEqual(saved.game,result.game);
 assert.equal(saved.game.turn,2);
 assert.match(renderChaosGame({game:saved.game,revealed:false}),/Pass the device to Casey/);
 assert.doesNotMatch(renderChaosGame({game:saved.game,revealed:false}),/ccc-hand-card|data-chaos-move=/);
 const bot=begin(plan(['normal','human'])).game;
 assert.doesNotMatch(renderChaosGame({game:bot,revealed:true}),/ccc-hand-card/);
});
test('CCC-6: persistence rejects corrupted envelopes, hidden-state edits and illegal move transcripts',()=>{
 const state=begin(),raw=encodeChaosJournal(state.journal);
 for(const bad of ['garbage','{}','[]',raw+' ',raw.slice(0,-1),'{'.repeat(CHAOS_SAVE_MAX_BYTES+129)]){
  assert.throws(()=>decodeChaosJournal(bad),/invalid|damaged/);
 }
 const envelope=JSON.parse(raw);
 envelope.payload=envelope.payload.replace('"seed":4626','"seed":4627');
 assert.throws(()=>decodeChaosJournal(JSON.stringify(envelope)),/invalid|damaged/);
 const fraudulent=structuredClone(state.journal);
 fraudulent.events=[{kind:'move',player:1,move:{action:'pass'}}];
 assert.throws(()=>replayChaosJournal(fraudulent),/invalid|damaged/);
 fraudulent.events=[{kind:'move',player:0,move:{action:'draw',choice:'deck'}}];
 assert.throws(()=>replayChaosJournal(fraudulent),/invalid|damaged/);
 fraudulent.events=[{kind:'stage'}];
 assert.throws(()=>replayChaosJournal(fraudulent),/invalid|damaged/);
 fraudulent.events=[{kind:'move',player:0,move:{action:'pass',target:1}}];
 assert.throws(()=>replayChaosJournal(fraudulent),/invalid|damaged/);
 fraudulent.events=[{kind:'move',player:0,move:{action:'pass',__protoPollution:true}}];
 assert.throws(()=>replayChaosJournal(fraudulent),/invalid|damaged/);
 const forged=structuredClone(state.journal);forged.plan.extra={privateHand:['bad']};
 assert.throws(()=>replayChaosJournal(forged),/invalid|damaged/);
});
test('CCC-6: storage is optional, quota failures report truth and stale saves cannot be trusted',()=>{
 const storage=memory(),journal=begin().journal;
 assert.equal(CHAOS_TAB_KEY!==CHAOS_DEVICE_KEY,true);
 assert.deepEqual(readChaosStorage(storage,CHAOS_DEVICE_KEY),{status:'empty'});
 assert.equal(writeChaosStorage(storage,CHAOS_TAB_KEY,journal).ok,true);
 assert.equal(readChaosStorage(storage,CHAOS_TAB_KEY).status,'ready');
 assert.equal(readChaosStorage(storage,CHAOS_DEVICE_KEY).status,'empty',
  'writing the automatic tab save must not silently persist a device save');
 assert.equal(removeChaosStorage(storage,CHAOS_TAB_KEY),true);
 assert.equal(readChaosStorage(storage,CHAOS_TAB_KEY).status,'empty');
 const quota={getItem:()=>null,setItem:()=>{throw Error('QuotaExceededError');},removeItem:()=>{throw Error('SecurityError');}};
 assert.equal(writeChaosStorage(quota,CHAOS_DEVICE_KEY,journal).ok,false);
 assert.equal(removeChaosStorage(quota,CHAOS_DEVICE_KEY),false);
 storage.setItem(CHAOS_DEVICE_KEY,'{malformed');
 assert.equal(readChaosStorage(storage,CHAOS_DEVICE_KEY).status,'invalid');
 assert.equal(readChaosStorage(null,CHAOS_DEVICE_KEY).status,'empty');
});
test('CCC-6: full three-stage championship can be replayed after closures and region boundaries',()=>{
 let state=begin(),actions=0;
 for(;actions<2000&&state.game.phase!=='finished';actions++){
  const s=state.game;
  if(s.phase==='between'){
   const after=advanceChaosLeg(s);
   state={game:after,journal:appendChaosJournal(state.journal,s,after,[{kind:'stage'}])};
  }else if(s.step==='discard')state=play(state,{action:'discard',index:0});
  else if(s.step==='draw')state=play(state,{action:'draw',choice:'deck'});
  else{
   const choices=chaosActionOptions(s);
   const option=choices.find(o=>o.action==='drive')||
    choices.find(o=>o.action==='fix')||
    choices.find(o=>o.action==='recover')||
    choices.find(o=>o.action==='pass');
   assert.ok(option);
   state=play(state,{action:option.action,index:option.index,target:option.target});
  }
  if(actions%61===0){
   const {game,journal}=decodeChaosJournal(encodeChaosJournal(state.journal));
   assert.deepEqual(game,state.game,'journal must reconstruct identical regional state');
   state={game,journal};
  }
 }
 assert.ok(actions<2000,'exhausted regional stock must not strand the race');
 assert.equal(state.game.phase,'finished');
 assert.equal(state.game.results.length,3);
 const last=decodeChaosJournal(encodeChaosJournal(state.journal));
 assert.deepEqual(last.game,state.game);
 for(const driver of last.game.players)assert.equal(
  driver.score,last.game.results.reduce((n,stage)=>n+stage.standings.find(x=>x.id===driver.id).banked,0));
 assert.match(renderChaosGame({game:last.game,revealed:false}),/Coast-to-coast championship complete/);
 assert.doesNotMatch(renderChaosGame({game:last.game,revealed:true}),/ccc-hand-card|data-chaos-move=/);
});
test('CCC-6: exhausted stock recycles discards, preserves visible top and does not strand turn',()=>{
 let game=createChaosGame({names:['Alpha','Beta'],seed:3});
 game.players[0].hand=game.players[0].hand.slice(0,5);
 game.step='draw';game.deck=[];game.discard=[
  {type:'mileage',uid:800001,km:100},{type:'mileage',uid:800002,km:150},
  {type:'mileage',uid:800003,km:500}];
 const next=takeChaosTurn(game,{player:0,action:'draw',choice:'deck'});
 assert.equal(next.players[0].hand.length,7);
 assert.equal(next.discard.length,1);
 assert.equal(next.discard[0].km,500);
 assert.equal(next.step,'play');
 const empty=createChaosGame({names:['Alpha','Beta'],seed:3});
 empty.deck=[];empty.discard=[];empty.players[0].hand=[];empty.step='draw';
 const drawn=takeChaosTurn(empty,{player:0,action:'draw',choice:'deck'});
 assert.equal(drawn.step,'play');
 const passed=takeChaosTurn(drawn,{player:0,action:'pass'});
 assert.equal(passed.turn,1,'empty deck must not strand the other player');
});
test('CCC-6: adverse card effects and late repair cannot forge save authority',()=>{
 const game=createChaosGame({names:['Alpha','Beta'],seed:12});
 game.players[0].hand[0]={type:'hazard',id:'cabot',name:'Detour',kind:'detour',category:'navigation',amount:150,uid:901};
 const attacked=takeChaosTurn(game,{player:0,action:'hazard',index:0,target:1});
 assert.equal(attacked.players[1].km,0);
 assert.equal(attacked.players[1].detourLoss,0);
 assert.equal(game.players[1].detourLoss,0,'canonical reducer remains immutable');
 assert.throws(()=>takeChaosTurn(game,{player:0,action:'hazard',index:0,target:0}),/eligible opponent/);
 const before=begin();
 const forged=structuredClone(before.journal);
 forged.events=[{kind:'move',player:0,move:{action:'hazard',index:0,target:0}}];
 assert.throws(()=>replayChaosJournal(forged),/invalid|damaged/);
});
test('CCC-6: responsive UI and release build ship no hidden hands or auto-enrollment in device saving',async()=>{
 const root=resolve(import.meta.dirname,'..');
 const [ui,app,shell,css,build,gate]=await Promise.all([
  'core/classics-ui.js','app.js','core/app-shell.js','ccc-tabletop.css',
  'scripts/build.mjs','scripts/qualify-web.mjs'].map(p=>readFile(resolve(root,p),'utf8')));
 const intro=renderChaosGame({saveInfo:{available:true}});
 assert.match(intro,/Resume saved championship/);
 assert.match(intro,/Delete saved championship/);
 const corrupt=renderChaosGame({saveInfo:{invalid:true}});
 assert.match(corrupt,/could not be validated/);
 assert.doesNotMatch(corrupt,/Resume saved championship/);
 const state=begin();
 state.game.players[0].hand[0].name='HIDDEN_HAND_1987';
 const sealed=renderChaosGame({game:state.game,revealed:false,
  saveInfo:{deviceSaving:false,notice:'Storage <script>alert(1)</script>'}});
 assert.match(sealed,/Save on this device/);
 assert.match(sealed,/private hands/i);
 assert.doesNotMatch(sealed,/HIDDEN_HAND_1987|<script>alert\(1\)<\/script>|ccc-hand-card/);
 assert.match(sealed,/&lt;script&gt;/);
 const active=renderChaosGame({game:state.game,revealed:false,saveInfo:{deviceSaving:true}});
 assert.match(active,/Stop saving on this device/);
 assert.doesNotMatch(active,/Save on this device<\/button>/);
 assert.match(app,/refreshChaosRecovery\(\)/);
 assert.match(app,/recordChaosTransition\(before,result\.game,events\)/);
 assert.match(app,/recordChaosTransition\(previous,updated,/);
 assert.match(app,/recordChaosTransition\(before,after,/);
 assert.match(app,/chaosGeneration/);
 assert.match(shell,/chaosSaveInfo/);
 assert.match(ui,/data-chaos-action="resume"/);
 assert.match(css,/min-block-size:44px/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(build,/for\(const item of \['index\.html','app\.js'/);
 assert.match(gate,/CCC-6 save\/resume and offline mobile release qualification failed/);
 assert.match(gate,/baseTotal:1157\*1024/);
 const shellOutput=renderApplicationShell({pathname:'/classics/cross-country-chaos',
  walletView:{connected:false},chaosSaveInfo:{available:true}});
 assert.match(shellOutput,/Resume saved championship/);
 assert.doesNotMatch(shellOutput,/Wallet.*required.*Cross-Country Chaos/);
});
