import {BOARD_SPECS,MODES} from './word-salad-rules.js';
import {TILE_VALUES} from './word-salad-tiles.js';
import {createAccountSocialClient,isSubjectID} from './account-social.js';
export const saladID=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
export const clean=r=>r?.data?.onChain===false&&r.data.wager===false&&r.data.rewards===false;
export function saladFormat(format,count){
 const [size,mode,timing='live',extra]=String(format).split(':');const p=BOARD_SPECS[size];
 return p&&String(p.size)===size&&MODES.includes(mode)&&['live','async','untimed'].includes(timing)&&extra===undefined&&count>=p.minPlayers&&count<=p.maxPlayers?{p,mode,timing}:null;
}
export function normalizeSalad(r,id){
 const s=r?.data?.session,v=s?.privateView;
 if(!clean(r)||![200,201].includes(r.status)||!s||!v||Object.keys(s).some(k=>!['id','roomId','gameId','seatCount','status','rulesVersion','rulesHash','sequence','turnSeat','deadline','winnerSeat','finishedReason','updatedAt','viewerSeat','privateView'].includes(k))||!saladID(id)||s.id!==id||!saladID(s.roomId)||s.gameId!=='scrabble'||s.rulesVersion!=='v1'||!/^[a-f0-9]{64}$/.test(s.rulesHash)||!Number.isSafeInteger(s.sequence)||s.sequence<1||![2,3,4].includes(s.seatCount)||!Number.isInteger(s.viewerSeat)||s.viewerSeat<0||s.viewerSeat>=s.seatCount||!['active','finished'].includes(s.status))return null;
 const fmt=saladFormat(v.variant,s.seatCount);if(!fmt)return null;
 const {p,timing}=fmt,n=s.seatCount,fields='variant board blankCells rack rackCounts bagCount scores turn terminal winners forfeit ending'.split(' ');
 if(Object.keys(v).length!==fields.length||!fields.every(k=>Object.hasOwn(v,k))||!v.board||Array.isArray(v.board)||typeof v.board!=='object'||!Array.isArray(v.blankCells)||new Set(v.blankCells).size!==v.blankCells.length||!Array.isArray(v.rack)||v.rack.length>p.rackSize||!Array.isArray(v.rackCounts)||v.rackCounts.length!==n||v.rackCounts.some(x=>!Number.isInteger(x)||x<0||x>p.rackSize)||v.rackCounts[s.viewerSeat]!==v.rack.length||!Array.isArray(v.scores)||v.scores.length!==n||v.scores.some(x=>!Number.isSafeInteger(x)||Math.abs(x)>1e9)||!Array.isArray(v.forfeit)||v.forfeit.length!==n||v.forfeit.some(x=>typeof x!=='boolean')||!Number.isInteger(v.bagCount)||v.bagCount<0||v.bagCount>p.tileCount||v.terminal!==(s.status==='finished'))return null;
 for(const [k,sym] of Object.entries(v.board)){const q=Number(k);if(!Number.isInteger(q)||String(q)!==k||q<0||q>=p.size*p.size||!Object.hasOwn(TILE_VALUES,sym)||sym==='?')return null;}
 if(Object.keys(v.board).length+v.bagCount+v.rackCounts.reduce((a,b)=>a+b,0)>p.tileCount||v.forfeit.some((x,i)=>x&&v.rackCounts[i]!==0))return null;
 if(v.blankCells.some(q=>!Number.isInteger(q)||!Object.hasOwn(v.board,q)||!/^[A-Z]$/.test(v.board[q])))return null;
 const ids=new Set();for(const t of v.rack){if(!t||Object.keys(t).length!==3||!Number.isInteger(t.id)||t.id<0||t.id>=p.tileCount||ids.has(t.id)||!Object.hasOwn(TILE_VALUES,t.symbol)||t.value!==TILE_VALUES[t.symbol])return null;ids.add(t.id);}
 if(v.terminal){if(v.turn!==-1||s.turnSeat!==null||s.deadline!==null||!Array.isArray(v.winners)||!v.winners.length||new Set(v.winners).size!==v.winners.length||v.winners.some(x=>!Number.isInteger(x)||x<0||x>=n||v.forfeit[x])||s.winnerSeat!==(v.winners.length===1?v.winners[0]:null)||!['out','scoreless','forfeit'].includes(v.ending))return null;}
 else if(!Number.isInteger(v.turn)||v.turn<0||v.turn>=n||v.forfeit[v.turn]||s.turnSeat!==v.turn||s.winnerSeat!==null||v.ending!==''||!(v.winners===null||Array.isArray(v.winners)&&!v.winners.length)||!(timing==='untimed'?s.deadline===null:typeof s.deadline==='string'&&Number.isFinite(Date.parse(s.deadline))))return null;
 return {...s,privateView:v,format:fmt};
}
const temporaryStatus=s=>[429,502,503,504].includes(s);
class TemporarySaladError extends Error{}
export class SaladController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){this.client=createAccountSocialClient({enabled,fetchImpl});this.onChange=onChange;this.gen=0;this.busy=false;this.actor=null;this.target=null;this.botWait=null;this.state={status:enabled?'idle':'disabled',session:null,matches:[],seats:[],draft:{},selected:null,exchange:[],order:[],error:'',notice:'',large:false};}
 emit(p){this.state={...this.state,...p};this.onChange();return this.state;}
 clear(){return {draft:{},selected:null,exchange:[],order:[],confirm:'',blank:'A',exchangeMode:false};}
 invalidate(){this.pollAbort?.abort();this.pollAbort=null;this.pendingAction=null;this.refreshPromise=null;this.gen++;this.busy=false;this.actor=null;this.target=null;this.botWait=null;this.emit({status:this.client.enabled?'idle':'disabled',session:null,matches:[],seats:[],error:'',notice:'',...this.clear()});}
 async principal(signal){const r=await this.client.request('/v1/me',{signal});if(r.status===401)return null;if(temporaryStatus(r.status))throw new TemporarySaladError('420ID temporarily unavailable; reconnecting');if(r.status!==200||r.data?.walletRequired!==false||!isSubjectID(r.data.profile?.subject))throw Error('420ID verification unavailable');return r.data.profile.subject;}
 refresh(id){if(this.pendingAction&&this.target===id)return this.refreshPromise;if(this.target===id&&this.refreshPromise)return this.refreshPromise;const p=this.refreshNow(id);if(this.busy&&!this.refreshPromise){this.refreshPromise=p;void p.finally(()=>{if(this.refreshPromise===p)this.refreshPromise=null;});}return p;}
 async refreshNow(id){if(!this.client.enabled)return;if(this.target!==id){this.invalidate();this.target=id;}if(this.busy)return;const gen=++this.gen;this.busy=true;const controller=new AbortController();this.pollAbort=controller;const signal=controller.signal;
 try{const actor=await this.principal(signal);if(gen!==this.gen)return;if(!actor){this.actor=null;this.emit({status:'guest',session:null,matches:[],seats:[],...this.clear()});return;}
 if(actor!==this.actor){this.actor=actor;this.emit({session:null,matches:[],seats:[],...this.clear()});}
 if(!id){const r=await this.client.request('/v1/classic-sessions',{signal});if(gen!==this.gen)return;if(r.status!==200||!clean(r)||!Array.isArray(r.data.sessions)||await this.principal(signal)!==actor)throw Error('Match list unavailable');if(gen===this.gen){const matches=r.data.sessions.filter(s=>s.gameId==='scrabble'&&saladID(s.id)&&saladID(s.roomId)&&s.rulesVersion==='v1'&&/^[a-f0-9]{64}$/.test(s.rulesHash)&&['active','finished'].includes(s.status)).map(({id,roomId,status,sequence})=>({id,roomId,status,sequence}));if(this.state.status!=='ready'||JSON.stringify(matches)!==JSON.stringify(this.state.matches))this.emit({status:'ready',session:null,matches,error:''});}return;}
 if(!saladID(id))throw Error('Invalid match link');
 const r=await this.client.request('/v1/classic-sessions/'+id,{signal});if(gen!==this.gen)return;if(temporaryStatus(r.status))throw new TemporarySaladError('Game service temporarily unavailable; reconnecting');let s=normalizeSalad(r,id);if(!s)throw Error('Match unavailable or access denied');
 const room=await this.client.request('/v1/classic-rooms/'+s.roomId,{signal});if(gen!==this.gen)return;if(temporaryStatus(room.status))throw new TemporarySaladError('Room service temporarily unavailable; reconnecting');const seats=room.data?.room?.seats;
 if(room.status!==200||!clean(room)||room.data.room.id!==s.roomId||room.data.room.gameId!=='scrabble'||!Array.isArray(seats)||seats.length!==s.seatCount||seats[s.viewerSeat]?.subject!==actor||seats.some((x,i)=>x.index!==i||!['human','bot'].includes(x.controller)||x.controller==='bot'&&!['easy','medium','hard'].includes(x.difficulty)))throw Error('Room seats unavailable');
 if(await this.principal(signal)!==actor)throw Error('Account changed');if(gen!==this.gen)return;
 // A bot turn that survives multiple polls can be recovered through a
 // server-authorized nudge; never send a guessed computer action.
 if(s.status==='active'&&seats[s.privateView.turn]?.controller==='bot'){
  const key=id+':'+s.sequence,now=Date.now();
  if(this.botWait?.key!==key)this.botWait={key,since:now,last:0};
  if(now-this.botWait.since>=8000&&now-this.botWait.last>=10000){
   this.botWait.last=now;
   const recovered=await this.client.request('/v1/classic-sessions/'+id+'/recover-bot',{method:'POST',body:{}});
   if(gen!==this.gen)return;
   if(recovered.status===401||recovered.status===403||recovered.status===404)throw Error('Match authorization changed');
   const candidate=normalizeSalad(recovered,id);
   if(candidate&&candidate.sequence>=s.sequence&&candidate.roomId===s.roomId&&candidate.viewerSeat===s.viewerSeat&&candidate.rulesHash===s.rulesHash&&candidate.privateView.variant===s.privateView.variant&&candidate.seatCount===s.seatCount)s=candidate;
  }
 }else this.botWait=null;
 const old=this.state.session;if(old?.id===id&&(s.sequence<old.sequence||s.roomId!==old.roomId||s.viewerSeat!==old.viewerSeat||s.rulesHash!==old.rulesHash||s.privateView.variant!==old.privateView.variant||s.seatCount!==old.seatCount))throw Error('Session identity or revision changed');
 if(old?.id===id&&old.sequence===s.sequence){if(JSON.stringify(old.privateView)!==JSON.stringify(s.privateView)||old.status!==s.status||old.deadline!==s.deadline)throw Error('Conflicting server revision');if(this.state.status==='ready')return;this.emit({status:'ready',session:s,seats,error:''});return;}
 const notice=old?.id===id?s.privateView.scores.map((x,i)=>x-old.privateView.scores[i]).map((x,i)=>x?'Player '+(i+1)+': '+(x>0?'+':'')+x:'').filter(Boolean).join(' · '):'';
 this.emit({status:'ready',session:s,seats,error:'',notice,...this.clear()});
 }catch(e){if(gen===this.gen){if(e instanceof TemporarySaladError&&this.state.session?.id===id&&this.actor)this.emit({status:'reconnecting',error:e.message});else this.emit({status:'unavailable',session:null,seats:[],matches:[],error:e.message,...this.clear()});}}finally{if(this.pollAbort===controller)this.pollAbort=null;if(gen===this.gen)this.busy=false;}}
 canPlay(){const s=this.state.session;return this.state.status==='ready'&&s?.status==='active'&&s.viewerSeat===s.privateView.turn&&!s.privateView.forfeit[s.viewerSeat];}
 select(id){if(this.canPlay()&&this.state.session.privateView.rack.some(t=>t.id===id))this.emit({selected:id});}
 place(q,blank=this.state.blank){if(!this.canPlay())return;const s=this.state.session,v=s.privateView,id=this.state.selected,t=v.rack.find(x=>x.id===id),size=s.format.p.size;if(!t||!Number.isInteger(q)||q<0||q>=size*size||Object.hasOwn(v.board,q)||t.symbol==='?'&&!/^[A-Z]$/.test(blank))return;
 const draft={...this.state.draft};for(const k of Object.keys(draft))if(draft[k].id===id)delete draft[k];draft[q]={row:Math.floor(q/size),col:q%size,id,...(t.symbol==='?'?{blank}:{})};this.emit({draft,selected:null,exchange:[]});}
 recall(q){const d={...this.state.draft};if(q===undefined)this.emit({draft:{},selected:null,exchange:[]});else{delete d[q];this.emit({draft:d});}}
 async act(move,action='move'){
  if(this.pendingAction)return;
  const original=this.state.session,actor=this.actor;
  if(!original||this.state.status!=='ready'||!actor||!['move','resign'].includes(action)||action==='move'&&!this.canPlay()||original.status!=='active'||original.privateView.forfeit[original.viewerSeat])return;
  const token={};this.pendingAction=token;
  try{
   // Supersede background reads, never a mutation. The action endpoint enforces
   // authorization and expectedSequence atomically even when a read was stale.
   if(this.pollAbort){this.gen++;this.pollAbort.abort();this.pollAbort=null;this.refreshPromise=null;this.busy=false;}
   if(this.pendingAction!==token||this.target!==original.id||this.actor!==actor||this.state.session?.sequence!==original.sequence||this.state.status!=='ready')return;
   return await this.actNow(move,action);
  }finally{if(this.pendingAction===token)this.pendingAction=null;}
 }
 async actNow(move,action='move'){const s=this.state.session,actor=this.actor;if(!['move','resign'].includes(action)||action==='move'&&!['place','exchange','pass'].includes(move?.type)||action==='resign'&&move!==undefined&&move!==null||this.busy||!s||s.status!=='active'||(action==='move'&&!this.canPlay())||s.privateView.forfeit[s.viewerSeat])return;
 const gen=++this.gen;this.busy=true;this.emit({status:'submitting',error:'',notice:'Submitting your action…'});let error='';
 try{if(await this.principal()!==actor||gen!==this.gen)throw Error('Account changed');const requestId=globalThis.crypto?.randomUUID?.();if(!saladID(requestId))throw Error('Secure request ID unavailable');
 const r=await this.client.request('/v1/classic-sessions/'+s.id+'/action',{method:'POST',body:{requestId,action,expectedSequence:s.sequence+1,...(move?{move}:{})}});if(gen!==this.gen)return;
 if(temporaryStatus(r.status))throw new TemporarySaladError('Move confirmation temporarily unavailable; reconnecting');
 if(r.status===400)error='That move was rejected by the rules or dictionary. Check your words and try again.';
 else if(r.status===409)error='The turn changed. Reloaded authoritative state.';
 else {const next=normalizeSalad(r,s.id);if(!next||next.sequence<s.sequence+1||next.roomId!==s.roomId||next.viewerSeat!==s.viewerSeat||next.rulesHash!==s.rulesHash||next.privateView.variant!==s.privateView.variant||next.seatCount!==s.seatCount)throw Error('Move not confirmed. Recheck the match before retrying.');
  if(await this.principal()!==actor||gen!==this.gen)throw Error('Account changed');
  this.emit({status:'ready',session:next,notice:next.status==='finished'?'Match complete':next.viewerSeat===next.privateView.turn?'Move accepted. Your turn.':'Move accepted. Opponent is playing.',error:'',...this.clear()});
 }
 if(r.status===400||r.status===409)this.emit({status:'idle',...(r.status===400?{}:this.clear())});
 }catch(e){error=e.message;if(gen===this.gen){if(e instanceof TemporarySaladError)this.emit({status:'reconnecting',error});else this.emit({status:'unavailable',session:null,...this.clear()});}}
 finally{if(gen===this.gen){this.busy=false;await this.refreshNow(s.id);if(error&&this.target===s.id&&this.actor===actor)this.emit({error});}}}
}
