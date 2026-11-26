import {classicRequestFailure} from './classic-rooms.js';
// BC-2.4 host-only authenticated start for an immutable Labyrinth room.
// Never locally deal, score, advance a turn, or infer a verified match from 201.
import {isSubjectID} from './account-social.js';
import {normalizeLabyrinthSession} from './labyrinth-session.js';

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
async function principal(client){
 const response=await client.request('/v1/me');
 if(response.status!==200||response.data?.walletRequired!==false||
    !isSubjectID(response.data?.profile?.subject))throw Error('420ID account unavailable');
 return response.data.profile.subject;
}
const notify=(rooms,message)=>rooms.emit({...rooms.state,notice:message});
export function bindLabyrinthRoomStart(root,rooms,{history,onRouteChange,onRefresh}={}){
 const form=root.querySelector('[data-labyrinth-room-start]');
 if(!form||!rooms?.client?.enabled)return;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const room=rooms.state?.selected;
  if(form.dataset.busy||!room||room.gameId!=='labyrinth-cribbage'||
   room.status!=='ready'||room.host!==rooms.state?.viewer||!ID.test(room.id)||
   !Array.isArray(room.seats)||room.seats.length!==room.seatCount||
   room.seats[0]?.subject!==room.host||room.seats[0]?.controller!=='human'||
   room.seats.some(s=>!['human','bot'].includes(s.controller))||
   !['labyrinth-2p','labyrinth-3p','labyrinth-4p-partners',
     'labyrinth-4p-individual'].includes(room.variantId))return;
  form.dataset.busy='1';
  form.querySelector('button')?.setAttribute('disabled','');
  try{
   const actor=await principal(rooms.client);
   if(actor!==room.host||rooms.state?.selected?.id!==room.id)
    throw Error('Host or selected room changed');
   const response=await rooms.client.request('/v1/classic-sessions',{
    method:'POST',body:{roomId:room.id}
   });
   if(response.status===409){
    notify(rooms,'Room seats changed; refresh before starting Labyrinth.');
    await onRefresh?.();return;
   }
   if(response.status!==201)throw Error(classicRequestFailure(response,'Labyrinth match start'));
   const verified=normalizeLabyrinthSession({...response,status:200},actor);
   if(!verified||verified.session.roomId!==room.id||
    verified.session.gameId!=='labyrinth-cribbage'||
    verified.session.status!=='active'||verified.session.sequence!==1||
    verified.session.viewerSeat!==0||verified.view.variant!==room.variantId)
    throw Error('Incorrect or unverified Labyrinth match');
   if(await principal(rooms.client)!==actor||rooms.state?.selected?.id!==room.id)
    throw Error('Account or room changed during start');
   history?.pushState({},'','/games/labyrinth-cribbage/play?session='+
    encodeURIComponent(verified.session.id));
   onRouteChange?.();
  }catch(error){
   notify(rooms,error.message.startsWith('Labyrinth match start — ')?error.message:'Labyrinth start was not confirmed. Refresh this 420ID room; no cards or scores were generated.');
  }finally{
   delete form.dataset.busy;
   form.querySelector('button')?.removeAttribute('disabled');
  }
 });
}
