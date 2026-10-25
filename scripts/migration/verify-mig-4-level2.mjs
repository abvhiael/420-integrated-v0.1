import fs from 'node:fs';
import assert from 'node:assert/strict';
const get=p=>fs.readFileSync(p,'utf8');
const data=JSON.parse(get('docs/migration/MIG-4-verified-source-cleanup.json'));
assert.equal(data.removed.length,92);
for(const f of data.removed) {
 assert.match(f.sha,/^[a-f0-9]{40}$/);
 assert.equal(fs.existsSync(f.path),false,'external file still in Genesis: '+f.path);
}
const stage=get('scripts/migration/stage-mig-4-game-consumers.sh');
for(const pin of ['9ab751e3cdf1fa2e8725dda0981749208ab038f5','fb0c2e72730c4a562cb465fdc526036d79164766','861feb3561ed22dd6c8c8a8209c30321bab3e599'])assert(stage.includes(pin),'missing external exact SHA pin');
for(const name of ['gaming-client-hardening','gaming-cross-game-qualification','gaming-four-game-e2e']) {
 const w=get('.github/workflows/'+name+'.yml');
 assert(w.includes('stage-mig-4-game-consumers.sh'),'no external staging in '+name);
 assert(w.includes('npm test'),'security suite disabled in '+name);
 for(const game of ['greenroad','budtender','smoke-chrome'])assert(!w.includes('"clients/'+game+'-access-v1/**"'),'still coupled to game source');
}
for(const name of ['hostile-state.test.js','four-game-e2e.test.js']) {
 const t=get('packages/420-gaming-client-hardening/test/'+name);
 assert(t.includes('HOSTILE_OTHER_GAME')||t.includes('poisoned'),'cross-game adversarial tests missing');
}
assert(get('packages/420-gaming-cross-game-qualification/test/cross-game.test.js').includes('shared clients inject only their own game scope'));
assert(!fs.existsSync('.github/workflows/mad-buds-sativa-steve-level2.yml'),'obsolete game workflow remains');
assert(fs.existsSync('contracts/src/gaming/GameRegistry420.sol'));
assert(fs.existsSync('contracts/src/highcountry'));
console.log('MIG-4 Level 2 local structural qualification PASS; retained adversarial test files and external source pins verified.');
