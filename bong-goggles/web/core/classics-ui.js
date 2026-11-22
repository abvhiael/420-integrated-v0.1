import {escapeHtml as esc,card} from './design-system.js';
import {CLASSIC_COLLECTIONS} from './classics.js';
import {LEGS,chaosActionOptions,chaosFinalRoundProgress} from './cross-country-chaos.js';
import {chaosCardArt} from './chaos-card-art.js';
import {renderChaosTable} from './chaos-board.js';
import {CHAOS_ART_DIRECTION,chaosRegionArt} from './chaos-visual-style.js';
import {CHAOS_VEHICLES,chaosVehicle} from './chaos-vehicles.js';
import {renderChaosGameEffects,renderChaosFinishEffects} from './chaos-game-effects.js';
import {renderChaosRegionalResults,renderChaosChampionshipResults,renderChaosResultsHistory,renderChaosCumulativeStandings} from './chaos-results.js';
import {isChaosComputer} from './chaos-computer.js';
import {renderChaosPracticeTable} from './chaos-practice-table.js';
const link='<a href="/classics" data-route="classics">← All Classics</a>';
export function renderClassicsCatalogue(){
 const groups=CLASSIC_COLLECTIONS.map(group=>'<section class="ccc-collection"><h2>'+esc(group.title)+'</h2><div class="ccc-collection-grid">'+group.games.map(game=>'<article class="ccc-game-tile"><h3>'+esc(game.title)+'</h3><p>'+esc(game.description||'Traditional kitchen-table gameplay.')+'</p><p class="ccc-meta">'+esc(game.players)+' players · '+esc(game.status==='account'?'Account multiplayer':game.status==='registry'?'Registry only — board unavailable':'Planned — not yet playable')+'</p><a href="/games/'+esc(game.id)+'" data-route="classic-game" class="ccc-link">View '+esc(game.title)+'</a>'+(game.status==='account'?'<a href="/classics/cross-country-chaos" data-route="chaos-game" class="ccc-link">Play Cross-Country Chaos</a>':'')+'</article>').join('')+'</div></section>').join('');
 return '<div class="ccc-wrap"><div class="ccc-hero"><p class="eyebrow">BongGoggles · Game Night</p><a class="ccc-link" href="/games" data-route="games">All Games</a><h2>Classics & Canadian Classics</h2><p>Kitchen-table card, dice and board games. Cross-Country Chaos offers account multiplayer or local computer opponents; other titles remain planned or registry-only.</p><a class="ccc-link" href="/classics/cross-country-chaos" data-route="chaos-game">Play Cross-Country Chaos →</a></div>'+groups+'</div>';
}
const stats=s=>'<div class="ccc-stats">'+s.players.map(p=>'<div class="ccc-player"><strong>'+esc(p.name)+'</strong><small>'+esc(isChaosComputer(p)?'Computer · '+p.difficulty:'Human driver')+'</small><span>'+p.km.toLocaleString('en-CA')+' / 2,500 km</span><span>'+p.score.toLocaleString('en-CA')+' championship km</span><small>'+esc(p.status?.name||'On the road')+(p.detourLoss?' · -'+p.detourLoss+' km detours':'')+'</small></div>').join('')+'</div>';
const history=s=>'<details class="ccc-history"><summary>Roadside radio / game log</summary><ol>'+s.log.map(entry=>'<li>'+esc(entry)+'</li>').join('')+'</ol></details>';
const artImage=(path,kind='card')=>path?'<img class="ccc-card-image ccc-card-image--'+esc(kind)+'" src="'+esc(path)+'" width="480" height="810" alt="" loading="lazy" decoding="async">':'';
const cardArt=(card,leg)=>chaosCardArt(card,leg);
const vehicleChoice=i=>'<div class="ccc-seat-config" data-chaos-seat="'+i+'"><div class="ccc-driver-setup" data-chaos-driver="'+i+'">'+
 '<label>Driver '+(i+1)+' <input name="player'+i+'" maxlength="24" placeholder="Driver '+(i+1)+'" autocomplete="off"></label>'+
 '<label>Choose your ride <select name="vehicle'+i+'" data-chaos-vehicle-pick="'+i+'">'+
 CHAOS_VEHICLES.map((v,j)=>'<option value="'+v.id+'"'+(j===i?' selected':'')+'>'+esc(v.name)+'</option>').join('')+
 '</select></label><img class="ccc-vehicle-picker-preview" src="'+chaosVehicle(null,i).src+'" alt="" width="100" height="64" loading="lazy"></div>'+
 '<label class="ccc-controller-picker">Who drives? <select name="control'+i+'" data-chaos-controller-pick="'+i+'">'+
 '<option value="human"'+(!i?' selected':'')+'>Human — pass and play</option><option value="easy">Computer — Easy</option>'+
 '<option value="normal"'+(i?' selected':'')+'>Computer — Normal</option><option value="hard">Computer — Hard</option></select></label></div>';
