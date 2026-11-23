// BC-0.3: reusable, inert-by-default presentation for game engines and account sessions.
// This module does not authenticate a caller or assert an outcome. Only an upstream,
// independently authorized service adapter may supply a verified per-seat view.
import {escapeHtml as esc} from './design-system.js';
import {renderGameScoreboard,renderTurnIndicator,renderSharedTabletop} from './tabletop-components.js';
import {renderLabyrinthScreen} from './labyrinth-cribbage-ui.js';
import {renderLabyrinthSocial} from './labyrinth-social.js';

export const GAME_SCREEN_IDS=Object.freeze(['intro','rules','play','setup','table','results','history','rematch']);
export const GAME_SUBSCREENS=Object.freeze(GAME_SCREEN_IDS.filter(id=>id!=='intro'));
const HEADINGS=Object.freeze({intro:'Overview',rules:'Rules',play:'Play',setup:'Opponents',table:'Game table',
 results:'Results',history:'History',rematch:'Rematch'});
const VARIANTS=Object.freeze({
 yahtzee:Object.freeze(['1 full scoring row','2 full scoring rows','3 full scoring rows','6 full scoring rows']),
 go:Object.freeze(['9×9 board','13×13 board','19×19 board']),
 'labyrinth-cribbage':Object.freeze(['Two-player individual (9 dealt, discard 3)','Three-player individual (8 dealt, discard 2)','Four-player partnerships (default)','Four-player individual free-for-all']),
 mahjong:Object.freeze(['Traditional four-player Mahjong; regional ruleset pending'])
});
const MAX_PLAYERS=6,MAX_MOVES=40;
const limited=(value,fallback='')=>typeof value==='string'&&value.length<=160?value:fallback;
const numeric=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const link=(game,screen)=>'/games/'+game.id+(screen==='intro'?'':'/'+screen);
const blockedButton=(name,reason)=>'<button type="button" disabled aria-disabled="true" title="'+esc(reason)+'">'+esc(name)+'</button>';
const notice=(title,message)=>'<div class="games-screen__empty" role="status"><strong>'+esc(title)+'</strong><p>'+esc(message)+'</p></div>';
const section=(heading,inner)=>'<section class="games-screen__panel" aria-label="'+esc(heading)+'"><h3>'+esc(heading)+'</h3>'+inner+'</section>';

