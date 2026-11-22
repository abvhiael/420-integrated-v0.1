// BC-0.10: authenticated, bounded and reconnectable Classic room transport.
// Polling is a proxy-compatible equivalent to SSE: room revision + durable
// session sequence are authority, not browser-generated game state.
import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {normalizeClassicRoom} from './classic-rooms.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const isID=v=>typeof v==='string'&&UUID.test(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const envelope=response=>response?.status===200&&response.data?.onChain===false&&
 response.data?.wager===false&&response.data?.rewards===false;
const sessionStatuses=new Set(['active','finished','timed_out','resigned','cancelled']);
const eventKinds=new Set(['started','move','finished','timed_out','resigned','cancelled']);
const safeInstant=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
function safePresence(result,room){
 if(!envelope(result)||result.data.playable!==false)return null;
 const p=result.data.presence;
 if(!p||p.roomId!==room.id||p.revision!==room.revision||p.leaseSeconds!==20||
  !Array.isArray(p.seats)||p.seats.length>room.seatCount)return null;
 const humans=room.seats.filter(s=>s.controller==='human').map(s=>s.index);
 if(humans.length!==p.seats.length||p.seats.some((s,i)=>s?.seat!==humans[i]||typeof s.online!=='boolean'))return null;
 return Object.freeze({seats:Object.freeze(p.seats.map(s=>Object.freeze({seat:s.seat,online:s.online}))),leaseSeconds:20});
}
function safeSession(item,room){
 if(!item||!isID(item.id)||item.roomId!==room.id||item.gameId!==room.gameId||
  !integer(item.seatCount,2,4)||item.seatCount!==room.seatCount||
  !sessionStatuses.has(item.status)||!integer(item.sequence,1,Number.MAX_SAFE_INTEGER)||
  !((item.turnSeat===null||item.turnSeat===undefined)||integer(item.turnSeat,0,room.seatCount-1)))return null;
 return item;
}
function safeSessionView(result,item,room,viewer){
 if(!envelope(result))return null;
 const s=result.data.session;
 if(!safeSession(s,room)||s.id!==item.id||s.sequence<item.sequence||
  !integer(s.viewerSeat,0,room.seatCount-1)||room.seats[s.viewerSeat]?.subject!==viewer||
  room.seats[s.viewerSeat]?.controller!=='human'||!isID(s.id)||
  (s.deadline!==null&&s.deadline!==undefined&&!safeInstant(s.deadline)))return null;
 // The server sends privateView only to its authenticated seat. This
 // communications controller intentionally drops it, even in memory.
 return Object.freeze({id:s.id,roomId:s.roomId,gameId:s.gameId,sequence:s.sequence,
  status:s.status,turnSeat:s.turnSeat??null,viewerSeat:s.viewerSeat,
  deadline:s.deadline??null});
}
function safeEvents(result,session,after){
 if(!envelope(result)||!Array.isArray(result.data.events)||result.data.events.length>50||
  !integer(result.data.sequence,1,Number.MAX_SAFE_INTEGER)||
  result.data.sequence!==session.sequence)return null;
 let seq=after;
 for(const event of result.data.events){
  if(!event||!integer(event.sequence,1,Number.MAX_SAFE_INTEGER)||
   event.sequence!==seq+1||event.sequence>session.sequence||
   !eventKinds.has(event.kind)||
   event.actorSeat!=null&&!integer(event.actorSeat,0,3)||
   !safeInstant(event.occurredAt)||!event.publicState||
   typeof event.publicState!=='object'||Array.isArray(event.publicState)||
   Object.keys(event.publicState).some(x=>!['status','turnSeat','deadline','winnerSeat','finishedReason'].includes(x)))
   return null;
  seq=event.sequence;
 }
 if(result.data.sequence!==seq)return null;
 return true;
}

