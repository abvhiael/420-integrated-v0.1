import {createAccountSocialClient} from './account-social.js';
import {escapeHtml,card,emptyState} from './design-system.js';

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const validID=id=>typeof id==='string'&&idPattern.test(id);
const plain=s=>escapeHtml(String(s??''));
const cLabel='Account-only · off-chain · wallet optional';
export function renderAccountExtra(kind,state,{enabled=false}={}){
 if(!enabled)return card({eyebrow:cLabel,title:kind==='messages'?'Private account messaging disabled':'Account quick games disabled',
  body:emptyState({title:'Not activated',message:'This separate 420ID app feature has not completed live acceptance. Canonical wallet messaging and games are unchanged.'})});
 if(!state||state.status==='loading')return card({title:'Checking 420ID session',body:'<p role="status">Checking account access. No private data is cached.</p>'});
 if(state.status==='guest')return card({eyebrow:cLabel,title:'Sign in without a wallet',
  body:'<p>Use 420ID email or passkey sign-in. Wallet balances and blockchain transactions are not required.</p><a href="/social-api/auth/start">Sign in with 420ID</a>'});
 if(state.status!=='ready')return card({eyebrow:cLabel,title:'Account feature unavailable',
  body:emptyState({title:'Session or service unavailable',message:'No messages or games are displayed without fresh 420ID verification.'})});
 return kind==='messages'?renderMessages(state):renderGames(state);
}
function renderMessages(state){
 const peers=state.peers??[];
 const thread=state.thread??[];
 const to=state.peer??'';
 return '<section class="account-social"><p class="eyebrow">'+cLabel+'</p><h2>Private account messages</h2>'+
  '<p>Only signed-in participants can read a conversation. Messages are encrypted on the server at rest, <strong>not end-to-end encrypted</strong>. Operators with server key custody are within the trust boundary. No wallet or on-chain Messenger is involved.</p>'+
  '<form data-extra-form="send"><label>Recipient account subject (UUID)<input required name="target" value="'+plain(to)+'" pattern="[0-9a-f-]{36}" maxlength="36"></label>'+
  '<label>Message<textarea required maxlength="2000" name="body"></textarea></label><button type="submit">Send private message</button></form>'+
  '<section aria-label="Conversations"><h3>Conversations</h3><ul>'+peers.map(p=>'<li><button type="button" data-extra-action="open-thread" data-peer="'+plain(p.subject)+'">'+plain(p.displayName)+' · '+plain(p.subject.slice(0,8))+'</button></li>').join('')+'</ul></section>'+
  (to?'<section aria-label="Private conversation"><h3>Conversation '+plain(to.slice(0,8))+'</h3><div class="social-comments">'+thread.map(m=>
   '<article><strong>'+plain(m.sender===state.viewer?'You':m.sender.slice(0,8))+'</strong><p class="social-post__body">'+plain(m.body)+'</p><small>'+plain(m.createdAt)+'</small> <button data-extra-action="delete-message" data-message="'+plain(m.id)+'" type="button">Remove from my inbox</button></article>').join('')+'</div></section>':'')+
  '<button type="button" data-extra-action="refresh">Refresh messages</button></section>';
}
function renderGames(state){
 const games=state.games??[],selected=state.selected;
 let detail='';
 if(selected){
  const board=selected.board??'',wide=selected.kind==='connect_four',width=wide?7:3;
  const rows=[];
  for(let i=0;i<board.length;i+=width){rows.push('<div class="game-row">'+[...board.slice(i,i+width)].map(ch=>'<span class="game-cell">'+plain(ch==='.'?'·':ch)+'</span>').join('')+'</div>');}
  let actions='';
  if(selected.status==='invited'&&selected.invited===state.viewer)actions='<button type="button" data-extra-action="accept">Accept</button><button type="button" data-extra-action="decline">Decline</button>';
  if(selected.status==='active'&&selected.nextTurn===state.viewer){
   actions='<div class="game-choices">'+Array.from({length:wide?7:9},(_,n)=>'<button type="button" data-extra-action="move" data-position="'+n+'">'+(wide?'Drop in column '+(n+1):'Place at square '+(n+1))+'</button>').join('')+'</div>';
  }
  detail='<section><h3>'+plain(selected.kind==='tic_tac_toe'?'Tic-tac-toe':'Connect Four')+'</h3><p>Status: '+plain(selected.status)+', moves: '+selected.moves+', next player: '+plain(selected.nextTurn||'none')+'</p>'+
   '<div class="account-game-board" aria-label="Current board">'+rows.join('')+'</div>'+actions+'</section>';
 }
 return '<section class="account-social"><p class="eyebrow">'+cLabel+'</p><h2>Zero-wager account games</h2>'+
  '<p>Play Tic-tac-toe or Connect Four with another 420ID BongGoggles member. Moves and results are stored off-chain; <strong>no wager, rewards, on-chain game outcome or token transfer</strong>.</p>'+
  '<form data-extra-form="invite"><label>Opponent account subject (UUID)<input required name="target" maxlength="36" pattern="[0-9a-f-]{36}"></label>'+
  '<label>Game<select name="kind"><option value="tic_tac_toe">Tic-tac-toe</option><option value="connect_four">Connect Four</option></select></label><button type="submit">Invite player</button></form>'+
  '<ul>'+games.map(g=>'<li><button type="button" data-extra-action="open-game" data-game="'+plain(g.id)+'">'+plain(g.kind)+' · '+plain(g.status)+' · '+plain(g.id.slice(0,8))+'</button></li>').join('')+'</ul>'+detail+
  '<button type="button" data-extra-action="refresh">Refresh games</button></section>';
}
export class AccountExtrasController{
 constructor({kind,enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  if(kind!=='messages'&&kind!=='games')throw Error('Invalid account feature');
  this.kind=kind;
  this.client=createAccountSocialClient({enabled,fetchImpl});
  this.state={status:enabled?'loading':'disabled'};
  this.onChange=onChange;
  this.generation=0;
 }
 emit(state){this.state={...state};this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.emit({status:'loading'});}
 async refresh(){
  if(!this.client.enabled)return this.emit({status:'disabled'});
  const gen=++this.generation;
  this.emit({status:'loading'});
  try{
   const me=await this.client.request('/v1/me');
   if(gen!==this.generation)return this.state;
   if(me.status===401)return this.emit({status:'guest'});
   if(me.status!==200||me.data?.walletRequired!==false||!validID(me.data.profile?.subject))throw Error('Unverified 420ID session');
   const path=this.kind==='messages'?'/v1/messages':'/v1/account-games';
   const result=await this.client.request(path);
   if(gen!==this.generation)return this.state;
   if(result.status!==200||result.data?.onChain!==false||!Array.isArray(result.data[this.kind==='messages'?'peers':'games']))throw Error('Unverified account data');
   if(this.kind==='messages'){
    if(result.data.encryption!=='server-at-rest'||result.data.peers.length>50||
       result.data.peers.some(p=>!validID(p.subject)))throw Error('Invalid confidential inbox');
    return this.emit({status:'ready',viewer:me.data.profile.subject,peers:result.data.peers,thread:[],peer:''});
   }
   if(result.data.wager!==false||result.data.rewards!==false||result.data.games.length>50||
       result.data.games.some(g=>!validID(g.id)))throw Error('Invalid free-game response');
   return this.emit({status:'ready',viewer:me.data.profile.subject,games:result.data.games,selected:null});
  }catch{
   if(gen===this.generation)return this.emit({status:'error'});
  }
  return this.state;
 }
 async act(action,data={}){
  if(!this.client.enabled||this.state.status!=='ready')throw Error('Verified session required');
  let path,method='POST',body;
  if(action==='refresh')return this.refresh();
  if(this.kind==='messages'){
   if(action==='open-thread'){
    if(!validID(data.peer))throw Error('Invalid subject');
    const result=await this.client.request('/v1/messages/'+data.peer);
    if(result.status!==200||result.data?.onChain!==false||!Array.isArray(result.data.messages)||
       result.data.encryption!=='server-at-rest'||result.data.messages.length>100)throw Error('Private conversation unavailable');
    return this.emit({...this.state,peer:data.peer,thread:result.data.messages});
   }
   if(action==='send'){
    if(!validID(data.target)||typeof data.body!=='string'||!data.body.trim()||data.body.length>2000)throw Error('Invalid message');
    path='/v1/messages';body={target:data.target,body:data.body};
   }else if(action==='delete-message'){
    if(!validID(data.id))throw Error('Invalid message');
    path='/v1/messages/item/'+data.id;method='DELETE';body={};
   }else throw Error('Unsupported message action');
  }else{
   if(action==='open-game'){
    if(!validID(data.id))throw Error('Invalid game');
    const result=await this.client.request('/v1/account-games/'+data.id);
    if(result.status!==200||result.data?.onChain!==false||result.data.wager!==false||
       result.data.rewards!==false||!validID(result.data.game?.id))throw Error('Game state unavailable');
    return this.emit({...this.state,selected:result.data.game});
   }
   if(action==='invite'){
    if(!validID(data.target)||!['tic_tac_toe','connect_four'].includes(data.kind))throw Error('Invalid invitation');
    path='/v1/account-games';body={target:data.target,kind:data.kind};
   }else if(action==='accept'||action==='decline'){
    if(!validID(this.state.selected?.id))throw Error('No selected invitation');
    path='/v1/account-games/'+this.state.selected.id+'/respond';body={accept:action==='accept'};
   }else if(action==='move'){
    const s=this.state.selected;
    if(!validID(s?.id)||s.status!=='active'||s.nextTurn!==this.state.viewer||
       !Number.isSafeInteger(data.position)||data.position<0||data.position>(s.kind==='connect_four'?6:8))throw Error('Move not permitted');
    path='/v1/account-games/'+s.id+'/move';body={position:data.position,expectedMove:s.moves+1};
   }else throw Error('Unsupported game action');
  }
  const outcome=await this.client.request(path,{method,body});
  if(outcome.status<200||outcome.status>=300){
   this.emit({status:'error'});throw Error('Operation rejected; current state must be refreshed');
  }
  const previous=this.state.selected?.id,peer=this.state.peer||data.target;
  await this.refresh();
  if(this.state.status==='ready'){
   if(this.kind==='games'&&previous)await this.act('open-game',{id:previous});
   if(this.kind==='messages'&&validID(peer))await this.act('open-thread',{peer});
  }
  return this.state;
 }
}
