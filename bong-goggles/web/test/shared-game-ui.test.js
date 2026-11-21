import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {CLASSIC_ROADMAP,ALL_CLASSICS,classicGameById} from '../core/classics.js';
import {resolveRoute,routeAccess} from '../core/routes.js';
import {renderClassicGamePage} from '../core/games-ui.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {GAME_SCREEN_IDS,GAME_SUBSCREENS,authorizedGameView,renderSharedGameScreen} from '../core/shared-game-ui.js';

const fixture={gameId:'cribbage',verified:true,source:'qualified-account-games',phase:'active',
 players:[{name:'North',score:31},{name:'South',score:29}],turn:'North to play',
 table:{cells:[['4','5'],['','♣']]},
 history:[{sequence:1,summary:'North pegged five'}]};
const finish={...fixture,phase:'finished',winner:'North'};

test('BC-0.3 eight screen routes resolve for all 25 games and legacy entries without a wallet',()=>{
 assert.deepEqual(GAME_SCREEN_IDS,['intro','rules','play','setup','table','results','history','rematch']);
 assert.equal(GAME_SUBSCREENS.length,7);
 for(const game of ALL_CLASSICS){
  assert.equal(resolveRoute('/games/'+game.id).id,'classic-game');
  for(const screen of GAME_SUBSCREENS){
   const path='/games/'+game.id+'/'+screen;
   const route=resolveRoute(path);
   assert.equal(route.id,'classic-game',path);
   assert.equal(route.gameId,game.id);
   assert.equal(route.screen,screen);
   assert.equal(routeAccess(route,{connected:false,supportedNetwork:false}).allowed,true);
   const html=renderApplicationShell({pathname:path,walletView:{connected:false,supportedNetwork:false}});
   assert.ok(html.includes('data-game-screen="'+screen+'"'),path);
   assert.ok(html.includes('aria-current="page">'+
    ({rules:'Rules',play:'Play',setup:'Opponents',table:'Game table',
      results:'Results',history:'History',rematch:'Rematch'})[screen]+'</a>'),path);
   assert.match(html,/href="\/games" data-route="games"/);
   assert.match(html,/No game|not yet|Game-specific|server|verified|match|Cross-Country Chaos/i);
  }
 }
 assert.equal(CLASSIC_ROADMAP.length,25);
});
test('BC-0.3 rejects nested/unknown screen segments and unknown games',()=>{
 for(const path of ['/games/cribbage/intro','/games/cribbage/move','/games/cribbage/table/private',
  '/games/cribbage/rematch/accept','/games/unknown/setup','/games/cribbage/%2e%2e']){
  assert.equal(resolveRoute(path).id,'not-found',path);
 }
 assert.throws(()=>renderSharedGameScreen({game:classicGameById('cribbage'),screen:'evil'}),/Unsupported game screen/);
});
test('BC-0.3 overview and rules are honest and variants do not masquerade as rulebooks',()=>{
 const crib=renderClassicGamePage('cribbage');
 assert.match(crib,/data-game-screen="intro"/);
 assert.match(crib,/Introduction/);
 assert.match(crib,/Zero-wager game/);
 const russian=renderClassicGamePage('russian-cribbage',{screen:'rules'});
 assert.match(russian,/Ruleset not yet published/);
 assert.match(russian,/Ruleset to be agreed and versioned/);
 assert.match(russian,/Active variant: not selected — no verified match/);
 assert.doesNotMatch(russian,/aria-current="page">Play<\/a>/);
 const yahtzee=renderClassicGamePage('yahtzee',{screen:'rules'});
 for(const row of [1,2,3,6])assert.ok(yahtzee.includes(row+' full scoring row'),row);
 assert.match(renderClassicGamePage('go',{screen:'rules'}),/19×19 board/);
});
test('BC-0.3 opponent setup exposes seat types and all bot difficulties but cannot submit',()=>{
 for(const gameId of ['cribbage','kaiser','mahjong','yahtzee']){
  const html=renderClassicGamePage(gameId,{screen:'setup'});
  assert.match(html,/Opponent setup/);
  assert.match(html,/New game — not yet available/);
  assert.match(html,/<fieldset disabled>/);
  assert.match(html,/name="seat-1-type"/);
  assert.match(html,/name="seat-2-difficulty"/);
  assert.match(html,/>Easy<\/option>/);
  assert.match(html,/>Medium<\/option>/);
  assert.match(html,/>Hard<\/option>/);
  assert.match(html,/disabled aria-disabled="true"/);
  assert.doesNotMatch(html,/data-game-action="create"/);
 }
 assert.match(renderClassicGamePage('chess',{screen:'setup'}),/Seat 2/);
 assert.doesNotMatch(renderClassicGamePage('chess',{screen:'setup'}),/Seat 3/);
});
test('BC-0.3 local Chaos launches only its existing approved game, not a fake service',()=>{
 const local=renderClassicGamePage('cross-country-chaos',{screen:'play'});
 assert.match(local,/href="\/classics\/cross-country-chaos" data-route="chaos-game">Play Cross-Country Chaos \(local\)/);
 assert.match(local,/save|resume|pass-and-play/i);
 const planned=renderClassicGamePage('cribbage',{screen:'play'});
 assert.match(planned,/disabled aria-disabled="true"/);
 assert.match(planned,/Resume game/);
 assert.doesNotMatch(planned,/data-game-action="play"/);
});
test('BC-0.3 table, results, history and rematch stay fail-closed without an authenticated projection',()=>{
 const game=classicGameById('cribbage');
 for(const screen of ['table','results','history','rematch']){
  const html=renderSharedGameScreen({game,screen,view:{...fixture,verified:false}});
  assert.doesNotMatch(html,/North pegged five|♣|31/);
  assert.match(html,/No verified|Finish a verified|authorized game service/i);
  assert.doesNotMatch(html,/data-game-action|data-action="game-invite"/);
 }
 const wrongGame=renderSharedGameScreen({game,screen:'table',view:{...fixture,gameId:'chess'}});
 assert.match(wrongGame,/No verified active table/);
 const wrongSource=renderSharedGameScreen({game,screen:'table',view:{...fixture,source:'browser-cache'}});
 assert.match(wrongSource,/No verified active table/);
});
test('BC-0.3 table uses only bounded public cells, safe scores and seat labels',()=>{
 const game=classicGameById('cribbage');
 assert.equal(authorizedGameView(game,fixture),fixture);
 const html=renderSharedGameScreen({game,screen:'table',view:fixture});
 assert.match(html,/Verified active game/);
 assert.match(html,/role="grid"/);
 assert.match(html,/role="gridcell"/);
 assert.match(html,/--game-cols:2/);
 assert.match(html,/Seat 1: North/);
 assert.match(html,/Seat 2: South/);
 assert.match(html,/31/);
 assert.match(html,/♣/);
 assert.doesNotMatch(html,/privateHand|opponentHand|wallet|wagerAmount/);
 const large={...fixture,table:{cells:Array.from({length:20},()=>['X'])}};
 assert.match(renderSharedGameScreen({game,screen:'table',view:large}),/Table projection unavailable/);
});
test('BC-0.3 result, history and rematch use verified data but never activate unconnected actions',()=>{
 const game=classicGameById('cribbage');
 const result=renderSharedGameScreen({game,screen:'results',view:finish});
 assert.match(result,/Winner: <strong>North<\/strong>/);
 assert.match(result,/Verified finished game/);
 assert.match(renderSharedGameScreen({game,screen:'results',view:fixture}),/No verified results/);
 const log=renderSharedGameScreen({game,screen:'history',view:finish});
 assert.match(log,/Move 1/);
 assert.match(log,/North pegged five/);
 const many={...finish,history:Array.from({length:45},(_,i)=>({sequence:i+1,summary:'Turn '+(i+1)}))};
 const paged=renderSharedGameScreen({game,screen:'history',view:many});
 assert.match(paged,/Move 45/);
 assert.doesNotMatch(paged,/Move 1<\/span>/);
 const rematch=renderSharedGameScreen({game,screen:'rematch',view:finish});
 assert.match(rematch,/Request rematch/);
 assert.match(rematch,/disabled aria-disabled="true"/);
 assert.doesNotMatch(rematch,/data-game-action="rematch"/);
});
test('BC-0.3 hostile text cannot inject HTML, URL attributes, extra private data or oversized state',()=>{
 const game=classicGameById('cribbage');
 const bad='<img src=x onerror=alert(1)>';
 const view={...fixture,players:[{name:bad,score:1},{name:'South',score:2}],
  turn:bad,table:{cells:[[bad]]},history:[{sequence:1,summary:bad}],
  rulebook:{verified:true,title:bad,paragraphs:[bad]}};
 for(const screen of ['table','history','rules']){
  const html=renderSharedGameScreen({game,screen,view});
  assert.doesNotMatch(html,/<img\b|<script\b|aria-label="[^"]*<img/i);
  assert.match(html,/&lt;img/);
 }
 assert.equal(authorizedGameView(game,{...fixture,players:[{name:'',score:1}]}),null);
 assert.equal(authorizedGameView(game,{...fixture,players:[{name:'x',score:Infinity},{name:'y'}]}),null);
 assert.equal(authorizedGameView(game,{...fixture,verified:'true'}),null);
 assert.equal(authorizedGameView(game,{...fixture,phase:'paid'}),null);
 const versioned=renderSharedGameScreen({game,screen:'rules',view:{...fixture,variant:'<variant-1>',rulebook:{verified:true,title:'Rules',paragraphs:['Versioned scoring']}}});
 assert.match(versioned,/Active variant: &lt;variant-1&gt;/);
 assert.doesNotMatch(versioned,/<variant-1>/);
});
test('BC-0.3 shared styles and navigation accessibility ship with the web app',async()=>{
 const css=await readFile(resolve(import.meta.dirname,'../styles.css'),'utf8');
 for(const token of ['games-screen__nav','games-screen__panel','games-screen__seats',
  'games-screen__table-grid','forced-colors:active','focus-visible']){
   assert.ok(css.includes(token),token);
 }
 const game=classicGameById('tarabish');
 const html=renderSharedGameScreen({game,screen:'history'});
 assert.match(html,/<nav class="games-screen__nav" aria-label="Tarabish screens">/);
 assert.equal((html.match(/data-route="classic-game"/g)||[]).length,8);
 assert.match(html,/aria-current="page">History<\/a>/);
});
