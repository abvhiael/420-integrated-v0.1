// BC-0.9 reusable, server-projection-only Classic tabletop presentation.
// No randomness, action dispatch, authorization, game scoring or local persistence.
import {escapeHtml as esc} from './design-system.js';

export const TABLETOP_SUITS=Object.freeze({
 clubs:'♣',diamonds:'♦',hearts:'♥',spades:'♠'
});
export const TABLETOP_PIECES=Object.freeze({
 chess:Object.freeze({
  white:Object.freeze({king:'♔',queen:'♕',rook:'♖',bishop:'♗',knight:'♘',pawn:'♙'}),
  black:Object.freeze({king:'♚',queen:'♛',rook:'♜',bishop:'♝',knight:'♞',pawn:'♟'})
 }),
 checkers:Object.freeze({
  white:Object.freeze({man:'⛀',king:'⛁'}),
  black:Object.freeze({man:'⛂',king:'⛃'})
 }),
 go:Object.freeze({white:Object.freeze({stone:'○'}),black:Object.freeze({stone:'●'})})
});
export const TABLETOP_DICE=Object.freeze(['','⚀','⚁','⚂','⚃','⚄','⚅']);
export const STANDARD_CARD_RANKS=Object.freeze(['A','2','3','4','5','6','7','8','9','10','J','Q','K']);

// An ordered data manifest, NOT an authoritative shuffled/dealt deck.
// Engines decide game-specific card composition and seeded shuffle privately.
export function standardCardDeck(){
 return Object.freeze(Object.keys(TABLETOP_SUITS).flatMap(suit=>
  STANDARD_CARD_RANKS.map(rank=>Object.freeze({id:suit+'-'+rank,rank,suit,label:rank+' '+suit}))));
}
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const text=(x,max=80)=>typeof x==='string'&&x.length>0&&x.length<=max&&x.trim()===x&&
 !/[\u0000-\u001f\u007f]/.test(x);
const optionalText=(x,max=80)=>x===undefined||text(x,max);
const shape=(x,keys)=>plain(x)&&Object.keys(x).every(k=>keys.includes(k));
const score=x=>x===null||integer(x,-10000000,10000000);
const count=x=>integer(x,0,500);
const seatIndex=(x,players)=>integer(x,0,players-1);
const suit=x=>x===undefined||Object.hasOwn(TABLETOP_SUITS,x);
const card=x=>shape(x,['id','label','suit'])&&text(x.id,48)&&text(x.label,80)&&suit(x.suit);
const tile=x=>shape(x,['id','letter','points','blank'])&&text(x.id,48)&&text(x.letter,4)&&
 integer(x.points,0,99)&&(x.blank===undefined||typeof x.blank==='boolean');
const piece=x=>shape(x,['family','side','kind','label'])&&
 Object.hasOwn(TABLETOP_PIECES,x.family)&&
 Object.hasOwn(TABLETOP_PIECES[x.family],x.side)&&
 Object.hasOwn(TABLETOP_PIECES[x.family][x.side],x.kind)&&optionalText(x.label,24);
const filled=(a,limit,validate)=>Array.isArray(a)&&a.length<=limit&&a.every(validate);
const unique=(a,getKey)=>new Set(a.map(getKey)).size===a.length;
const cardList=a=>filled(a,48,card)&&unique(a,x=>x.id);
const tileList=a=>filled(a,30,tile)&&unique(a,x=>x.id);
const board=b=>shape(b,['family','rows','columns','pieces'])&&
 ['chess','checkers','go'].includes(b.family)&&
 integer(b.rows,1,19)&&integer(b.columns,1,19)&&
 (b.family==='go'?[9,13,19].includes(b.rows)&&b.columns===b.rows:
  b.rows===8&&b.columns===8)&&
 filled(b.pieces,361,x=>shape(x,['row','column','piece'])&&
  integer(x.row,0,b.rows-1)&&integer(x.column,0,b.columns-1)&&
  piece(x.piece)&&x.piece.family===b.family)&&
 unique(b.pieces,x=>x.row+':'+x.column);
