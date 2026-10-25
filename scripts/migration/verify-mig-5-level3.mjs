import fs from 'node:fs';
import assert from 'node:assert/strict';
const file=p=>fs.readFileSync(p,'utf8');
const manifest=JSON.parse(file('docs/migration/MIG-5-closeout-manifest.json'));
const apps=JSON.parse(file('config/genesis-applications.json'));
const names=apps.apps.map(a=>a.name);
assert(!names.includes('420Arcade'));
assert(names.includes('420 Gaming Protocol'));
assert(!fs.existsSync('.github/workflows/mad-buds-kush-krusher-level1.yml'));
assert(!fs.existsSync('.github/workflows/mad-buds-sativa-steve-level2.yml'));
assert(fs.existsSync('packages/420-gaming-sdk/package.json'));
assert(fs.existsSync('contracts/src/gaming/GameRegistry420.sol'));
assert(fs.existsSync('contracts/src/highcountry'));
const pinText=file('scripts/migration/stage-mig-4-game-consumers.sh');
for(const [n,x] of Object.entries(manifest.independentRepositories)){
 assert.match(x.qualifiedCommit,/^[a-f0-9]{40}$/);
 assert.equal(x.gameBuildMandatoryForGenesis,false);
 if(n!=='420-arcade')assert(pinText.includes(x.qualifiedCommit));
}
assert.equal(Object.keys(manifest.independentRepositories).length,4);
assert.equal(new Set(Object.values(manifest.gameIds).filter(x=>x.startsWith('420/GAMING/GAME/'))).size,3);
for(const p of ['.github/workflows/gaming-client-hardening.yml','.github/workflows/gaming-cross-game-qualification.yml','.github/workflows/gaming-four-game-e2e.yml']){
 const c=file(p);
 assert(c.includes('stage-mig-4-game-consumers.sh'));
 assert(c.includes('npm test'));
}
assert(!fs.existsSync('assets/arcade'));
assert(!fs.existsSync('assets/budtender'));
assert.equal(manifest.migrationPRs['800'],'OPEN_HISTORICAL_INVENTORY_RECONCILIATION');
assert.equal(manifest.qualification,'PENDING_LEVEL_3');
console.log('MIG-5 bounded structural Level 3 candidate PASS — independent pins, game IDs, workflow isolation, Genesis protocol boundaries');
