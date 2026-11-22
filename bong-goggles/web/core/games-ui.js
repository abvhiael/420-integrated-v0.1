import {card,emptyState,escapeHtml,button} from './design-system.js';
import {GAME_TYPES,normalizeGameHub,normalizeGameDetail,gameActions,gameLink} from './games.js';
import {CLASSIC_ROADMAP,ALL_CLASSICS,classicGameById} from './classics.js';
import {renderSharedGameScreen} from './shared-game-ui.js';
import {renderGameAccountPanel} from './account-identity.js';
import {renderCribbageRoute} from './cribbage-ui.js';
const label=x=>String(x).replaceAll('_',' ').toLowerCase();
const statusText=game=>game.status==='playable'?'Playable · 420ID multiplayer and computer opponents':game.status==='account'?'Account multiplayer':game.status==='registry'?'Registry only — not yet playable':'Planned — not yet playable';
const gameTile=game=>{
const url='/games/'+game.id;
return '<article class="games-catalogue__tile"><div><small class="games-catalogue__phase">'+escapeHtml(game.milestone??'More games')+'</small><h3><a href="'+escapeHtml(url)+'" data-route="classic-game">'+escapeHtml(game.title)+'</a></h3><p>'+escapeHtml(game.description||'Traditional tabletop game.')+'</p></div><p class="games-catalogue__meta">'+escapeHtml(game.players)+' players · '+escapeHtml(statusText(game))+'</p></article>';
};
export function renderGameCatalogue({accountIdentityState=null,accountIdentityEnabled=false}={}){
const main=CLASSIC_ROADMAP.filter(game=>game.collection==='main');
const canadian=CLASSIC_ROADMAP.filter(game=>game.collection==='canadian');
const extras=ALL_CLASSICS.filter(game=>!CLASSIC_ROADMAP.some(item=>item.id===game.id));
const section=(id,title,games)=>'<section class="games-catalogue__section" id="'+id+'" aria-labelledby="'+id+'-heading"><h2 id="'+id+'-heading">'+title+'</h2><div class="games-catalogue__grid">'+games.map(gameTile).join('')+'</div></section>';
return '<div class="games-catalogue"><div class="games-catalogue__intro"><p class="eyebrow">BongGoggles · Free-to-play game night</p><h2>Games</h2><p>Explore the 25 Classics in order. Games become Playable only after real deployed two-account completion and verified release evidence.</p><nav aria-label="Games collections"><a href="#main-classics">Main Classics</a><a href="#canadian-classics">Canadian Classics</a><a href="#other-games">Other games</a><a href="/games/rooms" data-route="classic-rooms">Multiplayer rooms</a><a href="/classics" data-route="classics">Classic catalogue</a></nav></div>'+
section('main-classics','Main Classics',main)+section('canadian-classics','Canadian Classics',canadian)+
section('other-games','More BongGoggles games',extras)+
renderGameAccountPanel(accountIdentityState,{enabled:accountIdentityEnabled})+
'<p class="games-catalogue__footnote"><a href="/games/rooms" data-route="classic-rooms">Browse multiplayer rooms</a> to create private/public 420ID lobbies and choose human or computer seats. No match starts until its game rules are qualified.</p>'+
'<p class="games-catalogue__footnote">No wagers or rewards. Browse without a wallet. For existing wallet-independent two-player quick games, visit <a href="/account/games" data-route="account-games">Account Games</a>. Cross-Country Chaos uses private 420ID account rooms.</p></div>';
}
export function renderClassicGamePage(gameId,{screen='intro',view=null,cribbageState=null,accountIdentityState=null,accountIdentityEnabled=false}={}){
const game=classicGameById(gameId);
if(!game)return card({title:'Game unavailable',body:emptyState({title:'Game not found',message:'Choose a title from the Games catalogue.'})});
if(game.id==='cribbage')return renderCribbageRoute({screen,state:cribbageState,identity:[accountIdentityState,accountIdentityEnabled]});
const step=CLASSIC_ROADMAP.find(item=>item.id===gameId);
const playLink=game.status==='account'?'<a class="ccc-link" href="/classics/cross-country-chaos" data-route="chaos-game">Play Cross-Country Chaos online</a> <a class="ccc-link" href="/classics/cross-country-chaos/practice" data-route="chaos-game">Play against computers</a>':'';
const status=game.status==='account'?'Online multiplayer — separate 420ID accounts':statusText(game);
const note=game.status==='registry'?'The legacy on-chain session type exists, but no qualified interactive game board or match creation is available.':
game.status==='account'?'Sign in with 420ID to create or join a private room; the game service must be online.':
'The game page is available, but the rules engine, computer opponents and online multiplayer are not released.';
return '<section class="games-game-page"><p><a href="/games" data-route="games">← All Games</a> · <a href="/classics" data-route="classics">Classics catalogue</a> · <a href="/games/rooms" data-route="classic-rooms">Multiplayer rooms</a></p><p class="eyebrow">BongGoggles · '+escapeHtml(step?.milestone??'Other games')+'</p><h2>'+escapeHtml(game.title)+'</h2><p>'+escapeHtml(game.description||'Traditional tabletop game.')+'</p><dl class="games-game-page__facts"><div><dt>Players</dt><dd>'+escapeHtml(game.players)+'</dd></div><div><dt>Availability</dt><dd>'+escapeHtml(status)+'</dd></div></dl><p class="games-game-page__notice" role="status">'+escapeHtml(note)+'</p>'+playLink+'<p class="games-catalogue__footnote">Zero-wager game. A wallet is not required to browse. This page does not create a match or claim a finished game engine.</p></section>'+renderGameAccountPanel(accountIdentityState,{enabled:accountIdentityEnabled})+(game.id==='cross-country-chaos'?'':renderSharedGameScreen({game,screen,view}));
}
function entries(items,title){return card({title,body:items.length?`<div class="games-list">${items.map(s=>`<a class="games-card" href="${gameLink(s.sessionId)}" data-game-session="${escapeHtml(s.sessionId)}"><strong>${escapeHtml(label(s.gameType))}</strong><span>${escapeHtml(label(s.state))}</span><small>Opponent ${escapeHtml(s.peer)}</small><small>Next move #${s.nextMoveNumber}</small></a>`).join('')}</div>`:emptyState({title:'No games',message:'No canonical sessions are available in this category.'})});}
export function renderGamesHub({projection=null,viewer=null,walletView=null,accountIdentityState=null,accountIdentityEnabled=false}={}){
const catalogue=renderGameCatalogue({accountIdentityState,accountIdentityEnabled});
if(!walletView?.connected||!viewer)return catalogue+card({title:'Wallet-linked game sessions',body:emptyState({title:'420Wallet required for blockchain sessions only',message:'The Classics catalogue is public. Connect 420Wallet on the supported chain to view existing canonical game sessions, separately from free account games.'})});
if(!projection?.sessions)return catalogue+card({title:'Games service unavailable',body:emptyState({title:'No canonical game data',message:'Wallet-linked session data is unavailable. Bong Goggles will not invent invites, moves, winners or rewards.'})});
const hub=normalizeGameHub({viewer,sessions:projection.sessions,leaderboards:projection.leaderboards,statistics:projection.statistics});
const invite=card({title:'Challenge a friend',body:`<p>Supported zero-wager games: ${GAME_TYPES.map(label).join(', ')}.</p><p>Game invites are available after a qualified ruleset and current friend/game policy are confirmed through the game service and 420Wallet.</p>${button({label:'New challenge',action:'game-invite',disabled:true})}`});
const stats=hub.statistics?card({title:'Statistics',body:'<p>Qualified statistics projection available. Game outcomes remain canonical.</p>'}):'';
const leaders=hub.leaderboards?card({title:'Leaderboards',body:'<p>Qualified leaderboard projection available. Rankings are not reward or settlement authority.</p>'}):'';
return catalogue+`<div class="games-hub"><h2>Wallet-linked social game sessions</h2><p class="games-boundary" role="note"><strong>Zero-wager social games only.</strong> No stake, escrow, odds, wagers or payout settlement. Game rewards remain deferred and are not shown as earned or paid.</p>${invite}${entries(hub.invites,'Invitations received')}${entries(hub.outgoing,'Invitations sent')}${entries(hub.active,'Active games')}${entries(hub.history,'Finished and past games')}${stats}${leaders}</div>`;
}
export function renderGameDetail({projection=null,viewer=null,walletView=null}={}){
if(!walletView?.connected||!viewer)return card({title:'Game unavailable',body:emptyState({title:'420Wallet required',message:'Connect to view your canonical game session.'})});
if(!projection?.session)return card({title:'Game unavailable',body:emptyState({title:'Canonical session unavailable',message:'No game state or move history will be synthesized locally.'})});
const detail=normalizeGameDetail({...projection,viewer});const s=detail.session;
const actions=gameActions({session:projection.session,viewer,walletView,policy:detail.policy,turn:detail.turn,rulesetReady:detail.rulesetReady});
const moves=detail.history.length?`<ol class="games-moves">${detail.history.map(m=>`<li>#${m.moveNumber} · ${escapeHtml(m.commitment.slice(0,14))}…</li>`).join('')}</ol>`:emptyState({title:'No verified moves',message:'The qualified games service has not supplied a move history.'});
return `<div class="games-detail"><p class="games-boundary"><strong>Zero-wager game.</strong> A move is only canonical after registry confirmation. Scores, clocks and local board state do not authorize rewards.</p>${card({eyebrow:label(s.gameType),title:'Game session',body:`<dl class="mini-grid"><div><dt>Opponent</dt><dd>${escapeHtml(s.peer)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(label(s.state))}</dd></div><div><dt>Next canonical move</dt><dd>${s.nextMoveNumber}</dd></div><div><dt>Ruleset</dt><dd>${escapeHtml(s.rulesetHash)}</dd></div><div><dt>Winner</dt><dd>${escapeHtml(s.winner)}</dd></div></dl><div class="games-actions">${actions.map(a=>button({label:label(a.id),action:`game:${a.id}`,disabled:!a.enabled})).join('')}</div>`})}${card({title:'Game board',body:detail.turn?`<p>Verified turn: ${escapeHtml(detail.turn.player)} · move #${s.nextMoveNumber}</p><p>A qualified game engine supplies the interactive board and signed move commitment.</p>`:emptyState({title:'Board unavailable',message:'An active verified ruleset and canonical turn projection are required before an interactive board can be shown.'})})}${card({title:'Verified move history',body:moves})}<a href="/games" data-route="games">Back to games</a></div>`;
}
export function renderGamesRoute({projection=null,viewer=null,walletView=null,accountIdentityState=null,accountIdentityEnabled=false}={}){
if(projection?.detail)return renderGameDetail({projection:projection.detail,viewer,walletView});
return renderGamesHub({projection,viewer,walletView,accountIdentityState,accountIdentityEnabled});
}
