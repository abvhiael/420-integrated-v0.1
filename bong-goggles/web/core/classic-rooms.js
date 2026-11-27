import {saladFormat} from './word-salad-session.js';
// BC-0.5 — 420ID rooms and seat administration, never a match engine.
import {createAccountSocialClient,isSubjectID} from './account-social.js';
import {CLASSIC_ROADMAP} from './classics.js';
import {escapeHtml as esc} from './design-system.js';
import {renderClassicRoomLive} from './classic-communications-ui.js';
import {findCribbageRoomMatch,cribbageRoomEntry} from './cribbage-room-resume.js';

export const ROOM_LIMITS=Object.freeze({
cribbage:[2,4],'labyrinth-cribbage':[2,4],chess:[2,2],scrabble:[2,4],
checkers:[2,2],backgammon:[2,2],dominoes:[2,4],'crazy-eights':[2,4],
euchre:[4,4],yahtzee:[2,4],'go-fish':[2,4],hearts:[3,4],
go:[2,2],mahjong:[4,4],spades:[4,4],'500':[3,4],
canasta:[2,4],tarabish:[4,4],'45s':[2,4],'120s':[4,4],
'deux-cents':[4,4],hola:[2,4],rook:[4,4],nines:[3,4],kaiser:[4,4]
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const id=x=>typeof x==='string'&&UUID.test(x);
const title=game=>CLASSIC_ROADMAP.find(g=>g.id===(game==='russian-cribbage'?'labyrinth-cribbage':game))?.title??'Unknown game';
const limited=x=>typeof x==='string'&&x.length<=80&&x.trim()===x;
const types=new Set(['empty','invited','human','bot']);
const modes=new Set(['open','ready','in_game','completed','cancelled']);
const difficulties=new Set(['easy','medium','hard']);
const validCount=(game,n)=>Number.isSafeInteger(n)&&
(game==='russian-cribbage'?n===2:Object.hasOwn(ROOM_LIMITS,game)&&
 n>=ROOM_LIMITS[game][0]&&n<=ROOM_LIMITS[game][1]);
function normalizedRoom(r,detail=false){
if(!r||typeof r!=='object'||!id(r.id)||!id(r.host)||!validCount(r.gameId,r.seatCount)||
!['public','private'].includes(r.visibility)||!modes.has(r.status)||
!Number.isSafeInteger(r.revision)||r.revision<1)return null;
if(!detail)return Object.freeze({id:r.id,host:r.host,gameId:r.gameId,
visibility:r.visibility,seatCount:r.seatCount,status:r.status,revision:r.revision});
if(!Array.isArray(r.seats)||r.seats.length!==r.seatCount||!Array.isArray(r.invites)||r.invites.length>30)return null;
const seats=r.seats.map((s,index)=>{
if(!s||s.index!==index||!types.has(s.controller)||!Number.isSafeInteger(s.team)||
s.team<0||s.team>=r.seatCount||s.subject!=null&&s.subject!==''&&!id(s.subject)||
s.difficulty!=null&&s.difficulty!==''&&!difficulties.has(s.difficulty))return null;
if((s.controller==='empty'||s.controller==='bot')&&s.subject)return null;
if(s.controller==='human'&&!id(s.subject))return null;
if(s.controller==='bot'&&!difficulties.has(s.difficulty))return null;
if(s.controller!=='bot'&&s.difficulty)return null;
return Object.freeze({index,controller:s.controller,team:s.team,subject:s.subject??'',difficulty:s.difficulty??''});
});
if(seats.some(s=>!s))return null;
const invites=r.invites.map(v=>{
if(!v||!id(v.id)||!id(v.target)||!Number.isSafeInteger(v.seat)||v.seat<1||v.seat>=r.seatCount||
!['pending','accepted','declined','cancelled','expired'].includes(v.status))return null;
return Object.freeze({id:v.id,seat:v.seat,target:v.target,status:v.status});
});
if(invites.some(x=>!x))return null;
if(r.gameId==='chess'&&(r.seatCount!==2||seats.some((s,i)=>s.team!==i)))return null;
const variantId=['labyrinth-cribbage','scrabble'].includes(r.gameId)?r.variantId:null;
if(r.gameId==='scrabble'&&(!saladFormat(variantId,r.seatCount)||seats.some((s,i)=>s.team!==i)))return null;
if(r.gameId==='labyrinth-cribbage'&&variantId!=null){
 const expected=r.seatCount===2?'labyrinth-2p':r.seatCount===3?'labyrinth-3p':
 r.seats[2].team===0?'labyrinth-4p-partners':'labyrinth-4p-individual';
 if(variantId!==expected)return null;
 const teams=r.seatCount===4&&variantId==='labyrinth-4p-partners'?[0,1,0,1]:
 Array.from({length:r.seatCount},(_,i)=>i);
 if(seats.some((s,i)=>s.team!==teams[i]))return null;
}
return Object.freeze({...normalizedRoom(r),variantId,seats:Object.freeze(seats),invites:Object.freeze(invites)});
}
export const normalizeClassicRoom=normalizedRoom;
 // Never surface arbitrary upstream error bodies, SQL, tokens or identities.
export function classicRequestFailure(response,stage='Room action'){
 const status=response?.status;
 const message=({400:'Invalid game or room configuration.',401:'420ID session is no longer verified.',403:'Request is not authorized.',404:'Required game service or room is unavailable.',409:'Room conflict or active-room limit reached. Check Multiplayer Rooms before retrying.',429:'Too many requests. Try again after the rate limit resets.',502:'Gateway could not confirm the request.',503:'Game service temporarily unavailable.',504:'Gateway timed out; check existing rooms before retrying.'})[status];
 return stage+' — '+(message||(Number.isInteger(status)&&status>=200&&status<300?'Server response did not match the expected room or session.':'Network or service response could not be verified.'))+(Number.isInteger(status)&&status>0?' (HTTP '+status+')':'');
}

const verifiedEnvelope=(response,name)=>{
if(!response||response.status!==200&&response.status!==201||
response.data?.onChain!==false||response.data?.wager!==false||
response.data?.rewards!==false||response.data?.playable!==false)throw Error('Room response not authoritative');
return response.data[name];
};
export class ClassicRoomsController{
constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
this.client=createAccountSocialClient({enabled,fetchImpl});
this.state={status:enabled?'loading':'disabled'};
this.onChange=onChange;this.generation=0;this.mutating=false;
}
emit(state){this.state={...state};this.onChange(this.state);return this.state;}
invalidate(){this.generation++;this.emit({status:this.client.enabled?'loading':'disabled'});}
async refresh(roomId=null){
if(!this.client.enabled)return this.emit({status:'disabled'});
if(this.mutating)return this.state;
const gen=++this.generation;this.emit({status:'loading'});
try{
const me=await this.client.request('/v1/me');
if(gen!==this.generation)return this.state;
if(me.status===401)return this.emit({status:'guest'});
if(me.status!==200||me.data?.walletRequired!==false||!isSubjectID(me.data.profile?.subject))
throw Error('Unverified 420ID identity');
const list=await this.client.request('/v1/classic-rooms');
if(gen!==this.generation)return this.state;
if(list.status===401)return this.emit({status:'guest'});
const rooms=verifiedEnvelope(list,'rooms');
if(!Array.isArray(rooms)||rooms.length>50)throw Error('Unverified rooms');
const safeRooms=rooms.map(r=>normalizedRoom(r));
if(safeRooms.some(r=>!r))throw Error('Invalid room list');
const friendsPage=await this.client.request('/v1/classic-rooms/friends');
if(gen!==this.generation)return this.state;
if(friendsPage.status===401)return this.emit({status:'guest'});
if(friendsPage.status!==200||friendsPage.data?.onChain!==false||
!Array.isArray(friendsPage.data.friends)||friendsPage.data.friends.length>100)
throw Error('Friend list unavailable');
const friends=friendsPage.data.friends.map(f=>f&&id(f.subject)&&limited(f.displayName)&&
f.displayName.length>0?Object.freeze({subject:f.subject,displayName:f.displayName}):null);
if(friends.some(f=>!f))throw Error('Unverified friend');
let selected=null,notFound=false;
if(roomId!=null){
if(!id(roomId))throw Error('Invalid room ID');
const detail=await this.client.request('/v1/classic-rooms/'+roomId);
if(gen!==this.generation)return this.state;
if(detail.status===401)return this.emit({status:'guest'});
if(detail.status===404)notFound=true;
else {
selected=normalizedRoom(verifiedEnvelope(detail,'room'),true);
if(!selected||selected.id!==roomId)throw Error('Unverified room detail');
}
}
const found=await findCribbageRoomMatch(this.client,selected);
if(gen!==this.generation)return this.state;
if(found.status===401)return this.emit({status:'guest'});
const gameSession=found.session;
return this.emit({status:'ready',viewer:me.data.profile.subject,
rooms:safeRooms,friends,selected,gameSession,notFound,notice:''});
}catch{
if(gen===this.generation)return this.emit({status:'error'});
}
return this.state;
}
async act(action,data={}){
if(this.mutating)return this.state;
if(!this.client.enabled||this.state.status!=='ready'||!isSubjectID(this.state.viewer))
throw Error('420ID room session required');
const gen=++this.generation;
const current=this.state;
let submitted=false,failure='';this.mutating=true;
try{
let path,body;
if(action==='create'){
if(!validCount(data.gameId,Number(data.seatCount))||!['private','public'].includes(data.visibility))throw Error('Invalid room configuration');
path='/v1/classic-rooms';body={gameId:data.gameId,seatCount:Number(data.seatCount),visibility:data.visibility};
if(data.gameId==='labyrinth-cribbage'){
 if(!['individual','partnerships',''].includes(data.format??''))throw Error('Invalid Labyrinth scoring format');
 if(data.seatCount===4)body.format=data.format||'partnerships';
 else if(data.format&&data.format!=='individual')throw Error('Only four seats support partnerships');
}else if(data.gameId==='scrabble'){const format=data.format||'17:classic-salad:live';if(!saladFormat(format,Number(data.seatCount)))throw Error('Invalid Word Salad board format');body.format=format;}else if(data.format)throw Error('Format is not allowed for this game');
}else{
if(!current.selected||!id(current.selected.id)||!Number.isSafeInteger(data.seat)||data.seat<0||
data.seat>=current.selected.seatCount)throw Error('No qualified room and seat');
if(!['invite','accept','decline','cancel-invite','join','leave','bot','clear-bot','cancel-room'].includes(action))
throw Error('Unsupported room action');
path='/v1/classic-rooms/'+current.selected.id+'/change';
body={action,seat:data.seat,expectedRevision:current.selected.revision};
if(action==='invite'){
if(!current.friends.some(f=>f.subject===data.target))throw Error('Recipient is not a verified mutual friend');
body.target=data.target;
}
if(action==='bot'){
if(!difficulties.has(data.difficulty))throw Error('Invalid computer difficulty');
body.difficulty=data.difficulty;
}
}
submitted=true;
const response=await this.client.request(path,{method:'POST',body});
if(gen!==this.generation)return this.state;
if(response.status===401)return this.emit({status:'guest'});
if(action==='create'&&response.status!==201){failure=classicRequestFailure(response,'Room creation');throw Error(failure);}
if(response.status===409){
this.emit({...current,notice:'Room changed on another account. Reloading its verified state.'});
this.mutating=false;return this.refresh(current.selected?.id??null);
}
failure=classicRequestFailure(response,action==='create'?'Room creation':'Room action');
const returned=verifiedEnvelope(response,'room');
if(action==='decline'||action==='leave'){
if(!returned||!id(returned.id)||returned.id!==current.selected.id)throw Error('Unverified departure');
this.mutating=false;return this.refresh(null);
}
const view=normalizedRoom(returned,true);
if(!view)throw Error('Unverified room update');
if(action!=='create'&&view.gameId==='scrabble'&&view.id===current.selected?.id&&view.revision>=current.selected.revision)return this.emit({...current,selected:view,notice:'Room update confirmed.'});
this.mutating=false;return this.refresh(view.id);
}catch(error){
if(gen===this.generation)this.emit(submitted?{status:'error',notice:failure||'Room action not confirmed; check Multiplayer Rooms before retrying.'}:
{...current,notice:'Invalid room request. No action was submitted.'});
throw error;
}finally{this.mutating=false;}
}
}
const note=message=>'<p class="classic-room__notice" role="status">'+esc(message)+'</p>';
const roomHref=r=>'/games/rooms/'+r.id;
const games=CLASSIC_ROADMAP.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.title)+'</option>').join('');
const teamName=(r,s)=>r.gameId==='chess'?(s.index===0?'White':'Black'):r.seatCount===4&&new Set(['cribbage','euchre','spades','canasta','tarabish','500','120s','deux-cents','rook','kaiser']).has(r.gameId)?
'Team '+(s.team===0?'A':'B'):r.gameId==='labyrinth-cribbage'&&
 r.variantId==='labyrinth-4p-partners'?'Team '+(s.team===0?'A':'B'):
 'Player '+(s.index+1);
