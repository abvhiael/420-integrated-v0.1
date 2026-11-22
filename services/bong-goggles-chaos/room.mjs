// Cross Country Chaos — server-owned, account-scoped multiplayer authority.
// This module MUST run only on the trusted game service, never as a browser rules host.
// It reuses the frozen CCC-1–6 engine without forking its rules or random deck logic.
import {randomBytes,randomInt,randomUUID} from 'node:crypto';
import {createChaosGame,chaosActionOptions,takeChaosTurn,advanceChaosLeg} from '../../bong-goggles/web/core/cross-country-chaos.js';
import {configureChaosComputerSeats,advanceChaosComputerTurns,isChaosComputer} from '../../bong-goggles/web/core/chaos-computer.js';
import {applyChaosVehicleSelection,CHAOS_VEHICLES} from '../../bong-goggles/web/core/chaos-vehicles.js';

export const CHAOS_ROOM_RULESET='ccc-multiplayer-v1';
export class MatchError extends Error {
 constructor(status,message){super(message);this.status=status;}
}
const invalid=(message='Invalid match request')=>{throw new MatchError(400,message);};
const forbidden=()=>{throw new MatchError(404,'Match not found');};
const conflict=(message='Match has changed; refresh before retrying')=>{throw new MatchError(409,message);};
const safeName=value=>typeof value==='string'&&value.length<=80&&value.trim().length>=1?
 value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,24):'Member';
