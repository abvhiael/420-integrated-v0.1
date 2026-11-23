// BC-2.4: seat-private Labyrinth Cribbage presentation. The 1254px wood
// board must be the supplied PNG. No synthetic board, scores or hidden cards.
import {escapeHtml as esc} from './design-system.js';
import {LABYRINTH_CRIBBAGE_TARGET,labyrinthCribbageVariant} from './labyrinth-cribbage-rules.js';
import {cribbageCardLabel} from './cribbage-session.js';

export const LABYRINTH_BOARD_SRC='/assets/games/labyrinth-cribbage/labyrinth.png';
export const LABYRINTH_BOARD_SIZE=Object.freeze({width:1254,height:1254});
export const LABYRINTH_MANIFEST_SHA='8391ad4de516f8767208e584b183ff618c209648767e6a92387cd177db41cc13';
export const LABYRINTH_RULES_VERSION='v2.0';
const VARIANTS=Object.freeze({
 2:'labyrinth-2p',3:'labyrinth-3p',
 4:'labyrinth-4p-partners'
});
const card=x=>Number.isSafeInteger(x)&&x>=0&&x<=51;
const number=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const unique=x=>new Set(x).size===x.length;
const states=new Set(['discard','cut','peg','finished']);
const moves=Object.freeze(['discard','cut','play','go']);
const safe=(x)=>x&&typeof x==='object'&&!Array.isArray(x);
const limited=(x,n=180)=>typeof x==='string'&&x.length<=n;
const noUnknown=(obj,keys)=>safe(obj)&&Object.keys(obj).every(x=>keys.includes(x));

export function verifyLabyrinthProjection(view){
 // Only the authenticated account-session adapter is permitted to produce
 // verified=true. This is a defensive schema/privacy gate, not auth itself.
 const fields=['verified','source','gameId','rulesVersion','manifestHash',
  'sessionId','sequence','status','seatCount','variant','viewerSeat','turnSeat',
  'dealer','round','phase','scores','hand','cardCounts','cribCount','discarded',
  'starter','pegCount','pegPile','pegged','saidGo','lastShow','lastAwards',
  'winnerSeat','losers','notice'];
 if(!noUnknown(view,fields)||view.verified!==true||
  view.source!=='qualified-account-games'||view.gameId!=='labyrinth-cribbage'||
  view.rulesVersion!==LABYRINTH_RULES_VERSION||
  view.manifestHash!==LABYRINTH_MANIFEST_SHA||
  !['active','finished'].includes(view.status)||
  !number(view.sequence,1,100000000)||!number(view.seatCount,2,4)||
  !number(view.viewerSeat,0,view.seatCount-1)||
  !number(view.dealer,0,view.seatCount-1)||!number(view.round,1,100000)||
  !states.has(view.phase)||!limited(view.sessionId,100)||!Array.isArray(view.scores)||
  view.scores.length!==view.seatCount||
  !view.scores.every(s=>number(s,0,10000))||
  !Array.isArray(view.hand)||view.hand.length>9||!view.hand.every(card)||!unique(view.hand)||
  !Array.isArray(view.cardCounts)||view.cardCounts.length!==view.seatCount||
  !view.cardCounts.every(x=>number(x,0,9))||
  !Array.isArray(view.discarded)||view.discarded.length!==view.seatCount||
  !view.discarded.every(x=>typeof x==='boolean')||
  !number(view.cribCount,0,6)||!number(view.starter,-1,51)||
  !number(view.pegCount,0,31)||
  !Array.isArray(view.pegPile)||view.pegPile.length>16||!view.pegPile.every(card)||
  !Array.isArray(view.pegged)||view.pegged.length!==view.seatCount||
  !view.pegged.every(p=>Array.isArray(p)&&p.length<=6&&p.every(card)&&unique(p))||
  !Array.isArray(view.saidGo)||view.saidGo.length!==view.seatCount||
  !view.saidGo.every(x=>typeof x==='boolean')||
  !Array.isArray(view.lastAwards)||view.lastAwards.length>32||
  !Array.isArray(view.lastShow)||view.lastShow.length>view.seatCount+1||
  !Array.isArray(view.losers)||view.losers.length>view.seatCount-1||
  !(view.winnerSeat===null||number(view.winnerSeat,0,view.seatCount-1))||
  !(view.turnSeat===null||number(view.turnSeat,0,view.seatCount-1))||
  (view.status==='active'&&view.scores.some(s=>s>=LABYRINTH_CRIBBAGE_TARGET))||
  (view.status==='active'&&(view.turnSeat===null||view.phase==='finished'))||
  (view.status==='finished'&&(view.phase!=='finished'||view.winnerSeat===null)))return null;
 let variant;
 try{variant=labyrinthCribbageVariant(view.seatCount,
  view.variant==='labyrinth-4p-individual'?'individual':'partnerships');}
 catch{return null}
 if(view.variant!==variant.id||view.cardCounts[view.viewerSeat]!==view.hand.length)return null;
 for(let i=0;i<variant.seatCount;i++)for(let j=i+1;j<variant.seatCount;j++)
  if(variant.teams[i]===variant.teams[j]&&view.scores[i]!==view.scores[j])return null;
 if(view.phase==='discard'&&(view.hand.length!==(view.discarded[view.viewerSeat]?6:variant.deal)||
  view.starter!==-1))return null;
 if(view.phase==='cut'&&(view.starter!==-1||view.hand.length!==6))return null;
 if(view.phase==='peg'&&(view.starter<0||view.hand.length>6))return null;
 if(view.lastShow.some(show=>!noUnknown(show,['seat','isCrib','cards','starter','score'])||
  !number(show.seat,0,view.seatCount-1)||typeof show.isCrib!=='boolean'||
  !Array.isArray(show.cards)||show.cards.length!==6||!show.cards.every(card)||
  !unique(show.cards)||!card(show.starter)||
  !safe(show.score)||!number(show.score.total,0,200)))return null;
 if(view.lastAwards.some(a=>!noUnknown(a,['seat','team','kind','points','count','total'])||
  !number(a.seat,0,view.seatCount-1)||a.team!==variant.teams[a.seat]||
  !number(a.points,1,150)||!number(a.total,0,10000)))return null;
 return Object.freeze({...view,scores:Object.freeze([...view.scores]),hand:Object.freeze([...view.hand])});
}

