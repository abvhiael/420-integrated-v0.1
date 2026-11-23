import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('docs/migration/MIG-4-phase2-819-ledger.json','utf8'));
assert.equal(manifest.schema,'phase2-mig4-819-exact-source-disposition-v1');
assert.equal(manifest.sourcePR,819);
assert.equal(manifest.originalRemovalInventory.length,1199);
assert.equal(new Set(manifest.originalRemovalInventory.map(x=>x.path)).size,1199);
assert.equal(manifest.alreadyAbsentBefore,1180);
assert.equal(manifest.externallyPreservedAndRemoved.length,10);
assert.equal(manifest.retainedGenesisProtocolOrAuthority.length,9);
const retained=new Set(manifest.retainedGenesisProtocolOrAuthority);
const external=new Set(manifest.externallyPreservedAndRemoved);
for(const x of manifest.originalRemovalInventory) {
 assert.match(x.sourceSha,/^[a-f0-9]{40}$/);
 const expected=retained.has(x.path);
 assert.equal(existsSync(x.path),expected,'wrong Genesis ownership for '+x.path);
}
for(const x of external)assert(!retained.has(x));
for(const x of retained)assert(/^(\.github\/workflows\/gaming-|packages\/420-gaming-|scripts\/arcade\/verify-arc-0-3)/.test(x),'unauthorized retained game source: '+x);
const stage=readFileSync('scripts/migration/stage-mig-4-game-consumers.sh','utf8');
for(const pin of ['9ab751e3cdf1fa2e8725dda0981749208ab038f5','fb0c2e72730c4a562cb465fdc526036d79164766','861feb3561ed22dd6c8c8a8209c30321bab3e599'])assert(stage.includes(pin));
for(const file of ['packages/420-gaming-sdk/src/index.js','packages/420-gaming-client-hardening/test/hostile-state.test.js','packages/420-gaming-cross-game-qualification/test/cross-game.test.js','contracts/src/gaming/GameRegistry420.sol'])assert(existsSync(file),file+' missing');
console.log('PASS MIG-4 Phase 2: 1190 game-owned files absent, 9 Genesis-owned shared/authority entries retained, external migration SHA evidence pinned');
