import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createChaosGame,takeChaosTurn,FIXES,HAZARDS,UPGRADES,LEGENDARIES} from '../core/cross-country-chaos.js';
import {chaosCardArt} from '../core/chaos-card-art.js';
import {renderChaosTable} from '../core/chaos-board.js';
import {renderChaosGame} from '../core/classics-ui.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {deriveChaosTableFeedback,renderChaosTableFeedback} from '../core/chaos-table-art.js';

const root=resolve(import.meta.dirname,'..');
const names=['Martha','Gordie','Alex','Riley'];
const start=n=>createChaosGame({names:names.slice(0,n),seed:420});
let uid=180000;
const card=(type,fields={})=>({type,uid:++uid,...fields});
const act=(s,action,fields={})=>takeChaosTurn(s,{player:s.players[s.turn].id,action,...fields});

test('CCC-ART-4: physical deck backs and discard fronts show actual public pile counts and approved card faces',()=>{
 for(let n=2;n<=4;n++){
  const game=start(n);game.discard=[card('mileage',{km:400})];
  const table=renderChaosTable(game);
  assert.match(table,/ccc-tabletop--road-atlas/);
  assert.match(table,/class="ccc-stock-back"/);
  assert.match(table,/class="ccc-pile-face"/);
  assert.match(table,/Regional draw deck/);
  assert.match(table,/Face-up discard/);
  assert.match(table,new RegExp(game.deck.length+' face-down cards'));
  assert.match(table,/1 cards · 400 km/);
  assert.ok(table.includes(chaosCardArt(game.discard[0],'east')));
  assert.match(table,/ROAD TRIP/);
  assert.equal((table.match(/class="ccc-seat-mat/g)||[]).length,n);
  assert.doesNotMatch(table,/data-chaos-action="draw"/,'unrevealed public board must not offer draw actions');
 }
});
test('CCC-ART-4: clicking piles is only possible for revealed draw step, consistent with original draw options',()=>{
 let game=start(2);
 for(const player of [0,1]){
  game=act(game,'pass');
  game=act(game,'discard',{index:0});
  game=act(game,'discard',{index:0});
 }
 assert.equal(game.step,'draw');
 assert.equal(game.turn,0);
 game.discard=[card('mileage',{km:200})];
 let visible=renderChaosGame({game,revealed:true});
 assert.match(visible,/class="ccc-stock ccc-pile-control" data-chaos-action="draw" data-choice="deck"/);
 assert.match(visible,/class="ccc-discard-public ccc-pile-control" data-chaos-action="draw" data-choice="discard"/);
 assert.match(visible,/aria-label="Draw two face-down regional cards"/);
 assert.match(visible,/aria-label="Take the top discard and draw one face-down card"/);
 let hidden=renderChaosGame({game,revealed:false});
 assert.doesNotMatch(hidden,/data-chaos-action="draw"/);
 assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move/);
 const selected=act(game,'draw',{choice:'discard'});
 assert.equal(selected.step,'play');
 assert.ok(selected.players[0].hand.some(c=>c.km===200));
 assert.equal(selected.discard.length,0);
 visible=renderChaosGame({game:selected,revealed:true});
 assert.doesNotMatch(visible,/class="ccc-stock ccc-pile-control"/);
 assert.doesNotMatch(visible,/class="ccc-discard-public ccc-pile-control"/);
});
test('CCC-ART-4: empty discard is never clickable even in draw phase, stock remains clickable',()=>{
 let game=start(2);
 game.step='draw';game.players[0].hand=game.players[0].hand.slice(0,5);
 const html=renderChaosGame({game,revealed:true});
 assert.match(html,/class="ccc-stock ccc-pile-control"/);
 assert.doesNotMatch(html,/class="ccc-discard-public ccc-pile-control"/);
 assert.match(html,/Empty discard/);
 assert.doesNotMatch(html,/data-choice="discard"/);
});
test('CCC-ART-4: mileage has physical card stacks by denomination, without changes to effective kilometre accounting',()=>{
 const game=start(3);const p=game.players[0];
 p.played=[card('mileage',{km:500}),card('mileage',{km:100}),card('mileage',{km:500}),card('mileage',{km:300})];
 p.km=1200;p.detourLoss=100;
 const before=structuredClone(game);
 const table=renderChaosTable(game);
 assert.match(table,/class="ccc-mileage-card-stack" data-stack-count="2"/);
 assert.match(table,/data-stack-count="1"/);
 assert.match(table,/500 km × 2/);
 assert.match(table,/300 km × 1/);
 assert.match(table,/100 km × 1/);
 assert.ok(table.indexOf('500 km × 2')<table.indexOf('300 km × 1'));
 assert.ok(table.indexOf('300 km × 1')<table.indexOf('100 km × 1'));
 assert.match(table,/Detours −100 km/);
 assert.ok(table.includes(chaosCardArt({type:'mileage',km:500},'east')));
 assert.deepEqual(game,before,'presentation cannot mutate authoritative state');
});
test('CCC-ART-4: hazard bays and empty road stamp retain status and approved regional illustrations',()=>{
 for(const region of ['east','ontario','west']){
  const game=start(2);game.leg=['east','ontario','west'].indexOf(region);
  const clear=renderChaosTable(game);
  assert.equal((clear.match(/class="ccc-hazard-slot" data-slot="hazard"/g)||[]).length,2);
  assert.match(clear,/class="ccc-hazard-clear"/);
  assert.match(clear,/Clear highway/);
  game.players[1].status=card('hazard',{...HAZARDS[region].find(h=>h.kind==='block')});
  const blocked=renderChaosTable(game);
  assert.match(blocked,/ccc-mini-card--hazard ccc-hazard--block/);
  assert.match(blocked,/ccc-hazard-ribbon">STOP/);
  assert.ok(blocked.includes(chaosCardArt(game.players[1].status,region)));
  assert.ok(blocked.includes(game.players[1].status.name.replaceAll("'",'&#39;')));
 }
});
test('CCC-ART-4: all eight equipped upgrades appear as paper cards with accurate ready/used stamps and shields',()=>{
 const game=start(2),p=game.players[0];
 p.upgrades=UPGRADES.map(u=>card('upgrade',u));p.used=['winter-tires','duct-tape'];p.shield=2;
 const table=renderChaosTable(game);
 assert.equal((table.match(/class="ccc-mini-card ccc-mini-card--equipped/g)||[]).length,8);
 assert.equal((table.match(/ccc-power-stamp--used/g)||[]).length,2);
 assert.equal((table.match(/ccc-power-stamp--ready/g)||[]).length,6);
 assert.match(table,/Legendary hazard shields: 2/);
 for(const u of UPGRADES)assert.ok(table.includes(chaosCardArt({type:'upgrade',id:u.id},'east')),u.id);
 assert.match(renderChaosTable(start(2)),/None equipped/);
});
test('CCC-ART-4: actual repair effects trigger animation and never refund detour losses',()=>{
 for(const fix of FIXES.filter(f=>f.id!=='atlas')){
  let game=start(2);const p=game.players[0];
  const cat=fix.category==='all'?'mechanical':fix.category;
  p.status=card('hazard',{name:'Roadside trouble',id:'dummy',category:cat,kind:'block'});
  p.hand[0]=card('fix',fix);p.detourLoss=120;p.km=350;
  const before=structuredClone(game);
  const after=act(game,'fix',{index:0});
  const cue=deriveChaosTableFeedback(before,after,{action:'fix',index:0});
  assert.equal(cue.kind,'repair');
  assert.deepEqual(cue.seats,[0]);
  assert.equal(after.players[0].status,null);
  assert.equal(after.players[0].detourLoss,120);
  const html=renderChaosTable(after,{feedback:cue});
  assert.match(html,/ccc-repair-feedback--repair/);
  assert.match(html,/Roadside repair complete/);
  assert.equal((html.match(/class="ccc-repair-feedback /g)||[]).length,1);
  assert.match(html,/ccc-repair-glyph/);
  assert.ok(html.includes(chaosCardArt({type:'fix',id:fix.id},'east')));
 }
});
test('CCC-ART-4: the navigation fix shows a +150 km shortcut animation without claiming a blocked hazard was repaired',()=>{
 const game=start(2);const p=game.players[0];
 p.hand[0]=card('fix',{...FIXES.find(f=>f.id==='atlas')});
 p.status=card('hazard',{name:'Fog',id:'fog',category:'weather',kind:'slow',amount:150});
 p.played=[card('mileage',{km:500})];p.detourLoss=100;p.km=400;
 const after=act(game,'fix',{index:0}),cue=deriveChaosTableFeedback(game,after,{action:'fix',index:0});
 assert.equal(cue.kind,'shortcut');
 assert.equal(after.players[0].km,550);
 assert.equal(after.players[0].status.id,'fog');
 assert.equal(after.players[0].detourLoss,100);
 const html=renderChaosTable(after,{feedback:cue});
 assert.match(html,/ccc-repair-feedback--shortcut/);
 assert.match(html,/Permanent detours remain/);
 assert.doesNotMatch(html,/Roadside repair complete/);
});
test('CCC-ART-4: shortcut bonus displays honestly even when detours clamp effective mileage to zero',()=>{
 const game=start(2);const p=game.players[0];
 p.hand[0]=card('fix',{...FIXES.find(f=>f.id==='atlas')});
 p.detourLoss=200;p.km=0;
 const after=act(game,'fix',{index:0});
 const cue=deriveChaosTableFeedback(game,after,{action:'fix',index:0});
 assert.equal(after.players[0].bonusKm,150);
 assert.equal(after.players[0].detourLoss,200);
 assert.equal(after.players[0].km,0);
 assert.equal(cue.kind,'shortcut');
 assert.match(renderChaosTable(after,{feedback:cue}),/\+150 km card bonus/);
});
test('CCC-ART-4: spending an action on emergency recovery signals cleared status and consumes the same action',()=>{
 const game=start(2);game.players[0].status=card('hazard',{...HAZARDS.east[6]});
 const after=act(game,'recover'),cue=deriveChaosTableFeedback(game,after,{action:'recover'});
 assert.equal(after.players[0].status,null);
 assert.equal(after.step,'discard');
 assert.equal(after.discardsLeft,2);
 assert.equal(cue.kind,'recovery');
 assert.match(renderChaosTable(after,{feedback:cue}),/Hazard cleared · Action spent/);
});
test('CCC-ART-4: legendary clearing and Wagon auto-repair show truthful, correctly targeted effects',()=>{
 const game=start(3);
 game.players[0].status=card('hazard',{...HAZARDS.east[6]});
 game.players[0].hand[0]=card('legendary',{...LEGENDARIES.find(l=>l.id==='truck')});
 const after=act(game,'power',{index:0});
 const cue=deriveChaosTableFeedback(game,after,{action:'power',index:0});
 assert.equal(cue.kind,'repair');
 assert.deepEqual(cue.seats,[0]);
 assert.match(renderChaosTable(after,{feedback:cue}),/A helping hand/);
 const sunshine=start(3);
 sunshine.players[1].status=card('hazard',{...HAZARDS.east[2]});
 sunshine.players[2].status=card('hazard',{...HAZARDS.east[6]});
 sunshine.players[0].hand[0]=card('legendary',{...LEGENDARIES.find(l=>l.id==='sunshine')});
 const cleared=act(sunshine,'power',{index:0});
 const weather=deriveChaosTableFeedback(sunshine,cleared,{action:'power',index:0});
 assert.deepEqual(weather.seats,[1]);
 assert.equal(cleared.players[1].status,null);
 assert.notEqual(cleared.players[2].status,null);
 assert.equal((renderChaosTable(cleared,{feedback:weather}).match(/class="ccc-repair-feedback /g)||[]).length,1);
 let wagon=start(2);
 wagon.players[1].upgrades=[card('upgrade',{...UPGRADES.find(u=>u.id==='station-wagon')})];
 wagon.players[1].status=card('hazard',{...HAZARDS.east[6]});
 wagon=act(wagon,'pass');
 wagon=act(wagon,'discard',{index:0});
 const before=wagon;
 const next=act(wagon,'discard',{index:0});
 const auto=deriveChaosTableFeedback(before,next,{action:'discard',index:0});
 assert.equal(next.turn,1);
 assert.equal(auto?.kind,'repair');
 assert.deepEqual(auto.seats,[1]);
 assert.match(renderChaosTable(next,{feedback:auto}),/Station Wagon to the rescue/);
});
test('CCC-ART-4: no animation after failed, irrelevant, or non-clearing moves; untrusted cue text is escaped',()=>{
 let game=start(2),after=act(game,'pass');
 assert.equal(deriveChaosTableFeedback(game,after,{action:'pass'}),null);
 assert.equal(deriveChaosTableFeedback(game,game,{action:'fix',index:0}),null);
 assert.equal(deriveChaosTableFeedback(null,after,{action:'fix',index:0}),null);
 assert.equal(renderChaosTableFeedback({kind:'unknown',seats:[0],title:'Hi',detail:'Hi'},0),'');
 const fake={kind:'repair',seats:[0],title:'<img onerror=x>',detail:'<script>alert(1)</script>'};
 const html=renderChaosTableFeedback(fake,0);
 assert.doesNotMatch(html,/<img onerror=x>|<script>/);
 assert.match(html,/&lt;img onerror=x&gt;/);
 assert.match(html,/&lt;script&gt;/);
 assert.equal(renderChaosTableFeedback(fake,1),'');
 const hidden=renderChaosGame({game:after,revealed:false,feedback:fake});
 assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move|data-chaos-action="draw"/);
 assert.match(hidden,/ccc-repair-feedback--repair/);
});
test('CCC-ART-4: translucent table graphics are scoped, responsive, reduced-motion safe, and deployed by the build',async()=>{
 const css=await readFile(resolve(root,'ccc-tabletop.css'),'utf8');
 const originalCss=await readFile(resolve(root,'classics.css'),'utf8');
 const html=await readFile(resolve(root,'index.html'),'utf8');
 const build=await readFile(resolve(root,'scripts/build.mjs'),'utf8');
 const qualify=await readFile(resolve(root,'scripts/qualify-web.mjs'),'utf8');
 const app=await readFile(resolve(root,'app.js'),'utf8');
 const shell=await readFile(resolve(root,'core/app-shell.js'),'utf8');
 for(const cls of ['ccc-tabletop--road-atlas','ccc-stock-back','ccc-pile-face','ccc-spent-tray','ccc-hazard-slot',
  'ccc-art-zone--mileage','ccc-mileage-card-stack','ccc-power-rack','ccc-power-stamp','ccc-repair-feedback'])
  assert.ok(css.includes('.'+cls),'unstyled art element '+cls);
 assert.match(css,/@keyframes ccc-repair-appear/);
 assert.match(css,/@keyframes ccc-repair-turn/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/@media\(max-width:440px\)/);
 assert.ok(Buffer.byteLength(originalCss,'utf8')<35000,'CCC-ART-1 stylesheet budget is unchanged');
 assert.match(html,/href="\/ccc-tabletop\.css"/);
 assert.match(build,/'ccc-tabletop\.css'/);
 assert.match(qualify,/baseTotal:1141\*1024/);
 assert.match(qualify,/readFile\(resolve\(root,'ccc-tabletop\.css'\)/);
 assert.match(app,/chaosRepairCue=deriveChaosTableFeedback/);
 assert.match(shell,/chaosRepairCue/);
 assert.doesNotMatch(css,/@import|url\(https?:/i);
});