// A lost browser tab, worker, Render process or network never owns the clock,
// seat, score, private cards or match result. Reconnect reads authoritative
// room/session projections and replays contiguous PUBLIC events only.
export class ClassicCommunicationsController {
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{},onRoom=()=>{}}={}){
  this.enabled=enabled===true;
  this.client=createAccountSocialClient({enabled:this.enabled,fetchImpl});
  this.onChange=onChange;this.onRoom=onRoom;
  this.generation=0;this.busy=false;this.state={status:this.enabled?'idle':'disabled'};
 }
 emit(x){
  if(JSON.stringify(x)===JSON.stringify(this.state))return this.state;
  this.state=Object.freeze(x);this.onChange(this.state);return this.state;
 }
 invalidate(){
  this.generation++;
  return this.emit({status:this.enabled?'idle':'disabled'});
 }
 async sync({room,viewer}={}){
  if(!this.enabled)return this.state;
  if(!room||!isID(room.id)||!isSubjectID(viewer)){
   if(this.state.status!=='idle')this.invalidate();
   return this.state;
  }
  // An invited visitor/public viewer cannot claim presence or receive
  // private session updates before being admitted as a human player.
  if(!room.seats?.some(s=>s.controller==='human'&&s.subject===viewer))
   return this.emit({status:'spectator'});
  if(this.busy)return this.state;
  const gen=++this.generation,roomId=room.id;
  const previous=this.state;
  this.busy=true;
  const alive=()=>gen===this.generation;
  const fail=(status)=>{
   if(!alive())return this.state;
   this.onRoom(null);
   return this.emit({status});
  };
  const get=async path=>this.client.request(path);
  try{
   // A tab can switch accounts while another request is in flight. Confirm
   // identity every cycle, and recheck it after the complete read bundle.
   const me=await get('/v1/me');
   if(!alive())return this.state;
   if(me.status===401)return fail('guest');
   if(me.status!==200||me.data?.walletRequired!==false||
    me.data.profile?.subject!==viewer)return fail('reconnecting');
   const result=await get('/v1/classic-rooms/'+roomId);
   if(!alive())return this.state;
   if(result.status===401)return fail('guest');
   if(result.status===403||result.status===404)return fail('revoked');
   const current=envelope(result)&&result.data.playable===false?
    normalizeClassicRoom(result.data.room,true):null;
   if(!current||current.id!==roomId||
    !current.seats.some(x=>x.controller==='human'&&x.subject===viewer))return fail('reconnecting');
   // A concurrent server-side seat mutation must never restore older state.
   if(previous.room?.id===roomId&&current.revision<previous.room.revision)return fail('reconnecting');
   const beat=await this.client.request('/v1/classic-rooms/'+roomId+'/presence',
     {method:'POST',body:{}});
   if(!alive())return this.state;
   if(beat.status===404)return fail('disabled');
   if(beat.status===401)return fail('guest');
   if(beat.status===403)return fail('revoked');
   let presence=safePresence(beat,current);
   if(!presence)return fail('reconnecting');
   // GET covers presence from all participating devices/processes. POST
   // itself returns the same schema after the lease commit.
   let session=null,notice='';
   if(current.status==='in_game'||current.status==='completed'){
    const listing=await get('/v1/classic-sessions');
    if(!alive())return this.state;
    if(listing.status===401)return fail('guest');
    if(!envelope(listing)||!Array.isArray(listing.data.sessions)||listing.data.sessions.length>50)
     return fail('reconnecting');
    const item=listing.data.sessions.find(x=>x.roomId===roomId);
    if(!item||!safeSession(item,current))return fail('reconnecting');
    const snapshot=await get('/v1/classic-sessions/'+item.id);
    if(!alive())return this.state;
    if(snapshot.status===401)return fail('guest');
    if(snapshot.status===404)return fail('revoked');
    session=safeSessionView(snapshot,item,current,viewer);
    if(!session)return fail('reconnecting');
    let after=previous.session?.id===session.id?previous.session.sequence:0;
    if(after>session.sequence)return fail('reconnecting');
    const events=await get('/v1/classic-sessions/'+session.id+'/events?after='+after);
    if(!alive())return this.state;
    if(events.status===409){
     // Gap (>50) or stale cursor: the independently verified snapshot
     // becomes the new anchor. No missing action is locally fabricated.
     notice='Connection restored from the latest verified match snapshot.';
    }else if(events.status===401)return fail('guest');
    else if(events.status===403||events.status===404)return fail('revoked');
    else if(!safeEvents(events,session,after))return fail('reconnecting');
    if(session.status==='active'&&session.turnSeat===session.viewerSeat&&
       (previous.session?.id!==session.id||previous.session.sequence!==session.sequence))
     notice="It's your turn. The server remains the move authority.";
    else if(previous.session?.id===session.id&&session.sequence>previous.session.sequence&&!notice)
     notice='The other player made a move. Your match view is up to date.';
   }
   const again=await get('/v1/me');
   if(!alive())return this.state;
   if(again.status!==200||again.data?.profile?.subject!==viewer)return fail('guest');
   const state=this.emit({status:'connected',room:current,presence,session,notice});
   this.onRoom(current);
   return state;
  }catch{
   return fail('reconnecting');
  }finally{
   this.busy=false;
  }
 }
}