const discardTop=s=>s.discard.length?s.discard[s.discard.length-1]:null;
const handCards=(p,leg,options,s)=>{
 return '<div class="ccc-hand">'+p.hand.map((c,i)=>{
  const available=options.filter(o=>o.index===i);
  const label=c.type==='mileage'?c.km+' km':c.name;
  let controls='';
  if(s.step==='discard')controls='<button data-chaos-action="discard" data-card="'+i+'">Discard this card</button>';
  if(s.step==='play'){
   if(available.some(o=>o.action==='drive')){
    const canBoost=p.upgrades.some(u=>u.id==='shortcut-specialist'&&!p.used.includes(u.id));
    controls='<form data-chaos-move="drive" data-card="'+i+'">'+(canBoost?'<label class="ccc-boost"><input type="checkbox" name="boost"> Use Shortcut Specialist (+100 km)</label>':'')+'<button type="submit">Drive '+c.km+' km</button></form>';
   }
   if(available.some(o=>o.action==='hazard')){
    controls='<form data-chaos-move="hazard" data-card="'+i+'"><label>Target <select name="target">'+available.filter(o=>o.action==='hazard').map(o=>'<option value="'+o.target+'">'+esc(s.players[o.target].name)+'</option>').join('')+'</select></label><button type="submit">Cause chaos</button></form>';
   }
   if(available.some(o=>o.action==='fix'))controls='<button data-chaos-action="fix" data-card="'+i+'">'+(c.id==='atlas'?'Take shortcut +150 km':'Use repair')+'</button>';
   if(available.some(o=>o.action==='power'))controls='<button data-chaos-action="power" data-card="'+i+'">'+(available.find(o=>o.action==='power').free?'Activate free + draw again':'Activate power')+'</button>';
  }
  return '<article class="ccc-hand-card ccc-'+esc(c.type)+'">'+artImage(cardArt(c,leg.id),c.type)+'<div class="ccc-card-details"><small>'+esc(c.type.toUpperCase())+'</small><strong>'+esc(label)+'</strong><span>'+esc(c.type==='mileage'?(c.km>300?'Risky drive: regional hazard':'Safe highway travel'):c.type==='hazard'?c.category+' · '+c.kind:c.type==='fix'?(c.id==='atlas'?'150 km safe shortcut':c.category+' repair'):'Power card')+'</span>'+controls+'</div></article>';
 }).join('')+'</div>';
};
export function renderChaosGame({game=null,revealed=false,error=null,feedback=null,effects=null,saveInfo=null}={}){
 const saved=saveInfo||{};
 const saveControls=game?'<section class="ccc-save-panel" aria-label="Local championship recovery">'+
 '<div class="ccc-save-row"><strong>Local championship recovery</strong>'+
 (saved.deviceSaving?'<span>Device save active</span>':'<span>Tab recovery only</span>')+'</div>'+
 '<p>Progress is recorded in this tab after each action. Reloading keeps hands concealed. '+
 (saved.deviceSaving?'Private game data is saved on this device until you stop saving or start over.':
 'To resume after closing this tab, choose Save on this device. Do not use this on a shared device: the save can reconstruct private hands.')+'</p>'+
 '<div class="ccc-save-actions">'+(saved.deviceSaving?
 '<button type="button" data-chaos-action="stop-device-save">Stop saving on this device</button>':
 '<button type="button" data-chaos-action="save-device">Save on this device</button>')+'</div>'+
 (saved.notice?'<p class="ccc-save-message" role="status">'+esc(saved.notice)+'</p>':'')+'</section>':'';
 const recovery=(!game&&(saved.available||saved.invalid))?'<section class="ccc-save-panel" aria-label="Saved championship">'+
 '<h3>Saved championship</h3>'+(saved.available?'<p>Resume the championship saved on this device. No cards will be revealed until the active human confirms.</p><button type="button" data-chaos-action="resume">Resume saved championship</button>':
 '<p role="alert">A previous save could not be validated and will not be loaded.</p>')+
 '<button type="button" data-chaos-action="delete-save">Delete saved championship</button></section>':'';

 if(!game)return '<div class="ccc-wrap ccc-wrap--roadtrip ccc-region--east">'+link+'<div class="ccc-hero ccc-hero--roadtrip"><div class="ccc-road-brand"><span class="ccc-highway-shield" aria-label="Trans-Canada-inspired road trip">🍁 <b>TCH</b></span><span class="ccc-road-brandline">CANADIAN CLASSICS · NO DETOURS GUARANTEED</span></div><p class="eyebrow">BongGoggles Canadian Classics</p><h2>Cross-Country Chaos</h2><p class="ccc-hero-quip">'+esc(CHAOS_ART_DIRECTION.title)+'</p><p>Race from St. John\'s to Vancouver: three regions, 2,500 km each. Draw to seven, play, then discard. Hazards and detours can derail the race; championship kilometres decide the winner.</p><p><strong>Local pass-and-play only for human seats; computer opponents are also available.</strong> Choose Easy, Normal or Hard for computer drivers. At least one human is required. No online rooms, wallet, staking, rewards, or wagers. A tab reload keeps progress; optional device saves contain private cards.</p></div>'+(error?'<p class="ccc-error" role="alert">'+esc(error)+'</p>':'')+recovery+'<form class="ccc-setup" data-chaos-start><h3>Play against computers</h3><label for="ccc-count">Drivers</label><select id="ccc-count" name="count"><option value="2">2 drivers</option><option value="3">3 drivers</option><option value="4" selected>4 drivers</option></select><div class="ccc-names">'+[0,1,2,3].map(vehicleChoice).join('')+'</div><button type="submit">Start the cross-Canada championship</button></form></div>';
 const leg=LEGS[game.leg],p=game.players[game.turn];
 const computer=isChaosComputer(p),finalRound=chaosFinalRoundProgress(game);
 const regionArt=chaosRegionArt(leg.id);
 const top='<div class="ccc-wrap ccc-wrap--roadtrip ccc-region--'+leg.id+'">'+link+'<div class="ccc-hero ccc-hero--roadtrip"><div class="ccc-road-brand"><span class="ccc-highway-shield" aria-label="Trans-Canada-inspired road trip">🍁 <b>TCH</b></span><span class="ccc-road-brandline">'+esc(regionArt.shield)+' · ROUND '+(game.leg+1)+'/3</span></div><p class="eyebrow">Cross-Country Chaos · Stage '+(game.leg+1)+' of 3</p><h2>'+esc(leg.name)+'</h2><p class="ccc-hero-quip">'+esc(regionArt.line)+'</p><p>'+esc(leg.from)+' → '+esc(leg.to)+' · 2,500 km target</p><p>Three regional decks · four legendary cards across the championship · no wallet or cash prizes</p>'+(finalRound?'<div class="ccc-final-round" role="status" aria-live="polite"><strong>FINAL ROUND — finish the current turn cycle!</strong><p>'+finalRound.turnsRemaining+' driver turn'+(finalRound.turnsRemaining===1?'':'s')+' remaining, including the current driver. Resolve every final discard.</p></div>':'')+'</div>'+(game.phase==='playing'?stats(game)+renderChaosGameEffects(effects,{suppressRepairs:Boolean(feedback)})+
  renderChaosTable(game,{revealed:revealed&&!computer,feedback,effects}):'')+renderChaosFinishEffects(effects);
 const completedBoard='<details class="ccc-results-board"><summary>Review the completed road board</summary>'+renderChaosTable(game,{revealed:false,feedback:null,effects:null})+'</details>';
 const notice=(error?'<p class="ccc-error" role="alert">'+esc(error)+'</p>':'')+saveControls;
 if(game.phase==='between')return top+notice+renderChaosRegionalResults(game)+renderChaosCumulativeStandings(game)+renderChaosResultsHistory(game)+
  '<div class="ccc-panel"><p>Championship kilometres carry forward. All mileage, upgrades, hazards, and unused regional cards reset.</p><button data-chaos-action="next">Continue to '+esc(LEGS[game.leg+1].name)+'</button></div>'+completedBoard+history(game)+'</div>';
 if(game.phase==='finished')return top+notice+renderChaosChampionshipResults(game)+renderChaosResultsHistory(game)+
  '<div class="ccc-panel"><button data-chaos-action="restart">New championship</button></div>'+completedBoard+history(game)+'</div>';
 if(computer)return top+notice+'<div class="ccc-panel ccc-computer-turn" role="status" aria-live="polite"><h3>'+esc(p.name)+' — Computer driving ('+esc(p.difficulty)+')</h3><p>The computer is choosing its next legal road-trip move. Only public mileage, hazards and played cards are visible.</p>'+
 (error?'<button type="button" data-chaos-action="retry-cpu">Retry computer move</button>':'')+'</div>'+history(game)+'</div>';
 if(!revealed)return top+notice+'<div class="ccc-panel ccc-private"><h3>Pass the device to '+esc(p.name)+'</h3><p>Everyone else should look away. Only '+esc(p.name)+' should reveal their cards.</p><button data-chaos-action="reveal">I am '+esc(p.name)+' — reveal my hand</button></div>'+history(game)+'</div>';
 const options=chaosActionOptions(game),discard=discardTop(game);
 const pile='<div class="ccc-pile-status"><strong>Draw deck: '+game.deck.length+' cards</strong> · <strong>Discard pile: '+game.discard.length+' cards</strong>'+(discard?'<span class="ccc-discard-top">'+artImage(cardArt(discard,leg.id),'discard')+'Top discard: '+esc(discard.type==='mileage'?discard.km+' km':discard.name)+'</span>':'')+'</div>';
 if(game.step==='draw')return top+notice+'<div class="ccc-panel"><h3>'+esc(p.name)+' — draw to seven</h3>'+pile+'<p>Take two from the regional deck, or the top discard and one from the deck.</p><div class="ccc-actions"><button data-chaos-action="draw" data-choice="deck">Draw two from deck</button>'+(discard?'<button data-chaos-action="draw" data-choice="discard">Take top discard + draw one</button>':'')+'</div>'+'</div>'+history(game)+'</div>';
 const prompt=game.step==='discard'?'Discard '+game.discardsLeft+' card'+(game.discardsLeft===1?'':'s')+' to end turn':'Play one card or action; free newly drawn powers may be activated first.';
 return top+notice+'<div class="ccc-panel"><h3>'+esc(p.name)+' — '+(game.step==='discard'?'discard phase':'play phase')+'</h3>'+pile+'<p>'+prompt+' Repairs are only allowed on your turn. Detour losses are permanent this stage. Drives over 300 km trigger a regional hazard.</p>'+handCards(p,leg,options,game)+(game.step==='play'?'<div class="ccc-actions">'+(p.status?'<button data-chaos-action="recover">Emergency recovery (spend action)</button>':'')+'<button data-chaos-action="pass">Pass (discard two)</button></div>':'')+'</div>'+history(game)+'</div>';
}
export function renderClassicsRoute({pathname,game,revealed,error,feedback,effects,saveInfo}={}){
 return pathname==='/classics/cross-country-chaos/practice'?
  (game?.phase==='playing'?renderChaosPracticeTable({game,revealed,error,feedback,effects,saveInfo}):
   renderChaosGame({game,revealed,error,feedback,effects,saveInfo})):renderClassicsCatalogue();
}
