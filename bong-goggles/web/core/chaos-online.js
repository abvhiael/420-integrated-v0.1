// Account-owned CCC room client. Never constructs or mutates game rules/decks.
// All private cards and legal choices come from an authenticated server projection.
import {chaosCardArt} from './chaos-card-art.js';
import {renderChaosHighway} from './chaos-board.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const isRoom=value=>value&&typeof value==='object'&&id.test(value.id??'')&&
 Number.isSafeInteger(value.revision)&&value.revision>=0&&
 ['lobby','playing','between','finished'].includes(value.status)&&
 Number.isInteger(value.seat)&&value.seat>=0&&value.seat<=3&&
 Array.isArray(value.seats)&&value.seats.length>=2&&value.seats.length<=4&&
 !('seed'in value)&&!('deck'in value)&&!('legendaryByLeg'in value)&&
 !(value.players??[]).some(p=>p.hand!==undefined)&&Array.isArray(value.hand??[])&&
 Array.isArray(value.legal??[])&&
 Array.isArray(value.chat??[])&&(value.chat===undefined||value.chat?.length<=80)&&
 !(value.chat??[]).some(m=>!m||typeof m!=='object'||!id.test(m.id??'')||
  !Number.isInteger(m.seat)||m.seat<0||m.seat>3||typeof m.text!=='string'||
  !m.text.length||Array.from(m.text).length>280||typeof m.at!=='string'||!Number.isFinite(Date.parse(m.at)));