function roomSummary(r){
return '<li><a href="'+roomHref(r)+'" data-route="classic-room"><strong>'+esc(title(r.gameId))+
'</strong> · '+esc(r.visibility)+' · '+r.seatCount+' seats · '+esc(r.status)+'</a></li>';
}
function makeAction(action,seat,label,extra=''){
return '<form data-classic-room-action="'+action+'" data-room-seat="'+seat+'">'+extra+
'<button type="submit">'+esc(label)+'</button></form>';
}
function roomDetail(r,state,live=null,chessEnabled=false,saladEnabled=false){
const isHost=r.host===state.viewer;
const hasSeat=r.seats.some(s=>s.subject===state.viewer);
const friendOptions=state.friends.map(f=>'<option value="'+f.subject+'">'+esc(f.displayName)+'</option>').join('');
const invite=(index)=>friendOptions?makeAction('invite',index,'Invite friend',
'<label>Mutual friend<select name="target">'+friendOptions+'</select></label>'):'<small>Mutual 420ID friends required before sending an invitation.</small>';
const bot=(index,value='medium')=>makeAction('bot',index,'Set computer seat',
'<label>Computer strength<select name="difficulty">'+['easy','medium','hard'].map(d=>
'<option value="'+d+'"'+(d===value?' selected':'')+'>'+esc(d[0].toUpperCase()+d.slice(1))+'</option>').join('')+'</select></label>');
const seats=r.seats.map(s=>{
const invited=s.controller==='invited'&&s.subject===state.viewer;
const label=s.controller==='bot'?'Computer · '+s.difficulty:
s.controller==='human'?(s.subject===state.viewer?'You':state.friends.find(f=>f.subject===s.subject)?.displayName??'420ID member'):
s.controller==='invited'?'Invitation pending':'Empty seat';
let actions='';
if(r.status==='open'||r.status==='ready'){
if(s.index!==0&&s.controller==='empty'&&isHost)actions=invite(s.index)+bot(s.index);
else if(s.index!==0&&s.controller==='empty'&&r.visibility==='public'&&!hasSeat)
actions=makeAction('join',s.index,'Join this seat');
else if(s.index!==0&&s.controller==='bot'&&isHost)
actions=bot(s.index,s.difficulty)+makeAction('clear-bot',s.index,'Remove computer');
else if(s.index!==0&&s.controller==='invited'&&isHost)
actions=makeAction('cancel-invite',s.index,'Cancel invitation');
else if(invited)actions=makeAction('accept',s.index,'Accept invitation')+makeAction('decline',s.index,'Decline invitation');
else if(s.index!==0&&s.controller==='human'&&s.subject===state.viewer)
actions=makeAction('leave',s.index,'Leave room');
}
return '<li><strong>Seat '+(s.index+1)+' · '+esc(teamName(r,s))+'</strong><span>'+esc(label)+'</span><div class="classic-room__actions">'+actions+'</div></li>';
}).join('');
const invites=isHost&&r.invites.length?'<details><summary>Invitation history</summary><ul>'+r.invites.map(i=>
'<li>Seat '+(i.seat+1)+' · '+esc(state.friends.find(f=>f.subject===i.target)?.displayName??'420ID member')+
' · '+esc(i.status)+'</li>').join('')+'</ul></details>':'';
const roomLive=renderClassicRoomLive(r,live);
const cribbageLink=cribbageRoomEntry(r,state.gameSession,live);
const labyrinthLink=r.gameId==='labyrinth-cribbage'&&live?.status==='connected'&&
 live.session?.gameId===r.gameId&&live.session?.id&&live.session?.roomId===r.id&&
 ['active','finished'].includes(live.session.status)?
 '<p><a class="ui-button" href="/games/labyrinth-cribbage/play?session='+
 esc(live.session.id)+'" data-route="classic-game">Resume your private Labyrinth table</a></p>':'';
const chessLink=chessEnabled&&r.gameId==='chess'&&r.seats.some(s=>s.controller==='human'&&s.subject===state.viewer)&&live?.status==='connected'&&live?.session?.gameId==='chess'&&live.session.roomId===r.id&&/^[0-9a-f-]{36}$/.test(live.session.id)?'<p><a class="ui-button" data-route="classic-game" href="/games/chess/play?session='+esc(live.session.id)+'">Resume Chess</a></p>':'';
const chessStart=chessEnabled&&r.gameId==='chess'&&isHost&&r.status==='ready'?'<form data-chess-room-start><label>Clock <select name="clockProfile">'+['untimed','1+0','2+1','3+0','3+2','5+0','5+3','10+0','15+10','30+0','30+30','60+0'].map(x=>'<option>'+x+'</option>').join('')+'</select></label><button type="submit">Start Chess</button></form>':'';
const saladStart=saladEnabled&&r.gameId==='scrabble'&&isHost&&r.status==='ready'?'<form data-salad-room-start><button type="submit">Start Word Salad</button></form>':'';
const saladLink=saladEnabled&&r.gameId==='scrabble'&&hasSeat&&live?.status==='connected'&&live.session?.gameId==='scrabble'&&live.session.roomId===r.id&&id(live.session.id)?'<a href="/games/scrabble/play?session='+esc(live.session.id)+'" data-route="classic-game">Resume Word Salad</a>':'';
return '<section class="classic-room__detail"><p><a href="'+(r.gameId==='cribbage'?'/games/cribbage/history':'/games/rooms')+'" data-route="'+(r.gameId==='cribbage'?'classic-game':'classic-rooms')+'">← '+(r.gameId==='cribbage'?'Cribbage · My Games':'All rooms')+'</a></p>'+
'<h2>'+esc(title(r.gameId))+' · '+esc(r.visibility)+' room</h2>'+
'<p>'+r.seatCount+' seats · '+esc(r.status)+' · revision '+r.revision+
 (r.gameId==='labyrinth-cribbage'?' · '+esc(r.variantId==='labyrinth-4p-individual'?'Individual scores':r.variantId==='labyrinth-4p-partners'?'Opposite-seat partnerships (default)':'Individual scores'):'')+'</p>'+
note(r.status==='ready'?(r.gameId==='cribbage'?'All seats filled. The host may start a qualified Cribbage match.':'All seats filled. Game start and turns require BC-0.6; no match has begun.'):
r.status==='cancelled'?'This room was cancelled.':r.status==='in_game'?'Room is now in a server-owned session. Seats are locked.':r.status==='completed'?'The server session has ended.':'Lobby only — no wagers, rewards or playable match until its game engine is qualified.')+
'<ol class="classic-room__seats">'+seats+'</ol>'+(isHost&&r.status==='ready'&&
 ['cribbage','labyrinth-cribbage'].includes(r.gameId)?
 '<form '+(r.gameId==='cribbage'?'data-cribbage-room-start':'data-labyrinth-room-start')+
 '><button type="submit">Start '+esc(title(r.gameId))+'</button></form>':'')+
 cribbageLink+labyrinthLink+chessStart+chessLink+saladStart+saladLink+roomLive+invites+
(isHost&&(r.status==='open'||r.status==='ready')?makeAction('cancel-room',0,'Cancel room'):'')+'</section>';
}
export function renderClassicRooms(state,{enabled=false,roomId=null,live=null,chessEnabled=false,saladEnabled=false}={}){
const start='<section class="classic-room" aria-label="420ID multiplayer rooms"><p><a href="/games/cribbage/history" data-route="classic-game">← Cribbage · My Games</a> · <a href="/games" data-route="games">Games catalogue</a></p>'+
'<h2>Multiplayer rooms</h2><p>Persistent off-chain rooms for 420ID friends and public groups. No wallet, wagers or token rewards. Lobby seats do not start gameplay.</p>';
if(!enabled)return start+note('Multiplayer rooms are not activated for this deployment.')+'</section>';
if(!state||state.status==='loading')return start+note('Checking your 420ID session and room access…')+'</section>';
if(state.status==='guest')return start+note('Sign in with 420ID to browse, create or join rooms.')+
'<p><a class="ui-button" href="/social-api/auth/start">Sign In with 420ID</a></p></section>';
if(state.status!=='ready')return start+note(state.notice||'420ID room service or account verification is unavailable. No private room data is shown.')+
'<button type="button" data-classic-room-refresh>Retry room check</button></section>';
const heading=start+(state.notice?note(state.notice):'');
if(roomId!=null){
if(!state.selected)return heading+note(state.notFound?'Room not found or access denied.':'Room details are not available.')+
'<button type="button" data-classic-room-refresh>Refresh rooms</button></section>';
if(live&&['reconnecting','guest','revoked'].includes(live.status))
return heading+note('Connection lost or room access changed. Checking 420ID and the latest authoritative state; cached private room data is hidden.')+
'<button type="button" data-classic-room-refresh>Reconnect to room</button></section>';
return heading+roomDetail(state.selected,state,live,chessEnabled,saladEnabled)+'</section>';
}
const creation='<section class="classic-room__create"><h3>Create a private or public room</h3>'+
'<form data-classic-room-create><label>Game<select name="gameId">'+games+'</select></label>'+
'<label>Visibility<select name="visibility"><option value="private">Private — invited friends only</option><option value="public">Public — visible to other members</option></select></label>'+
'<label>Number of players<select name="seatCount"><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>'+
'<label data-labyrinth-room-format hidden>Labyrinth four-player scoring<select name="format"><option value="partnerships" selected>Partnerships (default)</option><option value="individual">Individual free-for-all</option></select></label>'+
'<button type="submit">Create room</button></form></section>';
return heading+creation+'<section><h3>Available rooms and invitations</h3>'+
(state.rooms.length?'<ul class="classic-room__list">'+state.rooms.map(roomSummary).join('')+'</ul>':
note('No visible rooms yet. Create a room to invite mutual friends or let others join publicly.'))+
'<button type="button" data-classic-room-refresh>Refresh rooms</button></section></section>';
}
