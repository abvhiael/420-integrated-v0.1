import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame,takeChaosTurn,chaosActionOptions} from '../core/cross-country-chaos.js';
import {configureChaosComputerSeats} from '../core/chaos-computer.js';
import {renderChaosGame,renderClassicsRoute} from '../core/classics-ui.js';
import {renderApplicationShell} from '../core/app-shell.js';

const route='/classics/cross-country-chaos/practice';
const make=()=>configureChaosComputerSeats(createChaosGame({names:['Alice','CPU Driver'],seed:1972}),['human','normal']);
const page=(game,revealed=false)=>renderClassicsRoute({pathname:route,game,revealed});

test('solo gameplay uses multiplayer map/table/deck/private hand hierarchy and approved road art',()=>{
 const game=make(),html=page(game,true);
 for(const name of ['ccc-online--practice','ccc-online-game','ccc-online-stage','ccc-online-track',
  'ccc-online-map','ccc-online-middle','ccc-online-tables','ccc-online-decks',
  'ccc-online-hand','ccc-practice-card-list','ccc-practice-radio'])
  assert.ok(html.includes(name),'missing shared layout: '+name);
 assert.ok(html.indexOf('ccc-online-track')<html.indexOf('ccc-online-middle'));
 assert.ok(html.indexOf('ccc-online-middle')<html.indexOf('ccc-online-hand'));
 assert.match(html,/east-atlas-underlay\.webp/);
 assert.equal((html.match(/class="ccc-map-vehicle ccc-map-vehicle--/g)||[]).length,2);
 assert.match(html,/Your private hand/);
 assert.match(html,/Roadside radio/);
 assert.match(html,/Solo practice · local game events, not multiplayer chat/);
 assert.doesNotMatch(html,/Your communities|Upcoming events|Discover people|data-chaos-online-chat/);
 assert.doesNotMatch(html,/ccc-seat-mat|class="ccc-tabletop|data-chaos-online-action=/);
 assert.deepEqual(game,make(),'rendering must not mutate the engine');
});

test('hidden cards stay hidden at every pass-device/recovery and computer turn',()=>{
 const game=make();
 game.players[0].hand[0]={type:'fix',id:'help',category:'all',uid:12345,name:'HUMAN_SECRET_MARKER'};
 game.players[1].hand[0]={type:'fix',id:'help',category:'all',uid:12346,name:'CPU_SECRET_MARKER'};
 let html=page(game,false);
 assert.match(html,/Pass the device to Alice/);
 assert.match(html,/data-chaos-action="reveal"/);
 assert.doesNotMatch(html,/HUMAN_SECRET_MARKER|CPU_SECRET_MARKER|ccc-practice-card-radio/);
 assert.doesNotMatch(html,/data-chaos-move=|data-chaos-action="draw"/);
 html=page(game,true);
 assert.match(html,/HUMAN_SECRET_MARKER/);
 assert.doesNotMatch(html,/CPU_SECRET_MARKER/);
 assert.equal((html.match(/ccc-practice-card-radio/g)||[]).length,game.players[0].hand.length);
 game.turn=1;
 html=page(game,true);
 assert.match(html,/CPU Driver is choosing a legal move/);
 assert.doesNotMatch(html,/CPU_SECRET_MARKER|HUMAN_SECRET_MARKER|data-chaos-move=|data-chaos-action="reveal"/);
 const resumed=renderApplicationShell({pathname:route,chaosGame:make(),chaosRevealed:false});
 assert.match(resumed,/HAND CONCEALED/);
 assert.doesNotMatch(resumed,/ccc-practice-card-radio/);
});

test('solo controls expose exactly local engine legal moves including repair, boost, hazard targets and discard',()=>{
 const game=make();
 game.players[0].hand[0]={type:'mileage',km:400,uid:909};
 game.players[0].hand[1]={type:'hazard',id:'fog',name:'Target Fog',category:'weather',kind:'slow',amount:100,uid:910};
 game.players[0].hand[2]={type:'fix',id:'help',name:'Roadside Assistance',category:'all',uid:911};
 game.players[0].upgrades=[{id:'shortcut-specialist',type:'upgrade',name:'Shortcut Specialist'}];
 let html=page(game,true);
 assert.match(html,/data-chaos-move="drive" data-card="0"/);
 assert.match(html,/name="boost"/);
 assert.match(html,/data-chaos-move="hazard" data-card="1"/);
 assert.match(html,/name="target"><option value="1">CPU Driver/);
 assert.doesNotMatch(html,/name="target"><option value="0"/);
 assert.match(html,/data-chaos-action="pass"/);
 assert.doesNotMatch(html,/data-chaos-action="draw"/);
 game.players[0].status={type:'hazard',id:'fog',category:'weather',kind:'slow',name:'Fog'};
 html=page(game,true);
 assert.match(html,/data-chaos-action="fix" data-card="2"/);
 assert.match(html,/data-chaos-action="recover"/);
 // The original authoritative transition still owns the discard phase.
 const next=takeChaosTurn(game,{player:0,action:'pass'});
 assert.equal(next.step,'discard');
 const discardHtml=page(next,true);
 assert.match(discardHtml,/data-chaos-action="discard" data-card="0"/);
 assert.doesNotMatch(discardHtml,/data-chaos-action="pass"/);
 assert.equal(chaosActionOptions(next).filter(x=>x.action==='discard').length,next.players[0].hand.length);
 const finishedDiscard=takeChaosTurn(next,{player:0,action:'discard',index:0});
 assert.equal(finishedDiscard.players[0].hand.length,next.players[0].hand.length-1);
});

test('draw controls only appear when the active human has revealed during a legal draw phase',()=>{
 const game=make();
 game.step='draw';game.discard=[{type:'mileage',km:100,uid:333}];
 const visible=page(game,true),hidden=page(game,false);
 for(const choice of ['deck','discard']){
  assert.match(visible,new RegExp('data-chaos-action="draw" data-choice="'+choice+'"'));
  assert.doesNotMatch(hidden,new RegExp('data-chaos-action="draw" data-choice="'+choice+'"'));
 }
 assert.match(visible,/Stock: \d+ cards/);
 assert.match(visible,/100 km/);
 game.discard=[];
 assert.doesNotMatch(page(game,true),/data-chaos-action="draw" data-choice="discard"/);
});

test('public tables show hazards and played mileage without private opponent hands or HTML injection',()=>{
 const game=make();
 game.players[0].played=[{type:'mileage',km:200},{type:'mileage',km:200}];
 game.players[0].km=400;
 game.players[1].name='<img src=x onerror=alert(1)>';
 game.players[1].hand[0]={type:'fix',id:'help',name:'RIVAL_PRIVATE',category:'all'};
 game.players[1].status={type:'hazard',id:'fog',name:'Fog Thicker Than Pea Soup',category:'weather',kind:'slow'};
 game.players[0].upgrades=[{type:'upgrade',id:'winter-tires',name:'Canadian Winter Tires'}];
 const html=page(game,true);
 assert.match(html,/200 km × 2/);
 assert.match(html,/Fog Thicker Than Pea Soup/);
 assert.match(html,/Canadian Winter Tires/);
 assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(html,/<img src=x|RIVAL_PRIVATE/);
});

test('solo presentation retains CPU status, regional finale UI, results and legacy test renderer',()=>{
 const game=make();
 game.finishPending=true;
 assert.match(page(game,true),/FINAL ROUND/);
 const between={...game,phase:'between',step:null,results:[{leg:0,winners:[0],standings:game.players.map((p,i)=>({
  id:p.id,name:p.name,place:i+1,km:p.km,rawKm:0,banked:i?0:2500,total:i?0:2500,winner:i===0
 }))}]};
 assert.match(page(between,false),/ccc-results-screen--regional/);
 assert.match(renderChaosGame({game,revealed:true}),/ccc-tabletop/,'legacy direct renderer remains a frozen rules/asset fixture');
});

test('production build carries independently bounded, mobile/keyboard safe solo styles',async()=>{
 const dir=resolve(import.meta.dirname,'..');
 const [html,build,gate,css,ui]=await Promise.all([
  'index.html','scripts/build.mjs','scripts/qualify-web.mjs','ccc-practice.css',
  'core/classics-ui.js'
 ].map(path=>readFile(resolve(dir,path),'utf8')));
 assert.match(html,/href="\/ccc-practice.css"/);
 assert.match(build,/'ccc-practice.css'/);
 assert.match(gate,/CCC_PRACTICE_ALLOWANCE=20\*1024/);
 assert.match(gate,/practiceJs\+practiceCss>CCC_PRACTICE_ALLOWANCE/);
 assert.match(css,/\.ccc-practice-card-radio:checked~/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css, /:focus-visible/);
 assert.match(ui,/game\?\.phase==='playing'\?renderChaosPracticeTable/);
});