export function checkChaosProjection(value){if(!isRoom(value))throw Error('Untrusted championship projection');return value;}
export class ChaosRoomsClient{
 constructor({fetchImpl=fetch,onChange=()=>{}}={}){
  this.fetchImpl=fetchImpl;this.onChange=onChange;
  this.state={status:'loading',rooms:[],room:null,error:null,selectedCard:0,chatOpen:false,mutedSeats:[],unreadChat:0,chatError:null};
  this.generation=0;this.busy=false;this.chatBusy=false;this.reportBusy=false;
 }
 emit(next){this.state={...next};this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.emit({status:'loading',rooms:[],room:null,error:null,selectedCard:0,chatOpen:false,mutedSeats:[],unreadChat:0,chatError:null});}
 async request(path,{method='GET',data}={}){
  if(!/^\/v1\/chaos\/rooms(?:\/[a-z0-9-]+)?(?:\/(?:start|move|next|chat(?:\/report)?))?$/.test(path))
   throw Error('Invalid game API path');
  const response=await this.fetchImpl('/social-api'+path,{
   method,credentials:'same-origin',cache:'no-store',redirect:'error',
   headers:method==='POST'?{'Content-Type':'application/json'}:{},
   body:method==='POST'?JSON.stringify(data??{}):undefined
  });
  let body={};
  try{body=await response.json();}catch{}
  return {status:response.status,data:body};
 }
 async refresh({preserve=true}={}){
  const gen=++this.generation;
  if(!preserve)this.emit({status:'loading',rooms:[],room:null,error:null});
  try{
   const result=await this.request('/v1/chaos/rooms');
   if(gen!==this.generation)return;
   if(result.status===401)return this.emit({status:'guest',rooms:[],room:null,error:null});
   if(result.status!==200||!Array.isArray(result.data.rooms)||result.data.rooms.length>50)
    return this.emit({status:'unavailable',rooms:[],room:null,error:'Multiplayer service is not ready.'});
   this.emit({...this.state,status:'ready',rooms:result.data.rooms,error:null});
   if(this.state.room?.id)await this.open(this.state.room.id,{silent:true});
  }catch{
   if(gen===this.generation)this.emit({status:'unavailable',rooms:[],room:null,error:'Unable to reach the game server.'});
  }
 }
 async open(roomId,{silent=false}={}){
  if(!id.test(roomId))throw Error('Invalid room ID');
  const gen=++this.generation;
  try{
   const res=await this.request('/v1/chaos/rooms/'+roomId);
   if(gen!==this.generation)return;
   if(res.status===401)return this.emit({status:'guest',rooms:[],room:null,error:null});
   if(res.status!==200)return this.emit({...this.state,status:'ready',room:null,error:'Room unavailable or access revoked.'});
   const next=checkChaosProjection(res.data.room),before=this.state.room;
   const sameRoom=before?.id===next.id;
   const oldId=before?.chat?.at(-1)?.id??null,newId=next.chat?.at(-1)?.id??null;
   const changed=!sameRoom||before.revision!==next.revision||oldId!==newId;
   // Do not destroy the card selection, chat draft and scrolling on idle polls.
   if(silent&&!changed){this.state={...this.state,room:next};return;}
   const unseen=sameRoom&&!this.state.chatOpen&&oldId&&oldId!==newId?
    Math.max(1,next.chat.length-(before.chat?.length||0)):0;
   this.emit({...this.state,status:'ready',room:next,error:null,
    selectedCard:sameRoom?this.state.selectedCard:0,
    unreadChat:sameRoom?Math.min(99,(this.state.unreadChat||0)+unseen):0,
    chatError:sameRoom?this.state.chatError:null});
  }catch{
   if(gen===this.generation&&!silent)this.emit({...this.state,status:'unavailable',room:null,error:'Could not refresh this game.'});
  }
 }
 async mutate(action,data={}){
  if(this.busy)throw Error('A game action is already pending');
  this.busy=true;
  ++this.generation; // stale polling GET cannot replace the just-committed move
  this.emit({...this.state,error:null});
  try{
   const room=this.state.room;
   let path='/v1/chaos/rooms',payload=data;
   if(action==='create')payload=data;
   else if(action==='join'){path+='/join';payload=data;}
   else{
    if(!room)throw Error('Choose a room first');
    path+='/'+room.id+'/'+action;
    payload={expectedRevision:room.revision,...data};
   }
   const res=await this.request(path,{method:'POST',data:payload});
   if(res.status!==200&&res.status!==201){
    if(res.status===409&&room)await this.open(room.id);
    if(res.status===401){this.emit({status:'guest',rooms:[],room:null,error:null});throw Error('Sign in again to play');}
    throw Error(res.status===409?'The room changed. Your latest state has been refreshed.':'Game action was rejected by the server.');
   }
   const updated=checkChaosProjection(res.data.room);
   this.emit({...this.state,status:'ready',room:updated,error:null});
   if(action==='create'||action==='join')await this.refresh({preserve:true});
   return updated;
  }catch(e){
   this.emit({...this.state,error:e.message});throw e;
  }finally{this.busy=false;}
 }
 selectCard(index){
  if(!Number.isInteger(index)||index<0||index>6)return;
  this.emit({...this.state,selectedCard:index});
 }
 toggleChat(){
  const open=!this.state.chatOpen;
  this.emit({...this.state,chatOpen:open,unreadChat:open?0:this.state.unreadChat});
 }
 toggleMute(seat){
  if(!Number.isInteger(seat)||seat<0||seat>3||seat===this.state.room?.seat)return;
  const muted=new Set(this.state.mutedSeats);
  if(muted.has(seat))muted.delete(seat);else muted.add(seat);
  this.emit({...this.state,mutedSeats:[...muted]});
 }
 async reportChat(messageId){
  const room=this.state.room;
  if(!room||this.reportBusy||!id.test(messageId??''))throw Error('Invalid room chat report');
  this.reportBusy=true;
  try{
   const res=await this.request('/v1/chaos/rooms/'+room.id+'/chat/report',{method:'POST',data:{messageId}});
   if(res.status!==200||res.data.reported!==true)
    throw Error(res.status===409?'Already reported.':'Unable to report that message.');
   if(this.state.room?.id===room.id)this.emit({...this.state,chatNotice:'Report saved privately for operator review.'});
  }catch(e){
   if(this.state.room?.id===room.id)this.emit({...this.state,chatError:e.message});
   throw e;
  }finally{this.reportBusy=false;}
 }
 async sendChat(text){
  const room=this.state.room;
  if(!room||this.chatBusy)throw Error('Room chat is unavailable');
  this.chatBusy=true; ++this.generation;
  try{
   const result=await this.request('/v1/chaos/rooms/'+room.id+'/chat',{method:'POST',data:{text}});
   if(result.status!==200){
    if(result.status===401){this.emit({status:'guest',rooms:[],room:null,error:null});throw Error('Sign in again to chat');}
    throw Error(result.status===429?'Slow down a moment before sending another message.':
      result.status===403||result.status===404?'This room is no longer available.':'Could not send your room message.');
   }
   if(this.state.room?.id!==room.id)return;
   const updated=checkChaosProjection(result.data.room);
   this.emit({...this.state,room:updated,chatError:null,unreadChat:0});
  }catch(e){
   if(this.state.room?.id===room.id)this.emit({...this.state,chatError:e.message});
   throw e;
  }finally{this.chatBusy=false;}
 }
}
const cardImage=(card,leg)=>{
 const url=chaosCardArt(card,['east','ontario','west'][leg]||'east');
 return url?'<img src="'+escape(url)+'" width="96" height="162" alt="" loading="lazy" decoding="async">':'';
};
const cardLabel=c=>c.type==='mileage'?c.km+' km':c.name||c.id||c.type;
const stageNames=['Down East','Ontario','Prairies & Mountains'];
const formButton=(text,attrs='')=>'<button type="submit" '+attrs+'>'+escape(text)+'</button>';
function handControls(room,c,index){
 if(room.turn!==room.seat||room.status!=='playing')return '';
 const options=room.legal.filter(o=>o.index===index);
 if(!options.length)return '<small>No legal play for this card right now</small>';
 return options.map(o=>{
  const verb=o.action==='drive'?'Drive '+c.km+' km':
    o.action==='hazard'?'Sabotage '+(room.seats[o.target]?.name||'opponent'):
    o.action==='fix'?'Repair':o.action==='power'?'Activate':o.action==='discard'?'Discard':'Play';
  const move={action:o.action,index:o.index,...(o.target!==undefined?{target:o.target}:{})};
  const button=(label,m)=>'<button type="button" data-chaos-online-action="move" data-move="'+escape(JSON.stringify(m))+'">'+escape(label)+'</button>';
  const boost=o.action==='drive'&&room.players?.[room.seat]?.upgrades?.some(u=>
    u.id==='shortcut-specialist'&&!room.players[room.seat].used.includes(u.id));
  return button(verb,move)+(boost?button('Drive +100 km boost',{...move,useBoost:true}):'');
 }).join('');
}
function privateHand(room,selectedCard=0){
 const index=Math.max(0,Math.min(room.hand.length-1,selectedCard||0));
 const card=room.hand[index];
 const yourTurn=room.turn===room.seat&&room.status==='playing';
 return '<section class="ccc-online-hand" aria-label="Your private hand">'+
  '<div class="ccc-online-hand-head"><h3>Your private hand <small>'+room.hand.length+' cards</small></h3>'+
  '<strong>'+(yourTurn?'YOUR TURN · '+escape(room.step):'Waiting for '+escape(room.seats[room.turn]?.name||'results'))+'</strong></div>'+
  '<div class="ccc-online-hand-content"><div class="ccc-online-cards" role="group" aria-label="Choose a card">'+
  room.hand.map((c,i)=>'<article class="ccc-online-card'+(i===index?' ccc-online-card--selected':'')+'">'+
   '<button type="button" class="ccc-online-card-select" data-chaos-online-select="'+i+'" aria-pressed="'+(i===index)+'" aria-label="Select '+escape(cardLabel(c))+'">'+
   cardImage(c,room.leg)+'<strong>'+escape(cardLabel(c))+'</strong></button></article>').join('')+
  '</div><div class="ccc-online-card-actions" aria-live="polite"><h4>'+escape(card?cardLabel(card):'Choose a card')+'</h4>'+
   (card?handControls(room,card,index):'<small>Draw to begin your turn.</small>')+
  '</div></div></section>';
}
function roomSummary(room){
 return '<article class="ccc-online-room"><strong>'+escape(stageNames[room.stage]||'Road trip')+
 '</strong><p>'+escape(room.status)+' · '+escape(room.seats.map(s=>s.name).join(', '))+'</p>'+
 '<button type="button" data-chaos-online-action="open" data-room="'+escape(room.id)+'">Open match</button></article>';
}

