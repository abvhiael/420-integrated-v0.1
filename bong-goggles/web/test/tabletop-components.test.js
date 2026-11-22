import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
 TABLETOP_SUITS,TABLETOP_PIECES,STANDARD_CARD_RANKS,standardCardDeck,
 validTabletopProjection,renderCardDeck,renderCardDiscard,renderCardHand,
 renderTileRack,renderPieceBoard,renderDiceSet,renderScorecards,
 renderPlayerSeats,renderGameScoreboard,renderTurnIndicator,renderGameControls,
 renderSharedTabletop
} from '../core/tabletop-components.js';
import {renderSharedGameScreen} from '../core/shared-game-ui.js';
import {classicGameById} from '../core/classics.js';

const player=(name,score)=>({name,score,controller:'human',handCount:4});
const rows=()=>[
 {id:'ones',label:'Ones',score:3},
 {id:'twos',label:'Twos',score:8},
 {id:'threes',label:'Threes',score:null},
 {id:'fours',label:'Fours',score:null},
 {id:'fives',label:'Fives',score:null},
 {id:'sixes',label:'Sixes',score:null},
 {id:'upper-bonus',label:'Upper bonus',score:null},
 {id:'three-kind',label:'Three of a kind',score:null},
 {id:'four-kind',label:'Four of a kind',score:null},
 {id:'full-house',label:'Full house',score:null},
 {id:'small-straight',label:'Small straight',score:null},
 {id:'large-straight',label:'Large straight',score:null},
 {id:'five-kind',label:'Five of a kind',score:null},
 {id:'chance',label:'Chance',score:null},
 {id:'total',label:'Grand total',score:null}
];
const tabletop=()=>({
 turnSeat:0,
 deck:{count:36,label:'Draw deck'},
 discard:{count:1,top:{id:'heart-9',label:'Nine',suit:'hearts'}},
 hand:{seat:0,cards:[{id:'a',label:'Ace',suit:'spades'},{id:'two',label:'2',suit:'clubs'}]},
 rack:{seat:0,tiles:[{id:'t1',letter:'A',points:1},{id:'t2',letter:'?',points:0,blank:true}]},
 board:{family:'chess',rows:8,columns:8,pieces:[
  {row:0,column:4,piece:{family:'chess',side:'black',kind:'king'}},
  {row:7,column:4,piece:{family:'chess',side:'white',kind:'king'}}
 ]},
 dice:{values:[1,2,3,4,5,6],held:[true,false,false,false,false,true]},
 scorecards:[{seat:0,columns:[{label:'Row 1',rows:rows()}]}],
 controls:[{id:'draw',label:'Draw card'},{id:'resign',label:'Resign',reason:'Not yet connected to a qualified match'}]
});
const fixture=()=>({
 verified:true,source:'qualified-account-games',phase:'active',gameId:'chess',
 viewerSeat:0,turn:'North to play',
 players:[player('North',12),player('South',9)],
 tabletop:tabletop()
});
const render=(view=fixture())=>renderSharedGameScreen({game:classicGameById('chess'),screen:'table',view});