export function authorizedGameView(game,view){
 // A UI projection is not an authorization token; the calling adapter must
 // authenticate the 420ID subject, validate seat visibility and avoid hidden cards.
 if(!game||!view||view.verified!==true||view.source!=='qualified-account-games'||view.gameId!==game.id||
    !['active','finished'].includes(view.phase)||!Array.isArray(view.players)||
    view.players.length<2||view.players.length>MAX_PLAYERS)return null;
 if(!view.players.every(p=>p&&typeof p==='object'&&limited(p.name).length>0&&
   (p.score==null||numeric(p.score,-10000000,10000000))))return null;
 return view;
}
function nav(game,screen){
 return '<nav class="games-screen__nav" aria-label="'+esc(game.title)+' screens">'+GAME_SCREEN_IDS.map(id=>
  '<a href="'+esc(link(game,id))+'" data-route="classic-game" aria-current="'+(id===screen?'page':'false')+'">'+
  esc(HEADINGS[id])+'</a>').join('')+'</nav>';
}
function intro(game){
 return section('Introduction','<p>'+esc(limited(game.description,'A traditional social game.'))+'</p>'+
 '<p>Each game will support human opponents and Easy, Medium and Hard computer seats after its rules and game service have been qualified.</p>'+
 '<p class="games-screen__footnote">This introduction does not open a match. Browse the rules, opponent setup and other screens to see the common game experience.</p>');
}
function rules(game,view){
 const variants=VARIANTS[game.id]??[];
 const title=limited(view?.rulebook?.title);
 const paragraphs=Array.isArray(view?.rulebook?.paragraphs)?view.rulebook.paragraphs:[];
 const verified=Boolean(view&&view.rulebook?.verified===true&&paragraphs.length>0&&
   paragraphs.length<=20&&paragraphs.every(p=>typeof p==='string'&&p.length>0&&p.length<=800));
 const content=verified?'<p class="games-screen__meta">Verified rulebook: '+esc(title||'Game rules')+'</p>'+
  '<ol class="games-screen__rules">'+paragraphs.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ol>':
  game.id==='labyrinth-cribbage'?notice('BC-2.1 rules documented; play not qualified',
    'Labyrinth Cribbage: 325 points, six retained cards and six-card crib. Four-player partnerships (default) or individual scoring; live matches are not yet enabled.'):
  notice('Ruleset not yet published','Game-specific rules and scoring must be versioned and verified before play is enabled.');
 return section('Rules & variants','<p class="games-screen__meta">'+
  (view&&limited(view.variant)?'Active variant: '+esc(limited(view.variant)):
    'Active variant: not selected — no verified match')+'</p>'+content+(variants.length?'<h4>Planned configuration</h4><ul>'+
  variants.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':'')+
  '<p class="games-screen__footnote">Rules and regional variants are fixed per match. A catalogue description is not a complete rulebook.</p>');
}
function setup(game){
 const seats=game.players==='2' ? 2 : game.players==='4' ? 4 : 4;
 const countOptions=[2,3,4].map(n=>'<option value="'+n+'"'+(n===seats?' selected':'')+'>'+n+'</option>').join('');
 const seat=(i)=>'<div class="games-screen__seat"><h4>Seat '+i+'</h4>'+
  '<label>Opponent type <select name="seat-'+i+'-type"><option>Human</option><option>Computer</option></select></label>'+
  '<label>Computer difficulty <select name="seat-'+i+'-difficulty"><option>Easy</option><option selected>Medium</option><option>Hard</option></select></label></div>';
 return section('Opponent setup','<p>Choose human or computer seats, with per-computer difficulty. Seat configuration is not available until the match service and individual game rules are qualified.</p>'+
  '<form class="games-screen__setup"><fieldset disabled><legend>New game — not yet available</legend>'+
  '<label>Players <select name="players">'+countOptions+'</select></label>'+
  '<div class="games-screen__seats">'+Array.from({length:seats},(_,i)=>seat(i+1)).join('')+'</div>'+
  '<label>Ruleset <select name="ruleset"><option>Pending qualified ruleset</option></select></label>'+
  blockedButton('Create game','Qualified server-side match creation is not available')+
  '</fieldset></form><p class="games-screen__footnote">No account is invited, no bot is started and no game data is saved from this preview.</p>');
}
function play(game){
 const local=game.status==='local';
 return section('Play','<p>'+(local?
  'Cross-Country Chaos already has a separate working local pass-and-play experience.':
  'New games require a qualified rules engine, session authority and opponent service.')+'</p>'+
  (local?'<a class="games-screen__play-link" href="/classics/cross-country-chaos" data-route="chaos-game">Play Cross-Country Chaos (local)</a>':
  blockedButton('Play','Game-specific play is not yet enabled')+
  blockedButton('Resume game','No qualified persisted match service is connected'))+
  '<p><a href="'+esc(link(game,'setup'))+'" data-route="classic-game">View opponent setup</a></p>');
}
function players(view){
 return view.players.map((p,index)=>'<li><span>Seat '+(index+1)+': '+esc(limited(p.name,'Player'))+'</span>'+
  (p.score==null?'':'<strong>'+p.score.toLocaleString('en-CA')+'</strong>')+'</li>').join('');
}
function publicTable(view){
 const grid=view?.table?.cells;
 const valid=Array.isArray(grid)&&grid.length>=1&&grid.length<=19&&
  grid.every(row=>Array.isArray(row)&&row.length===grid[0].length&&row.length>=1&&row.length<=19&&
   row.every(cell=>typeof cell==='string'&&cell.length<=36));
 if(!valid)return notice('Table projection unavailable','The game engine has not supplied a verified public board or tabletop view.');
 return '<div class="games-screen__table-grid" role="grid" aria-label="Verified public game board" style="--game-cols:'+grid[0].length+'">'+
  grid.map((row,i)=>'<div role="row">'+row.map((cell,j)=>'<span role="gridcell" aria-label="'+
  esc('Row '+(i+1)+', column '+(j+1)+(cell?', '+cell:''))+'">'+esc(cell||'·')+'</span>').join('')+'</div>').join('')+'</div>';
}
function table(game,view){
 if(!view||view.phase!=='active')return section('Game table',notice('No verified active table',
  'A real board, turn and score display will appear only after an authorized match is loaded.'));
 return section('Game table','<p class="games-screen__meta">Verified active game · '+esc(limited(view.turn,'Turn information unavailable'))+'</p>'+
  renderTurnIndicator(view.players,view.tabletop?.turnSeat,view.turn)+
  renderGameScoreboard(view.players)+(view.tabletop===undefined?publicTable(view):renderSharedTabletop(view))+
  '<p class="games-screen__footnote">Only server-authorized public state and this participant\'s own private projection are rendered. Hidden opponents\' hands and engine state must never be sent to the browser. Controls remain disabled until an authoritative game action transport is connected.</p>');
}
function results(view){
 if(!view||view.phase!=='finished')return section('Results',notice('No verified results',
  'Final scores and the winner are displayed only after the game service reports a completed match.'));
 return section('Results','<p class="games-screen__meta">Verified finished game</p>'+
  '<p>Winner: <strong>'+esc(limited(view.winner,'Not determined'))+'</strong></p>'+
  '<ol class="games-screen__scoreboard">'+players(view)+'</ol>');
}
function history(view){
 const entries=Array.isArray(view?.history)?view.history:[];
 if(!view||entries.length===0)return section('History',notice('No verified match history',
  'Moves and past matches are not generated locally. An authorized game service supplies these records.'));
 const items=entries.slice(-MAX_MOVES).filter(x=>x&&typeof x==='object'&&
   numeric(x.sequence,1,100000000)&&limited(x.summary).length>0);
 return section('History','<ol class="games-screen__history">'+items.map(x=>
  '<li><span>Move '+x.sequence+'</span> '+esc(limited(x.summary))+'</li>').join('')+'</ol>'+
  (entries.length>MAX_MOVES?'<p class="games-screen__footnote">Showing the latest available page; history pagination requires the game service.</p>':''));
}
function rematch(view){
 return section('Rematch','<p>'+(view?.phase==='finished'?
  'A verified match has finished. Rematch creation requires a fresh invitation and the current participant policies.':
  'Finish a verified match before requesting a rematch.')+'</p>'+
  blockedButton('Request rematch','Rematch invitations are not connected to an authorized service')+
  '<p><a href="/games" data-route="games">Back to Games</a></p>');
}
export function renderSharedGameScreen({game,screen='intro',view=null,labyrinthState=null}={}){
 if(!game||typeof game.id!=='string'||!GAME_SCREEN_IDS.includes(screen))throw new Error('Unsupported game screen');
 // The 325-point Labyrinth has a separate private-seat schema and original
 // approved board; never render it on the standard 121-point leaf board.
 if(game.id==='labyrinth-cribbage')return '<div class="games-screen" data-game-screen="'+esc(screen)+'">'+
  nav(game,screen)+renderLabyrinthScreen({screen,view:labyrinthState?.view??view,session:labyrinthState?.session??null,selection:labyrinthState?.selection??[],recoverable:labyrinthState?.recoverable??[],sessionError:labyrinthState?.error??null})+
  (['history','rematch','results'].includes(screen)?renderLabyrinthSocial(labyrinthState?.social):'')+'</div>';
 const authorized=authorizedGameView(game,view);
 const screens={intro,rules,play,setup,table,results,history,rematch};
 const body=screen==='rules'?rules(game,authorized):screen==='play'?play(game):
  screen==='setup'?setup(game):screen==='table'?table(game,authorized):
  screen==='results'?results(authorized):screen==='history'?history(authorized):
  screen==='rematch'?rematch(authorized):intro(game);
 return '<div class="games-screen" data-game-screen="'+esc(screen)+'">'+nav(game,screen)+body+'</div>';
}
