// BC-1.4: authenticated, read-only-per-seat presentation with server-only moves.
// No shuffle, opponent hand, crib contents or local score authority is present.
import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {cribbageTeams,cribbageNewPegs,cribbageLeap,cribbageSettlePegs} from './cribbage-board.js';

export const CRIBBAGE_RULES_HASH='6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24';
export const CRIBBAGE_RULES_VERSION='v1.0';
export const CRIBBAGE_ANNOUNCE_MS=1500;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const score=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000;
const card=n=>Number.isSafeInteger(n)&&n>=0&&n<=51;
const keys=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
const ownArray=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(card)&&new Set(a).size===a.length;
const scoreFields=['fifteens','pairs','runs','flush','nobs','total'];
const showFields=['seat','isCrib','cards','starter','score'];
const awardFields=['seat','team','kind','points','count','total'];
const viewFields=['gameId','variant','round','phase','dealer','turn','seat','scores','hand',
 'cardCounts','cribCount','discarded','starter','pegCount','pegPile','pegged','saidGo',
 'lastShow','lastAwards','losers','winner'];
const sessionFields=['id','roomId','gameId','seatCount','status','rulesVersion','rulesHash',
 'sequence','turnSeat','deadline','winnerSeat','finishedReason','updatedAt','viewerSeat','privateView'];
