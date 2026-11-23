import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderSharedGameScreen} from '../core/shared-game-ui.js';
import {classicGameById} from '../core/classics.js';
import {verifyLabyrinthProjection,labyrinthLegalMoves,renderLabyrinthScreen,
 renderLabyrinthTable,renderLabyrinthBoard,bindLabyrinthTable,
 LABYRINTH_BOARD_SRC,LABYRINTH_MANIFEST_SHA,LABYRINTH_RULES_VERSION} from '../core/labyrinth-cribbage-ui.js';
import {LABYRINTH_HOLE_CENTERS,LABYRINTH_HOLE_COUNT,LABYRINTH_BOARD_SHA256} from '../core/labyrinth-hole-survey.js';
import {LABYRINTH_CRIBBAGE_TARGET} from '../core/labyrinth-cribbage-rules.js';
import {renderClassicRooms} from '../core/classic-rooms.js';

const cards=(count)=>Array.from({length:count},(_,i)=>i+1);
const config={2:{id:'labyrinth-2p',deal:9,discard:3,crib:0},
 3:{id:'labyrinth-3p',deal:8,discard:2,crib:0},
 4:{id:'labyrinth-4p-partners',deal:7,discard:1,crib:2}};
function signedView(n=2,phase='discard',variant=config[n].id){
 const v=config[n],hand=cards(phase==='discard'?v.deal:6),
 teams=variant==='labyrinth-4p-partners'?[0,1,0,1]:Array.from({length:n},(_,i)=>i);
 return {verified:true,source:'qualified-account-games',gameId:'labyrinth-cribbage',
 rulesVersion:LABYRINTH_RULES_VERSION,manifestHash:LABYRINTH_MANIFEST_SHA,
 sessionId:'00000000-1111-4111-8111-111111111111',sequence:1,status:'active',
 seatCount:n,variant,viewerSeat:0,turnSeat:0,dealer:1,round:1,phase,
 scores:teams.map(()=>0),hand,cardCounts:teams.map((_,i)=>i===0?hand.length:v.deal),
 cribCount:v.crib,discarded:teams.map(()=>phase!=='discard'),starter:phase==='peg'?37:-1,
 pegCount:0,pegPile:[],pegged:teams.map(()=>[]),
 saidGo:teams.map(()=>false),lastShow:[],lastAwards:[],winnerSeat:null,losers:[]};
}
test('BC-2.4 separates 325 rules and authentic user-art path from the 121-point board',async()=>{
 assert.equal(LABYRINTH_CRIBBAGE_TARGET,325);
 assert.equal(LABYRINTH_RULES_VERSION,'v2.0');
 assert.match(LABYRINTH_MANIFEST_SHA,/^[0-9a-f]{64}$/);
 assert.equal(LABYRINTH_BOARD_SRC,'/assets/games/labyrinth-cribbage/labyrinth.png');
 assert.equal(LABYRINTH_BOARD_SHA256,'4634051491e6bcadec3f7e065ed61b8cbf92ca4ef3f3f488da1811730f91f5f5');
 const manifest=JSON.parse(await readFile(new URL('../../../docs/games/classics/BC-2-1-LABYRINTH-CRIBBAGE-VARIANTS.json',import.meta.url),'utf8'));
 assert.equal(manifest.board.scoringHolesPerRun,324);
 assert.equal(manifest.board.finishHole,325);
 assert.equal(manifest.targetScore,325);
 assert.equal(manifest.rulesetVersion,'2.0.0');
 assert.equal(manifest.board.physicalArtworkHoleCenters,652);
 const source=await readFile(new URL('../core/cribbage-board.js',import.meta.url),'utf8');
 assert.match(source,/121/); // independent frozen standard Cribbage
 const html=renderSharedGameScreen({game:classicGameById('labyrinth-cribbage'),screen:'rules'});
 assert.match(html,/325 points to win/);
 assert.match(html,/Six retained cards/);
 assert.match(html,/labyrinth.png/);
 assert.doesNotMatch(html,/leaf-board.svg|data-lab-card|data-lab-action="play"/);
});
test('BC-2.4 retains all 652 actual source-image hole centers without inventing ordered scores',()=>{
 assert.equal(LABYRINTH_HOLE_COUNT,652);
 assert.equal(LABYRINTH_HOLE_CENTERS.length,652);
 const unique=new Set(LABYRINTH_HOLE_CENTERS.map(({x,y})=>x+','+y));
 assert.equal(unique.size,652);
 for(const {x,y} of LABYRINTH_HOLE_CENTERS){
  assert.ok(Number.isInteger(x)&&x>=0&&x<1254&&Number.isInteger(y)&&y>=0&&y<1254);
 }
 assert.deepEqual(LABYRINTH_HOLE_CENTERS[0],{x:607,y:134});
 assert.deepEqual(LABYRINTH_HOLE_CENTERS.at(-1),{x:650,y:1022});
 // A source-coordinate survey is not numerical peg order, so no score -> hole function.
 const board=renderLabyrinthBoard({scores:[0,324],teams:[0,1]});
 assert.match(board,/325-point finish/);
 assert.doesNotMatch(board,/data-peg-hole|data-scored-hole/);
 assert.match(board,/Peg placement is withheld until/);
});
test('BC-2.4 formats generate exact authoritative discard combinations and private hands',()=>{
 for(const n of [2,3,4]){
  const v=signedView(n);
  assert.ok(verifyLabyrinthProjection(v));
  assert.equal(labyrinthLegalMoves(v).length,n===2?84:n===3?28:7);
  for(const move of labyrinthLegalMoves(v)){
   assert.equal(move.cards.length,config[n].discard);
   assert.equal(new Set(move.cards).size,config[n].discard);
   assert.ok(move.cards.every(c=>v.hand.includes(c)));
  }
  const table=renderLabyrinthTable({view:v});
  assert.match(table,/<section aria-label="Your private hand">/);
  assert.match(table,RegExp('Send '+config[n].discard+' card'));
  assert.doesNotMatch(table,/opponentHand|allHands|engineState|data-lab-action="play"/);
  assert.match(table,/\/ 325/);
 }
 const partners=signedView(4);
 partners.scores=[21,12,21,12];
 assert.ok(verifyLabyrinthProjection(partners));
 partners.scores=[21,12,20,12];
 assert.equal(verifyLabyrinthProjection(partners),null,'shared partner score cannot diverge');
 const solo=signedView(4,'discard','labyrinth-4p-individual');
 solo.scores=[21,12,20,7];
 assert.ok(verifyLabyrinthProjection(solo),'four individual scores remain independent');
});
test('BC-2.4 explicit Play selected card, 31/Go/cut and no unauthorized action callback',()=>{
 const v=signedView(2,'peg');v.hand=[5,9,12,21,30,31];v.cardCounts[0]=v.hand.length;v.pegCount=23;
 let moves=labyrinthLegalMoves(v);
 assert.equal(moves.length,v.hand.filter(c=>Math.min(10,c%13+1)+23<=31).length);
 assert.ok(verifyLabyrinthProjection(v));
 let html=renderLabyrinthTable({view:v,selection:[9]});
 assert.match(html,/data-lab-action="play"/);
 assert.match(html,/Play selected card/);
 assert.match(html,/data-lab-action="play" disabled/,'invalid selected peg does not authorize action');
 const good=moves[0]?.card;
 if(good!==undefined)assert.doesNotMatch(renderLabyrinthTable({view:v,selection:[good]}),/data-lab-action="play" disabled/);
 const blocked=signedView(2,'peg');blocked.hand=[9,10,11,22,23,24];blocked.cardCounts[0]=6;blocked.pegCount=27;
 assert.deepEqual(labyrinthLegalMoves(blocked),[{type:'go'}]);
 assert.match(renderLabyrinthTable({view:blocked}),/data-lab-action="go"/);
 const cut=signedView(2,'cut');
 assert.deepEqual(labyrinthLegalMoves(cut),[{type:'cut'}]);
 const btn=[];
 const root={querySelectorAll:()=>btn};
 let called=false;bindLabyrinthTable(root,{view:v,onMove:()=>{called=true}});
 assert.equal(called,false,'without DOM and trusted user click, never send action');
});
test('BC-2.4 fail-closed privacy, game version and view gating',()=>{
 const good=signedView(2);assert.ok(verifyLabyrinthProjection(good));
 for(const secret of ['deck','crib','seed','engineState','allHands','opponentHand','rulesHash']){
  assert.equal(verifyLabyrinthProjection({...good,[secret]:[2,6]}),null,secret);
 }
 assert.equal(verifyLabyrinthProjection({...good,rulesVersion:'v1.0'}),null);
 assert.equal(verifyLabyrinthProjection({...good,manifestHash:'0'.repeat(64)}),null);
 assert.equal(verifyLabyrinthProjection({...good,source:'client-local'}),null);
 assert.equal(verifyLabyrinthProjection({...good,verified:false}),null);
 assert.equal(verifyLabyrinthProjection({...good,status:'active',scores:[325,2]}),null);
 const blank=renderLabyrinthScreen({screen:'table'});
 assert.match(blank,/server-authorized Labyrinth session is required/);
 assert.doesNotMatch(blank,/data-lab-card|data-lab-action="play"/);
});
test('BC-2.4 CSS and room format controls exist and do not accidentally activate public Play',async()=>{
 const css=await readFile(new URL('../labyrinth.css',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(css,/aspect-ratio:1/);
 assert.match(css,/@media\(max-width:900px\)/);
 assert.match(html,/href="\/labyrinth.css"/);
 const room=await readFile(new URL('../core/classic-rooms.js',import.meta.url),'utf8');
 const bindings=await readFile(new URL('../core/classic-room-bindings.js',import.meta.url),'utf8');
 assert.match(room,/Labyrinth four-player scoring/);
 assert.match(room,/Partnerships \(default\)/);
 assert.match(bindings,/data-labyrinth-room-format/);
 assert.match(bindings,/format:data.get\('gameId'\)==='labyrinth-cribbage'/);
 assert.match(renderLabyrinthScreen({screen:'setup'}),/<fieldset disabled/);
 assert.match(renderLabyrinthScreen({screen:'play'}),/No verified 420ID Labyrinth session/);
});

test('BC-2.4 room deep link reopens the exact authorized Labyrinth match, not a standard Cribbage route',()=>{
 const id='30000000-3333-4333-8333-333333333333';
 const host='10000000-1111-4111-8111-111111111111';
 const match='40000000-4444-4444-8444-444444444444';
 const room={id,host,gameId:'labyrinth-cribbage',seatCount:4,visibility:'private',
  status:'in_game',revision:3,variantId:'labyrinth-4p-partners',
  seats:[0,1,2,3].map(i=>({index:i,controller:i===0?'human':'bot',team:i%2,
    subject:i===0?host:'',difficulty:i===0?'':'medium'})),invites:[]};
 const state={status:'ready',viewer:host,selected:room,rooms:[room],friends:[],notice:''};
 const live={status:'connected',room:{id},session:{id:match,roomId:id,gameId:'labyrinth-cribbage',
  status:'active',sequence:9,turnSeat:0,viewerSeat:0},presence:{seats:[{seat:0,online:true}]}};
 const html=renderClassicRooms(state,{enabled:true,roomId:id,live});
 assert.match(html,RegExp('/games/labyrinth-cribbage/play\\?session='+match));
 assert.match(html,/Resume your private Labyrinth table/);
 assert.doesNotMatch(html,/Open your private Cribbage table/);
 const forged=renderClassicRooms(state,{enabled:true,roomId:id,live:{...live,
  session:{...live.session,roomId:'50000000-5555-4555-8555-555555555555'}}});
 assert.doesNotMatch(forged,/Resume your private Labyrinth table/);
});
