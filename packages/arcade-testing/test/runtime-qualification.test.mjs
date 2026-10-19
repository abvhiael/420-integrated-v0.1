import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {verifyInventory} from '../scripts/qualify.mjs';
import {ArcadeAssetLoader} from '../../arcade-assets/src/index.mjs';
import {UniversalGameControls} from '../../arcade-controls/src/index.mjs';
import {ArcadeSessionEvents} from '../../arcade-score/src/index.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const games=JSON.parse(readFileSync(root+'config/arcade-game-identities.json','utf8')).games;
test('all canonical eleven games mapped with immutable guest-first identity',()=>{
 assert.equal(games.length,11);assert.equal(new Set(games.map(g=>g.gameId)).size,11);
 for(const g of games){assert.equal(g.walletRequiredForCore,false);assert.equal(g.registration,'UNREGISTERED');assert.match(g.rulesetVersion,/^\d+\.\d+\.\d+$/);}
});
test('complete mandatory Arcade runtime inventory and fail-closed non-playable state',()=>{
 const v=verifyInventory();assert.equal(v.inventory.length,9);
 const app=readFileSync(root+'apps/arcade-web/src/App.tsx','utf8');
 assert.match(app,/Game runtime not installed/);assert.match(app,/disabled aria-describedby="launch-unavailable"/);
 assert.doesNotMatch(app,/>Play now</);
});
test('runtime module contracts are present without introducing wallet or verified score authority',()=>{
 for(const c of [ArcadeAssetLoader,UniversalGameControls,ArcadeSessionEvents])assert.equal(typeof c,'function');
 const source=readFileSync(root+'packages/arcade-score/src/index.mjs','utf8');
 assert.match(source,/LOCAL_UNVERIFIED/);
 const platform=JSON.parse(readFileSync(root+'config/arcade-platform-requirements.json','utf8'));
 assert.equal(platform.offline.guestCoreNeverRequiresWallet,true);
 assert.equal(platform.offline.serviceWorkerOptInInstall,true);
});