const cards=c=>shape(c,['seat','cards'])&&integer(c.seat,0,5)&&cardList(c.cards);
const rack=r=>shape(r,['seat','tiles'])&&integer(r.seat,0,5)&&tileList(r.tiles);
const dice=d=>shape(d,['values','held'])&&
 Array.isArray(d.values)&&d.values.length>=1&&d.values.length<=8&&
 d.values.every(n=>integer(n,1,6))&&
 (d.held===undefined||Array.isArray(d.held)&&d.held.length===d.values.length&&
  d.held.every(x=>typeof x==='boolean'));
const scoreRow=r=>shape(r,['id','label','score'])&&text(r.id,40)&&text(r.label,80)&&
 (r.score===undefined||score(r.score));
const scoreColumn=c=>shape(c,['label','rows'])&&text(c.label,40)&&
 Array.isArray(c.rows)&&c.rows.length>=1&&c.rows.length<=32&&
 c.rows.every(scoreRow)&&unique(c.rows,x=>x.id);
const scorecard=c=>shape(c,['seat','columns'])&&integer(c.seat,0,5)&&
 Array.isArray(c.columns)&&c.columns.length>=1&&c.columns.length<=6&&
 c.columns.every(scoreColumn)&&unique(c.columns,x=>x.label)&&
 c.columns.every(col=>col.rows.length===c.columns[0].rows.length&&
  col.rows.every((row,i)=>row.id===c.columns[0].rows[i].id&&
   row.label===c.columns[0].rows[i].label));
const action=a=>shape(a,['id','label','reason'])&&text(a.id,40)&&
 /^[a-z][a-z0-9-]*$/.test(a.id)&&text(a.label,80)&&optionalText(a.reason,120);
const deck=d=>shape(d,['count','label'])&&count(d.count)&&optionalText(d.label);
const discard=d=>shape(d,['count','top'])&&count(d.count)&&
 (d.top===undefined||d.top===null||card(d.top))&&
 (d.count===0?!d.top:!d.top||d.count>0);
const PLAYER_KEYS=['name','score','team','controller','handCount','status'];
const validPlayer=p=>shape(p,PLAYER_KEYS)&&text(p.name,160)&&
 (p.score===undefined||score(p.score))&&
 (p.team===undefined||integer(p.team,0,5))&&
 (p.controller===undefined||['human','bot'].includes(p.controller))&&
 (p.handCount===undefined||count(p.handCount))&&optionalText(p.status,50);

export function validTabletopProjection(view){
 // The caller MUST first verify identity/game/version and authorize the
 // per-seat server projection. "verified" alone is not an auth credential.
 if(!view||view.verified!==true||view.source!=='qualified-account-games'||
  view.phase!=='active'||!Array.isArray(view.players)||view.players.length<2||
  view.players.length>6||!view.players.every(validPlayer))return false;
 const t=view.tabletop;
 if(!shape(t,['deck','discard','hand','rack','board','dice','scorecards','controls','turnSeat']))return false;
 const n=view.players.length;
 if(t.turnSeat!==undefined&&!seatIndex(t.turnSeat,n))return false;
 if(t.deck!==undefined&&!deck(t.deck))return false;
 if(t.discard!==undefined&&!discard(t.discard))return false;
 if(t.hand!==undefined&&(!cards(t.hand)||!seatIndex(view.viewerSeat,n)||
   t.hand.seat!==view.viewerSeat))return false;
 if(t.rack!==undefined&&(!rack(t.rack)||!seatIndex(view.viewerSeat,n)||
   t.rack.seat!==view.viewerSeat))return false;
 if(t.board!==undefined&&!board(t.board))return false;
 if(t.dice!==undefined&&!dice(t.dice))return false;
 if(t.scorecards!==undefined&&(!Array.isArray(t.scorecards)||t.scorecards.length>n||
   !t.scorecards.every(c=>scorecard(c)&&seatIndex(c.seat,n))||
   !unique(t.scorecards,c=>c.seat)))return false;
 if(t.controls!==undefined&&(!filled(t.controls,24,action)||
   !unique(t.controls,x=>x.id)))return false;
 return true;
}
const panel=(title,body,extra='')=>'<section class="game-kit__panel'+extra+'" aria-label="'+esc(title)+'"><h4>'+esc(title)+'</h4>'+body+'</section>';
const cardFace=c=>'<span class="game-kit__card-face'+
 (c.suit==='hearts'||c.suit==='diamonds'?' game-kit__card-face--red':'')+
 '" aria-label="'+esc(c.label)+'"><strong>'+esc(c.label)+'</strong>'+
 (c.suit?'<span aria-hidden="true">'+TABLETOP_SUITS[c.suit]+'</span>':'')+'</span>';
