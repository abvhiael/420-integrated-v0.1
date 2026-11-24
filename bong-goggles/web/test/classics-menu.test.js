import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_CLASSICS,CLASSIC_COLLECTIONS,CLASSIC_ROADMAP,classicGameById} from '../core/classics.js';
import {resolveRoute,routeAccess,navigationItems} from '../core/routes.js';
import {renderGameCatalogue,renderClassicGamePage,renderGamesHub,renderGamesRoute} from '../core/games-ui.js';
import {renderClassicsCatalogue} from '../core/classics-ui.js';
import {renderApplicationShell,navigateWithoutReload} from '../core/app-shell.js';

const main=['Cribbage','Labyrinth Cribbage','Chess','Scrabble','Checkers','Backgammon','Dominoes','Crazy Eights','Euchre','Yahtzee','Go Fish','Hearts','Go','Four-Player Mahjong','Spades','500','Canasta'];
const canadian=['Tarabish','Forty-Fives (45s)','120s','Deux Cents (200)','Hola','Rook','Nines','Kaiser'];

test('BC-0.2 maintains the exact 25-game order, category and public deep links',()=>{
 assert.equal(CLASSIC_ROADMAP.length,25);
 assert.deepEqual(CLASSIC_ROADMAP.map(x=>x.title),[...main,...canadian]);
 assert.deepEqual(CLASSIC_ROADMAP.map(x=>x.milestone),Array.from({length:25},(_,i)=>'BC-'+(i+1)));
 assert.equal(new Set(CLASSIC_ROADMAP.map(x=>x.id)).size,25);
 assert.equal(CLASSIC_ROADMAP.filter(x=>x.collection==='main').length,17);
 assert.equal(CLASSIC_ROADMAP.filter(x=>x.collection==='canadian').length,8);
 for(const game of CLASSIC_ROADMAP){
  assert.equal(game.href,'/games/'+game.id);
  assert.equal(classicGameById(game.id).title,game.title);
  const route=resolveRoute(game.href);
  assert.equal(route.id,'classic-game');
  assert.equal(route.gameId,game.id);
  assert.equal(route.label,game.title);
  assert.equal(routeAccess(route,{connected:false,supportedNetwork:false}).allowed,true);
 }
});
test('BC-0.2 public /games lists all games as clickable links without fake play buttons',()=>{
 const html=renderApplicationShell({pathname:'/games',walletView:{connected:false}});
 assert.match(html,/Main Classics/);
 assert.match(html,/Canadian Classics/);
 assert.match(html,/More BongGoggles games/);
 assert.match(html,/Wallet-linked game sessions/);
 assert.match(html,/420Wallet required for blockchain sessions only/);
 assert.doesNotMatch(html,/Games require 420Wallet/);
 for(const game of CLASSIC_ROADMAP){
  assert.ok(html.includes('href="/games/'+game.id+'" data-route="classic-game"'),game.id);
  assert.ok(html.includes('>'+game.title+'</a>'),game.title);
 }
 assert.equal((html.match(/class="games-catalogue__tile"/g)||[]).length,ALL_CLASSICS.length);
 assert.match(html,/Registry only — not yet playable/);
 assert.match(html,/>Playable · 420ID</);
 assert.match(html,/Planned — not yet playable/);
 assert.doesNotMatch(html,/data-action="game-invite"/);
});
test('BC-0.2 all 25 and legacy game detail pages survive direct loads without fake start controls',()=>{
 for(const game of ALL_CLASSICS){
  const route=resolveRoute('/games/'+game.id);
  assert.equal(route.id,'classic-game');
  const html=renderApplicationShell({pathname:route.path,walletView:{connected:false,supportedNetwork:false}});
  assert.match(html,/← All Games/);
  assert.match(html,/Zero-wager game/);
  assert.match(html,/href="\/games" data-route="games"/);
  assert.match(html,/class="games-game-page__notice" role="status"/);
  assert.doesNotMatch(html,/<button[^>]*>Start game/);
  assert.doesNotMatch(html,/data-action="game-invite"/);
 }
 // BC-1.4 has a real private-session frontend, but no public Play activation.
 const cribbage=renderClassicGamePage('cribbage');
 assert.match(cribbage,/data-game-screen="intro"/);
 assert.match(cribbage,/board-cannabis-leaf\.png/);
 assert.doesNotMatch(cribbage,/leaf-board\.svg/);
 assert.match(cribbage,/BC-1\.5 · Authenticated rooms/);
 assert.match(cribbage,/not yet playable until real 420ID room activation/);
 assert.doesNotMatch(cribbage,/<button[^>]*>Start game/);
 assert.match(renderClassicGamePage('yahtzee'),/1, 2, 3 or 6 rows/);
 assert.match(renderClassicGamePage('scrabble'),/rights must be resolved/);
 assert.match(renderClassicGamePage('cross-country-chaos'),/Play Cross-Country Chaos/);
 assert.match(renderClassicGamePage('cross-country-chaos'),/separate 420ID accounts/);
 assert.doesNotMatch(renderClassicGamePage('cross-country-chaos'),/pass-and-play/);
});
test('BC-0.2 preserves /classics, Cross-Country Chaos and previous unrelated entries',()=>{
 const group=CLASSIC_COLLECTIONS.find(x=>x.id==='canadian');
 assert.equal(group.games.at(-1).id,'cross-country-chaos');
 for(const id of ['rummy','asshole','five-dice-one','five-dice-six']){
  assert.ok(ALL_CLASSICS.some(x=>x.id===id),id);
 }
 const html=renderClassicsCatalogue();
 assert.match(html,/Classics & Canadian Classics/);
 assert.match(html,/Play Cross-Country Chaos/);
 assert.match(html,/href="\/classics\/cross-country-chaos" data-route="chaos-game"/);
 assert.match(html,/href="\/games\/cribbage" data-route="classic-game"/);
 assert.equal(resolveRoute('/classics').id,'classics');
 assert.equal(resolveRoute('/classics/cross-country-chaos').id,'chaos-game');
 assert.equal(resolveRoute('/account/games').id,'account-games');
 const accountView=renderApplicationShell({pathname:'/classics/cross-country-chaos'});
 assert.match(accountView,/420ID Account multiplayer/);
 assert.doesNotMatch(accountView,/data-chaos-start|Pass the device/);
});
test('BC-0.2 unknown and nested game slugs fail closed',()=>{
 for(const path of ['/games/unknown','/games/cribbage/move','/games/%2e%2e','/games/cribbage%2Fother']){
  assert.equal(resolveRoute(path).id,'not-found',path);
  assert.match(renderApplicationShell({pathname:path}),/Page not found/);
 }
 assert.equal(resolveRoute('/games/').id,'games');
 assert.equal(resolveRoute('/games/cribbage///').id,'classic-game');
 assert.equal(resolveRoute('/games').id,'games');
});
test('BC-0.2 Games link appears in desktop/mobile navigation; legacy account and messaging links remain',()=>{
 const html=renderApplicationShell({pathname:'/games/cribbage',walletView:null});
 const header=html.slice(0,html.indexOf('<div class="app-layout">'));
 assert.match(header,/href="\/games" data-route="games" aria-current="page"/);
 const mobile=html.slice(html.indexOf('app-nav--mobile'));
 for(const url of ['/games','/social','/messages','/notifications','/profile'])
  assert.ok(mobile.includes('href="'+url+'"'),url);
 assert.equal(navigationItems({connected:false}).find(x=>x.id==='games').access.allowed,true);
 const mainPage=renderGameCatalogue();
 assert.match(mainPage,/href="\/account\/games" data-route="account-games"/);
});
test('BC-0.2 same-origin game links work with existing no-reload navigation',()=>{
 const windowObject={location:{href:'https://bonggoggles.420integrated.org/games',origin:'https://bonggoggles.420integrated.org'},history:{pushState(_s,_n,uri){this.uri=uri;}}};
 const event={preventDefault(){this.prevented=true;},target:{closest(){return {href:'https://bonggoggles.420integrated.org/games/kaiser'};}}};
 let navigated=null;
 assert.equal(navigateWithoutReload(event,{windowObject,onNavigate:path=>{navigated=path;}}),true);
 assert.equal(navigated,'/games/kaiser');
 assert.equal(windowObject.history.uri,'/games/kaiser');
 assert.equal(event.prevented,true);
});
test('BC-0.2 wallet-based sessions remain separately protected and do not create fabricated projections',()=>{
 const guest=renderGamesHub();
 assert.match(guest,/Canadian Classics/);
 assert.match(guest,/420Wallet required for blockchain sessions only/);
 const wallet={connected:true,supportedNetwork:true};
 const user='0x'+'1'.repeat(40);
 assert.match(renderGamesRoute({walletView:wallet,viewer:user}),/Games service unavailable/);
 assert.match(renderGamesRoute({walletView:wallet,viewer:user}),/Main Classics/);
});

test('BC-2.1 canonical Labyrinth title, URL and legacy deep links',()=>{
 assert.equal(classicGameById('labyrinth-cribbage')?.title,'Labyrinth Cribbage');
 assert.equal(resolveRoute('/games/labyrinth-cribbage').gameId,'labyrinth-cribbage');
 assert.equal(resolveRoute('/games/russian-cribbage').gameId,'labyrinth-cribbage');
 assert.equal(classicGameById('russian-cribbage')?.title,'Labyrinth Cribbage');
 assert.equal(CLASSIC_ROADMAP[1].href,'/games/labyrinth-cribbage');
});
