// BC-1.4: usable left-side hand/table, right-side approved leaf score board.
// Reads only the verified 420ID seat projection. Never renders secret opponent cards.
import {escapeHtml as esc} from './design-system.js';
import {resignCribbageMatch} from './classic-cribbage-multiplayer.js';
import {renderCribbageSocial} from './classic-cribbage-social.js';
import {renderGameAccountPanel} from './account-identity.js';
import {renderSharedGameScreen} from './shared-game-ui.js';
import {classicGameById} from './classics.js';
import {CRIBBAGE_BOARD_SIZE,CRIBBAGE_BOARD_ART,CRIBBAGE_HOLES,CRIBBAGE_TRACKS,
cribbageHole,cribbageTeams,cribbageLane,cribbageNewPegs} from './cribbage-board.js';
import {cribbageCardLabel,cribbageLegalMoves,cribbageCanSubmit} from './cribbage-session.js';
const back='<a class="cribbage-back" href="/games" data-route="games">← All Games</a>';
const gameLink=(id,screen)=>'/games/cribbage/'+screen+(id?'?session='+encodeURIComponent(id):'');
const tabs=['intro','rules','play','setup','table','results','history','rematch'];
const tabLabel={intro:'Overview',rules:'Rules',play:'Play',setup:'Opponents',table:'Game table',results:'Results',history:'History',rematch:'Rematch'};
const menu=(screen,id)=>'<nav class="cribbage-nav" aria-label="Cribbage screens">'+
tabs.map(s=>'<a href="'+gameLink(id,s)+'" data-route="classic-game"'+
(s===screen?' aria-current="page"':'')+'>'+tabLabel[s]+'</a>').join('')+'</nav>';
const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
function cardFace(id,selected=false,disabled=false){
const name=cribbageCardLabel(id),suit=name.at(-1),rank=name.slice(0,-1);
const red=suit==='♥'||suit==='♦';
return '<span class="cribbage-card'+(red?' cribbage-card--red':'')+
(selected?' is-selected':'')+(disabled?' is-muted':'')+'" aria-label="'+esc(name)+'">'+
'<span class="cribbage-card__corner">'+esc(rank)+'<small>'+esc(suit)+'</small></span>'+
'<span class="cribbage-card__pip" aria-hidden="true">'+esc(suit)+'</span>'+
'<span class="cribbage-card__corner cribbage-card__corner--bottom">'+esc(rank)+
'<small>'+esc(suit)+'</small></span></span>';
}
function pegHtml(peg,lane){
const a=cribbageHole(lane,peg.a,0),b=cribbageHole(lane,peg.b,1);
return [a,b].map((pos,index)=>{
const name=index?'b':'a',from=peg.hop?.peg===name?cribbageHole(lane,peg.hop.from,index):null;
return '<g class="cribbage-peg cribbage-peg--'+lane+'" role="img" aria-label="'+
esc('Team '+(peg.team+1)+', '+name.toUpperCase()+' peg on '+(peg[name]||'start'))+'">'+
'<circle cx="'+pos.x+'" cy="'+pos.y+'" r="10" class="cribbage-peg__glow"/>'+
'<circle cx="'+pos.x+'" cy="'+pos.y+'" r="6" class="cribbage-peg__head">'+
(from?'<animate attributeName="cx" from="'+from.x+'" to="'+pos.x+'" dur="1.2s" fill="freeze"/>'+
'<animate attributeName="cy" from="'+from.y+'" to="'+pos.y+'" dur="1.2s" fill="freeze"/>':'')+
'</circle>'+
'</g>';
}).join('');
}
export function renderCribbageBoard({scores=[0,0],seatCount=2,pegs=null,settings={}}={}){
const actual=pegs??cribbageNewPegs(scores,seatCount),teams=cribbageTeams(seatCount);
const distinct=[...new Set(teams)];
const holes=distinct.map(team=>{
const lane=cribbageLane(team,seatCount);
return CRIBBAGE_HOLES[lane].map(p=>
'<circle class="cribbage-hole cribbage-hole--'+lane+'" cx="'+p.x+'" cy="'+p.y+
'" r="'+(seatCount===3?4.2:4.8)+'" data-hole="'+p.number+'" data-lane="'+lane+'">'+
'<title>'+esc('Team '+(team+1)+': '+p.number)+'</title></circle>').join('');
}).join('');
const decade=CRIBBAGE_HOLES.ivory.filter(p=>p.number%10===0).map(p=>
'<text class="cribbage-number" x="'+p.x+'" y="'+(p.y-14)+'" text-anchor="middle">'+p.number+'</text>').join('');
const end='<circle class="cribbage-finish-hole" cx="704" cy="893" r="9"/>'+
'<text class="cribbage-finish-label" x="704" y="861" text-anchor="middle">121</text>';
const stinkhole=settings.stinkhole?distinct.map(team=>{
const lane=cribbageLane(team,seatCount),p=cribbageHole(lane,120);
return '<circle class="cribbage-stinkhole" cx="'+p.x+'" cy="'+p.y+'" r="12"/>';
}).join(''):'';
const tokens=actual.map(p=>pegHtml(p,cribbageLane(p.team,seatCount))).join('');
const table=actual.map(p=>'<li class="cribbage-team cribbage-team--'+cribbageLane(p.team,seatCount)+
'"><span>Team '+(p.team+1)+'</span><strong>'+Math.min(121,p.score)+
'</strong><small>of 121</small></li>').join('');
return '<figure class="cribbage-leaf" aria-label="Cannabis-leaf cribbage scoring board, one hundred and twenty holes per lane and shared finish">'+
'<svg viewBox="0 0 '+CRIBBAGE_BOARD_SIZE.width+' '+CRIBBAGE_BOARD_SIZE.height+
'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Leaf-shaped 121-point cribbage board">'+
'<image href="'+CRIBBAGE_BOARD_ART+'" x="0" y="0" width="1448" height="1086" preserveAspectRatio="none"/>'+
'<g class="cribbage-holes">'+holes+'</g><g aria-hidden="true">'+decade+end+stinkhole+'</g>'+
'<g class="cribbage-pegs">'+tokens+'</g></svg>'+
'<figcaption><ol class="cribbage-board-totals">'+table+
'</ol><p>Two pegs leapfrog as the server awards points. '+(seatCount===4?
'Partners share a track.':seatCount===3?'Amber is the additional third-player virtual track.':
'Every point advances a single physical peg.')+'</p></figcaption></figure>';
}
function opponents(v,seatCount){
const teams=cribbageTeams(seatCount);
return '<ul class="cribbage-seat-list">'+v.cardCounts.map((num,seat)=>
'<li class="'+(v.turn===seat?'is-turn':'')+'">'+
'<span class="cribbage-player-badge">P'+(seat+1)+'</span><span><strong>'+
(seat===v.seat?'You':'Player '+(seat+1))+
'</strong><small>'+('Team '+(teams[seat]+1))+(v.dealer===seat?' · Dealer / crib':'')+
(v.saidGo[seat]?' · Go':'')+'</small></span>'+
'<span class="cribbage-back-stack">'+(seat===v.seat?'Your cards':num+' hidden')+'</span></li>').join('')+'</ul>';
}
function announcements(state){
return '<div class="cribbage-announcer" role="status" aria-live="polite" aria-atomic="true">'+
(state.announcement?'<strong>'+esc(state.announcement)+'</strong>'+
'<span class="cribbage-announcer__time">Scoring · 1.5 seconds</span>':
'<strong>'+esc(state.session?.status==='finished'?'Game complete':
state.session?.privateView.phase==='discard'?'Choose your crib discards':
state.session?.privateView.phase==='cut'?'Cut for the starter':
state.session?.privateView.phase==='peg'?'Play to 31':'Waiting for a match')+'</strong>')+
'</div>';
}
function hand(v,session,state){
const selected=new Set(state.selection??[]),legal=cribbageLegalMoves(session),turn=session.turnSeat===session.viewerSeat;
const validPlay=new Set(legal.filter(x=>x.type==='play').map(x=>x.card));
const discard=v.phase==='discard';
const count=session.seatCount===2?2:1;
const ready=discard&&selected.size===count&&cribbageCanSubmit(session,{
type:'discard',cards:v.hand.filter(id=>selected.has(id))
});
const cards=v.hand.map(id=>{
const active=turn&&(discard||validPlay.has(id));
return '<button type="button" class="cribbage-card-button" data-cribbage-card="'+id+'"'+
(active?'':' disabled')+' aria-pressed="'+(selected.has(id)?'true':'false')+
'" aria-label="'+esc((discard?'Select ':'Play ')+cribbageCardLabel(id))+'">'+
cardFace(id,selected.has(id),!active)+'</button>';
}).join('');
const note=discard?'Select '+count+' card'+(count===1?'':'s')+' to put in the dealer’s crib.':
v.phase==='peg'?'Choose a playable card. The running count may not exceed 31.':
v.phase==='cut'?'One legal cut reveals the shared starter.':
'Your next hand is being prepared.';
const action=discard?
'<button class="cribbage-primary" type="button" data-cribbage-action="discard"'+
(ready?'':' disabled')+'>Send '+count+' to crib</button>':
v.phase==='cut'&&turn?
'<button class="cribbage-primary" type="button" data-cribbage-action="cut">Cut the deck</button>':
v.phase==='peg'&&turn&&legal.some(x=>x.type==='go')?
'<button class="cribbage-primary" type="button" data-cribbage-action="go">Say “Go”</button>':
'';
return '<section class="cribbage-hand-area" aria-label="Your private hand">'+
'<div class="cribbage-section-title"><h3>Your hand</h3><span>'+v.hand.length+' cards</span></div>'+
'<p>'+esc(note)+'</p><div class="cribbage-hand-cards">'+cards+'</div>'+
'<div class="cribbage-actions">'+action+(discard&&selected.size?
'<button type="button" data-cribbage-action="clear">Clear selection</button>':'')+'</div></section>';
}
function playPanel(state){
const session=state.session,v=session.privateView;
const alert=state.error?'<p class="cribbage-error" role="alert">'+esc(state.error)+'</p>':
state.notice?'<p class="cribbage-notice" role="status">'+esc(state.notice)+'</p>':'';
const active=session.status==='active',me=session.viewerSeat===session.turnSeat;
const instructions=session.status==='finished'?'Winner: player '+(session.winnerSeat+1):
active?(me?'Your move — '+v.phase:'Player '+(session.turnSeat+1)+' is playing'):'Match '+session.status;
const pile='<section class="cribbage-pile" aria-label="Exposed cards and cut">'+
'<div class="cribbage-section-title"><h3>Table</h3><strong>'+esc(instructions)+'</strong></div>'+
'<div class="cribbage-table-objects">'+
'<div class="cribbage-table-object"><span class="cribbage-card-back" aria-hidden="true">BG</span>'+
'<small>Deck / crib · '+v.cribCount+' concealed</small></div>'+
'<div class="cribbage-table-object">'+(v.starter<0?
'<span class="cribbage-card-back" aria-label="Starter not yet cut">?</span>':cardFace(v.starter))+
'<small>Starter</small></div>'+
'<div class="cribbage-count"><strong>'+v.pegCount+'</strong><small>Running count / 31</small></div></div>'+
'<div class="cribbage-exposed"><strong>Current pegging pile</strong><div class="cribbage-peg-cards">'+
(v.pegPile.length?v.pegPile.map(id=>cardFace(id)).join(''):
'<p>No public pegging cards in this count.</p>')+'</div></div></section>';
const show=state.showing?'<section class="cribbage-show" aria-label="Scored hand reveal"><strong>'+
(state.showing.isCrib?'Dealer’s crib':'Player '+(state.showing.seat+1)+' hand')+
'</strong><div class="cribbage-show-cards">'+state.showing.cards.map(id=>cardFace(id)).join('')+'</div>'+
'<p>Fifteens '+state.showing.score.fifteens+' · Pairs '+state.showing.score.pairs+
' · Runs '+state.showing.score.runs+' · Flush '+state.showing.score.flush+
' · Nobs '+state.showing.score.nobs+' · Total '+state.showing.score.total+'</p></section>':'';
const end=session.status!=='active'?'<div class="cribbage-completed"><h3>'+
(session.status==='finished'?'Game over — player '+(session.winnerSeat+1)+' wins!':'Match '+session.status)+
'</h3><p>Final scores are confirmed by the Cribbage server.</p></div>':'';
return '<div class="cribbage-layout">'+
'<div class="cribbage-left">'+announcements(state)+alert+
'<section class="cribbage-opponents"><div class="cribbage-section-title"><h3>Seats · round '+v.round+'</h3>'+
'<span>Dealer P'+(v.dealer+1)+'</span></div>'+opponents(v,session.seatCount)+'</section>'+
pile+show+end+(active?hand(v,session,state)+
'<div class="cribbage-actions" role="group" aria-label="Match controls">'+(state.resignPending?
'<button type="button" data-cribbage-action="confirm-resign">Confirm resignation</button><button type="button" data-cribbage-action="cancel-resign">Keep playing</button>':
'<button type="button" data-cribbage-action="request-resign">Resign match</button>')+'</div>':'')+'</div>'+
'<div class="cribbage-right">'+renderCribbageBoard({scores:v.scores,
seatCount:session.seatCount,pegs:state.pegs,settings:state.settings})+'</div></div>';
}
function rules(){
return '<section class="cribbage-info"><h3>Cribbage · 121 points</h3>'+
'<p>Two players keep four from six dealt cards, discarding two each. Three players keep four from five and contribute one to the crib; an extra crib card comes from the stock. Four players play as opposite-seat partners and discard one card each.</p>'+
'<p>The crib belongs to the dealer. After everyone discards, cut a starter card. A Jack starter earns the dealer two for “his heels”.</p>'+
'<p>Starting left of the dealer, each player plays a card in turn without letting the running count exceed 31. Score two for 15 or 31, two for a pair, six for three of a kind, twelve for four of a kind and the length of qualifying runs. The last playable card below 31 or a Go scores one.</p>'+
'<p>At the show, counting starts with the player left of the dealer and proceeds clockwise. The dealer’s hand counts last, then the dealer’s crib. Fifteens, pairs, runs, hand flushes, crib five-card flushes and nobs count automatically. The first side to 121 wins.</p>'+
'<p>There is no automatic penalty or bonus for landing on 120 (“the stinkhole”). Highlighting that hole is only a display option and never alters a server score.</p>'+
'<p><strong>Privacy:</strong> hidden opponent cards and the crib cannot be viewed until the server reveals counted cards at the show. The browser never awards points.</p></section>';
}
function settings(state){
const s=state?.settings??{motion:'standard',announcements:true,stinkhole:false};
return '<details class="cribbage-settings"><summary>Display settings</summary>'+
'<label>Movement <select data-cribbage-setting="motion"><option value="standard"'+
(s.motion==='standard'?' selected':'')+'>Animated leapfrog</option><option value="reduced"'+
(s.motion==='reduced'?' selected':'')+'>Reduced motion</option></select></label>'+
'<label><input type="checkbox" data-cribbage-setting="announcements"'+
(s.announcements?' checked':'')+'> Highlight scoring announcements (1.5 seconds)</label>'+
'<label><input type="checkbox" data-cribbage-setting="stinkhole"'+
(s.stinkhole?' checked':'')+'> Highlight the 120 “stinkhole” — visual only</label>'+
'</details>';
}
export function renderCribbageRoute({screen='intro',state=null,accountPanel='',identity=null}={}){
if(identity)accountPanel=renderGameAccountPanel(identity[0],{enabled:identity[1]});
const s=state??{status:'idle'},session=s.session,id=session?.id??null;
const nav=back+menu(screen,id);
const heading='<header class="cribbage-heading"><div><span class="eyebrow">BONGGOGGLES · CLASSICS</span>'+
'<h2>Cribbage</h2><p>121 points. A green-leaf board. A proper count.</p></div>'+
'<span class="cribbage-status">BC-1.6 · Authenticated challenges</span></header>';
const isLive=s.status==='ready'&&session?.gameId==='cribbage';
const zero='<section class="cribbage-empty" role="status"><h3>Choose a verified table</h3>'+
'<p>Browse the 420ID rooms, join a real Cribbage seat, then open its authenticated match. No cards or scores appear without a server-authorized per-seat snapshot.</p>'+
'<p><a class="cribbage-primary" href="/games/rooms" data-route="classic-rooms">Browse Cribbage rooms</a></p>'+
(s.status==='guest'?'<p><a href="/social-api/auth/start">Sign in to 420ID</a> to access your private cards.</p>':'')+
(Array.isArray(s.recoverable)&&s.recoverable.length?'<h4>Your verified matches</h4><ul>'+s.recoverable.map(m=>'<li><a href="/games/cribbage/play?session='+esc(m.id)+'" data-route="classic-game">Resume '+m.seatCount+'-player match · '+esc(m.status)+' · turn '+(m.turnSeat===null?'ended':m.turnSeat+1)+'</a></li>').join('')+'</ul>':'')+
(s.error?'<p role="alert">'+esc(s.error)+'</p>':'')+'</section>';
const boardPreview=renderCribbageBoard({scores:[0,0],seatCount:2,settings:s.settings??{}});
const home='<div class="cribbage-intro-grid"><div class="cribbage-intro-copy"><h3>Introduction · Classic Cribbage, made for game night</h3>'+
'<p>Play with two or three individuals or four players in opposite-seat partnerships. Watch the back peg leap past the front peg on every verified scoring award.</p>'+
'<p>The board counts hands in order, with the dealer’s crib last. Every counted announcement is held for 1.5 seconds before the next scoring event.</p>'+
'<a class="cribbage-primary" href="/games/cribbage/play" data-route="classic-game">Open a Cribbage table</a></div>'+
boardPreview+'</div>';
const generic=screen=>renderSharedGameScreen({game:classicGameById('cribbage'),screen});
const details=screen==='rules'?rules():
screen==='setup'?'<div class="cribbage-setup">'+zero+generic('setup')+'</div>':
screen==='play'||screen==='table'?isLive?playPanel(s):
'<div class="cribbage-restricted">'+zero+generic(screen)+'</div>':
screen==='results'?isLive?'<div class="cribbage-results">'+
'<h3>'+esc(session.status==='finished'?'Confirmed result':'Current verified scores')+'</h3>'+
renderCribbageBoard({scores:session.privateView.scores,seatCount:session.seatCount,
pegs:s.pegs,settings:s.settings})+renderCribbageSocial(s.social)+'</div>':renderCribbageSocial(s.social):
screen==='history'||screen==='rematch'?renderCribbageSocial(s.social):home;
return '<section class="games-game-page cribbage-app" data-game-screen="'+esc(screen)+'" data-motion="'+esc(s.settings?.motion??'standard')+'" data-announcements="'+(s.settings?.announcements===false?'off':'on')+'">'+nav+heading+accountPanel+'<p class="games-game-page__notice" role="status">Zero-wager game · The interface is implemented, but the live game is not yet playable until real 420ID room activation and the remaining release gates qualify.</p>'+details+settings(s)+
'<p class="cribbage-boundary">Zero wagers · Server-authorized moves · No public Play activation until the remaining game release gates qualify</p></section>';
}
// Event handlers bind only data-attribute choices and submit through the
// canonical session controller. No browser-generated scores or deck state.
export function bindCribbageDom(root,controller){
if(!controller?.client.enabled)return;
const state=controller.state,session=state.session;
for(const button of root.querySelectorAll('[data-cribbage-card]'))button.addEventListener('click',()=>{
if(!session||state.submitting||state.queue?.length)return;
const id=Number(button.dataset.cribbageCard),v=controller.state.session?.privateView;
if(!v||!v.hand.includes(id))return;
if(v.phase==='peg'){
void controller.act({type:'play',card:id}).catch(()=>{});
return;
}
if(v.phase!=='discard')return;
const selected=new Set(controller.state.selection??[]),required=session.seatCount===2?2:1;
if(selected.has(id))selected.delete(id);else if(selected.size<required)selected.add(id);
controller.emit({selection:[...selected]});
});
for(const button of root.querySelectorAll('[data-cribbage-action]'))button.addEventListener('click',()=>{
const action=button.dataset.cribbageAction,v=controller.state.session?.privateView;
if(action==='request-resign'){controller.emit({resignPending:true});return;}
if(action==='cancel-resign'){controller.emit({resignPending:false});return;}
if(action==='confirm-resign'){void resignCribbageMatch(controller).catch(()=>{});return;}
if(action==='clear'){controller.emit({selection:[]});return;}
if(!v)return;
let move=null;
if(action==='discard')move={type:'discard',cards:v.hand.filter(id=>(controller.state.selection??[]).includes(id))};
else if(action==='cut')move={type:'cut'};
else if(action==='go')move={type:'go'};
if(move&&cribbageCanSubmit(controller.state.session,move))
void controller.act(move).then(()=>controller.emit({selection:[]})).catch(()=>{});
});
for(const setting of root.querySelectorAll('[data-cribbage-setting]'))setting.addEventListener('change',()=>{
const key=setting.dataset.cribbageSetting;
controller.configure(key,setting.type==='checkbox'?setting.checked:setting.value);
});
}
