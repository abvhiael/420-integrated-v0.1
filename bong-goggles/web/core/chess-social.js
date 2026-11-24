import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {verifyCribbageFriends} from './classic-cribbage-social.js';
import {normalizeClassicRoom} from './classic-rooms.js';
import {escapeHtml as esc} from './design-system.js';
import {chessID} from './chess-session.js';
const flags=r=>r?.data?.onChain===false&&r.data.wager===false&&r.data.rewards===false;
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function verifyChessHistory(r){
 const h=r?.data?.history;
 if(r?.status!==200||!flags(r)||!Array.isArray(h?.matches)||h.matches.length>20||!Array.isArray(h.invitations)||h.invitations.length>20)return null;
 const matches=h.matches.map(m=>chessID(m.id)&&chessID(m.roomId)&&m.gameId==='chess'&&m.rulesVersion==='v1.1'&&/^[a-f0-9]{64}$/.test(m.rulesHash)&&m.seatCount===2&&[0,1].includes(m.viewerSeat)&&['active','finished'].includes(m.status)&&[null,0,1].includes(m.winnerSeat)&&[null,0,1].includes(m.turnSeat)&&Number.isSafeInteger(m.sequence)&&m.sequence>0&&date(m.updatedAt)?{id:m.id,roomId:m.roomId,status:m.status,viewerSeat:m.viewerSeat,winnerSeat:m.winnerSeat,turnSeat:m.turnSeat}:null);
 const invitations=h.invitations.map(i=>chessID(i.roomId)&&isSubjectID(i.inviter)&&i.seat===1&&date(i.expiresAt)?{roomId:i.roomId,inviter:i.inviter,expiresAt:i.expiresAt}:null);
 return matches.some(x=>!x)||invitations.some(x=>!x)?null:{matches,invitations};
}
export class ChessSocialController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});this.onChange=onChange;this.gen=0;this.busy=false;this.state={status:enabled?'idle':'disabled',friends:[],history:null};
 }
 emit(p){const next={...this.state,...p};if(JSON.stringify(next)!==JSON.stringify(this.state)){this.state=next;this.onChange();}}
 invalidate(){this.gen++;this.busy=false;this.emit({status:this.client.enabled?'idle':'disabled',viewer:null,friends:[],history:null,notice:'',submitting:false});}
 async principal(){const r=await this.client.request('/v1/me');return r.status===200&&r.data?.walletRequired===false&&isSubjectID(r.data.profile?.subject)?r.data.profile.subject:null;}
 async refresh(){
  if(!this.client.enabled||this.busy)return;
  const gen=++this.gen;this.busy=true;
  try{
   const actor=await this.principal();if(gen!==this.gen)return;
   if(!actor){this.emit({status:'guest',viewer:null,friends:[],history:null});return;}
   if(actor!==this.state.viewer)this.emit({status:'loading',viewer:null,friends:[],history:null});
   const [h,f]=await Promise.all([this.client.request('/v1/classic-sessions/history-chess'),this.client.request('/v1/classic-rooms/friends')]);
   const history=verifyChessHistory(h),friends=verifyCribbageFriends(f);
   if(!history||!friends||await this.principal()!==actor)throw Error('Chess invitations unavailable');
   if(gen===this.gen)this.emit({status:'ready',viewer:actor,history,friends});
  }catch(e){if(gen===this.gen)this.emit({status:'unavailable',viewer:null,friends:[],history:null,notice:e.message});}
  finally{if(gen===this.gen)this.busy=false;}
 }
 async invite(kind,value,session=null){
  if(this.busy||this.state.status!=='ready'||!chessID(value))return null;
  if(kind==='challenge'&&!this.state.friends.some(f=>f.subject===value))return null;
  if(kind==='rematch'&&!this.state.history.matches.some(m=>m.id===value&&m.status==='finished')&&!(session?.id===value&&session.status==='finished'))return null;
  if(!['challenge','rematch'].includes(kind))return null;
  const actor=this.state.viewer,gen=++this.gen;this.busy=true;this.emit({submitting:true,notice:''});
  try{
   if(await this.principal()!==actor||gen!==this.gen)throw Error('Account changed');
   const requestId=globalThis.crypto?.randomUUID?.();if(!chessID(requestId))throw Error('Secure request ID unavailable');
   const r=await this.client.request(kind==='challenge'?'/v1/classic-sessions/challenge-chess':'/v1/classic-sessions/'+value+'/rematch',{method:'POST',body:kind==='challenge'?{target:value,requestId}:{requestId}});
   const room=normalizeClassicRoom(r.data?.room,true);
   if(r.status!==201||!flags(r)||r.data.playable!==false||!room||room.gameId!=='chess'||room.seatCount!==2||room.visibility!=='private'||room.host!==actor||room.seats[0].subject!==actor||room.seats[0].controller!=='human'||room.seats.some((s,i)=>s.team!==i)||!['open','ready'].includes(room.status)||kind==='challenge'&&(room.status!=='open'||room.seats[1].controller!=='invited'||room.seats[1].subject!==value)||await this.principal()!==actor||gen!==this.gen)throw Error('Invitation not confirmed. Check your rooms before retrying.');
   return room.id;
  }catch(e){if(gen===this.gen)this.emit({notice:e.message});return null;}
  finally{if(gen===this.gen){this.busy=false;this.emit({submitting:false});}}
 }
}
export function renderChessSocial(state,session=null){
 if(!state||state.status==='disabled')return '';
 if(state.status!=='ready')return '<p role="status">'+esc(state.notice||'Checking Chess invitations…')+'</p>';
 const disabled=state.submitting?' disabled':'';
 const invite=state.history.invitations.map(i=>'<li><a data-route="classic-room" href="/games/rooms/'+esc(i.roomId)+'">Chess invitation from '+esc(state.friends.find(f=>f.subject===i.inviter)?.displayName??'420ID member')+'</a></li>').join('');
 const form=state.friends.length?'<form data-chess-challenge><label>Challenge a mutual friend<select name="target">'+state.friends.map(f=>'<option value="'+esc(f.subject)+'">'+esc(f.displayName)+'</option>').join('')+'</select></label><button type="submit"'+disabled+'>Send Chess challenge</button></form>':'<p>Mutual 420ID friends can receive challenges.</p>';
 const rematch=id=>'<button type="button" data-chess-rematch="'+esc(id)+'"'+disabled+'>Invite rematch</button>';
 const history=state.history.matches.map(m=>'<li><a data-route="classic-game" href="/games/chess/play?session='+esc(m.id)+'">'+(m.status==='active'?'Resume match':'Review result')+'</a> · '+(m.viewerSeat?'Black':'White')+(m.status==='finished'?' · '+(m.winnerSeat===null?'Draw':m.winnerSeat===m.viewerSeat?'Won':'Lost')+' '+rematch(m.id):'')+'</li>').join('');
 return '<section aria-label="Chess multiplayer"><h3>Chess challenges and rematches</h3>'+(state.notice?'<p role="alert">'+esc(state.notice)+'</p>':'')+(session?.status==='finished'?rematch(session.id):'')+form+'<h4>Pending invitations</h4>'+(invite?'<ul>'+invite+'</ul>':'<p>No pending invitations.</p>')+'<h4>Verified matches</h4><ul>'+history+'</ul></section>';
}
export function bindChessSocial(root,c,navigate,session){
 const form=root.querySelector('[data-chess-challenge]');
 form?.addEventListener('submit',e=>{e.preventDefault();void c.invite('challenge',new FormData(form).get('target')).then(id=>{if(id)navigate(id);});});
 for(const b of root.querySelectorAll('[data-chess-rematch]'))b.addEventListener('click',()=>{void c.invite('rematch',b.dataset.chessRematch,session).then(id=>{if(id)navigate(id);});});
}