test('BC-0.9 canonical 52-card manifest is deterministic, unique and immutable, not a shuffled dealt hand',()=>{
 const deck=standardCardDeck();
 assert.equal(deck.length,52);
 assert.equal(new Set(deck.map(c=>c.id)).size,52);
 assert.deepEqual(deck,standardCardDeck());
 assert.ok(Object.isFrozen(deck)&&Object.isFrozen(deck[0]));
 assert.equal(Object.keys(TABLETOP_SUITS).length,4);
 assert.equal(STANDARD_CARD_RANKS.length,13);
 assert.ok(TABLETOP_PIECES.chess.white.king&&TABLETOP_PIECES.checkers.black.man);
 assert.ok(!deck.some(c=>Object.hasOwn(c,'owner')||Object.hasOwn(c,'shuffled')));
});
test('BC-0.9 verified tabletop composes decks, discards, own hand and tiles, board pieces, dice and scorecards',()=>{
 const html=render();
 for(const phrase of ['Verified active game','Draw deck','Discard pile','Your cards','Your tile rack',
  'Chess board','Dice','Seat 1 scorecard','Grand total','Game controls','Current turn:',
  'Seat 1: North','Seat 2: South','36 remaining','Nine','♠','♔','♚','⚀','⚅','Held']){
  assert.ok(html.includes(phrase),phrase);
 }
 assert.match(html,/role="grid" aria-label="chess board"/);
 assert.match(html,/aria-label="Row 1, column 5, black king"/);
 assert.match(html,/aria-label="Your private hand"/);
 assert.match(html,/aria-label="Your private tile rack"/);
 assert.match(html,/aria-label="Seat 1 scorecard"/);
 assert.match(html,/aria-current="step"/);
 assert.match(html,/<button type="button" disabled aria-disabled="true"/);
 assert.doesNotMatch(html,/data-game-action|data-action="game|onclick=|private0|opponentHand|seedHex/);
 assert.ok(validTabletopProjection(fixture()));
});
test('BC-0.9 server-verified seat permissions are required for all private cards and tiles',()=>{
 const opponent=fixture();
 opponent.tabletop.hand.seat=1;
 opponent.tabletop.rack.seat=1;
 assert.equal(validTabletopProjection(opponent),false);
 const html=render(opponent);
 assert.match(html,/Tabletop projection unavailable/);
 assert.doesNotMatch(html,/Your cards|Your tile rack|Ace|Nine|game-kit__board/);
 const missing=fixture();delete missing.viewerSeat;
 assert.equal(validTabletopProjection(missing),false);
 const unverified=fixture();unverified.verified=false;
 assert.match(render(unverified),/No verified active table/);
 assert.doesNotMatch(render(unverified),/Nine|Ace|Draw card/);
 const wrongGame=fixture();wrongGame.gameId='cribbage';
 assert.match(render(wrongGame),/No verified active table/);
 const wrongSource=fixture();wrongSource.source='browser-cache';
 assert.match(render(wrongSource),/No verified active table/);
});
test('BC-0.9 rejects invalid boards, duplicate locations, invalid card/dice values and untrusted schema',()=>{
 const mutate=(fn)=>{
  const f=fixture();fn(f);return f;
 };
 const invalid=[
  f=>f.tabletop.board.pieces.push(f.tabletop.board.pieces[0]),
  f=>f.tabletop.board.rows=19,
  f=>f.tabletop.board.pieces[0].piece.family='checkers',
  f=>f.tabletop.board.pieces[0].piece.kind='dragon',
  f=>f.tabletop.dice.values[0]=7,
  f=>f.tabletop.dice.held=[true],
  f=>f.tabletop.deck.count=-1,
  f=>f.tabletop.discard.count=0,
  f=>f.tabletop.hand.cards.push(f.tabletop.hand.cards[0]),
  f=>f.tabletop.rack.tiles[0].points=Infinity,
  f=>f.tabletop.controls.push(f.tabletop.controls[0]),
  f=>f.tabletop.board.privatePieces=[{kind:'pawn'}],
  f=>f.tabletop.opponentHand=[{id:'secret',label:'Secret'}],
  f=>f.tabletop.turnSeat=9,
  f=>f.tabletop.scorecards[0].columns.push(...Array.from({length:6},(_,i)=>({label:'Row '+i,rows:rows()})))
 ];
 for(const [i,fn] of invalid.entries()){
  const f=mutate(fn);
  assert.equal(validTabletopProjection(f),false,'invalid payload '+i);
  assert.match(render(f),/Tabletop projection unavailable/);
  assert.doesNotMatch(render(f),/game-kit__card-face|game-kit__board|Your private hand/);
 }
});
test('BC-0.9 all reusable public renderers escape malicious labels and never inject URLs or active action hooks',()=>{
 const attack='<img src=x onerror=alert(1)>';
 const safeCard={id:'safe-1',label:attack,suit:'hearts'};
 const pieces={family:'checkers',rows:8,columns:8,pieces:[{row:0,column:0,piece:
  {family:'checkers',side:'black',kind:'king',label:attack}}]};
 const parts=[
  renderCardDeck({count:2,label:attack}),
  renderCardDiscard({count:1,top:safeCard}),
  renderCardHand({seat:0,cards:[safeCard]}),
  renderTileRack({seat:0,tiles:[{id:'safe',letter:'<',points:1}]}),
  renderPieceBoard(pieces),
  renderDiceSet({values:[1,6]}),
  renderScorecards([{seat:0,columns:[{label:attack,rows:[{id:'x',label:attack,score:4}]}]}]),
  renderPlayerSeats([{name:attack},{name:'B'}],0),
  renderGameScoreboard([{name:attack,score:1},{name:'B',score:2}]),
  renderTurnIndicator([{name:attack},{name:'B'}],0,attack),
  renderGameControls([{id:'pass',label:attack,reason:attack}])
 ];
 for(const [i,html] of parts.entries()){
  // Attribute-like words inside HTML-escaped text are harmless; detect
  // executable tags, URI attributes and actual action handlers instead.
  assert.doesNotMatch(html,/<img\b|<script\b|<a\b[^>]*href="javascript:|\sonclick="|<button\b[^>]*data-game-action/i,'injection '+i);
  if(i!==5)assert.match(html,/&lt;img|&lt;/,'escaped '+i);
 }
 assert.equal(renderCardDeck({count:-4}),'');
 assert.equal(renderPieceBoard({family:'chess',rows:9,columns:9,pieces:[]}), '');
 assert.equal(renderGameControls([{id:'x',label:'X'},{id:'x',label:'Y'}]),'');
});
test('BC-0.9 full generic multi-column scorecards support 1, 2, 3 and 6 complete scoring rows',()=>{
 for(const n of [1,2,3,6]){
  const columns=Array.from({length:n},(_,i)=>({label:'Row '+(i+1),rows:rows()}));
  const html=renderScorecards([{seat:0,columns}]);
  assert.match(html,/Upper bonus/);
  assert.match(html,/Grand total/);
  assert.match(html,/Full house/);
  assert.match(html,/Five of a kind/);
  assert.equal((html.match(/scope="col"/g)||[]).length,n+1);
  assert.equal((html.match(/scope="row"/g)||[]).length,15);
 }
});
test('BC-0.9 chess/checkers and 9, 13, 19 Go boards render bounded, accessible squares',()=>{
 for(const [family,size,kind] of [['chess',8,'queen'],['checkers',8,'man'],
   ['go',9,'stone'],['go',13,'stone'],['go',19,'stone']]){
  const html=renderPieceBoard({family,rows:size,columns:size,pieces:[
   {row:0,column:0,piece:{family,side:'white',kind}}]});
  assert.equal((html.match(/role="gridcell"/g)||[]).length,size*size);
  assert.match(html,/aria-label="Row 1, column 1/);
  assert.match(html,/style="--game-kit-cols:/);
 }
});
test('BC-0.9 responsive and forced-color accessibility skin is packaged with Classics',async()=>{
 const css=await readFile(resolve(import.meta.dirname,'../styles.css'),'utf8');
 for(const token of ['game-kit__card-face','game-kit__rack','game-kit__board',
   'game-kit__dice','game-kit__scorecard','game-kit__seats','game-kit__turn',
   'game-kit__controls','forced-colors:active','prefers-reduced-motion:reduce']){
  assert.ok(css.includes(token),token);
 }
});
