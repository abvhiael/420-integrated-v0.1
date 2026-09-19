import {card,emptyState,escapeHtml,button} from './design-system.js';
import {GAME_TYPES,normalizeGameHub,normalizeGameDetail,gameActions,gameLink} from './games.js';
const label=x=>String(x).replaceAll('_',' ').toLowerCase();
function entries(items,title){return card({title,body:items.length?`<div class="games-list">${items.map(s=>`<a class="games-card" href="${gameLink(s.sessionId)}" data-game-session="${escapeHtml(s.sessionId)}"><strong>${escapeHtml(label(s.gameType))}</strong><span>${escapeHtml(label(s.state))}</span><small>Opponent ${escapeHtml(s.peer)}</small><small>Next move #${s.nextMoveNumber}</small></a>`).join('')}</div>`:emptyState({title:'No games',message:'No canonical sessions are available in this category.'})});}
export function renderGamesHub({projection=null,viewer=null,walletView=null}={}){
 if(!walletView?.connected||!viewer)return card({title:'Games',body:emptyState({title:'420Wallet required',message:'Connect on the configured 420 network to view your game sessions.'})});
 if(!projection?.sessions)return card({title:'Games service unavailable',body:emptyState({title:'No canonical game data',message:'Bong Goggles will not invent invites, moves, winners or rewards.'})});
 const hub=normalizeGameHub({viewer,sessions:projection.sessions,leaderboards:projection.leaderboards,statistics:projection.statistics});
 const invite=card({title:'Challenge a friend',body:`<p>Supported zero-wager games: ${GAME_TYPES.map(label).join(', ')}.</p><p>Game invites are available after a qualified ruleset and current friend/game policy are confirmed through the game service and 420Wallet.</p>${button({label:'New challenge',action:'game-invite',disabled:true})}`});
 const stats=hub.statistics?card({title:'Statistics',body:'<p>Qualified statistics projection available. Game outcomes remain canonical.</p>'}):'';
 const leaders=hub.leaderboards?card({title:'Leaderboards',body:'<p>Qualified leaderboard projection available. Rankings are not reward or settlement authority.</p>'}):'';
 return `<div class="games-hub"><p class="games-boundary" role="note"><strong>Zero-wager social games only.</strong> No stake, escrow, odds, wagers or payout settlement. Game rewards remain deferred and are not shown as earned or paid.</p>${invite}${entries(hub.invites,'Invitations received')}${entries(hub.outgoing,'Invitations sent')}${entries(hub.active,'Active games')}${entries(hub.history,'Finished and past games')}${stats}${leaders}</div>`;
}
export function renderGameDetail({projection=null,viewer=null,walletView=null}={}){
 if(!walletView?.connected||!viewer)return card({title:'Game unavailable',body:emptyState({title:'420Wallet required',message:'Connect to view your canonical game session.'})});
 if(!projection?.session)return card({title:'Game unavailable',body:emptyState({title:'Canonical session unavailable',message:'No game state or move history will be synthesized locally.'})});
 const detail=normalizeGameDetail({...projection,viewer});const s=detail.session;
 const actions=gameActions({session:projection.session,viewer,walletView,policy:detail.policy,turn:detail.turn,rulesetReady:detail.rulesetReady});
 const moves=detail.history.length?`<ol class="games-moves">${detail.history.map(m=>`<li>#${m.moveNumber} · ${escapeHtml(m.commitment.slice(0,14))}…</li>`).join('')}</ol>`:emptyState({title:'No verified moves',message:'The qualified games service has not supplied a move history.'});
 return `<div class="games-detail"><p class="games-boundary"><strong>Zero-wager game.</strong> A move is only canonical after registry confirmation. Scores, clocks and local board state do not authorize rewards.</p>${card({eyebrow:label(s.gameType),title:'Game session',body:`<dl class="mini-grid"><div><dt>Opponent</dt><dd>${escapeHtml(s.peer)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(label(s.state))}</dd></div><div><dt>Next canonical move</dt><dd>${s.nextMoveNumber}</dd></div><div><dt>Ruleset</dt><dd>${escapeHtml(s.rulesetHash)}</dd></div><div><dt>Winner</dt><dd>${escapeHtml(s.winner)}</dd></div></dl><div class="games-actions">${actions.map(a=>button({label:label(a.id),action:`game:${a.id}`,disabled:!a.enabled})).join('')}</div>`})}${card({title:'Game board',body:detail.turn?`<p>Verified turn: ${escapeHtml(detail.turn.player)} · move #${s.nextMoveNumber}</p><p>A qualified game engine supplies the interactive board and signed move commitment.</p>`:emptyState({title:'Board unavailable',message:'An active verified ruleset and canonical turn projection are required before an interactive board can be shown.'})})}${card({title:'Verified move history',body:moves})}<a href="/games" data-route="games">Back to games</a></div>`;
}
export function renderGamesRoute({projection=null,viewer=null,walletView=null}={}){
 if(projection?.detail)return renderGameDetail({projection:projection.detail,viewer,walletView});
 return renderGamesHub({projection,viewer,walletView});
}