export function renderCardDeck(d){
 if(!deck(d))return '';
 return panel(d.label??'Draw deck','<div class="game-kit__deck" aria-label="'+esc(d.count+' cards remaining')+
 '"><span class="game-kit__card-back" aria-hidden="true">BG</span><span>'+d.count+' remaining</span></div>');
}
export function renderCardDiscard(d){
 if(!discard(d))return '';
 return panel('Discard pile','<div class="game-kit__discard">'+
 (d.top?cardFace(d.top):'<span>Empty pile</span>')+
 '<span>'+d.count+' discarded</span></div>');
}
export function renderCardHand(h){
 if(!cards(h))return '';
 return panel('Your cards','<ol class="game-kit__hand" aria-label="Your private hand">'+
 h.cards.map(c=>'<li>'+cardFace(c)+'</li>').join('')+'</ol>',' game-kit__panel--private');
}
export function renderTileRack(r){
 if(!rack(r))return '';
 return panel('Your tile rack','<ol class="game-kit__rack" aria-label="Your private tile rack">'+
 r.tiles.map(t=>'<li><span class="game-kit__tile" aria-label="'+esc(t.blank?'Blank tile':t.letter+', '+t.points+' points')+
 '"><strong>'+esc(t.letter)+'</strong><small>'+t.points+'</small></span></li>').join('')+
 '</ol>',' game-kit__panel--private');
}
export function renderPieceBoard(b){
 if(!board(b))return '';
 const pieces=new Map(b.pieces.map(x=>[x.row+':'+x.column,x.piece]));
 const cells=Array.from({length:b.rows},(_,row)=>
  '<div role="row">'+Array.from({length:b.columns},(_,column)=>{
   const p=pieces.get(row+':'+column);
   const glyph=p?TABLETOP_PIECES[p.family][p.side][p.kind]:'';
   const accessible='Row '+(row+1)+', column '+(column+1)+(p?', '+(p.label??p.side+' '+p.kind):', empty');
   return '<span role="gridcell" class="game-kit__square'+((row+column)%2?' game-kit__square--dark':'')+
    '" aria-label="'+esc(accessible)+'">'+(p?'<span aria-hidden="true">'+glyph+'</span>':'')+'</span>';
  }).join('')+'</div>').join('');
 return panel(b.family==='chess'?'Chess board':b.family==='checkers'?'Checkers board':'Go board',
  '<div class="game-kit__board-scroll"><div class="game-kit__board" role="grid" aria-label="'+
  esc(b.family+' board')+'" style="--game-kit-cols:'+b.columns+'">'+cells+'</div></div>');
}
export function renderDiceSet(d){
 if(!dice(d))return '';
 return panel('Dice','<ol class="game-kit__dice" aria-label="Dice values">'+
  d.values.map((value,i)=>'<li class="'+(d.held?.[i]?'game-kit__die--held':'')+
   '" aria-label="Die '+(i+1)+': '+value+(d.held?.[i]?', held':'')+'">'+
   '<span aria-hidden="true">'+TABLETOP_DICE[value]+'</span>'+
   (d.held?.[i]?'<small>Held</small>':'')+'</li>').join('')+'</ol>');
}
export function renderScorecards(c){
 if(!Array.isArray(c)||!c.every(scorecard))return '';
 return c.map(item=>panel('Seat '+(item.seat+1)+' scorecard',
  '<div class="game-kit__scorecard-scroll"><table class="game-kit__scorecard"><caption>Seat '+
  (item.seat+1)+' scorecard</caption><thead><tr><th scope="col">Category</th>'+
  item.columns.map((col,i)=>'<th scope="col">'+esc(col.label)+'</th>').join('')+'</tr></thead><tbody>'+
  item.columns[0].rows.map((row,i)=>'<tr><th scope="row">'+esc(row.label)+'</th>'+
   item.columns.map(col=>'<td>'+(
    col.rows[i]&&col.rows[i].id===row.id&&col.rows[i].score!=null?
    esc(col.rows[i].score.toLocaleString('en-CA')):'—')+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div>')).join('');
}
export function renderPlayerSeats(players,turnSeat){
 if(!Array.isArray(players)||players.length<2||players.length>6||
  !players.every(validPlayer))return '';
 return '<ol class="game-kit__seats" aria-label="Player seats">'+players.map((p,i)=>
  '<li class="game-kit__seat"'+(i===turnSeat?' aria-current="step"':'')+'>'+
  '<strong>Seat '+(i+1)+': '+esc(p.name)+'</strong>'+
  (p.controller?'<span>'+esc(p.controller==='bot'?'Computer':'Human')+'</span>':'')+
  (p.team===undefined?'':'<span>Team '+(p.team+1)+'</span>')+
  (p.handCount===undefined?'':'<span>'+p.handCount+' concealed card'+(p.handCount===1?'':'s')+'</span>')+
  (p.status?'<span>'+esc(p.status)+'</span>':'')+'</li>').join('')+'</ol>';
}
export function renderGameScoreboard(players){
 if(!Array.isArray(players)||players.length<2||players.length>6||
  !players.every(validPlayer))return '';
 return '<ol class="games-screen__scoreboard game-kit__scoreboard" aria-label="Current scores">'+
  players.map((p,i)=>'<li><span>Seat '+(i+1)+': '+esc(p.name)+'</span>'+
   (p.score==null?'':'<strong>'+p.score.toLocaleString('en-CA')+'</strong>')+'</li>').join('')+'</ol>';
}
export function renderTurnIndicator(players,seat,turn){
 if(!Array.isArray(players)||!players.every(validPlayer)||!text(turn,160))return '';
 if(seat!==undefined&&!seatIndex(seat,players.length))return '';
 return '<p class="game-kit__turn" role="status" aria-live="polite"><strong>Current turn:</strong> '+
 esc(turn)+(seat!==undefined?' · Seat '+(seat+1)+': '+esc(players[seat].name):'')+'</p>';
}
export function renderGameControls(actions=[]){
 if(!filled(actions,24,action)||!unique(actions,x=>x.id))return '';
 // BC-0.9 is presentation only. A qualified action dispatcher must bind
 // legal moves to server authority before any control can be activated.
 return panel('Game controls','<div class="game-kit__controls">'+
  (actions.length?actions.map(a=>'<button type="button" disabled aria-disabled="true" title="'+
   esc(a.reason??'Move submission not connected to an authoritative game')+'">'+esc(a.label)+'</button>').join(''):
   '<p>No actions available.</p>')+'</div>');
}
export function renderSharedTabletop(view){
 if(!validTabletopProjection(view))return '<div class="games-screen__empty" role="status"><strong>Tabletop projection unavailable</strong><p>Only an authorized, seat-safe game projection can display shared components.</p></div>';
 const t=view.tabletop;
 return '<div class="game-kit" aria-label="Verified reusable tabletop components">'+
  renderPlayerSeats(view.players,t.turnSeat)+
  (t.deck?renderCardDeck(t.deck):'')+
  (t.discard?renderCardDiscard(t.discard):'')+
  (t.board?renderPieceBoard(t.board):'')+
  (t.dice?renderDiceSet(t.dice):'')+
  (t.scorecards?renderScorecards(t.scorecards):'')+
  (t.hand?renderCardHand(t.hand):'')+
  (t.rack?renderTileRack(t.rack):'')+
  (t.controls?renderGameControls(t.controls):'')+'</div>';
}
