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
const starts=new WeakMap();
const temporary=s=>[429,502,503,504].includes(s);
const validMatch=(result,actor,room)=>{const verified=normalizeLabyrinthSession(result,actor);return verified&&verified.session.roomId===room.id&&verified.session.seatCount===room.seatCount&&verified.session.viewerSeat===0&&verified.view.variant===room.variantId?verified:null;};
async function recover(client,actor,room){
 const list=await client.request('/v1/classic-sessions');
 if(list.status!==200||list.data?.onChain!==false||list.data?.wager!==false||list.data?.rewards!==false||!Array.isArray(list.data.sessions)||list.data.sessions.length>50)return null;
 const matches=list.data.sessions.filter(s=>s.roomId===room.id&&s.gameId==='labyrinth-cribbage'&&ID.test(s.id));
 if(matches.length!==1)return null;
 const result=await client.request('/v1/classic-sessions/'+matches[0].id);
 return validMatch(result,actor,room);
}
const notify=(rooms,message)=>rooms.emit({...rooms.state,notice:message});
export function bindLabyrinthRoomStart(root,rooms,{history,onRouteChange,onRefresh,isCurrentRoom=()=>true}={}){
 const form=root.querySelector('[data-labyrinth-room-start]');
 if(!form||!rooms?.client?.enabled)return;
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const room=rooms.state?.selected;
  if(starts.has(rooms)||form.dataset.busy||!room||room.gameId!=='labyrinth-cribbage'||
   room.status!=='ready'||room.host!==rooms.state?.viewer||!ID.test(room.id)||
   !Array.isArray(room.seats)||room.seats.length!==room.seatCount||
   room.seats[0]?.subject!==room.host||room.seats[0]?.controller!=='human'||
   room.seats.some(s=>!['human','bot'].includes(s.controller))||
   !['labyrinth-2p','labyrinth-3p','labyrinth-4p-partners',
     'labyrinth-4p-individual'].includes(room.variantId))return;
  const token={};starts.set(rooms,token);
  form.dataset.busy='1';
  form.querySelector('button')?.setAttribute('disabled','');
  try{
   const actor=await principal(rooms.client);
   if(actor!==room.host||!isCurrentRoom(room.id)||rooms.state?.selected?.id&&rooms.state.selected.id!==room.id)
    throw Error('Host or selected room changed');
   const response=await rooms.client.request('/v1/classic-sessions',{
    method:'POST',body:{roomId:room.id}
   });
   let verified=null;
   if(response.status===201)verified=validMatch({...response,status:200},actor,room);
   else if(response.status===409||temporary(response.status))verified=await recover(rooms.client,actor,room);
   else throw Error(classicRequestFailure(response,'Labyrinth match start'));
   if(!verified)throw Error('Incorrect or unverified Labyrinth match');
   if(await principal(rooms.client)!==actor||!isCurrentRoom(room.id)||rooms.state?.selected?.id&&rooms.state.selected.id!==room.id)
    throw Error('Account or room changed during start');
   history?.pushState({},'','/games/labyrinth-cribbage/play?session='+
    encodeURIComponent(verified.session.id));
   onRouteChange?.();
  }catch(error){
   notify(rooms,error.message.startsWith('Labyrinth match start — ')?error.message:'Labyrinth start was not confirmed. Refresh this 420ID room or My Games to recover any match already created.');
  }finally{
   if(starts.get(rooms)===token)starts.delete(rooms);
   delete form.dataset.busy;
   form.querySelector('button')?.removeAttribute('disabled');
  }
 });
}
