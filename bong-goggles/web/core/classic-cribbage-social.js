// BC-1.6: verified 420ID invitations and per-seat history, never game authority.
import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {normalizeClassicRoom} from './classic-rooms.js';
import {CRIBBAGE_RULES_HASH,CRIBBAGE_RULES_VERSION} from './cribbage-session.js';
import {escapeHtml as esc} from './design-system.js';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validID=v=>typeof v==='string'&&ID.test(v);
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const terminal=new Set(['finished','resigned','timed_out']);
const flags=r=>r?.data?.onChain===false&&r.data.wager===false&&r.data.rewards===false;
const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export function verifyCribbageHistory(result){
 if(result?.status!==200||!flags(result))return null;
 const h=result.data.history,stats=h?.stats;
 if(!h||!Array.isArray(h.matches)||h.matches.length>20||!Array.isArray(h.invitations)||
  h.invitations.length>20||!stats||!['sampleSize','completed','wins','losses'].every(k=>int(stats[k],0,20)))return null;
 const matches=h.matches.map(m=>{
  if(!validID(m?.id)||!validID(m.roomId)||m.gameId!=='cribbage'||
   m.rulesHash!==CRIBBAGE_RULES_HASH||m.rulesVersion!==CRIBBAGE_RULES_VERSION||
   !int(m.seatCount,2,4)||!int(m.viewerSeat,0,m.seatCount-1)||!int(m.sequence,1,1000000)||
   !['active','finished','resigned','timed_out','cancelled'].includes(m.status)||
   m.turnSeat!=null&&!int(m.turnSeat,0,m.seatCount-1)||
   m.winnerSeat!=null&&!int(m.winnerSeat,0,m.seatCount-1)||
   !Array.isArray(m.scores)||m.scores.length!==m.seatCount||
   !m.scores.every(x=>int(x,0,10000))||!validDate(m.updatedAt))return null;
  return Object.freeze({id:m.id,roomId:m.roomId,seatCount:m.seatCount,
   status:m.status,viewerSeat:m.viewerSeat,turnSeat:m.turnSeat??null,
   winnerSeat:m.winnerSeat??null,scores:Object.freeze([...m.scores]),updatedAt:m.updatedAt});
 });
 if(matches.some(x=>!x)||stats.sampleSize>matches.length||stats.completed>stats.sampleSize||
  stats.wins+stats.losses>stats.sampleSize)return null;
 const invitations=h.invitations.map(v=>{
  if(!validID(v?.roomId)||!validID(v.inviter)||!int(v.seat,1,3)||!validDate(v.expiresAt))return null;
  return Object.freeze({roomId:v.roomId,inviter:v.inviter,seat:v.seat,expiresAt:v.expiresAt});
 });
 if(invitations.some(x=>!x))return null;
 return Object.freeze({matches,stats:{...stats},invitations});
}
export function verifyCribbageFriends(r){
 if(r?.status!==200||r.data?.onChain!==false||!Array.isArray(r.data.friends)||r.data.friends.length>100)return null;
 const friends=r.data.friends.map(f=>
  isSubjectID(f?.subject)&&typeof f.displayName==='string'&&f.displayName.length>0&&
   f.displayName.length<=320&&!/[\u0000-\u001f]/.test(f.displayName)?
   {subject:f.subject,displayName:f.displayName}:null);
 return friends.some(x=>!x)?null:friends;
}
export class CribbageSocialController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});this.onChange=onChange;
  this.generation=0;this.busy=false;this.state={status:enabled?'idle':'disabled'};
 }
 emit(change){this.state=Object.freeze({...this.state,...change});this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.busy=false;this.emit({status:this.client.enabled?'idle':'disabled',viewer:null,history:null,friends:[],notice:''});}
 async refresh(){
  if(!this.client.enabled||this.busy)return this.state;
  const gen=++this.generation;
  this.emit({status:'loading',viewer:null,history:null,friends:[],notice:''});
  try{
   const me=await this.client.request('/v1/me');
   if(gen!==this.generation)return this.state;
   if(me.status===401)return this.emit({status:'guest'});
   const actor=me.data?.profile?.subject;
   if(me.status!==200||me.data?.walletRequired!==false||!isSubjectID(actor))throw Error('Unverified identity');
   const [hist,peers]=await Promise.all([
    this.client.request('/v1/classic-sessions/history'),
    this.client.request('/v1/classic-rooms/friends')]);
   if(gen!==this.generation)return this.state;
   const history=verifyCribbageHistory(hist),friends=verifyCribbageFriends(peers);
   if(!history||!friends)throw Error('Unverified history or friends');
   const again=await this.client.request('/v1/me');
   if(gen!==this.generation)return this.state;
   if(again.status!==200||again.data?.profile?.subject!==actor||
    again.data?.walletRequired!==false)throw Error('Identity changed');
   return this.emit({status:'ready',viewer:actor,history,friends,notice:''});
  }catch{
   if(gen===this.generation)this.emit({status:'unavailable',viewer:null,history:null,
    friends:[],notice:'Could not verify your 420ID match history.'});
  }
  return this.state;
 }
 async invite(action,id){
  if(this.busy||this.state.status!=='ready'||!isSubjectID(this.state.viewer))throw Error('420ID required');
  if(action==='challenge'&&!this.state.friends.some(f=>f.subject===id))throw Error('Mutual friend required');
  if(action==='rematch'&&!this.state.history.matches.some(m=>m.id===id&&terminal.has(m.status)))
   throw Error('Verified terminal match required');
  if(action!=='challenge'&&action!=='rematch')throw Error('Unsupported invitation');
  const requestId=globalThis.crypto?.randomUUID?.();
  if(!validID(requestId))throw Error('Secure request ID required');
  const actor=this.state.viewer,gen=++this.generation;this.busy=true;
  this.emit({submitting:true,notice:'Submitting authenticated invitation…'});
  try{
   const path=action==='challenge'?'/v1/classic-sessions/challenge':
    '/v1/classic-sessions/'+id+'/rematch';
   const body=action==='challenge'?{requestId,target:id}:{requestId};
   const response=await this.client.request(path,{method:'POST',body});
   if(gen!==this.generation)return null;
   if(response.status!==201||!flags(response)||response.data?.playable!==false)
    throw Error('Invitation was not confirmed');
   const room=normalizeClassicRoom(response.data.room,true);
   if(!room||room.gameId!=='cribbage'||room.host!==actor||room.visibility!=='private'||
    room.status!=='open'||room.seats[0]?.subject!==actor||
    action==='challenge'&&(room.seatCount!==2||room.seats[1]?.subject!==id||
     room.seats[1]?.controller!=='invited'))throw Error('Unverified room');
   const check=await this.client.request('/v1/me');
   if(gen!==this.generation)return null;
   if(check.status!==200||check.data?.profile?.subject!==actor)throw Error('Identity changed');
   this.emit({submitting:false,notice:'Invitation created. Each human player must accept before play.'});
   return room.id;
  }catch{
   if(gen===this.generation)this.emit({submitting:false,
    notice:'Not confirmed. Check existing 420ID rooms before sending another invitation.'});
   return null;
  }finally{if(gen===this.generation)this.busy=false;}
 }
}
const when=d=>esc(new Date(d).toLocaleString());
export function renderCribbageSocial(state){
 if(!state||state.status==='disabled')return '<p>Cribbage social features are disabled.</p>';
 if(state.status==='guest')return '<p><a href="/social-api/auth/start">Sign in with 420ID</a> for your match history.</p>';
 if(state.status!=='ready')return '<p role="status">'+esc(state.notice||'Verifying 420ID history…')+'</p>';
 const h=state.history;
 const invitation=h.invitations.map(i=>'<li><a href="/games/rooms/'+esc(i.roomId)+
  '" data-route="classic-room">Invitation from '+esc(state.friends.find(f=>f.subject===i.inviter)?.displayName??'420ID member')+
  '</a> · seat '+(i.seat+1)+' · expires '+when(i.expiresAt)+'</li>').join('');
 const challenge=state.friends.length?'<form data-cribbage-challenge><label>Challenge a mutual friend <select name="target">'+
  state.friends.map(f=>'<option value="'+esc(f.subject)+'">'+esc(f.displayName)+'</option>').join('')+
  '</select></label><button type="submit"'+(state.submitting?' disabled':'')+'>Send challenge</button></form>':
  '<p>Mutually follow another member to challenge them.</p>';
 const matches=h.matches.map(m=>{
  const won=m.winnerSeat===null?'No declared winner':
   (m.winnerSeat===m.viewerSeat||m.seatCount===4&&m.winnerSeat%2===m.viewerSeat%2)?'Your side won':'Opponent won';
  return '<li><strong>'+esc(m.status)+'</strong> · '+m.scores.map((v,i)=>'P'+(i+1)+' '+v).join(' · ')+
   ' · '+esc(won)+' · '+when(m.updatedAt)+
   ' <a href="/games/cribbage/play?session='+esc(m.id)+'" data-route="classic-game">View</a>'+
   (terminal.has(m.status)?' <button type="button" data-cribbage-rematch="'+esc(m.id)+'"'+
    (state.submitting?' disabled':'')+'>Invite rematch</button>':'')+'</li>';
 }).join('');
 return '<section class="cribbage-social" aria-label="Authenticated Cribbage challenges and results">'+
  '<h3>Challenges, rematches and match history</h3>'+
  '<p>Verified 420ID account play · off-chain · zero wagers or rewards. Invitations require acceptance.</p>'+
  (state.notice?'<p role="status">'+esc(state.notice)+'</p>':'')+
  '<h4>Pending invitations</h4>'+(invitation?'<ul>'+invitation+'</ul>':'<p>None pending.</p>')+
  challenge+'<h4>Recent verified results</h4><p>'+h.stats.completed+' finished · '+
  h.stats.wins+' wins · '+h.stats.losses+' losses among '+h.stats.sampleSize+
  ' recent terminal matches (maximum 20 visible; not a leaderboard).</p>'+
  (matches?'<ul>'+matches+'</ul>':'<p>No verified Cribbage games yet.</p>')+'</section>';
}
export function bindCribbageSocial(root,controller,navigate){
 if(controller?.state.status!=='ready')return;
 const form=root.querySelector('[data-cribbage-challenge]');
 form?.addEventListener('submit',event=>{
  event.preventDefault();
  const id=new FormData(form).get('target');
  if(typeof id==='string')void controller.invite('challenge',id).then(room=>{if(room)navigate(room);});
 });
 for(const button of root.querySelectorAll('[data-cribbage-rematch]'))
  button.addEventListener('click',()=>{
   void controller.invite('rematch',button.dataset.cribbageRematch).then(room=>{if(room)navigate(room);});
  });
}
