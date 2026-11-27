import {escapeHtml as esc} from './design-system.js';
import {resignCribbageMatch} from './classic-cribbage-multiplayer.js';
import {renderCribbageSocial} from './classic-cribbage-social.js';
import {renderCribbagePractice as practice,bindCribbagePractice as bindPractice} from './classic-cribbage-practice.js';
import {renderGameAccountPanel} from './account-identity.js';
import {renderSharedGameScreen} from './shared-game-ui.js';
import {classicGameById} from './classics.js';
import {CRIBBAGE_BOARD_SIZE,CRIBBAGE_BOARD_ART,
cribbageHole,cribbageTeams,cribbageLane,cribbageNewPegs} from './cribbage-board.js';
import {cribbageCardLabel,cribbageLegalMoves,cribbageCanSubmit} from './cribbage-session.js';
const back='<a class="cribbage-back" href="/games" data-route="games">← All Games</a>';
const gameLink=(id,screen)=>'/games/cribbage/'+screen+(id?'?session='+encodeURIComponent(id):'');
const tabs=['intro','rules','play','setup','table','results','history','rematch'];
const tabLabel={intro:'Overview',rules:'Rules',play:'Play',setup:'Opponents',table:'Game table',results:'Results',history:'My Games',rematch:'Rematch'};
const menu=(screen,id)=>'<nav class="cribbage-nav" aria-label="Cribbage screens">'+
tabs.map(s=>'<a href="'+gameLink(id,s)+'" data-route="classic-game"'+
(s===screen?' aria-current="page"':'')+'>'+tabLabel[s]+'</a>').join('')+'</nav>';
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
const actual=pegs??cribbageNewPegs(scores,seatCount);
const mark=settings.stinkhole?[...new Set(cribbageTeams(seatCount))].map(t=>{
const p=cribbageHole(cribbageLane(t,seatCount),120);
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

'<g aria-hidden="true">'+mark+'</g><g class="cribbage-pegs">'+tokens+'</g></svg>'+
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
const readyPlay=v.phase==='peg'&&selected.size===1&&validPlay.has([...selected][0])&&
cribbageCanSubmit(session,{type:'play',card:[...selected][0]});
const interactive=state.status==='ready'&&!state.submitting&&!state.scoring;
const cards=v.hand.map(id=>{
const active=turn&&interactive&&(discard||validPlay.has(id));
return '<button type="button" class="cribbage-card-button" data-cribbage-card="'+id+'"'+
(active?'':' disabled')+' aria-pressed="'+(selected.has(id)?'true':'false')+
'" aria-label="'+esc('Select '+cribbageCardLabel(id))+'">'+
cardFace(id,selected.has(id),!active)+'</button>';
}).join('');
const note=discard?'Choose '+count+' card'+(count===1?'':'s')+' for '+(v.dealer===session.viewerSeat?'your crib':'the dealer’s crib')+'.':
v.phase==='peg'?'Select a card, then press Play selected card. Count cannot exceed 31.':
v.phase==='cut'?'One legal cut reveals the shared starter.':
'Your next hand is being prepared.';
const action=discard?
'<button class="cribbage-primary" type="button" data-cribbage-action="discard"'+
(ready&&interactive?'':' disabled')+'>Send '+count+' to crib</button>':
v.phase==='cut'&&turn?
'<button class="cribbage-primary" type="button" data-cribbage-action="cut"'+(interactive?'':' disabled')+'>Cut the deck</button>':
v.phase==='peg'&&turn&&validPlay.size?
'<button class="cribbage-primary" type="button" data-cribbage-action="play"'+
(readyPlay&&interactive?'':' disabled')+'>Play selected card</button>':
v.phase==='peg'&&turn&&legal.some(x=>x.type==='go')?
'<button class="cribbage-primary" type="button" data-cribbage-action="go"'+
(interactive?'':' disabled')+'>Say “Go”</button>':
'';
return '<section class="cribbage-hand-area" aria-label="Your private hand">'+
'<div class="cribbage-section-title"><h3>Your hand</h3><span>'+v.hand.length+' cards</span></div>'+
'<p>'+esc(state.submitting?'Submitting your move…':state.scoring?'Counting points — play resumes automatically.':note)+'</p><div class="cribbage-hand-cards">'+cards+'</div>'+
'<div class="cribbage-actions">'+action+(selected.size?
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
'<div class="cribbage-actions" role="group" aria-label="Match controls">'+
(state.status!=='ready'?'<button type="button" data-cribbage-action="refresh">Refresh this game</button>':'')+
(state.resignPending?
'<button type="button" data-cribbage-action="confirm-resign">Confirm resignation</button><button type="button" data-cribbage-action="cancel-resign">Keep playing</button>':
'<button type="button" data-cribbage-action="request-resign">Resign match</button>')+'</div>':'')+'</div>'+
'<div class="cribbage-right">'+renderCribbageBoard({scores:v.scores,
seatCount:session.seatCount,pegs:state.pegs,settings:state.settings})+'</div></div>';
}
function rules(){
return '<section class="cribbage-info"><h3>Cribbage · 121 points</h3>'+
'<p>Two players keep four from six dealt cards, discarding two each. Four players play as opposite-seat partners and discard one card each.</p>'+
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
const s=state??{status:'idle'},pState=state??{status:'disabled'},session=s.session,id=session?.id??null,playable=classicGameById('cribbage').status==='playable';
const nav=back+menu(screen,id);
const heading='<header class="cribbage-heading"><div><span class="eyebrow">BONGGOGGLES · CLASSICS</span>'+
'<h2>Cribbage</h2><p>121 points. A green-leaf board. A proper count.</p></div>'+
'<span class="cribbage-status">'+(playable?'Playable':'BC-1.5 · Authenticated rooms')+'</span></header>';
const isLive=!!session&&session.gameId==='cribbage'&&['ready','error','loading'].includes(s.status);
const myGames='<section class="cribbage-matches" aria-label="My Games"><h3>My Games</h3>'+
(Array.isArray(s.recoverable)&&s.recoverable.length?'<ul>'+s.recoverable.map(m=>
'<li><a href="/games/cribbage/play?session='+esc(m.id)+'" data-route="classic-game">'+
(m.status==='active'?'Resume game':'View match')+' · '+m.seatCount+' players · '+esc(m.status)+'</a></li>').join('')+'</ul>':
'<p>No verified matches yet. Start a match or refresh 420ID.</p>')+'</section>';
const zero='<section class="cribbage-empty" role="status"><h3>Choose a verified table</h3>'+
'<p>Browse the 420ID rooms, join a real Cribbage seat, then open its authenticated match. No cards or scores appear without a server-authorized per-seat snapshot.</p>'+
practice(pState)+'<p><a class="cribbage-primary" href="/games/rooms" data-route="classic-rooms">Browse Cribbage rooms</a></p>'+
(s.status==='guest'?'<p><a href="/social-api/auth/start">Sign in to 420ID</a> to access your private cards.</p>':'')+
myGames+
(s.error?'<p role="alert">'+esc(s.error)+'</p>':'')+'</section>';
const boardPreview=renderCribbageBoard({scores:[0,0],seatCount:2,settings:s.settings??{}});
const home='<div class="cribbage-intro-grid"><div class="cribbage-intro-copy"><h3>Introduction · Classic Cribbage, made for game night</h3>'+
'<p>Play two players or four in partnerships. Watch pegging and scoring.</p>'+
'<p>The board counts hands in order, with the dealer’s crib last. Every counted announcement is held for 1.5 seconds before the next scoring event.</p>'+
'<a class="cribbage-primary" href="/games/cribbage/play" data-route="classic-game">Open a Cribbage table</a></div>'+
boardPreview+'</div>'+practice(pState);
const generic=screen=>renderSharedGameScreen({game:classicGameById('cribbage'),screen});
const details=screen==='rules'?rules():
screen==='setup'?'<div class="cribbage-setup">'+zero+'</div>':
screen==='play'||screen==='table'?isLive?playPanel(s):
'<div class="cribbage-restricted">'+zero+'</div>':
screen==='results'?isLive?'<div class="cribbage-results">'+
'<h3>'+esc(session.status==='finished'?'Confirmed result':'Current verified scores')+'</h3>'+
renderCribbageBoard({scores:session.privateView.scores,seatCount:session.seatCount,
pegs:s.pegs,settings:s.settings})+renderCribbageSocial(s.social)+'</div>':renderCribbageSocial(s.social):
screen==='history'?myGames+renderCribbageSocial(s.social):
screen==='rematch'?renderCribbageSocial(s.social):home;
return '<section class="games-game-page cribbage-app" data-game-screen="'+esc(screen)+'" data-motion="'+esc(s.settings?.motion??'standard')+'" data-announcements="'+(s.settings?.announcements===false?'off':'on')+'">'+nav+heading+accountPanel+'<p class="games-game-page__notice" role="status">'+(playable?'Playable · 420ID and computers.':'Zero-wager game · It is not yet playable until real 420ID room activation.')+'</p>'+details+settings(s)+
'<p class="cribbage-boundary">'+(playable?'Zero wagers · 420ID private play':'Zero wagers · Server-authorized moves · No public Play activation until the remaining game release gates qualify')+'</p></section>';
}
export function bindCribbageDom(root,controller){
if(!controller?.client.enabled)return;
bindPractice(root,controller);
const state=controller.state,session=state.session;
for(const button of root.querySelectorAll('[data-cribbage-card]'))button.addEventListener('click',()=>{
if(!session||controller.state.status!=='ready'||controller.state.submitting||controller.state.scoring)return;
const id=Number(button.dataset.cribbageCard),v=controller.state.session?.privateView;
if(!v||!v.hand.includes(id))return;
if(v.phase!=='discard'&&v.phase!=='peg')return;
const selected=new Set(controller.state.selection??[]),required=v.phase==='discard'?(session.seatCount===2?2:1):1;
if(selected.has(id))selected.delete(id);else if(selected.size<required)selected.add(id);
controller.emit({selection:[...selected]});
});
for(const button of root.querySelectorAll('[data-cribbage-action]'))button.addEventListener('click',()=>{
const action=button.dataset.cribbageAction,v=controller.state.session?.privateView;
if(action==='request-resign'){controller.emit({resignPending:true});return;}
if(action==='cancel-resign'){controller.emit({resignPending:false});return;}
if(action==='confirm-resign'){void resignCribbageMatch(controller).catch(()=>{});return;}
if(action==='clear'){controller.emit({selection:[]});return;}
if(action==='refresh'){if(controller.state.session)void controller.open(controller.state.session.id,{quiet:true});return;}
if(!v||controller.state.submitting||controller.state.scoring)return;
let move=null;
if(action==='discard')move={type:'discard',cards:v.hand.filter(id=>(controller.state.selection??[]).includes(id))};
else if(action==='play'){
const cards=(controller.state.selection??[]).filter(id=>v.hand.includes(id));
if(cards.length===1)move={type:'play',card:cards[0]};
}
else if(action==='cut')move={type:'cut'};
else if(action==='go')move={type:'go'};
if(move&&cribbageCanSubmit(controller.state.session,move))
void controller.act(move).catch(e=>{if(controller.state.status==='ready'&&!controller.state.submitting)controller.emit({notice:e.message});});
});
for(const setting of root.querySelectorAll('[data-cribbage-setting]'))setting.addEventListener('change',()=>{
const key=setting.dataset.cribbageSetting;
controller.configure(key,setting.type==='checkbox'?setting.checked:setting.value);
});
}