export function labyrinthLegalMoves(v){
 v=verifyLabyrinthProjection(v);
 if(!v||v.status!=='active'||v.turnSeat!==v.viewerSeat)return [];
 const variant=labyrinthCribbageVariant(v.seatCount,
  v.variant==='labyrinth-4p-individual'?'individual':'partnerships');
 if(v.phase==='cut')return [{type:'cut'}];
 if(v.phase==='discard'){
  const hand=v.hand,n=variant.discard,out=[];
  for(let i=0;i<hand.length;i++)
   for(let j=i+1;j<(n>=2?hand.length:i+2);j++)
    for(let k=j+1;k<(n>=3?hand.length:j+2);k++){
     const cards=n===1?[hand[i]]:n===2?[hand[i],hand[j]]:[hand[i],hand[j],hand[k]];
     out.push({type:'discard',cards});
    }
  return out;
 }
 if(v.phase==='peg'){
  const legal=v.hand.filter(c=>Math.min(10,c%13+1)+v.pegCount<=31)
   .map(c=>({type:'play',card:c}));
  return legal.length?legal:[{type:'go'}];
 }
 return [];
}

const cardFace=id=>'<span class="lab-card '+([1,2].includes(Math.floor(id/13))?'lab-card--red':'')+
 '">'+esc(cribbageCardLabel(id))+'</span>';
export function renderLabyrinthBoard({scores=[],teams=[],viewerSeat=0}={}){
 const parts=teams.length?teams.map((team,seat)=>({team,seat,score:scores[seat]})):[];
 const rows=parts.map(({team,seat,score})=>'<li class="lab-board-score'+
  (seat===viewerSeat?' lab-board-score--you':'')+'"><strong>'+
  (seat===viewerSeat?'You':'Seat '+(seat+1))+'</strong><span>'+
  esc(String(number(score,0,10000)?score:'—'))+' / '+LABYRINTH_CRIBBAGE_TARGET+
  '</span><small>Track '+(team+1)+'</small></li>').join('');
 return '<figure class="lab-board" aria-label="Original wood-slice Labyrinth Cribbage board">'+
  '<div class="lab-board-art"><img src="'+LABYRINTH_BOARD_SRC+
  '" width="1254" height="1254" alt="User-approved labyrinth wood-slice board with printed score guides, shown without alteration" loading="lazy" decoding="async">'+
  '<p hidden data-lab-art-missing role="status">The exact source board image is not installed on this deployment; no substitute artwork is shown.</p></div>'+
  '<figcaption>Approved original artwork · 325-point finish. Peg placement is withheld until the physical hole sequence is independently verified.</figcaption>'+
  '<ol class="lab-board-scores" aria-label="Authoritative scores">'+rows+'</ol></figure>';
}

