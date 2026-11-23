// BC-2.6 — independent 420ID Labyrinth history, social challenges and notices.
// No wallet claims, opponent hands, game scores supplied by a browser or push tokens.
import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {normalizeClassicRoom} from './classic-rooms.js';
import {LABYRINTH_RULES_HASH} from './labyrinth-session.js';
import {LABYRINTH_RULES_VERSION} from './labyrinth-cribbage-ui.js';
import {verifyCribbageFriends} from './classic-cribbage-social.js';
import {escapeHtml as esc} from './design-system.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id=v=>typeof v==='string'&&UUID.test(v);
const integer=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const terminal=new Set(['finished','resigned','timed_out']);
const flags=r=>r?.data?.onChain===false&&r.data.wager===false&&r.data.rewards===false;
const formats=Object.freeze({2:'labyrinth-2p',3:'labyrinth-3p'});
export function verifyLabyrinthHistory(response){
 if(response?.status!==200||!flags(response))return null;
 const h=response.data.history,stats=h?.stats;
 if(!h||!Array.isArray(h.matches)||h.matches.length>20||
  !Array.isArray(h.invitations)||h.invitations.length>20||!stats||
  !['sampleSize','completed','wins','losses'].every(k=>integer(stats[k],0,20)))return null;
 const matches=h.matches.map(m=>{
  if(!id(m?.id)||!id(m.roomId)||m.gameId!=='labyrinth-cribbage'||
   m.rulesVersion!==LABYRINTH_RULES_VERSION||m.rulesHash!==LABYRINTH_RULES_HASH||
   !integer(m.seatCount,2,4)||!integer(m.viewerSeat,0,m.seatCount-1)||
   !integer(m.sequence,1,1000000)||!['active','finished','resigned','timed_out','cancelled'].includes(m.status)||
   m.turnSeat!=null&&!integer(m.turnSeat,0,m.seatCount-1)||
   m.winnerSeat!=null&&!integer(m.winnerSeat,0,m.seatCount-1)||
   !Array.isArray(m.scores)||m.scores.length!==m.seatCount||
   !m.scores.every(s=>integer(s,0,10000))||!date(m.updatedAt)||
   (m.seatCount===4?!['labyrinth-4p-partners','labyrinth-4p-individual'].includes(m.variantId):m.variantId!==formats[m.seatCount]))return null;
  return Object.freeze({id:m.id,roomId:m.roomId,status:m.status,variantId:m.variantId,
   seatCount:m.seatCount,viewerSeat:m.viewerSeat,winnerSeat:m.winnerSeat??null,
   turnSeat:m.turnSeat??null,scores:Object.freeze([...m.scores]),updatedAt:m.updatedAt});
 });
 if(matches.some(m=>!m)||stats.sampleSize>matches.length||stats.completed>stats.sampleSize||
  stats.wins+stats.losses>stats.sampleSize)return null;
 const invitations=h.invitations.map(i=>id(i?.roomId)&&isSubjectID(i.inviter)&&
  integer(i.seat,1,3)&&date(i.expiresAt)?
  Object.freeze({roomId:i.roomId,inviter:i.inviter,seat:i.seat,expiresAt:i.expiresAt}):null);
 if(invitations.some(v=>!v))return null;
 return Object.freeze({matches,stats:Object.freeze({...stats}),invitations});
}
export class LabyrinthSocialController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});this.onChange=onChange;
  this.generation=0;this.busy=false;this.state={status:enabled?'idle':'disabled'};
 }
 emit(v){this.state=Object.freeze({...this.state,...v});this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.busy=false;this.emit({status:this.client.enabled?'idle':'disabled',history:null,friends:[],viewer:null,notice:''});}
 async principal(){
  const r=await this.client.request('/v1/me');
  if(r.status===401)return null;
  if(r.status!==200||r.data?.walletRequired!==false||!isSubjectID(r.data?.profile?.subject))throw Error('420ID unverified');
  return r.data.profile.subject;
 }
 async refresh(){
  if(!this.client.enabled||this.busy)return this.state;
  const gen=++this.generation;this.emit({status:'loading',history:null,friends:[],viewer:null,notice:''});
  try{
   const viewer=await this.principal();
   if(gen!==this.generation)return this.state;
   if(!viewer)return this.emit({status:'guest'});
   const [h,peers]=await Promise.all([
    this.client.request('/v1/classic-sessions/history-labyrinth'),
    this.client.request('/v1/classic-rooms/friends')
   ]);
   if(gen!==this.generation)return this.state;
   const history=verifyLabyrinthHistory(h),friends=verifyCribbageFriends(peers);
   if(!history||!friends||await this.principal()!==viewer)throw Error('History or 420ID changed');
   if(gen!==this.generation)return this.state;
   return this.emit({status:'ready',viewer,history,friends,notice:''});
  }catch{
   if(gen===this.generation)return this.emit({status:'unavailable',history:null,friends:[],viewer:null,notice:'Verified 420ID Labyrinth history unavailable.'});
  }
  return this.state;
 }
 async invite(action,value){
  if(this.busy||this.state.status!=='ready'||!isSubjectID(this.state.viewer))throw Error('420ID required');
  if(action==='challenge'&&!this.state.friends.some(f=>f.subject===value))throw Error('Mutual 420ID friend required');
  if(action==='rematch'&&!this.state.history.matches.some(m=>m.id===value&&terminal.has(m.status)))throw Error('Verified terminal Labyrinth match required');
  if(action!=='challenge'&&action!=='rematch')throw Error('Unsupported Labyrinth action');
  const requestId=globalThis.crypto?.randomUUID?.();if(!id(requestId))throw Error('Secure request ID unavailable');
  const gen=++this.generation,actor=this.state.viewer;this.busy=true;this.emit({submitting:true,notice:'Sending verified 420ID invitation…'});
  try{
   const response=await this.client.request(action==='challenge'?'/v1/classic-sessions/challenge-labyrinth':
    '/v1/classic-sessions/'+value+'/rematch',{method:'POST',body:action==='challenge'?{target:value,requestId}:{requestId}});
   if(gen!==this.generation)return null;
   const room=normalizeClassicRoom(response.data?.room,true);
   if(response.status!==201||!flags(response)||response.data?.playable!==false||
    !room||room.gameId!=='labyrinth-cribbage'||room.visibility!=='private'||
    room.host!==actor||room.seats[0]?.subject!==actor||!['open','ready'].includes(room.status)||
    (action==='challenge'&&(room.seatCount!==2||room.status!=='open'||
      room.seats[1]?.subject!==value||room.seats[1]?.controller!=='invited'))||
    await this.principal()!==actor)throw Error('Invitation was not confirmed');
   this.emit({submitting:false,notice:'Invitation recorded. Other human seats must accept before play.'});
   return room.id;
  }catch{
   if(gen===this.generation)this.emit({submitting:false,notice:'Invitation not confirmed. Check My Rooms before trying again.'});
   return null;
  }finally{if(gen===this.generation)this.busy=false;}
 }
}
const when=v=>esc(new Date(v).toLocaleString());
export function renderLabyrinthSocial(state){
 if(!state||state.status==='disabled')return '<p>Labyrinth account social features are disabled.</p>';
 if(state.status==='guest')return '<p><a href="/social-api/auth/start">Sign in with 420ID</a> to view private Labyrinth results and invitations.</p>';
 if(state.status!=='ready')return '<p role="status">'+esc(state.notice||'Verifying Labyrinth history and notifications…')+'</p>';
 const {history,viewer,friends}=state;
 const invite=history.invitations.map(i=>'<li><a href="/games/rooms/'+esc(i.roomId)+'" data-route="classic-room">Challenge from '+
  esc(friends.find(f=>f.subject===i.inviter)?.displayName??'420ID member')+'</a> · seat '+(i.seat+1)+' · expires '+when(i.expiresAt)+'</li>').join('');
 const challenge=friends.length?'<form data-lab-challenge><label>Challenge a mutual friend <select name="target">'+
  friends.map(f=>'<option value="'+esc(f.subject)+'">'+esc(f.displayName)+'</option>').join('')+
  '</select></label><button type="submit"'+(state.submitting?' disabled':'')+'>Send Labyrinth challenge</button></form>':
  '<p>Mutually follow another 420ID member to send a challenge.</p>';
 const matches=history.matches.map(m=>{
  const winner=m.winnerSeat===null?'No declared winner':
   (m.winnerSeat===m.viewerSeat||m.variantId==='labyrinth-4p-partners'&&m.winnerSeat%2===m.viewerSeat%2)?
    'Your side won':'Another seat won';
  const description=m.variantId==='labyrinth-4p-partners'?'Four-player partnerships':
   m.variantId==='labyrinth-4p-individual'?'Four-player individual':
   m.seatCount+'-player individual';
  return '<li><strong>'+esc(m.status)+'</strong> · '+esc(description)+' · '+
    m.scores.map((score,i)=>'P'+(i+1)+' '+score).join(' · ')+
    ' · '+esc(winner)+' · '+when(m.updatedAt)+
    ' <a data-route="classic-game" href="/games/labyrinth-cribbage/play?session='+esc(m.id)+'">View match</a>'+
    (terminal.has(m.status)?' <button type="button" data-lab-social-rematch="'+esc(m.id)+'"'+
     (state.submitting?' disabled':'')+'>Invite rematch</button>':'')+'</li>';
 }).join('');
 return '<section class="lab-social" aria-label="420ID Labyrinth history and notifications">'+
  '<h3>Labyrinth Cribbage · My 420ID matches</h3><p>Verified private account results. <a href="/profile">Profile</a> · <a href="/games/rooms">Rooms</a>. Off-chain; no wagers or rewards.</p>'+
  '<p role="status">'+history.invitations.length+' pending invitation'+(history.invitations.length===1?'':'s')+
  ' · '+history.matches.filter(m=>m.status==='active'&&m.turnSeat===m.viewerSeat).length+' matches awaiting your turn</p>'+
  (state.notice?'<p role="status">'+esc(state.notice)+'</p>':'')+
  '<h4>Invitation notifications</h4>'+(invite?'<ul>'+invite+'</ul>':'<p>No pending Labyrinth invitations.</p>')+
  challenge+'<h4>Past matches and statistics</h4><p>'+history.stats.completed+' finished · '+
  history.stats.wins+' wins · '+history.stats.losses+' losses among '+history.stats.sampleSize+
  ' recently verified terminal matches (up to 20; not a leaderboard).</p>'+
  (matches?'<ol>'+matches+'</ol>':'<p>No verified Labyrinth sessions yet.</p>')+'</section>';
}
export function bindLabyrinthSocial(root,controller,navigate){
 if(controller.state.status!=='ready')return;
 const form=root.querySelector('[data-lab-challenge]');
 form?.addEventListener('submit',event=>{
  event.preventDefault();
  const target=new FormData(form).get('target');
  if(typeof target==='string')void controller.invite('challenge',target).then(room=>{if(room)navigate(room);});
 });
 for(const button of root.querySelectorAll('[data-lab-social-rematch]')){
  button.addEventListener('click',()=>{
   if(button.disabled)return;
   button.disabled=true;
   void controller.invite('rematch',button.dataset.labSocialRematch).then(room=>{
    if(room)navigate(room);else button.disabled=false;
   }).catch(()=>{button.disabled=false;});
  });
 }
}