function publicTables(room){
 if(!Array.isArray(room.players)||!room.players.length)return '';
 return '<section class="ccc-online-tables" aria-label="Exposed player tables">'+
  '<h3>On the table <small>Visible cards only · private hands stay hidden</small></h3>'+
  '<div class="ccc-online-table-grid">'+room.players.map((p,i)=>{
   const played=(p.played||[]).filter(c=>c.type==='mileage'&&Number.isSafeInteger(c.km));
   const mileage=[...new Set(played.map(c=>c.km))].sort((a,b)=>b-a);
   const total=played.reduce((n,c)=>n+c.km,0);
   const upgrades=(p.upgrades||[]).map(c=>
    '<span class="ccc-online-exposed-card">'+cardImage(c,room.leg)+
    '<span>'+escape(cardLabel(c))+(p.used?.includes(c.id)?' · USED':' · READY')+'</span></span>').join('');
   const hazard=p.status?'<span class="ccc-online-exposed-card ccc-online-hazard">'+cardImage(p.status,room.leg)+
    '<span>'+escape(cardLabel(p.status))+'</span></span>':'<span class="ccc-online-clear">Clear road</span>';
   const stacks=mileage.map(km=>'<span class="ccc-online-mile-stack" aria-label="'+
    played.filter(c=>c.km===km).length+' played '+km+' kilometre cards">'+
    cardImage({type:'mileage',km},room.leg)+'<strong>'+km+' km × '+played.filter(c=>c.km===km).length+'</strong></span>').join('');
   return '<article class="ccc-online-table'+(room.seat===i?' ccc-online-table--mine':'')+'">'+
    '<header><strong>'+escape(p.name)+'</strong><span>'+Number(p.km||0).toLocaleString('en-CA')+' / 2,500 km</span></header>'+
    '<div class="ccc-online-exposed"><div><h4>Active hazard</h4>'+hazard+'</div>'+
    '<div><h4>Upgrades</h4>'+(upgrades||'<span class="ccc-online-clear">None equipped</span>')+'</div>'+
    '<div><h4>Legendary protection</h4><strong>'+Number(p.shield||0)+' shield'+(p.shield===1?'':'s')+'</strong></div>'+
    '<div><h4>Mileage cards · '+total.toLocaleString('en-CA')+' played</h4>'+
     '<div class="ccc-online-mileage">'+(stacks||'<span class="ccc-online-clear">No mileage cards</span>')+'</div></div></div>'+
    ((p.slowLoss||p.detourLoss)?'<p class="ccc-online-losses">Slowdowns −'+Number(p.slowLoss||0)+
      ' km · Detours −'+Number(p.detourLoss||0)+' km</p>':'')+'</article>';
  }).join('')+'</div></section>';
}


