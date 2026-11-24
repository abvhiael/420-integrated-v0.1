// Direct private solo setup: existing authoritative room and session endpoints.
import {normalizeClassicRoom} from './classic-rooms.js';
import {normalizeLabyrinthSession} from './labyrinth-session.js';
import {isSubjectID} from './account-social.js';

export async function startLabyrinthComputerGame(client,{players,difficulty,format},active=()=>true){
 if(!client.enabled||![2,3,4].includes(players)||!['easy','medium','hard'].includes(difficulty)||
    !['individual','partnerships'].includes(format))throw Error('Invalid computer match configuration');
 const check=()=>{if(!active())throw Error('Game setup cancelled');};
 const principal=async()=>{
  check();
  const r=await client.request('/v1/me');check();
  if(r.status!==200||r.data?.walletRequired!==false||!isSubjectID(r.data?.profile?.subject))
   throw Error('Sign in with 420ID before starting a game.');
  return r.data.profile.subject;
 };
 const actor=await principal();
 const variant=players===2?'labyrinth-2p':players===3?'labyrinth-3p':
  format==='individual'?'labyrinth-4p-individual':'labyrinth-4p-partners';
 const sameActor=async()=>{if(await principal()!==actor)throw Error('420ID account changed during setup');};
 const roomFrom=(r,expectedId)=>{
  check();
  const d=r.data,room=normalizeClassicRoom(d?.room,true);
  if(![200,201].includes(r.status)||d?.onChain!==false||d?.wager!==false||
     d?.rewards!==false||d?.playable!==false||!room||room.host!==actor||
     room.gameId!=='labyrinth-cribbage'||room.visibility!=='private'||
     room.seatCount!==players||room.variantId!==variant||(expectedId&&room.id!==expectedId)||
     !['open','ready'].includes(room.status)||room.seats[0].subject!==actor||
     room.seats[0].controller!=='human')throw Error('Computer game room was not confirmed.');
  return room;
 };
 let room=roomFrom(await client.request('/v1/classic-rooms',{method:'POST',body:{
  gameId:'labyrinth-cribbage',seatCount:players,visibility:'private',
  ...(players===4?{format}:{})}}));
 for(let seat=1;seat<players;seat++){
  await sameActor();
  if(room.seats[seat].controller!=='empty')throw Error('Unexpected occupied computer seat.');
  const previous=room;
  room=roomFrom(await client.request('/v1/classic-rooms/'+room.id+'/change',{
   method:'POST',body:{action:'bot',seat,difficulty,expectedRevision:room.revision}}),previous.id);
  if(room.revision<=previous.revision||room.seats.slice(1,seat+1).some(s=>s.controller!=='bot'||s.difficulty!==difficulty))
   throw Error('Computer seat was not confirmed.');
 }
 if(room.status!=='ready'||room.seats.slice(1).some(s=>s.controller!=='bot'||s.difficulty!==difficulty))
  throw Error('Computer opponents are not ready.');
 await sameActor();
 const response=await client.request('/v1/classic-sessions',{method:'POST',body:{roomId:room.id}});
 check();
 const match=normalizeLabyrinthSession({...response,status:200},actor);
 if(response.status!==201||!match||match.session.roomId!==room.id||
    match.session.viewerSeat!==0||match.session.status!=='active'||match.view.variant!==variant)
  throw Error('Game start was not confirmed. Check My Games before retrying.');
 await sameActor();
 return match.session.id;
}
