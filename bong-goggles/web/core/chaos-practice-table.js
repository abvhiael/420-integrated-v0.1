// The solo practice surface reuses the authenticated game's public card/table
// presentation, but all moves still go through the existing LOCAL CCC engine.
import {LEGS,chaosActionOptions,chaosFinalRoundProgress} from './cross-country-chaos.js';
import {chaosCardArt} from './chaos-card-art.js';
import {renderChaosHighway} from './chaos-board.js';
import {renderChaosPublicTables} from './chaos-online.js';
import {renderChaosGameEffects,renderChaosFinishEffects} from './chaos-game-effects.js';
import {isChaosComputer} from './chaos-computer.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=c=>c.type==='mileage'?c.km+' km':c.name||c.id||c.type;
const image=(c,region)=>c?'<img src="'+esc(chaosCardArt(c,region))+'" alt="" width="96" height="162" loading="lazy" decoding="async">':'';
const publicPlayers=game=>game.players.map(p=>({
 id:p.id,name:p.name,vehicle:p.vehicle,km:p.km,score:p.score,
 played:p.played,status:p.status,upgrades:p.upgrades,used:p.used,
 shield:p.shield,slowLoss:p.slowLoss,detourLoss:p.detourLoss
}));
// This deliberately excludes every player's hand, deck, shuffle seed and journal.
function standings(game){
 return '<div class="ccc-online-standings" aria-label="Public standings">'+game.players.map((p,i)=>
  '<div class="ccc-online-seat'+(i===game.turn?' ccc-online-seat--turn':'')+'">'+
  '<span>'+esc(p.name)+(isChaosComputer(p)?' · CPU':'')+'</span>'+
  '<strong>'+p.km.toLocaleString('en-CA')+' / 2,500 km</strong>'+
  '<small>'+p.score.toLocaleString('en-CA')+' championship km · '+esc(p.status?.name||'On the road')+'</small></div>'
 ).join('')+'</div>';
}
function piles(game,active){
 const region=LEGS[game.leg].id;
 const top=game.discard.at(-1);
 const draw=active&&game.step==='draw';
 const button=(choice,enabled,face,title)=>enabled?
  '<button type="button" data-chaos-action="draw" data-choice="'+choice+'" aria-label="'+esc(title)+'">'+face+'</button>':
  '<div aria-label="'+esc(title)+'">'+face+'</div>';
 const stock='<span class="ccc-online-stock-back"><b>🍁</b><strong>CCC</strong>ROAD TRIP</span>';
 const discard='<span class="ccc-online-discard-face">'+(top?image(top,region):'<span>Empty discard</span>')+'</span>';
 return '<section class="ccc-online-decks" aria-label="Draw deck and discard pile"><h3>Road trip decks</h3>'+
  '<div class="ccc-online-piles"><div class="ccc-online-pile">'+
  button('deck',draw,stock,'Draw two from stock')+'<strong>Draw deck</strong><small>Stock: '+game.deck.length+' cards</small></div>'+
  '<div class="ccc-online-pile">'+button('discard',draw&&Boolean(top),discard,'Take top discard and draw one')+
  '<strong>Discard pile</strong><small>'+game.discard.length+' cards'+(top?' · '+esc(label(top)):'')+'</small></div></div>'+
  (draw?'<p class="ccc-practice-hint">Choose a pile to draw to seven.</p>':'')+
  (active&&game.step==='play'?'<div class="ccc-online-pile-actions">'+
   (game.players[game.turn].status?'<button type="button" data-chaos-action="recover">Emergency recovery</button>':'')+
   '<button type="button" data-chaos-action="pass">Pass · discard two</button></div>':'')+
  (game.finishPending?'<p class="ccc-online-finish">Final round underway</p>':'')+'</section>';
}
function actions(game,card,index,options){
 const available=options.filter(o=>o.index===index);
 if(!available.length)return '<small>No legal play for this card during this phase.</small>';
 return available.map(option=>{
  if(option.action==='discard')return '<button type="button" data-chaos-action="discard" data-card="'+index+'">Discard this card</button>';
  if(option.action==='drive'){
   const p=game.players[game.turn];
   const boost=p.upgrades.some(u=>u.id==='shortcut-specialist'&&!p.used.includes(u.id));
   return '<form data-chaos-move="drive" data-card="'+index+'">'+
    (boost?'<label class="ccc-practice-boost"><input name="boost" type="checkbox"> Shortcut Specialist +100 km</label>':'')+
    '<button type="submit">Drive '+card.km+' km</button></form>';
  }
  if(option.action==='hazard'){
   // One form with the legal targets only; never include an ineligible seat.
   if(available.some(o=>o.action==='hazard'&&o.target<option.target))return '';
   const targets=available.filter(o=>o.action==='hazard');
   return '<form data-chaos-move="hazard" data-card="'+index+'"><label>Target <select name="target">'+
    targets.map(o=>'<option value="'+o.target+'">'+esc(game.players[o.target].name)+'</option>').join('')+
    '</select></label><button type="submit">Cause chaos</button></form>';
  }
  if(option.action==='fix')return '<button type="button" data-chaos-action="fix" data-card="'+index+'">'+
   (card.id==='atlas'?'Take shortcut +150 km':'Use repair')+'</button>';
  if(option.action==='power')return '<button type="button" data-chaos-action="power" data-card="'+index+'">'+
   (option.free?'Activate free + draw again':'Activate power')+'</button>';
  return '';
 }).join('');
}
function hand(game,{revealed,computer}){
 const p=game.players[game.turn],active=revealed&&!computer;
 const heading='<div class="ccc-online-hand-head"><h3>Your private hand</h3><strong>'+
  (computer?'COMPUTER TURN':active?esc(game.step.toUpperCase())+' PHASE':'HAND CONCEALED')+'</strong></div>';
 if(!active)return '<section class="ccc-online-hand ccc-practice-hand" aria-label="Private hand concealed">'+heading+
  '<div class="ccc-practice-privacy" role="status">'+
  (computer?'<p>'+esc(p.name)+' is choosing a legal move. Computer cards stay hidden.</p>':
   '<p>Pass the device to '+esc(p.name)+'. Everyone else should look away.</p>'+
   '<button type="button" data-chaos-action="reveal">I am '+esc(p.name)+' — reveal my hand</button>')+
  '</div></section>';
 const options=chaosActionOptions(game),region=LEGS[game.leg].id;
 return '<section class="ccc-online-hand ccc-practice-hand" aria-label="Your private hand">'+heading+
  '<div class="ccc-online-hand-content ccc-practice-hand-content">'+
  '<div class="ccc-online-cards ccc-practice-card-list" role="group" aria-label="Choose one of your cards">'+
  p.hand.map((c,i)=>'<div class="ccc-practice-hand-card">'+
   '<input class="ccc-practice-card-radio" type="radio" name="ccc-practice-selection" id="ccc-practice-card-'+i+'"'+(i===0?' checked':'')+
   ' aria-label="Select '+esc(label(c))+'">'+
   '<label for="ccc-practice-card-'+i+'" class="ccc-online-card-select">'+image(c,region)+
   '<strong>'+esc(label(c))+'</strong></label>'+
   '<div class="ccc-practice-card-actions"><h4>'+esc(label(c))+'</h4>'+
   (game.step==='draw'?'<small>Draw from a pile above to continue.</small>':actions(game,c,i,options))+
   '</div></div>').join('')+'</div></div>'+
  '<p class="ccc-practice-hint">'+(game.step==='discard'?'Discard '+game.discardsLeft+' card(s) to end the turn.':
   game.step==='draw'?'Choose the draw deck or face-up discard above.':'Select a card, then choose its legal action. Drives over 300 km carry a regional hazard.')+'</p></section>';
}
function roadside(game,error,saveInfo,computer){
 const saving=saveInfo?.deviceSaving;
 return '<aside class="ccc-online-chat ccc-practice-radio" aria-label="Solo practice roadside radio">'+
  '<header><div><h3>Roadside radio</h3><small>Solo practice · local game events, not multiplayer chat</small></div></header>'+
  '<ol class="ccc-online-chat-log" aria-label="Public road events">'+
  game.log.slice(0,30).map(entry=>'<li class="ccc-online-chat-message">'+esc(entry)+'</li>').join('')+'</ol>'+
  (error?'<p class="ccc-online-chat-error" role="alert">'+esc(error)+'</p>':'')+
  (computer&&error?'<button type="button" data-chaos-action="retry-cpu">Retry computer move</button>':'')+
  '<details class="ccc-practice-recovery"><summary>Save & recovery</summary>'+
  '<p>Progress recovers in this tab. Device saves contain recoverable private cards; avoid them on shared devices.</p>'+
  '<button type="button" data-chaos-action="'+(saving?'stop-device-save':'save-device')+'">'+
  (saving?'Stop saving on this device':'Save on this device')+'</button>'+
  (saveInfo?.notice?'<p role="status">'+esc(saveInfo.notice)+'</p>':'')+'</details></aside>';
}
export function renderChaosPracticeTable({game,revealed=false,error=null,feedback=null,effects=null,saveInfo=null}={}){
 if(!game||game.phase!=='playing')throw Error('Solo tabletop requires a playing CCC game.');
 const leg=LEGS[game.leg],p=game.players[game.turn],computer=isChaosComputer(p);
 const active=revealed&&!computer;
 const view={leg:game.leg,seat:active?game.turn:-1,players:publicPlayers(game)};
 const finalRound=chaosFinalRoundProgress(game);
 return '<div class="ccc-online ccc-online--game ccc-online--practice ccc-region--'+esc(leg.id)+'" data-chaos-practice>'+
  '<header class="ccc-online-header"><div><p class="eyebrow">BongGoggles Canadian Classics · local practice</p>'+
  '<h2>Cross-Country Chaos</h2><p>'+esc(leg.from)+' → '+esc(leg.to)+' · 2,500 km per stage · computer opponents</p></div>'+
  '<a class="ccc-practice-exit" href="/classics/cross-country-chaos" data-route="chaos-game">Online multiplayer</a></header>'+
  '<section class="ccc-online-game"><div class="ccc-online-main">'+
  '<div class="ccc-online-stage"><strong>LEG '+(game.leg+1)+'/3 — '+esc(leg.name)+'</strong>'+
  '<span>'+esc(p.name)+(computer?' · CPU':' · HUMAN')+' · '+esc(game.step)+' phase</span></div>'+
  '<section class="ccc-online-track" aria-label="Canadian highway map">'+
  '<div class="ccc-online-map">'+renderChaosHighway(view,{effects})+'</div>'+standings(game)+'</section>'+
  '<div class="ccc-practice-effects">'+renderChaosGameEffects(effects,{suppressRepairs:Boolean(feedback)})+'</div>'+
  '<div class="ccc-online-middle">'+renderChaosPublicTables(view)+piles(game,active)+'</div>'+
  hand(game,{revealed,computer})+'<div class="ccc-practice-effects">'+renderChaosFinishEffects(effects)+'</div></div>'+
  roadside(game,error,saveInfo,computer)+'</section>'+
  (finalRound?'<p class="ccc-practice-final" role="status">FINAL ROUND — '+finalRound.turnsRemaining+' driver turns remaining in this stage.</p>':'')+
  '</div>';
}
