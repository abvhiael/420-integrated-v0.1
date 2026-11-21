// CCC-ART-6: events are derived exclusively from accepted before/after engine state.
// Transient animations NEVER influence authoritative mileage, hazards, cards or turns.
import {escapeHtml as esc} from './design-system.js';

const KINDS=Object.freeze(['drive','breakdown','detour','slowdown','defended',
 'repair','shortcut','power','legendary','shield','checkpoint','finish']);
const event=(kind,seats,title,detail)=>Object.freeze({
 kind,seats:Object.freeze([...seats]),title,detail
});
const changed=(before,after,id)=>[before.players.find(p=>p.id===id),after.players.find(p=>p.id===id)];
const activeHazard=(old,next)=>Boolean(next?.status&&(!old?.status||old.status.uid!==next.status.uid||
 old.status.id!==next.status.id||old.status.kind!==next.status.kind));
const addedProtection=(old,next)=>next.shield<old.shield||next.used.some(id=>!old.used.includes(id));

export function deriveChaosGameEffects(before,after,move){
 if(before?.version!==2||after?.version!==2||before.phase!=='playing'||!move||
  !Array.isArray(before.players)||!Array.isArray(after.players)||before.leg!==after.leg||
  before.players.length!==after.players.length)return null;
 const actor=before.players[before.turn],nextActor=after.players.find(p=>p.id===actor?.id);
 if(!actor||!nextActor)return null;
 const events=[],card=actor.hand?.[move.index];
 const emit=(kind,seats,title,detail)=>{
  if(KINDS.includes(kind))events.push(event(kind,seats,title,detail));
 };
 const hazardOutcome=(old,next)=>{
  if(!old||!next)return;
  if(next.detourLoss>old.detourLoss){
   const loss=next.detourLoss-old.detourLoss;
   emit('detour',[next.id],'Permanent detour','−'+loss+' km this stage');
  }else if(activeHazard(old,next)){
   const status=next.status;
   emit(status.kind==='block'?'breakdown':'slowdown',[next.id],
    status.kind==='block'?'Breakdown on the road':'Road conditions',status.name);
  }else if(addedProtection(old,next)){
   emit('defended',[next.id],'Hazard blocked','Vehicle equipment or legendary shield protected this driver');
  }
 };
 if(move.action==='drive'&&nextActor.played.length>actor.played.length){
  const added=nextActor.played.at(-1);
  if(added?.type==='mileage')emit('drive',[actor.id],'On the road',added.km+' km mileage card played');
  if(nextActor.slowLoss>actor.slowLoss)
   emit('slowdown',[actor.id],'Slow going','−'+(nextActor.slowLoss-actor.slowLoss)+' km from '+(actor.status?.name||'road conditions'));
  hazardOutcome(actor,nextActor); // Risky drives resolve a real regional hazard.
 }
 if(move.action==='hazard'&&card?.type==='hazard'&&
  nextActor.hand.length<actor.hand.length){
  const [old,target]=changed(before,after,move.target);
  if(old&&target&&target.id!==actor.id)hazardOutcome(old,target);
 }
 if(move.action==='fix'&&card?.type==='fix'&&nextActor.hand.length<actor.hand.length){
  if(card.id==='atlas'&&nextActor.bonusKm-actor.bonusKm===150)
   emit('shortcut',[actor.id],'Local shortcut','+150 km card bonus; permanent detours remain');
  else if(actor.status&&!nextActor.status)
   emit('repair',[actor.id],'Roadside repair',actor.status.name+' cleared');
 }
 if(move.action==='recover'&&actor.status&&!nextActor.status)
  emit('repair',[actor.id],'Emergency recovery','Hazard cleared; normal action and discards spent');
 if(move.action==='power'&&card&&after.spent.some(c=>c.uid===card.uid)&&
  !nextActor.hand.some(c=>c.uid===card.uid)){
  if(card.type==='upgrade'&&nextActor.upgrades.some(u=>u.uid===card.uid))
   emit('power',[actor.id],'Equipment installed',card.name+' ready for the road');
  if(card.type==='legendary'&&
   !before.retiredLegendaries.includes(card.id)&&after.retiredLegendaries.includes(card.id)){
   emit('legendary',[actor.id],'Legendary activated',card.name);
   if(card.id==='rodeo'&&nextActor.shield>actor.shield)
    emit('shield',[actor.id],'Legendary protection','+'+(nextActor.shield-actor.shield)+' hazard shields');
   if(card.id==='truck'&&actor.status&&!nextActor.status)
    emit('repair',[actor.id],'Truck to the rescue',actor.status.name+' cleared');
   if(card.id==='sunshine'){
    const cleared=before.players.filter(p=>p.status?.category==='weather'&&
     !after.players.find(q=>q.id===p.id)?.status);
    if(cleared.length)emit('repair',cleared.map(p=>p.id),'Skies clearing',
     cleared.length+' active weather hazard'+(cleared.length===1?'':'s')+' cleared');
   }
   if(card.id==='shortcut')hazardOutcome(actor,nextActor);
  }
 }
 if(move.action==='discard'&&after.turn!==before.turn){
  const next=after.players[after.turn],old=before.players.find(p=>p.id===next?.id);
  if(old?.status?.kind==='block'&&old.status.category==='mechanical'&&!next.status&&
   !old.used.includes('station-wagon')&&next.used.includes('station-wagon'))
   emit('repair',[next.id],'Station Wagon rescue','Automatic mechanical breakdown repair');
 }
 const moves=before.players.flatMap(old=>{
  const next=after.players.find(p=>p.id===old.id);
  return next&&Number.isFinite(old.km)&&Number.isFinite(next.km)&&next.km!==old.km?
   [Object.freeze({id:old.id,from:old.km,to:next.km})]:[];
 });
 if(!before.finishPending&&after.finishPending&&after.phase==='playing'){
  const reached=after.players.filter(p=>p.km>=2500).map(p=>p.id);
  if(reached.length)emit('checkpoint',reached,'Finish line reached','Finish the current turn cycle');
 }
 if(after.results.length>before.results.length&&['between','finished'].includes(after.phase)){
  const result=after.results.at(-1);
  const winners=result.winners.filter(id=>after.players.some(p=>p.id===id));
  if(winners.length)emit('finish',winners,after.phase==='finished'?'Coast-to-coast final stage':'Regional stage complete',
   winners.map(id=>after.players.find(p=>p.id===id).name).join(' & ')+' banked 2,500 championship km');
 }
 if(!events.length&&!moves.length)return null;
 return Object.freeze({leg:before.leg,events:Object.freeze(events),moves:Object.freeze(moves)});
}
const icons=Object.freeze({
 drive:'➜',breakdown:'⚠',detour:'↷',slowdown:'◷',defended:'◆',
 repair:'✚',shortcut:'↗',power:'✦',legendary:'★',
 shield:'◈',checkpoint:'⚑',finish:'★'
});
export function renderChaosGameEffects(effects,{suppressRepairs=false}={}){
 if(!effects||!Array.isArray(effects.events))return '';
 const events=effects.events.filter(e=>KINDS.includes(e.kind)&&
  !(suppressRepairs&&['repair','shortcut'].includes(e.kind)));
 if(!events.length)return '';
 return '<section class="ccc-effects-rail" role="status" aria-live="polite" aria-label="Latest public road-trip effects">'+
  events.map(e=>'<div class="ccc-game-effect ccc-game-effect--'+e.kind+'">'+
   '<span class="ccc-effect-symbol" aria-hidden="true">'+icons[e.kind]+'</span>'+
   '<div><strong>'+esc(e.title)+'</strong><span>'+esc(e.detail)+'</span></div></div>').join('')+'</section>';
}
export function renderChaosFinishEffects(effects){
 const finish=effects?.events?.find(e=>e.kind==='finish');
 if(!finish)return '';
 return '<div class="ccc-finish-celebration" role="status" aria-live="polite">'+
  '<span class="ccc-finish-banner" aria-hidden="true">★ ★ ★</span>'+
  '<div class="ccc-finish-confetti" aria-hidden="true">'+
  Array.from({length:14},(_,i)=>'<i class="ccc-finish-confetti-piece ccc-finish-confetti-piece--'+i+'"></i>').join('')+
  '</div><strong>'+esc(finish.title)+'</strong><span>'+esc(finish.detail)+'</span></div>';
}
export function chaosEffectKinds(){return KINDS;}
