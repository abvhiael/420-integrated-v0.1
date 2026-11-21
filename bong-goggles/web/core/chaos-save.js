// CCC-6: bounded, replay-validated local save journal. No network, wallet or shared account state.
// The shuffle seed allows reconstructing private hands: device persistence must be explicit.
import {createChaosGame,chaosActionOptions,takeChaosTurn,advanceChaosLeg} from './cross-country-chaos.js';
import {configureChaosComputerSeats} from './chaos-computer.js';
import {applyChaosVehicleSelection,CHAOS_VEHICLES} from './chaos-vehicles.js';

export const CHAOS_SAVE_FORMAT='ccc-6-offline-journal-v1';
export const CHAOS_TAB_KEY='bonggoggles.ccc6.tab.v1';
export const CHAOS_DEVICE_KEY='bonggoggles.ccc6.device.v1';
export const CHAOS_SAVE_MAX_EVENTS=4096;
export const CHAOS_SAVE_MAX_BYTES=400_000;

const fail=()=>{throw Error('Saved championship is invalid or damaged. Delete this save to start again.');};
const valid=(condition)=>{if(!condition)fail();};
const own=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).sort().join('|')===keys.slice().sort().join('|');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=value=>{
 // A corruption detector, not an authentication signature. Replay validates every action.
 let h=2166136261;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
 return (h>>>0).toString(16).padStart(8,'0');
};
function initial(plan){
 valid(own(plan,['names','seed','controllers','vehicles']));
 valid(Array.isArray(plan.names)&&Array.isArray(plan.controllers)&&
  Array.isArray(plan.vehicles)&&plan.names.length===plan.controllers.length&&
  plan.names.length===plan.vehicles.length&&plan.names.length>=2&&plan.names.length<=4);
 valid(Number.isSafeInteger(plan.seed)&&plan.seed>=0&&plan.seed<=0xffffffff);
 valid(plan.controllers.every(x=>['human','easy','normal','hard'].includes(x))&&
  plan.controllers.includes('human'));
 valid(plan.vehicles.every(x=>CHAOS_VEHICLES.some(v=>v.id===x)));
 return configureChaosComputerSeats(
  applyChaosVehicleSelection(createChaosGame({names:plan.names,seed:plan.seed}),plan.vehicles),
  plan.controllers);
}
function normalizeMove(move){
 valid(move&&typeof move==='object'&&!Array.isArray(move));
 valid(Object.keys(move).every(k=>['action','index','choice','target','useBoost'].includes(k)));
 valid(['draw','discard','drive','hazard','fix','recover','power','pass'].includes(move.action));
 const out={action:move.action};
 if(move.index!==undefined&&move.index!==null){
  valid(Number.isInteger(move.index)&&move.index>=0&&move.index<7);
  out.index=move.index;
 }
 if(move.choice!==undefined&&move.choice!==null){
  valid(move.action==='draw'&&['deck','discard'].includes(move.choice));
  out.choice=move.choice;
 }
 if(move.target!==undefined&&move.target!==null){
  valid(move.action==='hazard'&&Number.isInteger(move.target)&&move.target>=0&&move.target<4);
  out.target=move.target;
 }
 if(move.useBoost!==undefined&&move.useBoost!==false){
  valid(move.action==='drive'&&move.useBoost===true);
  out.useBoost=true;
 }
 return out;
}
function applyEvent(s,event){
 valid(event!==null&&typeof event==='object'&&!Array.isArray(event));
 if(event.kind==='stage'){
  valid(own(event,['kind'])&&s.phase==='between');
  return advanceChaosLeg(s);
 }
 valid(own(event,['kind','player','move'])&&event.kind==='move'&&s.phase==='playing');
 valid(Number.isInteger(event.player)&&event.player===s.players[s.turn]?.id);
 const move=normalizeMove(event.move);
 const legal=chaosActionOptions(s).some(o=>
  o.action===move.action&&o.index===move.index&&o.choice===move.choice&&o.target===move.target);
 valid(legal);
 if(move.useBoost)valid(s.players[s.turn].upgrades.some(u=>
   u.id==='shortcut-specialist'&&!s.players[s.turn].used.includes(u.id)));
 return takeChaosTurn(s,{player:event.player,...move});
}
export function beginChaosJournal(plan){
 initial(plan);
 return {format:CHAOS_SAVE_FORMAT,plan:structuredClone(plan),events:[]};
}
export function replayChaosJournal(journal){
 valid(own(journal,['format','plan','events'])&&journal.format===CHAOS_SAVE_FORMAT);
 valid(Array.isArray(journal.events)&&journal.events.length<=CHAOS_SAVE_MAX_EVENTS);
 let game=initial(journal.plan);
 for(const event of journal.events)game=applyEvent(game,event);
 return game;
}
export function appendChaosJournal(journal,before,after,events){
 valid(Array.isArray(events)&&events.length>0&&
  journal?.events?.length+events.length<=CHAOS_SAVE_MAX_EVENTS);
 let game=before;
 const canonical=[];
 for(const event of events){
  const e=event?.kind==='stage'?{kind:'stage'}:
   {kind:'move',player:event?.player,move:normalizeMove(event?.move)};
  game=applyEvent(game,e);
  canonical.push(e);
 }
 valid(same(game,after));
 const updated={format:CHAOS_SAVE_FORMAT,plan:journal.plan,
  events:[...journal.events,...canonical]};
 valid(JSON.stringify(updated).length<=CHAOS_SAVE_MAX_BYTES);
 return updated;
}
export function encodeChaosJournal(journal){
 // An empty journal and a mid-discard journal are equally valid, but only
 // the canonical engine can determine their private cards on recovery.
 // Trusted appends already validated the exact transition against the engine.
 // Replaying the entire championship after every discard would be quadratic
 // on low-powered phones; replay ALL actions when loading a save instead.
 valid(own(journal,['format','plan','events'])&&journal.format===CHAOS_SAVE_FORMAT&&
  Array.isArray(journal.events)&&journal.events.length<=CHAOS_SAVE_MAX_EVENTS);
 const payload=JSON.stringify(journal);
 valid(payload.length<=CHAOS_SAVE_MAX_BYTES);
 return JSON.stringify({format:CHAOS_SAVE_FORMAT,payload,digest:digest(payload)});
}
export function decodeChaosJournal(raw){
 valid(typeof raw==='string'&&raw.length>0&&raw.length<=CHAOS_SAVE_MAX_BYTES+128);
 let envelope;
 try{envelope=JSON.parse(raw);}catch{fail();}
 valid(raw===JSON.stringify(envelope));
 valid(own(envelope,['format','payload','digest'])&&envelope.format===CHAOS_SAVE_FORMAT&&
  typeof envelope.payload==='string'&&envelope.payload.length<=CHAOS_SAVE_MAX_BYTES&&
  envelope.digest===digest(envelope.payload));
 let journal;
 try{journal=JSON.parse(envelope.payload);}catch{fail();}
 const game=replayChaosJournal(journal);
 return {journal,game};
}
export function readChaosStorage(storage,key){
 try{
  const raw=storage?.getItem(key);
  if(raw===null||raw===undefined)return {status:'empty'};
  return {status:'ready',...decodeChaosJournal(raw)};
 }catch{
  return {status:'invalid',message:'Saved championship could not be read or verified.'};
 }
}
export function writeChaosStorage(storage,key,journal){
 try{
  const value=encodeChaosJournal(journal);
  storage?.setItem(key,value);
  valid(storage&&storage.getItem(key)===value);
  return {ok:true};
 }catch{return {ok:false,message:'Browser storage is unavailable or full. Progress is not saved.'};}
}
export function removeChaosStorage(storage,key){
 try{storage?.removeItem(key);return storage?.getItem(key)===null;}catch{return false;}
}
