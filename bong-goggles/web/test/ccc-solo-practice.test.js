import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {resolveRoute} from '../core/routes.js';
import {renderApplicationShell} from '../core/app-shell.js';
import {renderClassicGamePage} from '../core/games-ui.js';
import {createChaosGame} from '../core/cross-country-chaos.js';
import {configureChaosComputerSeats,advanceChaosComputerTurns} from '../core/chaos-computer.js';

const practice='/classics/cross-country-chaos/practice';
const online='/classics/cross-country-chaos';
const session=controllers=>configureChaosComputerSeats(
 createChaosGame({names:controllers.map((c,i)=>c==='human'?'Tester':'Computer '+i),seed:42017}),controllers);

test('solo practice is an explicit, deep-linkable game route, not the shared-account game',()=>{
 const p=resolveRoute(practice);
 assert.equal(p.id,'chaos-game');
 assert.equal(p.path,practice);
 assert.equal(resolveRoute(online).id,'chaos-game');
 assert.equal(resolveRoute('/classics/cross-country-chaos/practice/').path,practice);
 assert.equal(resolveRoute('/classics/cross-country-chaos/other').id,'not-found');
 const solo=renderApplicationShell({pathname:practice,online:{status:'unavailable'}});
 assert.match(solo,/data-chaos-start/);
 assert.match(solo,/Play against computers/);
 assert.match(solo,/Start the cross-Canada championship/);
 assert.match(solo,/data-chaos-controller-pick="3"/);
 assert.equal((solo.match(/<option value="normal" selected>/g)||[]).length,3);
 assert.equal((solo.match(/<option value="human" selected>/g)||[]).length,1);
 assert.doesNotMatch(solo,/Account multiplayer is not available yet|Retry connection/);
 assert.doesNotMatch(solo,/social-api\/v1\/chaos/);
 const root=renderApplicationShell({pathname:online,online:{status:'unavailable'}});
 assert.match(root,/Account multiplayer is not available yet/);
 assert.match(root,/href="\/classics\/cross-country-chaos\/practice"/);
 assert.doesNotMatch(root,/data-chaos-start|Start the cross-Canada championship|Pass the device/);
});
test('only qualified CCC provides a working CPU setup instead of disabled generic Opponents screen',()=>{
 const entry=renderClassicGamePage('cross-country-chaos',{screen:'setup'});
 assert.match(entry,/Play against computers/);
 assert.match(entry,/href="\/classics\/cross-country-chaos\/practice"/);
 assert.match(entry,/Play Cross-Country Chaos online/);
 assert.doesNotMatch(entry,/New game — not yet available|Opponent setup|Pending qualified ruleset/);
 assert.match(renderClassicGamePage('kaiser',{screen:'setup'}),/Opponent setup/);
});
test('private local hand is revealed only after the single human elects to see it',()=>{
 const game=session(['human','normal','hard']);
 const hidden=renderApplicationShell({pathname:practice,chaosGame:game,chaosRevealed:false});
 assert.match(hidden,/Pass the device to Tester/);
 assert.doesNotMatch(hidden,/ccc-hand-card|data-chaos-move=/);
 const revealed=renderApplicationShell({pathname:practice,chaosGame:game,chaosRevealed:true});
 assert.match(revealed,/ccc-hand-card/);
 assert.match(revealed,/data-chaos-action="reveal"|data-chaos-action="pass"|data-chaos-move=/);
 const onlineHtml=renderApplicationShell({pathname:online,chaosGame:game,chaosRevealed:true,online:{status:'loading'}});
 assert.doesNotMatch(onlineHtml,/ccc-hand-card|data-chaos-move=|Pass the device/);
});
test('computer turn never shows its private hand and yields to local human legally',()=>{
 const game=session(['normal','hard','human']);
 const waiting=renderApplicationShell({pathname:practice,chaosGame:game,chaosRevealed:true});
 assert.match(waiting,/Computer driving/);
 assert.doesNotMatch(waiting,/ccc-hand-card|data-chaos-move=/);
 const result=advanceChaosComputerTurns(game,{maxActions:96});
 assert.equal(result.pending,false);
 assert.equal(result.game.players[result.game.turn].controller,'human');
 assert.match(renderApplicationShell({pathname:practice,chaosGame:result.game,chaosRevealed:false}),/Pass the device to Tester/);
});
test('practice bindings, crash-safe local journal restore and multiplayer account partition are wired',async()=>{
 const base=resolve(import.meta.dirname,'..');
 const [app,shell,routes]=await Promise.all(['app.js','core/app-shell.js','core/routes.js'].map(f=>readFile(resolve(base,f),'utf8')));
 assert.match(app,/function bindChaos\(\)\{\s*if\(window\.location\.pathname!=='\/classics\/cross-country-chaos\/practice'\)return;/);
 assert.match(app,/bindAccountMonetization\(\);bindChaos\(\);bindChaosOnline\(/);
 assert.match(app,/applyViewPreferences\(\);restoreChaosOnGameRoute\(\);renderCurrent\(\)/);
 assert.match(app,/scheduleChaosComputer\(\)/);
 assert.match(app,/window\.location\.pathname==='\/classics\/cross-country-chaos'&&chaosOnline/);
 assert.match(shell,/route\.path\.endsWith\('\/practice'\)\?renderClassicsRoute/);
 assert.match(routes,/BY_PATH\.set\(p,Object\.freeze/);
});
