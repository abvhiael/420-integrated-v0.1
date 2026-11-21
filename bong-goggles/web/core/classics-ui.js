import {escapeHtml as esc,card} from './design-system.js';
import {CLASSIC_COLLECTIONS} from './classics.js';
import {LEGS,chaosLeaders,chaosActionOptions} from './cross-country-chaos.js';
import {chaosCardArt} from './chaos-card-art.js';
import {renderChaosTable} from './chaos-board.js';
const link='<a href="/classics" data-route="classics">← All Classics</a>';
const badge=s=>'<span class="ccc-badge">'+esc(s)+'</span>';
export function renderClassicsCatalogue(){
 const groups=CLASSIC_COLLECTIONS.map(group=>'<section class="ccc-collection"><h2>'+esc(group.title)+'</h2><div class="ccc-collection-grid">'+group.games.map(game=>'<article class="ccc-game-tile"><h3>'+esc(game.title)+'</h3><p>'+esc(game.description||'Traditional kitchen-table gameplay.')+'</p><p class="ccc-meta">'+esc(game.players)+' players · '+esc(game.status==='local'?'Playable locally':game.status==='registry'?'Registry only — board unavailable':'Planned — not yet playable')+'</p>'+(game.status==='local'?'<a href="/classics/cross-country-chaos" data-route="chaos-game" class="ccc-link">Play Cross-Country Chaos</a>':'')+'</article>').join('')+'</div></section>').join('');
 return '<div class="ccc-wrap"><div class="ccc-hero"><p class="eyebrow">BongGoggles · Game Night</p><h2>Classics & Canadian Classics</h2><p>Kitchen-table card, dice and board games. Cross-Country Chaos is playable locally now; other titles are listed as planned or registry-only, not falsely advertised as live multiplayer.</p><a class="ccc-link" href="/classics/cross-country-chaos" data-route="chaos-game">Play Cross-Country Chaos →</a></div>'+groups+'</div>';
}
const stats=s=>'<div class="ccc-stats">'+s.players.map(p=>'<div class="ccc-player"><strong>'+esc(p.name)+'</strong><span>'+p.km.toLocaleString('en-CA')+' / 2,500 km</span><span>'+p.score.toLocaleString('en-CA')+' championship km</span><small>'+esc(p.status?.name||'On the road')+(p.detourLoss?' · -'+p.detourLoss+' km detours':'')+'</small></div>').join('')+'</div>';
const history=s=>'<details class="ccc-history"><summary>Roadside radio / game log</summary><ol>'+s.log.map(entry=>'<li>'+esc(entry)+'</li>').join('')+'</ol></details>';
const artImage=(path,kind='card')=>path?'<img class="ccc-card-image ccc-card-image--'+esc(kind)+'" src="'+esc(path)+'" width="480" height="810" alt="" loading="lazy" decoding="async">':'';
const cardArt=(card,leg)=>chaosCardArt(card,leg);
const stageResults=s=>s.results.map(result=>'<section class="ccc-standings"><h3>'+esc(LEGS[result.leg].name)+' — 2,500 km stage</h3><ol>'+result.standings.map(p=>'<li>'+esc(p.name)+(p.winner?' 🏆':'')+' · '+p.km.toLocaleString('en-CA')+' effective km · banked '+p.banked.toLocaleString('en-CA')+' km · total '+p.total.toLocaleString('en-CA')+' km</li>').join('')+'</ol></section>').join('');
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
export function renderChaosGame({game=null,revealed=false,error=null}={}){
 if(!game)return '<div class="ccc-wrap">'+link+'<div class="ccc-hero"><p class="eyebrow">BongGoggles Canadian Classics</p><h2>Cross-Country Chaos</h2><p>Race from St. John\'s to Vancouver: three regions, 2,500 km each. Draw to seven, play, then discard. Hazards and detours can derail the race; championship kilometres decide the winner.</p><p><strong>Local pass-and-play only.</strong> No online rooms, wallet, staking, rewards, or wagers. This session is kept in this tab and resets on reload.</p></div><form class="ccc-setup" data-chaos-start><h3>Start your road trip</h3><label for="ccc-count">Drivers</label><select id="ccc-count" name="count"><option value="2">2 drivers</option><option value="3">3 drivers</option><option value="4" selected>4 drivers</option></select><div class="ccc-names">'+[0,1,2,3].map(i=>'<label>Driver '+(i+1)+' <input name="player'+i+'" maxlength="24" placeholder="Driver '+(i+1)+'" autocomplete="off"></label>').join('')+'</div><button type="submit">Start the cross-Canada championship</button></form></div>';
 const leg=LEGS[game.leg],p=game.players[game.turn],leaders=chaosLeaders(game);
 const top='<div class="ccc-wrap">'+link+'<div class="ccc-hero"><p class="eyebrow">Cross-Country Chaos · Stage '+(game.leg+1)+' of 3</p><h2>'+esc(leg.name)+'</h2><p>'+esc(leg.from)+' → '+esc(leg.to)+' · 2,500 km target</p><p>Three regional decks · four legendary cards across the championship · no wallet or cash prizes</p>'+(game.finishPending?'<strong role="status">FINAL ROUND — finish the current turn cycle!</strong>':'')+'</div>'+stats(game)+renderChaosTable(game);
 const notice=error?'<p class="ccc-error" role="alert">'+esc(error)+'</p>':'';
 if(game.phase==='between')return top+notice+'<div class="ccc-panel"><h3>Regional finish line!</h3>'+stageResults(game)+'<p>Championship kilometres carry forward. All mileage, upgrades, hazards, and unused regional cards reset.</p><button data-chaos-action="next">Continue to '+esc(LEGS[game.leg+1].name)+'</button></div>'+history(game)+'</div>';
 if(game.phase==='finished'){
  const best=leaders[0];
  const west=driver=>game.results[2]?.standings.find(x=>x.id===driver.id)?.banked||0;
  const champions=leaders.filter(q=>q.score===best.score&&q.wins===best.wins&&west(q)===west(best));
  return top+notice+'<div class="ccc-panel"><h3>Coast-to-coast championship complete</h3><p><strong>Grand champion:</strong> '+esc(champions.map(q=>q.name).join(' & '))+'</p><ol>'+leaders.map(q=>'<li>'+esc(q.name)+' — '+q.score.toLocaleString('en-CA')+' championship km, '+q.wins+' stage wins</li>').join('')+'</ol>'+stageResults(game)+'<button data-chaos-action="restart">New championship</button></div>'+history(game)+'</div>';
 }
 if(!revealed)return top+notice+'<div class="ccc-panel ccc-private"><h3>Pass the device to '+esc(p.name)+'</h3><p>Everyone else should look away. Only '+esc(p.name)+' should reveal their cards.</p><button data-chaos-action="reveal">I am '+esc(p.name)+' — reveal my hand</button></div>'+history(game)+'</div>';
 const options=chaosActionOptions(game),discard=discardTop(game);
 const pile='<div class="ccc-pile-status"><strong>Draw deck: '+game.deck.length+' cards</strong> · <strong>Discard pile: '+game.discard.length+' cards</strong>'+(discard?'<span class="ccc-discard-top">'+artImage(cardArt(discard,leg.id),'discard')+'Top discard: '+esc(discard.type==='mileage'?discard.km+' km':discard.name)+'</span>':'')+'</div>';
 if(game.step==='draw')return top+notice+'<div class="ccc-panel"><h3>'+esc(p.name)+' — draw to seven</h3>'+pile+'<p>Take two from the regional deck, or the top discard and one from the deck.</p><div class="ccc-actions"><button data-chaos-action="draw" data-choice="deck">Draw two from deck</button>'+(discard?'<button data-chaos-action="draw" data-choice="discard">Take top discard + draw one</button>':'')+'</div>'+'</div>'+history(game)+'</div>';
 const prompt=game.step==='discard'?'Discard '+game.discardsLeft+' card'+(game.discardsLeft===1?'':'s')+' to end turn':'Play one card or action; free newly drawn powers may be activated first.';
 return top+notice+'<div class="ccc-panel"><h3>'+esc(p.name)+' — '+(game.step==='discard'?'discard phase':'play phase')+'</h3>'+pile+'<p>'+prompt+' Repairs are only allowed on your turn. Detour losses are permanent this stage. Drives over 300 km trigger a regional hazard.</p>'+handCards(p,leg,options,game)+(game.step==='play'?'<div class="ccc-actions">'+(p.status?'<button data-chaos-action="recover">Emergency recovery (spend action)</button>':'')+'<button data-chaos-action="pass">Pass (discard two)</button></div>':'')+'</div>'+history(game)+'</div>';
}
export function renderClassicsRoute({pathname,game,revealed,error}={}){
 return pathname==='/classics/cross-country-chaos'?renderChaosGame({game,revealed,error}):renderClassicsCatalogue();
}
