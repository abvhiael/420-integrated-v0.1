// BC-1.5: explicit host start and per-account restart discovery.
// This module never constructs hands, game state, scores, or a request cookie.
import {isSubjectID} from './account-social.js';
import {normalizeCribbageSnapshot,CRIBBAGE_RULES_HASH,CRIBBAGE_RULES_VERSION} from './cribbage-session.js';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validID=x=>typeof x==='string'&&ID.test(x);
const game='cribbage';
const envelope=r=>r?.data?.onChain===false&&r.data.wager===false&&r.data.rewards===false;
const statuses=new Set(['active','finished','resigned','timed_out','cancelled']);
function verifiedSummary(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||
  Object.keys(s).some(k=>!['id','roomId','gameId','seatCount','status','rulesVersion',
   'rulesHash','sequence','turnSeat','deadline','winnerSeat','finishedReason','updatedAt'].includes(k))||
  !validID(s.id)||!validID(s.roomId)||s.gameId!==game||
  s.rulesHash!==CRIBBAGE_RULES_HASH||s.rulesVersion!==CRIBBAGE_RULES_VERSION||
  ![2,3,4].includes(s.seatCount)||!statuses.has(s.status)||
  !Number.isSafeInteger(s.sequence)||s.sequence<1||
  !(s.turnSeat==null||Number.isInteger(s.turnSeat)&&s.turnSeat>=0&&s.turnSeat<s.seatCount)||
  !(s.winnerSeat==null||Number.isInteger(s.winnerSeat)&&s.winnerSeat>=0&&s.winnerSeat<s.seatCount))
  return null;
 return Object.freeze({id:s.id,roomId:s.roomId,seatCount:s.seatCount,
  sequence:s.sequence,status:s.status,turnSeat:s.turnSeat??null});
}
async function verifiedPrincipal(client){
 const result=await client.request('/v1/me');
 if(result.status!==200||result.data?.walletRequired!==false||
  !isSubjectID(result.data.profile?.subject))throw Error('A verified 420ID account is required');
 return result.data.profile.subject;
}
const deny=(rooms,message)=>rooms.emit({...rooms.state,notice:message});

// May be invoked only from a real click in the authenticated host's ready
// Cribbage room. Backend reauthorizes host, seats and exact rules under locks.
export function bindCribbageRoomStart(root,rooms,{history,onRouteChange,onRefresh}={}){
 const form=root.querySelector('[data-cribbage-room-start]');
 if(!form||!rooms?.client?.enabled)return;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const room=rooms.state?.selected;
  if(form.dataset.busy)return;
  if(!room||room.gameId!==game||room.status!=='ready'||room.host!==rooms.state.viewer||
   !validID(room.id)||!Array.isArray(room.seats)||room.seats.length!==room.seatCount||
   room.seats.some(s=>s.controller!=='human'&&s.controller!=='bot'))return;
  form.dataset.busy='1';
  form.querySelector('button')?.setAttribute('disabled','');
  try{
   const actor=await verifiedPrincipal(rooms.client);
   if(actor!==room.host||rooms.state.selected?.id!==room.id)throw Error('Host identity changed');
   const result=await rooms.client.request('/v1/classic-sessions',{
    method:'POST',body:{roomId:room.id}
   });
   if(result.status===401||result.status===403||result.status===404){
    deny(rooms,'Cribbage sessions are unavailable for this account or deployment.');return;
   }
   if(result.status===409){
    deny(rooms,'The room changed; recheck seats before starting.');
    await onRefresh?.();return;
   }
   if(result.status!==201||!envelope(result))throw Error('Unverified server match start');
   const s=normalizeCribbageSnapshot(result,actor);
   if(!s||s.gameId!==game||s.roomId!==room.id||s.viewerSeat!==0||
    s.status!=='active'||s.sequence!==1)throw Error('Incorrectly authorized Cribbage match');
   if(await verifiedPrincipal(rooms.client)!==actor)
    throw Error('420ID account changed during start');
   history?.pushState({},'','/games/cribbage/play?session='+encodeURIComponent(s.id));
   onRouteChange?.();
  }catch{
   deny(rooms,'Start was not confirmed. Refresh the 420ID room to check for an existing match.');
  }finally{
   delete form.dataset.busy;
   form.querySelector('button')?.removeAttribute('disabled');
  }
 });
}

// Server owns every match. This returns only participant-scoped metadata,
// NEVER the hidden opponent hands, crib, private journal or an auth secret.
export async function discoverCribbageMatches(controller){
 if(!controller?.client?.enabled)return [];
 const token=++controller.generation;
 try{
  const actor=await verifiedPrincipal(controller.client);
  const list=await controller.client.request('/v1/classic-sessions');
  if(token!==controller.generation)return [];
  if(list.status===401){controller.invalidate();controller.emit({status:'guest',recoverable:[]});return [];}
  if(list.status!==200||!envelope(list)||!Array.isArray(list.data.sessions)||
   list.data.sessions.length>50)throw Error('Session listing unavailable');
  const matches=[];
  for(const item of list.data.sessions){
   if(item?.gameId!==game)continue;
   const safe=verifiedSummary(item);
   if(!safe)throw Error('Untrusted Cribbage session summary');
   matches.push(safe);
  }
  if(token!==controller.generation)return [];
  if(await verifiedPrincipal(controller.client)!==actor)throw Error('420ID account switched');
  if(token===controller.generation)controller.emit({status:'idle',session:null,
   recoverable:matches,pegs:[],queue:[],announcement:'',error:null});
  return matches;
 }catch{
  if(token===controller.generation){
   controller.invalidate();
   controller.emit({status:'unavailable',recoverable:[],session:null,
    error:'Could not verify your 420ID sessions; no cached hands are shown.'});
  }
  return [];
 }
}