const variantFor=n=>n===2?'standard-2p':n===3?'standard-3p':n===4?'standard-4p-partners':null;
const pips=id=>Math.min(10,id%13+1);
export const cribbageCardLabel=id=>{
 if(!card(id))return '';
 const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'],suits=['♠','♥','♦','♣'];
 return ranks[id%13]+suits[Math.floor(id/13)];
};
export function normalizeCribbageSnapshot(result,subject=null){
 if(!result||result.status!==200||result.data?.onChain!==false||
  result.data?.wager!==false||result.data?.rewards!==false)return null;
 const s=result.data.session;
 if(!keys(s,sessionFields)||!uuid.test(s.id)||!uuid.test(s.roomId)||
  s.gameId!=='cribbage'||![2,3,4].includes(s.seatCount)||
  s.rulesVersion!==CRIBBAGE_RULES_VERSION||s.rulesHash!==CRIBBAGE_RULES_HASH||
  !['active','finished','resigned','timed_out','cancelled'].includes(s.status)||
  !Number.isSafeInteger(s.sequence)||s.sequence<1||
  !Number.isInteger(s.viewerSeat)||s.viewerSeat<0||s.viewerSeat>=s.seatCount||
  !(s.turnSeat===null||Number.isInteger(s.turnSeat)&&s.turnSeat>=0&&s.turnSeat<s.seatCount)||
  !(s.winnerSeat==null||Number.isInteger(s.winnerSeat)&&s.winnerSeat>=0&&s.winnerSeat<s.seatCount)||
  !keys(s.privateView,viewFields))return null;
 const v=s.privateView,n=s.seatCount,teams=cribbageTeams(n);
 if(v.gameId!=='cribbage'||v.variant!==variantFor(n)||!Number.isInteger(v.round)||v.round<1||
  !['discard','cut','peg','finished'].includes(v.phase)||v.seat!==s.viewerSeat||
  (s.status==='active'?v.turn!==s.turnSeat:!(v.turn===-1||Number.isInteger(v.turn)&&v.turn>=0&&v.turn<n))||
  !Number.isInteger(v.dealer)||v.dealer<0||v.dealer>=n||
  !Array.isArray(v.scores)||v.scores.length!==n||!v.scores.every(score)||
  !ownArray(v.hand,6)||!Array.isArray(v.cardCounts)||v.cardCounts.length!==n||
  !v.cardCounts.every(x=>Number.isInteger(x)&&x>=0&&x<=6)||
  !Array.isArray(v.discarded)||v.discarded.length!==n||!v.discarded.every(x=>typeof x==='boolean')||
  !Number.isInteger(v.cribCount)||v.cribCount<0||v.cribCount>4||
  !Number.isInteger(v.starter)||v.starter< -1||v.starter>51||
  !Number.isInteger(v.pegCount)||v.pegCount<0||v.pegCount>31||
  !ownArray(v.pegPile,16)||!Array.isArray(v.pegged)||v.pegged.length!==n||
  !v.pegged.every(x=>ownArray(x,4))||
  !Array.isArray(v.saidGo)||v.saidGo.length!==n||!v.saidGo.every(x=>typeof x==='boolean')||
  !Array.isArray(v.lastShow)||v.lastShow.length>n+1||
  !Array.isArray(v.lastAwards)||v.lastAwards.length>32||
  !Array.isArray(v.losers)||v.losers.length>n-1||
  !(v.winner===null||Number.isInteger(v.winner)&&v.winner>=0&&v.winner<n))return null;
 if(s.status==='active'&&v.scores.some(x=>x>=121))return null;
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)
  if(teams[i]===teams[j]&&v.scores[i]!==v.scores[j])return null;
 if(v.phase==='discard'&&v.hand.length!==(n===2?6:5)&&!v.discarded[v.seat])return null;
 if(v.phase==='cut'&&v.hand.length!==4)return null;
 if(v.phase==='peg'&&v.starter<0)return null;
 for(const entry of v.lastShow){
  if(!keys(entry,showFields)||!Number.isInteger(entry.seat)||entry.seat<0||entry.seat>=n||
   typeof entry.isCrib!=='boolean'||!ownArray(entry.cards,4)||entry.cards.length!==4||
   !card(entry.starter)||!keys(entry.score,scoreFields)||
   !scoreFields.every(k=>score(entry.score[k]))||
   entry.score.total!==entry.score.fifteens+entry.score.pairs+entry.score.runs+
     entry.score.flush+entry.score.nobs)return null;
 }
 for(const entry of v.lastAwards){
  if(!keys(entry,awardFields)||!Number.isInteger(entry.seat)||entry.seat<0||entry.seat>=n||
   entry.team!==teams[entry.seat]||typeof entry.kind!=='string'||
   !/^[a-z+-]{1,40}$/.test(entry.kind)||!Number.isInteger(entry.points)||
   entry.points<1||entry.points>29||
   !(entry.count===undefined||Number.isInteger(entry.count)&&entry.count>=0&&entry.count<=31)||
   !score(entry.total))return null;
 }
 if(!v.losers.every(x=>keys(x,['team','score','classification'])&&
  Number.isInteger(x.team)&&x.team>=0&&x.team<n&&score(x.score)&&
  ['ordinary','skunk','double-skunk'].includes(x.classification)))return null;
 // A caller may pass an independently verified current 420ID identity. The
 // session itself is always fetched with same-origin HTTP-only credentials.
 if(subject!==null&&!isSubjectID(subject))return null;
 return Object.freeze({...s,privateView:Object.freeze(v)});
}
export function cribbageLegalMoves(s){
 if(!s||s.status!=='active'||s.turnSeat!==s.viewerSeat)return [];
 const v=s.privateView,hand=v.hand;
 if(v.phase==='discard'){
  if(v.discarded[v.seat])return [];
  if(s.seatCount!==2)return hand.map(c=>Object.freeze({type:'discard',cards:[c]}));
  const moves=[];
  for(let i=0;i<hand.length;i++)for(let j=i+1;j<hand.length;j++)
   moves.push(Object.freeze({type:'discard',cards:[hand[i],hand[j]]}));
  return moves;
 }
 if(v.phase==='cut')return [{type:'cut'}];
 if(v.phase==='peg'){
  const legal=hand.filter(c=>v.pegCount+pips(c)<=31).map(c=>Object.freeze({type:'play',card:c}));
  return legal.length?legal:hand.length?[{type:'go'}]:[];
 }
 return [];
}
export function cribbageCanSubmit(s,move){
 return cribbageLegalMoves(s).some(a=>JSON.stringify(a)===JSON.stringify(move));
}
export function cribbageAwardAnnouncement(award,view){
 const n=view.scores.length,name='Player '+(award.seat+1);
 if(award.kind==='heels')return {label:name+': his heels for '+award.points,team:award.team,total:award.total};
 if(award.kind==='go'||award.kind==='last-card')return {label:name+': '+(award.kind==='go'?'Go':'Last card')+' for '+award.points,team:award.team,total:award.total};
 const count=award.kind.includes('fifteen')?15:award.kind.includes('thirty-one')?31:award.count??view.pegCount;
 const detail=award.kind.includes('quadruple')?'four of a kind':award.kind.includes('triple')?'three of a kind':
  award.kind.includes('pair')?'a pair':award.kind.includes('run')?'a run':'';
 return {label:name+': '+count+' for '+award.points+(detail?', '+detail:''),team:award.team,total:award.total};
}
// The Go engine has already scored the show. Narration replays exactly the
// server's listed dealer-left -> other hands -> dealer hand -> crib order.
// Zero-point hands are still announced, but never move a peg.
export function cribbageAnnouncementQueue(previous,next){
 if(!previous||!next||next.sequence!==previous.sequence+1||next.gameId!=='cribbage')return [];
 const view=next.privateView,past=previous.privateView;
 const newShow=JSON.stringify(view.lastShow)!==JSON.stringify(past.lastShow)&&view.lastShow.length>0;
 const awards=view.lastAwards;
 const queue=[];
 if(!newShow){
  for(const award of awards)queue.push(cribbageAwardAnnouncement(award,view));
  return queue;
 }
 for(const award of awards){
  if(award.kind!=='hand'&&award.kind!=='crib')queue.push(cribbageAwardAnnouncement(award,view));
 }
 const showAwards=awards.filter(a=>a.kind==='hand'||a.kind==='crib');
 for(const item of view.lastShow){
  const team=cribbageTeams(next.seatCount)[item.seat];
  const award=showAwards.find(a=>a.seat===item.seat&&a.kind===(item.isCrib?'crib':'hand'));
  queue.push({label:'Player '+(item.seat+1)+(item.isCrib?"'s crib":" hand")+
   ': '+item.score.total+' point'+(item.score.total===1?'':'s'),
   team,total:award?.total??null,show:item});
 }
 return queue;
}
export class CribbageSessionController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});
  this.onChange=onChange;this.setTimer=setTimer;this.clearTimer=clearTimer;
  this.generation=0;this.timer=null;this.busy=false;this.settings={motion:'standard',announcements:true,stinkhole:false};
  this.state={status:enabled?'idle':'disabled',settings:this.settings};
 }
 emit(delta){this.state=Object.freeze({...this.state,...delta,settings:{...this.settings}});
  this.onChange(this.state);return this.state;}
 cancelTimer(){if(this.timer!==null){this.clearTimer(this.timer);this.timer=null;}}
 invalidate(){this.generation++;this.cancelTimer();this.busy=false;this.state={status:this.client.enabled?'idle':'disabled',settings:{...this.settings}};this.onChange(this.state);}
 configure(key,value){
  if(key==='motion'&&['standard','reduced'].includes(value))this.settings.motion=value;
  else if(key==='announcements'&&typeof value==='boolean')this.settings.announcements=value;
  else if(key==='stinkhole'&&typeof value==='boolean')this.settings.stinkhole=value;
  else return;
  this.emit({});
 }
 advance(){
  if(this.state.status!=='ready'||!this.state.queue?.length)return;
  const [item,...remaining]=this.state.queue;
  let pegs=this.state.pegs??[];
  if(item.total!==null&&item.total!==undefined)pegs=cribbageLeap(pegs,item.team,item.total);
  this.emit({pegs,announcement:item.label,showing:item.show??null,queue:remaining});
  this.cancelTimer();
  this.timer=this.setTimer(()=>{
   this.timer=null;
   this.emit({pegs:cribbageSettlePegs(this.state.pegs),announcement:'',showing:null});
   if(this.state.queue.length){this.advance();}
   else if(this.state.session)this.emit({pegs:cribbageNewPegs(this.state.session.privateView.scores,this.state.session.seatCount)});
  },CRIBBAGE_ANNOUNCE_MS);
 }
 async open(id,{quiet=false}={}){
  if(!this.client.enabled||!uuid.test(id))return this.emit({status:'unavailable',error:'A qualified 420ID match is required.'});
  if(this.busy)return this.state;
  const generation=++this.generation,existing=this.state.session?.id===id?this.state.session:null;
  this.busy=true;
  if(!existing&&!quiet)this.emit({status:'loading',session:null,pegs:[],queue:[],announcement:''});
  try{
   const me=await this.client.request('/v1/me');
   if(generation!==this.generation)return this.state;
   if(me.status===401)return this.emit({status:'guest',session:null,pegs:[],queue:[]});
   if(me.status!==200||me.data?.walletRequired!==false||
    !isSubjectID(me.data.profile?.subject))throw Error('420ID session could not be verified');
   const result=await this.client.request('/v1/classic-sessions/'+id);
   if(generation!==this.generation)return this.state;
   if([401,403,404].includes(result.status))
    return this.emit({status:result.status===401?'guest':'unavailable',session:null,pegs:[],queue:[]});
   const session=normalizeCribbageSnapshot(result,me.data.profile.subject);
   if(!session||session.id!==id||existing&&session.sequence<existing.sequence)
    throw Error('Unverified Cribbage snapshot; no private cards were displayed');
   // A normal heartbeat cannot restart announcements or reset back pegs.
   if(existing&&session.sequence===existing.sequence)return this.state;
   // Preserve the 1.5-second per-award sequence; the next poll will catch
   // up once the score presentation has completed.
   if(existing&&(this.timer!==null||this.state.queue?.length))return this.state;
   const replay=existing&&session.sequence===existing.sequence+1;
   const queue=replay?cribbageAnnouncementQueue(existing,session):[];
   const pegs=existing&&replay&&queue.length?
    this.state.pegs:cribbageNewPegs(session.privateView.scores,session.seatCount);
   if(!replay){this.cancelTimer();}
   this.emit({status:'ready',session,pegs,queue:replay?queue:[],error:null,
    announcement:replay?'':this.state.announcement??'',
    showing:null,notice:existing&&session.sequence>existing.sequence+1?
     'Resynchronized to verified scores; missed announcements were not invented.':''});
   if(replay&&queue.length)this.advance();
   return this.state;
  }catch(e){
   if(generation===this.generation)this.emit({status:'error',session:null,pegs:[],queue:[],
    error:e.message??'Match temporarily unavailable'});
   return this.state;
  }finally{if(generation===this.generation)this.busy=false;}
 }
 async act(move){
  const current=this.state.session;
  if(this.busy||this.state.status!=='ready'||!current||
   !cribbageCanSubmit(current,move))throw Error('Not a legal move for your authenticated turn');
  if(this.state.queue?.length||this.timer!==null)throw Error('Scoring announcement still playing');
  this.busy=true;
  const generation=++this.generation,requestId=globalThis.crypto?.randomUUID?.();
  if(!requestId||!uuid.test(requestId)){this.busy=false;throw Error('Secure request ID unavailable');}
  this.emit({submitting:true,error:null});
  try{
   const result=await this.client.request('/v1/classic-sessions/'+current.id+'/action',
    {method:'POST',body:{requestId,action:'move',expectedSequence:current.sequence+1,move}});
   if(generation!==this.generation)return this.state;
   if(result.status===409||result.status===403){
    this.emit({submitting:false,notice:'Turn changed. Refreshing the canonical match.'});
    this.busy=false;return this.open(current.id);
   }
   const session=normalizeCribbageSnapshot(result);
   if(!session||session.id!==current.id||session.viewerSeat!==current.viewerSeat||
    session.sequence!==current.sequence+1)throw Error('Move was not confirmed by the match server');
   const queue=cribbageAnnouncementQueue(current,session);
   this.emit({status:'ready',session,submitting:false,queue,announcement:'',
    notice:'',pegs:queue.length?this.state.pegs:cribbageNewPegs(session.privateView.scores,session.seatCount)});
   if(queue.length)this.advance();
   return this.state;
  }catch(e){
   if(generation===this.generation)this.emit({status:'error',error:e.message,submitting:false});
   throw e;
  }finally{if(generation===this.generation)this.busy=false;}
 }
 destroy(){this.invalidate();}
}
