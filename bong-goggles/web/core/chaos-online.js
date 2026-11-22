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
 Array.isArray(value.legal??[]);
export function checkChaosProjection(value){if(!isRoom(value))throw Error('Untrusted championship projection');return value;}
export class ChaosRoomsClient{
 constructor({fetchImpl=fetch,onChange=()=>{}}={}){
  this.fetchImpl=fetchImpl;this.onChange=onChange;
  this.state={status:'loading',rooms:[],room:null,error:null};
  this.generation=0;this.busy=false;
 }
 emit(next){this.state={...next};this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.emit({status:'loading',rooms:[],room:null,error:null});}
 async request(path,{method='GET',data}={}){
  if(!/^\/v1\/chaos\/rooms(?:\/[a-z0-9-]+)?(?:\/(?:start|move|next))?$/.test(path))
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
   this.emit({...this.state,status:'ready',room:checkChaosProjection(res.data.room),error:null});
  }catch{
   if(gen===this.generation&&!silent)this.emit({...this.state,status:'unavailable',room:null,error:'Could not refresh this game.'});
  }
 }
 async mutate(action,data={}){
  if(this.busy)throw Error('A game action is already pending');
  this.busy=true;
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
 if(!options.length)return '<small>Not playable this turn</small>';
 return options.map(o=>{
  const verb= o.action==='drive'?'Drive '+c.km+' km':
   o.action==='hazard'?'Sabotage '+(room.seats[o.target]?.name||'opponent'):
   o.action==='fix'?'Repair':o.action==='power'?'Activate':o.action==='discard'?'Discard':'Play';
  const base={action:o.action,index:o.index,...(o.target!==undefined?{target:o.target}:{})};
  const button=(text,move)=>'<button type="button" data-chaos-online-action="move" data-move="'+
   escape(JSON.stringify(move))+'">'+escape(text)+'</button>';
  const boost=o.action==='drive'&&room.players?.[room.seat]?.upgrades?.some(u=>
   u.id==='shortcut-specialist'&&!room.players[room.seat].used.includes(u.id));
  return button(verb,base)+(boost?button('Drive + 100 km boost',{...base,useBoost:true}):'');
 }).join('');
}
function privateHand(room){
 return '<section class="ccc-online-hand" aria-label="Your private hand"><h3>Your cards <small>'+room.hand.length+' cards</small></h3>'+
 '<div class="ccc-online-cards">'+room.hand.map((c,i)=>'<article class="ccc-online-card">'+cardImage(c,room.leg)+
 '<strong>'+escape(cardLabel(c))+'</strong><div class="ccc-online-card-actions">'+handControls(room,c,i)+'</div></article>').join('')+'</div></section>';
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

function roomDetails(room){
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
   '>Start championship</button>':'<p>Waiting for the host to start.</p>')+'</section>';
 const controls=room.legal.filter(o=>o.index===undefined).map(o=>
  '<button type="button" data-chaos-online-action="move" data-move="'+escape(JSON.stringify(o))+'">'+
  escape(o.action==='draw'?o.choice==='deck'?'Draw two from stock':'Take top discard + draw':
   o.action==='pass'?'Pass turn':o.action==='recover'?'Recover vehicle':o.action)+'</button>').join('');
 const finished=room.status==='finished'?
  '<section class="ccc-online-results"><h3>Championship finished</h3>'+
  room.players.map(p=>'<p>'+escape(p.name)+': '+p.score.toLocaleString('en-CA')+' banked km · '+p.wins+' stage wins</p>').join('')+'</section>':'';
 const between=room.status==='between'?
  '<section class="ccc-online-results"><h3>Stage complete</h3><p>Scores are banked. All regional hazards and equipment reset for the next stage.</p>'+
  (room.host?'<button type="button" data-chaos-online-action="next">Start next region</button>':
   '<p>Waiting for host to continue.</p>')+'</section>':'';
 return '<section class="ccc-online-game"><div class="ccc-online-track"><div class="ccc-online-map">'+
  renderChaosHighway({leg:room.leg,players:room.players})+'</div>'+board+'</div>'+publicTables(room)+
  '<div class="ccc-online-play"><div class="ccc-online-public"><h3>On the road</h3>'+
  '<p>'+escape(room.stageName)+' · Stage '+(room.leg+1)+' of 3</p>'+
  '<p>Stock: '+room.stockCount+' cards · Discard: '+room.discardCount+'</p>'+
  (room.discardTop?'<div class="ccc-online-discard">'+cardImage(room.discardTop,room.leg)+
  '<span>Top discard: '+escape(cardLabel(room.discardTop))+'</span></div>':'')+
  (room.finishPending?'<p class="ccc-online-finish">Final round underway</p>':'')+
  '<p class="ccc-online-status" role="status">'+(room.turn===room.seat&&room.status==='playing'?
   'Your turn · '+escape(room.step):'Waiting for '+escape(room.seats[room.turn]?.name||'results'))+'</p>'+
  '<div class="ccc-online-actions">'+controls+'</div></div>'+
  privateHand(room)+'</div>'+between+finished+
  '<details class="ccc-online-log"><summary>Roadside radio</summary><ol>'+
  (room.log||[]).map(s=>'<li>'+escape(s)+'</li>').join('')+'</ol></details></section>';
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
 return '<div class="ccc-online" data-chaos-online>'+header+
  (state.error?'<p role="alert" class="ccc-online-error">'+escape(state.error)+'</p>':'')+
  (room?roomDetails(room):'<div class="ccc-online-home"><section><h3>My championships</h3>'+
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
