// BC-2.4 authenticated, seat-private 325-point Labyrinth match adapter.
// Production registration is separate. This module never creates scores/cards.
import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {normalizeClassicRoom} from './classic-rooms.js';
import {LABYRINTH_RULES_VERSION,LABYRINTH_MANIFEST_SHA,verifyLabyrinthProjection,labyrinthLegalMoves} from './labyrinth-cribbage-ui.js';
export const LABYRINTH_RULES_HASH='9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const statuses=new Set(['active','finished','resigned','timed_out','cancelled']);
const temporary=s=>[429,502,503,504].includes(s);
class TemporaryLabyrinthError extends Error{}
const terminal=new Set(['finished','resigned','timed_out']);
const arrays=['scores','hand','cardCounts','discarded','pegPile','pegged','saidGo','lastShow','lastAwards','losers'];
const allowed=['gameId','variant','round','phase','dealer','turn','seat','scores','hand',
 'cardCounts','cribCount','discarded','starter','pegCount','pegPile','pegged','saidGo',
 'lastShow','lastAwards','losers','winner'];
const noExtra=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>keys.includes(k));
function canonicalSession(result,viewer=null){
 if(result?.status!==200||result.data?.onChain!==false||result.data?.wager!==false||
  result.data?.rewards!==false)return null;
 const s=result.data.session;
 const keys=['id','roomId','gameId','seatCount','status','rulesVersion','rulesHash',
  'sequence','turnSeat','deadline','winnerSeat','finishedReason','updatedAt','viewerSeat','privateView'];
 if(!noExtra(s,keys)||!UUID.test(s.id)||!UUID.test(s.roomId)||!statuses.has(s.status)||
  s.gameId!=='labyrinth-cribbage'||s.rulesVersion!==LABYRINTH_RULES_VERSION||
  s.rulesHash!==LABYRINTH_RULES_HASH||![2,3,4].includes(s.seatCount)||
  !Number.isSafeInteger(s.sequence)||s.sequence<1||
  !Number.isSafeInteger(s.viewerSeat)||s.viewerSeat<0||s.viewerSeat>=s.seatCount||
  !(s.turnSeat===null||Number.isInteger(s.turnSeat)&&s.turnSeat>=0&&s.turnSeat<s.seatCount)||
  !(s.winnerSeat===null||Number.isInteger(s.winnerSeat)&&s.winnerSeat>=0&&s.winnerSeat<s.seatCount)||
  (s.deadline!==null&&(typeof s.deadline!=='string'||!Number.isFinite(Date.parse(s.deadline))))||
  !noExtra(s.privateView,allowed)||!allowed.every(k=>Object.hasOwn(s.privateView,k))||
  !arrays.every(k=>Array.isArray(s.privateView[k]))||
  viewer!==null&&!isSubjectID(viewer))return null;
 const v=s.privateView;
 const view=verifyLabyrinthProjection({
  verified:true,source:'qualified-account-games',gameId:s.gameId,
  rulesVersion:s.rulesVersion,manifestHash:LABYRINTH_MANIFEST_SHA,
  sessionId:s.id,sequence:s.sequence,status:s.status,seatCount:s.seatCount,
  variant:v.variant,viewerSeat:s.viewerSeat,turnSeat:s.turnSeat,
  dealer:v.dealer,round:v.round,phase:v.phase,scores:v.scores,hand:v.hand,
  cardCounts:v.cardCounts,cribCount:v.cribCount,discarded:v.discarded,
  starter:v.starter,pegCount:v.pegCount,pegPile:v.pegPile,pegged:v.pegged,
  saidGo:v.saidGo,lastShow:v.lastShow,lastAwards:v.lastAwards,
  winnerSeat:s.winnerSeat,losers:v.losers
 });
 if(!view||v.seat!==s.viewerSeat||
  (s.status==='active'&&v.turn!==s.turnSeat)||
  (s.status==='finished'&&v.winner!==s.winnerSeat))return null;
 return Object.freeze({session:Object.freeze({...s,privateView:undefined}),view});
}
export function normalizeLabyrinthSession(result,viewer=null){return canonicalSession(result,viewer);}
export class LabyrinthSessionController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});
  this.onChange=onChange;this.generation=0;this.busy=false;this.actor=null;
  this.state={status:enabled?'idle':'disabled',session:null,view:null,
    selection:[],recoverable:[],submitting:false,error:null};
 }
 emit(next){this.state=Object.freeze({...this.state,...next});this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.busy=false;this.actor=null;return this.emit({status:this.client.enabled?'idle':'disabled',
  session:null,view:null,selection:[],recoverable:[],submitting:false,error:null});}
 async principal(){
  const me=await this.client.request('/v1/me');
  if(me.status===401)return null;
  if(temporary(me.status))throw new TemporaryLabyrinthError('420ID temporarily unavailable; reconnecting.');
  if(me.status!==200||me.data?.walletRequired!==false||
    !isSubjectID(me.data?.profile?.subject))throw Error('420ID authentication unavailable');
  return me.data.profile.subject;
 }
 async open(id,{quiet=false}={}){
  if(!this.client.enabled||!UUID.test(id))return this.emit({status:'unavailable',
   error:'An authenticated 420ID session is required.',session:null,view:null});
  if(this.busy)return this.state;
  const generation=++this.generation,old=this.state.session?.id===id?this.state.session:null;
  this.busy=true;
  if(!old&&!quiet)this.emit({status:'loading',session:null,view:null,selection:[]});
  try{
   const principal=await this.principal();
   if(generation!==this.generation)return this.state;
   if(!principal){this.actor=null;return this.emit({status:'guest',session:null,view:null});}
   const sameActor=this.actor===principal;
   if(this.actor&&!sameActor)this.emit({status:'loading',session:null,view:null,selection:[],recoverable:[]});
   const result=await this.client.request('/v1/classic-sessions/'+id);
   if(generation!==this.generation)return this.state;
   if(temporary(result.status))throw new TemporaryLabyrinthError('Labyrinth service temporarily unavailable; reconnecting.');
   if([401,403,404].includes(result.status)){this.actor=null;return this.emit({status:'unavailable',session:null,view:null,
    error:'Session access denied or revoked.'});}
   const validated=canonicalSession(result,principal);
   if(!validated||validated.session.id!==id||old&&validated.session.sequence<old.sequence)
    throw Error('Unverified or stale Labyrinth session');
   if(old&&sameActor&&validated.session.viewerSeat===old.viewerSeat&&
      validated.session.sequence===old.sequence&&this.state.status==='ready')return this.state;
   this.actor=principal;
   return this.emit({status:'ready',...validated,selection:[],submitting:false,error:null});
  }catch(e){
   if(generation===this.generation&&(e instanceof TemporaryLabyrinthError||e instanceof TypeError))return this.emit({status:'reconnecting',session:old??null,view:null,selection:[],error:'Connection interrupted; recovering your existing match.'});
   if(generation===this.generation){this.actor=null;return this.emit({status:'unavailable',session:null,view:null,
    selection:[],error:e.message||'Session unavailable'});}
   return this.state;
  }finally{if(generation===this.generation)this.busy=false;}
 }
 select(selection){
  if(this.state.status!=='ready'||!this.state.view||!Array.isArray(selection)||selection.length>3||
    selection.some(c=>!Number.isSafeInteger(c)||!this.state.view.hand.includes(c))||
    new Set(selection).size!==selection.length)return;
  this.emit({selection:[...selection]});
 }
 async act(move){
  const {session,view}=this.state;
  if(!this.client.enabled||this.busy||this.state.status!=='ready'||!session||
   !labyrinthLegalMoves(view).some(m=>JSON.stringify(m)===JSON.stringify(move)))
   throw Error('No legal Labyrinth action for this authenticated seat');
  const requestId=globalThis.crypto?.randomUUID?.();
  if(!UUID.test(requestId??''))throw Error('Secure request ID unavailable');
  const generation=++this.generation;this.busy=true;
  this.emit({submitting:true,error:null});
  try{
   const response=await this.client.request('/v1/classic-sessions/'+session.id+'/action',{
    method:'POST',body:{requestId,action:'move',expectedSequence:session.sequence+1,move}
   });
   if(generation!==this.generation)return this.state;
   if(response.status===401||response.status===403||response.status===404){
    this.emit({status:'unavailable',session:null,view:null,submitting:false});
    throw Error('Session permission changed');
   }
   if(temporary(response.status)){this.emit({status:'reconnecting',view:null,submitting:false,error:'Move confirmation unavailable; recovering authoritative match.'});this.busy=false;return await this.open(session.id,{quiet:true});}
   if(response.status===409){
    this.busy=false;this.emit({submitting:false,notice:'Turn changed; refreshing authoritative state'});
    return await this.open(session.id,{quiet:true});
   }
   const validated=canonicalSession(response);
   if(!validated||validated.session.id!==session.id||
      validated.session.viewerSeat!==session.viewerSeat||
      validated.session.sequence!==session.sequence+1)
    throw Error('Move was not confirmed by canonical game server');
   return this.emit({status:'ready',...validated,selection:[],submitting:false,error:null});
  }catch(e){
   if(generation===this.generation)this.emit({error:e.message,submitting:false});
   throw e;
  }finally{if(generation===this.generation)this.busy=false;}
 }
 async lifecycle(action){
  if(action!=='resign'&&action!=='cancel')throw Error('Unsupported game lifecycle action');
  const {session}=this.state;
  if(!this.client.enabled||this.busy||this.state.status!=='ready'||!session||
     session.status!=='active')throw Error('No authorized active Labyrinth match');
  const requestId=globalThis.crypto?.randomUUID?.();
  if(!UUID.test(requestId??''))throw Error('Secure request ID unavailable');
  const gen=++this.generation;this.busy=true;this.emit({submitting:true,error:null});
  try{
   const response=await this.client.request('/v1/classic-sessions/'+session.id+'/action',{
    method:'POST',body:{requestId,action,expectedSequence:session.sequence+1}
   });
   if(gen!==this.generation)return this.state;
   if([401,403,404].includes(response.status)){
    this.emit({status:'unavailable',session:null,view:null,submitting:false});
    throw Error('Session permission changed');
   }
   if(response.status===409){
    this.busy=false;this.emit({submitting:false,error:'Match changed. Refreshing server result.'});
    return this.open(session.id,{quiet:true});
   }
   const validated=canonicalSession(response);
   if(!validated||validated.session.id!==session.id||
      validated.session.viewerSeat!==session.viewerSeat||
      validated.session.sequence!==session.sequence+1||
      validated.session.status!==(action==='resign'?'resigned':'cancelled'))
     throw Error('Lifecycle result was not confirmed by the game server');
   return this.emit({status:'ready',...validated,selection:[],submitting:false,error:null});
  }catch(e){
   if(gen===this.generation)this.emit({error:e.message,submitting:false});
   throw e;
  }finally{if(gen===this.generation)this.busy=false;}
 }
 async rematch(){
  const old=this.state.session;
  if(!this.client.enabled||this.busy||this.state.status!=='ready'||!old||
     !terminal.has(old.status))throw Error('A verified ended Labyrinth match is required');
  const requestId=globalThis.crypto?.randomUUID?.();
  if(!UUID.test(requestId??''))throw Error('Secure request ID unavailable');
  const gen=++this.generation;this.busy=true;this.emit({submitting:true,error:null});
  try{
   const actor=await this.principal();
   if(gen!==this.generation||!actor)throw Error('420ID account changed');
   const result=await this.client.request('/v1/classic-sessions/'+old.id+'/rematch',{
    method:'POST',body:{requestId}
   });
   if(gen!==this.generation)throw Error('Session changed during rematch');
   const room=normalizeClassicRoom(result.data?.room,true);
   if(result.status!==201||result.data?.onChain!==false||
     result.data?.wager!==false||result.data?.rewards!==false||
     result.data?.playable!==false||!room||
     room.gameId!=='labyrinth-cribbage'||room.host!==actor||
     room.seatCount!==old.seatCount||room.status!=='ready'&&room.status!=='open')
    throw Error('Rematch lobby was not verified');
   if(await this.principal()!==actor||gen!==this.generation)
    throw Error('420ID account changed during rematch');
   this.emit({submitting:false,error:null});
   return room.id;
  }catch(e){
   if(gen===this.generation)this.emit({submitting:false,error:e.message});
   throw e;
  }finally{if(gen===this.generation)this.busy=false;}
 }
 async list(){
  if(!this.client.enabled||this.busy)return this.state;
  const generation=++this.generation;this.busy=true;
  try{
   const principal=await this.principal();
   if(!principal){this.actor=null;return this.emit({status:'guest',session:null,view:null,recoverable:[]});}
   if(this.actor&&this.actor!==principal)this.emit({status:'idle',session:null,view:null,selection:[],recoverable:[]});
   this.actor=principal;
   const response=await this.client.request('/v1/classic-sessions');
   if(generation!==this.generation)return this.state;
   if(response.status!==200||response.data?.onChain!==false||
      response.data?.wager!==false||response.data?.rewards!==false||
      !Array.isArray(response.data?.sessions)||response.data.sessions.length>50)
     throw Error('Canonical matches cannot be listed');
   const matches=response.data.sessions.filter(s=>s.gameId==='labyrinth-cribbage'&&
     s.rulesVersion===LABYRINTH_RULES_VERSION&&s.rulesHash===LABYRINTH_RULES_HASH&&
     statuses.has(s.status)&&UUID.test(s.id)&&UUID.test(s.roomId)&&
     Number.isSafeInteger(s.sequence)&&s.sequence>=1).map(s=>Object.freeze({
      id:s.id,roomId:s.roomId,status:s.status,sequence:s.sequence
     }));
   if(await this.principal()!==principal){this.actor=null;return this.emit({status:'unavailable',session:null,view:null,recoverable:[],error:'420ID account changed'});}
   if(generation!==this.generation)return this.state;
   return this.emit({status:this.state.session?'ready':'idle',recoverable:matches,error:null});
  }catch(e){
   if(generation===this.generation)this.emit({recoverable:[],error:e.message});
   return this.state;
  }finally{if(generation===this.generation)this.busy=false;}
 }
}
