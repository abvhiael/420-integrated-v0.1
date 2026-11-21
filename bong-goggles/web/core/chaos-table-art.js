// CCC-ART-4: presentation-only roadside repair feedback. The rules engine is
// authoritative; effects are reported only after comparing a successful turn.
import {escapeHtml as esc} from './design-system.js';

export function deriveChaosTableFeedback(before,after,move){
 if(before?.version!==2||after?.version!==2||before.phase!=='playing'||after.phase!=='playing'||
    !move||!Array.isArray(before.players)||before.leg!==after.leg)return null;
 const player=before.players[before.turn],updated=after.players.find(p=>p.id===player?.id);
 if(!player||!updated)return null;
 const cue=(kind,seats,title,detail)=>Object.freeze({kind,seats:Object.freeze(seats),title,detail});
 if(move.action==='fix'){
  const card=player.hand[move.index];
  if(card?.type!=='fix')return null;
  if(card.id==='atlas'&&updated.bonusKm===player.bonusKm+150&&updated.detourLoss===player.detourLoss)
   return cue('shortcut',[player.id],'Shortcut found','+150 km card bonus · Permanent detours remain');
  if(player.status&&!updated.status)
   return cue('repair',[player.id],'Roadside repair complete',card.name+' cleared '+player.status.name);
 }
 if(move.action==='recover'&&player.status&&!updated.status)
  return cue('recovery',[player.id],'Emergency recovery','Hazard cleared · Action spent');
 if(move.action==='power'){
  const card=player.hand[move.index];
  if(card?.type!=='legendary')return null;
  if(card.id==='truck'&&player.status&&!updated.status)
   return cue('repair',[player.id],'A helping hand','Truck cleared your active hazard');
  if(card.id==='sunshine'){
   const cleared=before.players.filter(p=>p.status?.category==='weather'&&
    !after.players.find(q=>q.id===p.id)?.status).map(p=>p.id);
   if(cleared.length)return cue('repair',cleared,'Skies clearing','Active weather hazards cleared');
  }
 }
 if(move.action==='discard'&&after.turn!==before.turn){
  const next=after.players[after.turn],old=before.players.find(p=>p.id===next?.id);
  if(old?.status?.kind==='block'&&old.status.category==='mechanical'&&!next.status&&
    !old.used.includes('station-wagon')&&next.used.includes('station-wagon'))
   return cue('repair',[next.id],'Station Wagon to the rescue','Mechanical breakdown automatically repaired');
 }
 return null;
}
const repairGlyph='<svg class="ccc-repair-glyph" viewBox="0 0 64 64" width="48" height="48" aria-hidden="true" focusable="false">'+
 '<circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 5"/>'+
 '<path d="M42 10a15 15 0 0 0-18 19L12 41a7 7 0 0 0 10 10l12-12A15 15 0 0 0 53 21l-10 9-10-9Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>'+
 '<path d="m17 46 3 3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
export function renderChaosTableFeedback(feedback,seatId){
 if(!feedback||!['repair','recovery','shortcut'].includes(feedback.kind)||
   !Array.isArray(feedback.seats)||!feedback.seats.includes(seatId))return '';
 return '<div class="ccc-repair-feedback ccc-repair-feedback--'+feedback.kind+'" role="status" aria-live="polite">'+
  '<span class="ccc-repair-spark" aria-hidden="true">✦</span>'+repairGlyph+
  '<div><strong>'+esc(feedback.title)+'</strong><span>'+esc(feedback.detail)+'</span></div></div>';
}