const ruleContent='<p><strong>325 points to win.</strong> Six retained cards and a six-card crib. '+
 'Two players receive nine each and discard three; three receive eight and discard two; '+
 'four receive seven and discard one, with two additional crib cards dealt directly.</p>'+
 '<p>Four-player partnerships (opposite seats, shared points) is the default; four-player '+
 'individual scoring is also supported. The starter joins every six-card hand for the '+
 'seven-card show. Hands flush only with all six matching suits (six points), plus one '+
 'for a matching starter; a crib flush requires all seven cards matching (seven points). '+
 'Automatic pegging and counting, last card, Go and heels apply. First award to 325 wins.</p>';
const previewSetup='<fieldset disabled aria-disabled="true"><legend>Game configuration · release gated</legend>'+
 '<label>Players <select name="players"><option>2 players</option><option>3 players</option><option selected>4 players</option></select></label>'+
 '<label>Four-player format <select name="format"><option selected>Partnerships (default)</option><option>Individual free-for-all</option></select></label>'+
 '<label>Computer strength <select name="difficulty"><option>Easy</option><option selected>Medium</option><option>Hard</option></select></label>'+
 '<button type="button" disabled>Start a verified 325-point match</button></fieldset>';
export function renderLabyrinthScreen({screen='intro',view=null,selection=[],recoverable=[],sessionError=null}={}){
 const v=verifyLabyrinthProjection(view);
 const start='<section class="labyrinth-game" data-labyrinth-screen="'+esc(screen)+'"><header>'+
 '<h2>Labyrinth Cribbage</h2><p>325 points · original wood-slice labyrinth board</p></header>';
 const recovery=Array.isArray(recoverable)&&recoverable.length?'<nav aria-label="My Labyrinth games"><h3>My Games</h3><ol>'+recoverable.filter(m=>/^[0-9a-f-]{36}$/.test(m.id)).slice(0,25).map(m=>'<li><a href="/games/labyrinth-cribbage/play?session='+esc(m.id)+'" data-route="classic-game">Resume '+esc(m.status)+' match #'+esc(m.id.slice(0,8))+'</a></li>').join('')+'</ol></nav>':'';
 const error=sessionError?'<p role="alert">'+esc(String(sessionError).slice(0,160))+'</p>':'';
 const board=renderLabyrinthBoard({scores:v?.scores??[0,0],teams:v?
  labyrinthCribbageVariant(v.seatCount,v.variant==='labyrinth-4p-individual'?'individual':'partnerships').teams:
  [0,1],viewerSeat:v?.viewerSeat??0});
 if(screen==='intro')return start+'<p>Browse the approved board and rules. Live Play remains gated.</p>'+error+recovery+board+'</section>';
 if(screen==='rules')return start+'<section aria-label="325-point Labyrinth rules">'+ruleContent+'</section>'+board+'</section>';
 if(screen==='setup')return start+'<form class="labyrinth-setup">'+previewSetup+'</form>'+board+'</section>';
 if(screen==='play')return start+error+recovery+(v?renderLabyrinthTable({view:v,selection}):
  '<p role="status">No verified 420ID Labyrinth session. Do not expose a playable table or private cards.</p>')+'</section>';
 if(screen==='table')return start+error+recovery+(v?renderLabyrinthTable({view:v,selection}):
  '<p role="status">A server-authorized Labyrinth session is required to display a private hand.</p>')+'</section>';
 if(screen==='results')return start+(v?.status==='finished'?
  '<h3>Match complete · winner seat '+(v.winnerSeat+1)+'</h3>'+board:
  '<p>No verified finished Labyrinth match.</p>')+'</section>';
 return start+'<p>Verified history and rematches will appear with account-session activation.</p></section>';
}
export function renderLabyrinthTable({view,selection=[]}={}){
 const v=verifyLabyrinthProjection(view);
 if(!v)return '<p role="alert">Private Labyrinth view is unverified.</p>';
 const variant=labyrinthCribbageVariant(v.seatCount,
  v.variant==='labyrinth-4p-individual'?'individual':'partnerships');
 const selected=new Set(selection.filter(card));
 const turn=v.status==='active'&&v.turnSeat===v.viewerSeat;
 const count=variant.discard,canPlay=labyrinthLegalMoves(v);
 const playable=new Set(canPlay.filter(m=>m.type==='play').map(m=>m.card));
 const discards=v.hand.filter(c=>selected.has(c));
 const discard=canPlay.some(m=>m.type==='discard'&&JSON.stringify(m.cards)===JSON.stringify(discards));
 const cardButtons=v.hand.map(c=>'<button type="button" data-lab-card="'+c+
  '" aria-pressed="'+(selected.has(c)?'true':'false')+'"'+
  (!turn||v.phase==='peg'&&!playable.has(c)?' disabled':'')+'>'+cardFace(c)+'</button>').join('');
 const action=v.phase==='discard'?'<button type="button" data-lab-action="discard"'+
  (discard?'':' disabled')+'>Send '+count+' card'+(count===1?'':'s')+' to crib</button>':
  v.phase==='peg'?'<button type="button" data-lab-action="play"'+
  (!(turn&&selected.size===1&&playable.has([...selected][0]))?' disabled':'')+'>Play selected card</button>'+
  (canPlay.some(m=>m.type==='go')?'<button type="button" data-lab-action="go">Say Go</button>':''):
  v.phase==='cut'&&turn?'<button type="button" data-lab-action="cut">Cut starter</button>':'';
 const seats=v.cardCounts.map((count,i)=>'<li>'+esc(i===v.viewerSeat?'You':'Player '+(i+1))+
  ' · '+count+' concealed/retained · Team '+(variant.teams[i]+1)+
  (i===v.dealer?' · dealer':'')+'</li>').join('');
 const cards=v.pegPile.map(cardFace).join('');
 return '<div class="lab-table"><div class="lab-table-main">'+
  '<p role="status">Round '+v.round+' · '+esc(v.phase)+' · '+(turn?'Your turn':'Waiting for seat '+((v.turnSeat??0)+1))+'</p>'+
  '<ol aria-label="Player seats">'+seats+'</ol>'+
  '<section aria-label="Public pegging count"><h3>Count '+v.pegCount+' / 31</h3><div>'+cards+'</div>'+
  '<p>Starter: '+(v.starter<0?'Face down':cardFace(v.starter))+
  ' · Crib '+v.cribCount+' face-down cards</p></section>'+
  '<section aria-label="Your private hand"><h3>Your hand · '+v.hand.length+' cards</h3>'+
  '<div class="lab-cards">'+cardButtons+'</div><div class="lab-actions">'+action+
  (selected.size?'<button type="button" data-lab-action="clear">Clear selection</button>':'')+
  '</div></section></div>'+renderLabyrinthBoard({scores:v.scores,teams:variant.teams,viewerSeat:v.viewerSeat})+'</div>';
}
// A binding is inert without a caller-provided authenticated action transport.
// Do not synthesize a game action locally or update scores optimistically.
export function bindLabyrinthTable(root,{view,selection=[],onSelection=()=>{},onMove=null}={}){
 const v=verifyLabyrinthProjection(view);if(!v)return;
 const choose=id=>{
  if(!v.hand.includes(id)||v.turnSeat!==v.viewerSeat)return;
  const next=new Set(selection.filter(card));
  if(next.has(id))next.delete(id);else if(v.phase==='peg'){next.clear();next.add(id)
  }else if(v.phase==='discard'){
   const n=labyrinthCribbageVariant(v.seatCount,v.variant==='labyrinth-4p-individual'?'individual':'partnerships').discard;
   if(next.size>=n)return;
   next.add(id);
  }
  onSelection([...next]);
 };
 for(const b of root.querySelectorAll('[data-lab-card]'))
  b.addEventListener('click',()=>choose(Number(b.dataset.labCard)));
 for(const b of root.querySelectorAll('[data-lab-action]'))b.addEventListener('click',()=>{
  const kind=b.dataset.labAction;
  if(kind==='clear'){onSelection([]);return}
  if(typeof onMove!=='function')return;
  let move;
  if(kind==='discard')move={type:'discard',cards:v.hand.filter(c=>selection.includes(c))};
  if(kind==='play')move={type:'play',card:selection[0]};
  if(kind==='cut')move={type:'cut'};
  if(kind==='go')move={type:'go'};
  if(move&&labyrinthLegalMoves(v).some(m=>JSON.stringify(m)===JSON.stringify(move)))
   void onMove(move);
 });
}