function drawPiles(room){
 const deck=room.legal.find(o=>o.action==='draw'&&o.choice==='deck');
 const discard=room.legal.find(o=>o.action==='draw'&&o.choice==='discard');
 const action=(move,label,content)=>move?'<button type="button" data-chaos-online-action="move" data-move="'+
  escape(JSON.stringify(move))+'" aria-label="'+escape(label)+'">'+content+'</button>':'<div>'+content+'</div>';
 const other=room.legal.filter(o=>o.index===undefined&&o.action!=='draw');
 return '<section class="ccc-online-decks" aria-label="Draw deck and discard pile"><h3>Road trip decks</h3>'+
  '<div class="ccc-online-piles"><div class="ccc-online-pile">'+
  action(deck,'Draw two from stock','<span class="ccc-online-stock-back"><b>🍁</b><strong>CCC</strong>ROAD TRIP</span>')+
  '<strong>Draw deck</strong><small>Stock: '+room.stockCount+' cards</small></div>'+
  '<div class="ccc-online-pile">'+
  action(discard,'Take top discard and draw','<span class="ccc-online-discard-face">'+
    (room.discardTop?cardImage(room.discardTop,room.leg):'<span>Empty discard</span>')+'</span>')+
  '<strong>Discard pile</strong><small>'+room.discardCount+' cards'+
    (room.discardTop?' · '+escape(cardLabel(room.discardTop)):'')+'</small></div></div>'+
  '<div class="ccc-online-pile-actions">'+other.map(o=>
   '<button type="button" data-chaos-online-action="move" data-move="'+escape(JSON.stringify(o))+'">'+
    escape(o.action==='pass'?'Pass turn':o.action==='recover'?'Recover vehicle':o.action)+'</button>').join('')+'</div>'+
  (room.finishPending?'<p class="ccc-online-finish">Final round underway</p>':'')+
  '</section>';
}
function roomChat(room,state={}){
 const muted=new Set(state.mutedSeats||[]);
 const open=state.chatOpen===true;
 const messages=(room.chat||[]).filter(m=>!muted.has(m.seat));
 const log='<ol class="ccc-online-chat-log" data-chaos-chat-log role="log" aria-label="Room messages" aria-live="polite" aria-relevant="additions text">'+
  (messages.length?messages.map(m=>{
   const mine=m.seat===room.seat;
   const name=room.seats[m.seat]?.name||'Driver';
   return '<li class="ccc-online-chat-message'+(mine?' ccc-online-chat-message--mine':'')+'">'+
    '<div><strong>'+escape(name)+'</strong><time datetime="'+escape(m.at)+'">'+
      escape(new Date(m.at).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'}))+'</time></div>'+
    '<p>'+escape(m.text)+'</p>'+
    (mine?'':'<button type="button" class="ccc-online-chat-report" data-chaos-online-action="chat-report" data-message-id="'+escape(m.id)+'" aria-label="Report message by '+escape(name)+'">Report</button>')+'</li>';
  }).join(''):'<li class="ccc-online-chat-empty">Room chat is ready. Be the first to talk trash.</li>')+'</ol>';
 return '<aside class="ccc-online-chat'+(open?' ccc-online-chat--open':'')+'" aria-label="Private match chat">'+
  '<header><div><h3>Roadside radio</h3><small>Private to this room · '+room.seats.filter(s=>s.joined).length+' drivers</small></div>'+
   '<button type="button" class="ccc-online-chat-close" data-chaos-online-action="chat-toggle" aria-label="Close room chat">✕</button></header>'+
  '<details class="ccc-online-chat-events"><summary>Road events</summary><ol>'+
   (room.log||[]).slice(-5).map(msg=>'<li>'+escape(msg)+'</li>').join('')+'</ol></details>'+
  log+
  '<div class="ccc-online-chat-mutes"><span>Mute players:</span>'+
   room.seats.map((s,i)=>i===room.seat||s.controller==='computer'?'': 
    '<button type="button" data-chaos-online-action="mute" data-seat="'+i+'" aria-pressed="'+muted.has(i)+'">'+
     (muted.has(i)?'Unmute ':'Mute ')+escape(s.name)+'</button>').join('')+'</div>'+
  (state.chatError?'<p class="ccc-online-chat-error" role="alert">'+escape(state.chatError)+'</p>':'')+
  (state.chatNotice?'<p class="ccc-online-chat-notice" role="status">'+escape(state.chatNotice)+'</p>':'')+
  '<form data-chaos-online-chat aria-label="Send room-only message">'+
   '<label for="ccc-online-chat-text">Message to this room</label>'+
   '<textarea id="ccc-online-chat-text" name="text" maxlength="280" rows="2" placeholder="Friendly trash talk…" required></textarea>'+
   '<button type="submit">Send</button></form></aside>';
}

function roomDetails(room,state={}){
 const lobby=room.status==='lobby';
 const ready=room.seats.every(s=>s.joined);
 const board='<div class="ccc-online-standings" aria-label="Public standings">'+room.seats.map((s,i)=>{
  const p=room.players?.[i];
  return '<div class="ccc-online-seat '+(room.seat===i?'ccc-online-seat--mine':'')+
   (room.turn===i?' ccc-online-seat--turn':'')+'"><span>'+escape(s.name)+'</span>'+
   '<strong>'+(p?p.km.toLocaleString('en-CA')+' / 2,500 km':s.joined?'Ready':'Awaiting player')+'</strong>'+
   '<small>'+(p?p.score.toLocaleString('en-CA')+' championship km · '+escape(p.status?.name||'On the road'):
    s.controller==='computer'?'Computer · '+escape(s.difficulty):'Human driver')+'</small></div>';
 }).join('')+'</div>';
 if(lobby)return '<section class="ccc-online-lobby"><h3>Private waiting room</h3>'+board+
  '<p>Invite each person with a separate BongGoggles account. Everyone uses their own screen.</p>'+
  (room.joinCode?'<label>Private invite code <input readonly value="'+escape(room.joinCode)+'" aria-label="Invite code"></label>'+
   '<p>Share this code privately with the other players. Every player must sign in and join on their own device.</p>':'')+
  (room.host?'<button type="button" data-chaos-online-action="start" '+(ready?'':'disabled')+
   '>Start championship</button>':'<p>Waiting for the host to start.</p>')+'</section>'+roomChat(room,state);
 const finished=room.status==='finished'?
  '<section class="ccc-online-results"><h3>Championship finished</h3>'+
  room.players.map(p=>'<p>'+escape(p.name)+': '+p.score.toLocaleString('en-CA')+' banked km · '+p.wins+' stage wins</p>').join('')+'</section>':'';
 const between=room.status==='between'?
  '<section class="ccc-online-results"><h3>Stage complete</h3><p>Scores are banked. All regional hazards and equipment reset for the next stage.</p>'+
  (room.host?'<button type="button" data-chaos-online-action="next">Start next region</button>':
   '<p>Waiting for host to continue.</p>')+'</section>':'';
 const top='<section class="ccc-online-track" aria-label="Shared Canadian highway map">'+
  '<div class="ccc-online-map">'+renderChaosHighway({leg:room.leg,players:room.players})+'</div>'+
  board+'</section>';
 return '<section class="ccc-online-game">'+
  '<div class="ccc-online-main"><div class="ccc-online-stage"><strong>LEG '+(room.leg+1)+'/3 — '+escape(room.stageName)+'</strong>'+
   '<span>'+(room.turn===room.seat?'YOUR TURN':escape(room.seats[room.turn]?.name||'Driver')+' DRIVING')+
    ' · 2,500 km goal</span>'+
   '<button class="ccc-online-chat-toggle" type="button" data-chaos-online-action="chat-toggle" aria-expanded="'+(state.chatOpen===true)+'">'+
    'Room chat'+(state.unreadChat?' · '+state.unreadChat+' new':'')+'</button></div>'+
   top+'<div class="ccc-online-middle">'+publicTables(room)+drawPiles(room)+'</div>'+
   privateHand(room,state.selectedCard)+
   '<div class="ccc-online-stage-end">'+between+finished+'</div></div>'+
   roomChat(room,state)+'</section>';
}
export function renderChaosOnline(state={status:'loading'}){
 state??={status:'loading'};
 const header='<header class="ccc-online-header"><div><p class="eyebrow">420ID Account multiplayer · zero wager</p>'+
  '<h2>Cross-Country Chaos</h2><p>One driver per account. Your hand is private; the server handles the race.</p></div>'+
  (state.room?'<button type="button" data-chaos-online-action="back">My matches</button>':'')+'</header>';
 if(state.status==='guest')return '<div class="ccc-online" data-chaos-online>'+header+
  '<section class="ccc-online-message"><h3>Sign in to play</h3><p>Every human player needs their own 420ID account and browser session. No wallet required.</p>'+
  '<a class="ui-button" href="/social-api/auth/start">Log in with 420ID</a></section></div>';
 if(state.status==='unavailable'||state.status==='disabled')return '<div class="ccc-online" data-chaos-online>'+header+
  '<section class="ccc-online-message" role="status"><h3>Account multiplayer is not available yet</h3>'+
  '<p>The authenticated game server has not been activated or cannot be reached. This is an online multiplayer game; it will not silently switch to shared-screen play.</p>'+
  '<button type="button" data-chaos-online-action="refresh">Retry connection</button></section></div>';
 if(state.status==='loading')return '<div class="ccc-online" data-chaos-online>'+header+
  '<p role="status">Checking your 420ID session and current matches…</p></div>';
 const room=state.room;
 return '<div class="ccc-online'+(room&&room.status!=='lobby'?' ccc-online--game':'')+'" data-chaos-online>'+header+
  (state.error?'<p role="alert" class="ccc-online-error">'+escape(state.error)+'</p>':'')+
  (room?roomDetails(room,state):'<div class="ccc-online-home"><section><h3>My championships</h3>'+
   (state.rooms.length?state.rooms.map(roomSummary).join(''):'<p>No active account matches. Start a room or enter an invite code.</p>')+
   '<button type="button" data-chaos-online-action="refresh">Refresh rooms</button></section>'+
   '<form data-chaos-online-create><h3>Create a private room</h3>'+
   '<label>Total human players <select name="humanSeats"><option value="2">2 accounts</option><option value="3">3 accounts</option><option value="4">4 accounts</option><option value="1">1 account + computers</option></select></label>'+
   '<label>Computer seats <select name="botCount"><option value="0">None</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>'+
   '<label>Computer difficulty <select name="difficulty"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></label>'+
   '<button type="submit">Create room</button></form>'+
   '<form data-chaos-online-join><h3>Join another player</h3><label>Private invitation code <input name="code" minlength="32" maxlength="32" autocomplete="off" required></label>'+
   '<button type="submit">Join room</button></form></div>')+'</div>';
}