const uid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const subject=value=>typeof value==='string'&&uid.test(value);
const vehicleNames=new Set(CHAOS_VEHICLES.map(v=>v.id));
const cpuLevels=new Set(['easy','normal','hard']);
const publicCard=c=>c?Object.fromEntries(Object.entries(c).filter(([k])=>k!=='uid')):null;
const publicDriver=p=>({
 id:p.id,name:p.name,km:p.km,score:p.score,wins:p.wins,played:p.played.map(publicCard),
 status:p.status?publicCard(p.status):null,upgrades:p.upgrades.map(publicCard),
 used:[...p.used],shield:p.shield,detourLoss:p.detourLoss,slowLoss:p.slowLoss,
 controller:p.controller,difficulty:p.difficulty,vehicle:p.vehicle
});
const ownerSeat=(room,actor)=>room.seats.findIndex(s=>s.subject===actor);
const member=(room,actor)=>{if(ownerSeat(room,actor)<0)forbidden();};
const normalizeMove=move=>{
 if(!move||typeof move!=='object'||Array.isArray(move)||
    Object.keys(move).some(k=>!['action','index','choice','target','useBoost'].includes(k)))
  invalid('Invalid move');
 const {action,index,choice,target,useBoost}=move;
 if(!['draw','discard','drive','hazard','fix','recover','power','pass'].includes(action))invalid('Invalid action');
 if(index!==undefined&&(!Number.isInteger(index)||index<0||index>6))invalid('Invalid card slot');
 if(choice!==undefined&& !['deck','discard'].includes(choice))invalid('Invalid draw option');
 if(target!==undefined&&(!Number.isInteger(target)||target<0||target>3))invalid('Invalid opponent');
 if(useBoost!==undefined&&typeof useBoost!=='boolean')invalid('Invalid boost');
 const out={action};
 if(index!==undefined)out.index=index;
 if(choice!==undefined)out.choice=choice;
 if(target!==undefined)out.target=target;
 if(useBoost===true)out.useBoost=true;
 return out;
};
// A 32-bit deterministic local seed must NEVER determine private online hands.
// Preserve the frozen region's exact physical inventory, but CSPRNG-redeal
// hands and stock after each canonical regional setup. Public action random
// hazards still use the original qualified engine seed.
function secureRegionalDeal(game){
 const pool=[...game.players.flatMap(p=>p.hand),...game.deck];
 for(let i=pool.length-1;i>0;i--){
  const j=randomInt(i+1),temp=pool[i];
  pool[i]=pool[j];pool[j]=temp;
 }
 for(const p of game.players)p.hand=pool.splice(0,7);
 game.deck=pool;
 return game;
}
function bots(game){
 let state=game,actions=0;
 while(state.phase==='playing'&&isChaosComputer(state.players[state.turn])){
  if(actions>=4096)throw new MatchError(503,'Computer turn budget exceeded');
  const run=advanceChaosComputerTurns(state,{maxActions:96});
  if(!run.moves.length)throw new MatchError(503,'Computer turn did not advance');
  actions+=run.moves.length;state=run.game;
 }
 return state;
}
export function makeRoom(actor,name,{humanSeats=2,bots:computer=[],vehicle='wagon'}={}){
 if(!subject(actor))invalid('Verified 420ID subject required');
 if(!Number.isInteger(humanSeats)||humanSeats<1||humanSeats>4||!Array.isArray(computer)||
   humanSeats+computer.length<2||humanSeats+computer.length>4||
   !computer.every(x=>cpuLevels.has(x))||!vehicleNames.has(vehicle))invalid('Choose 2–4 seats');
 const now=new Date().toISOString();
 const seats=[{subject:actor,name:safeName(name),controller:'human',difficulty:null,vehicle},
  ...Array.from({length:humanSeats-1},()=>({subject:null,name:null,controller:'human',difficulty:null,vehicle:'compact'})),
  ...computer.map((difficulty,i)=>({subject:null,name:['Easy','Normal','Hard'].find(v=>v.toLowerCase()===difficulty)+' computer '+(i+1),
    controller:'computer',difficulty,vehicle:CHAOS_VEHICLES[(humanSeats+i)%CHAOS_VEHICLES.length].id}))];
 return {id:randomUUID(),code:randomBytes(24).toString('base64url'),ruleset:CHAOS_ROOM_RULESET,
  chat:[],
  host:actor,seats,status:'lobby',revision:0,game:null,createdAt:now,updatedAt:now};
}
export function joinRoom(room,actor,name){
 if(!subject(actor)||room.status!=='lobby')conflict('Room is not accepting players');
 if(ownerSeat(room,actor)>=0)return room;
 const index=room.seats.findIndex(s=>s.controller==='human'&&!s.subject);
 if(index<0)conflict('Room is full');
 const next=structuredClone(room);
 next.seats[index].subject=actor;
 next.seats[index].name=safeName(name);
 next.revision++;next.updatedAt=new Date().toISOString();
 return next;
}
export function startRoom(room,actor){
 member(room,actor);
 if(room.host!==actor)forbidden();
 if(room.status!=='lobby')conflict();
 if(room.seats.some(s=>s.controller==='human'&&!s.subject))conflict('Waiting for all human players');
 // The shuffle seed is server-only, never exposed in public projections.
 const seed=randomBytes(4).readUInt32BE(0);
 const names=room.seats.map((s,i)=>String(s.name).slice(0,19)+' #'+(i+1));
 let game=createChaosGame({names,seed});
 game=configureChaosComputerSeats(game,room.seats.map(s=>s.controller==='computer'?s.difficulty:'human'));
 game=secureRegionalDeal(applyChaosVehicleSelection(game,room.seats.map(s=>s.vehicle)));
 const next=structuredClone(room);
 next.game=bots(game);next.status=next.game.phase;next.revision++;
 next.updatedAt=new Date().toISOString();
 return next;
}
export function moveRoom(room,actor,move){
 const seat=ownerSeat(room,actor);
 if(seat<0)forbidden();
 if(room.status!=='playing'||room.game?.phase!=='playing')conflict('The championship is not accepting moves');
 const game=room.game;
 if(game.turn!==seat||game.players[seat].controller!=='human')conflict("It is not this driver's turn");
 const action=normalizeMove(move);
 const legal=chaosActionOptions(game).some(o=>
  o.action===action.action&&o.index===action.index&&
  o.choice===action.choice&&o.target===action.target);
 if(!legal)conflict('The selected move is not legal for this hand');
 let after;
 try{after=takeChaosTurn(game,{player:seat,...action});}
 catch{conflict('The move was rejected by the championship rules');}
 const next=structuredClone(room);
 next.game=bots(after);next.status=next.game.phase;next.revision++;
 next.updatedAt=new Date().toISOString();
 return next;
}
export function continueRoom(room,actor){
 member(room,actor);
 if(room.host!==actor)forbidden();
 if(room.status!=='between'||room.game?.phase!=='between')conflict('Regional results are not ready');
 const next=structuredClone(room);
 next.game=bots(secureRegionalDeal(advanceChaosLeg(room.game)));next.status=next.game.phase;
 next.revision++;next.updatedAt=new Date().toISOString();
 return next;
}
// Server-authored, bounded chat lives with the room so reconnects and legs share
// the same history. It never consumes a game revision or touches private hands.
export function appendChaosChat(room,actor,value,{now=Date.now()}={}){
 member(room,actor);
 if(!Number.isFinite(now)||now<0||typeof value!=='string')invalid('Invalid room message');
 const text=value.replace(/\s+/gu,' ').trim();
 if(!text||Array.from(text).length>280||Buffer.byteLength(text,'utf8')>1024||
    /[\u0000-\u001f\u007f-\u009f]/u.test(text))invalid('Message must contain 1–280 visible characters');
 const seat=ownerSeat(room,actor),chat=Array.isArray(room.chat)?room.chat:[];
 const previous=[...chat].reverse().find(m=>m.seat===seat);
 if(previous&&now-Date.parse(previous.at)<1500)throw new MatchError(429,'Please slow down before sending another message');
 const next=structuredClone(room);
 next.chat=[...chat,{id:randomUUID(),seat,text,at:new Date(now).toISOString()}].slice(-80);
 next.updatedAt=new Date(now).toISOString();
 return next;
}
export function projectRoom(room,actor){
 const seat=ownerSeat(room,actor);
 if(seat<0)forbidden();
 const base={id:room.id,ruleset:room.ruleset,revision:room.revision,
  status:room.status,host:room.host===actor,seat,
  seats:room.seats.map((s,i)=>({seat:i,name:s.name??'Open seat',joined:s.controller==='computer'||Boolean(s.subject),
   controller:s.controller,difficulty:s.difficulty,vehicle:s.vehicle})),
  joinCode:room.status==='lobby'&&room.host===actor?room.code:null,
  chat:(Array.isArray(room.chat)?room.chat:[]).slice(-80).map(m=>({id:m.id,seat:m.seat,text:m.text,at:m.at}))};
 if(!room.game)return base;
 const g=room.game;
 return {...base,leg:g.leg,stageName:['The Down East Disaster','The Never-Ending Ontario','Prairie Madness & Mountain Mayhem'][g.leg],
  phase:g.phase,turn:g.turn,step:g.step,finishPending:g.finishPending,roundStart:g.roundStart,
  players:g.players.map(publicDriver),results:g.results,log:g.log.slice(0,12),
  stockCount:g.deck.length,discardCount:g.discard.length,discardTop:publicCard(g.discard.at(-1)),
  hand:g.players[seat].hand.map(publicCard),
  legal: g.phase==='playing'&&g.turn===seat?chaosActionOptions(g).map(o=>({...o})):[],
  discardRemaining:g.turn===seat?g.discardsLeft:0};
}
export function summarizeRoom(room,actor){
 member(room,actor);
 return {id:room.id,status:room.status,ruleset:room.ruleset,revision:room.revision,
  stage:room.game?.leg??0,activeSeat:room.game?.turn??null,seat:ownerSeat(room,actor),
  seats:room.seats.map(s=>({name:s.name??'Open seat',joined:s.controller==='computer'||Boolean(s.subject),
   controller:s.controller,difficulty:s.difficulty}))};
}
export function validateRevision(room,expected){
 if(!Number.isSafeInteger(expected)||expected<0||expected!==room.revision)conflict();
}
export function assertRoomShape(room){
 if(!room||room.ruleset!==CHAOS_ROOM_RULESET||!subject(room.host)||
   !Array.isArray(room.seats)||room.seats.length<2||room.seats.length>4||
   !['lobby','playing','between','finished'].includes(room.status)||
   !Number.isSafeInteger(room.revision)||room.revision<0)throw new MatchError(503,'Stored game is invalid');
 if(room.status!=='lobby'&&(!room.game||room.game.version!==2||room.game.phase!==room.status||
  room.game.players.length!==room.seats.length))throw new MatchError(503,'Stored game is invalid');
 return room;
}
