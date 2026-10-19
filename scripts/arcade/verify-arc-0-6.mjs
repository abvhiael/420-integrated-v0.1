import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const policy=JSON.parse(read('config/arcade-module-architecture.json'));
const ids=JSON.parse(read('config/arcade-game-identities.json'));
const platform=JSON.parse(read('config/arcade-platform-requirements.json'));
const expected=['arcade-web','arcade-core','arcade-phaser','arcade-character-sdk','arcade-saves','arcade-score','arcade-art','arcade-testing'];
const roles=['launcher','pure-domain','runtime-adapter','approved-assets','local-persistence','unverified-result-adapter','private-vector-art','test-only'];
export function validate(m){
 assert.equal(m.schemaVersion,'1.0.0');assert.equal(m.step,'ARC-0.6');assert.equal(m.application,'420Arcade');
 assert.equal(m.status,'STRUCTURE_CONTRACT_DEFINED');
 assert.equal(m.sourceIdentityManifest,'config/arcade-game-identities.json');
 assert.equal(m.sourcePlatformRequirements,'config/arcade-platform-requirements.json');
 assert.equal(m.architectureOwner,'docs/arcade/ARC-0.2-ARCHITECTURE-DECISIONS.md');
 assert.equal(m.packages?.length,8);
 const names=new Set();
 for(let i=0;i<8;i++){const p=m.packages[i];assert.equal(p.id,expected[i]);assert.equal(p.role,roles[i]);
 assert.equal(p.path,(i===0?'apps/':'packages/')+p.id);assert.equal(p.implemented,false);
 assert.ok(!names.has(p.id));names.add(p.id);
 const deps=i===0?expected.filter(x=>x!=='arcade-web'&&x!=='arcade-testing'):i===1?[]:['arcade-core'];
 assert.deepEqual(p.dependencies,deps);
 }
 function visit(id,trail=new Set()){assert.ok(!trail.has(id),'dependency cycle');const p=m.packages.find(x=>x.id===id);assert.ok(p,'foreign dependency');const next=new Set(trail);next.add(id);for(const dep of p.dependencies)visit(dep,next);}
 for(const p of m.packages)visit(p.id);
 assert.equal(ids.games.length,11);assert.equal(m.gameBundles?.length,11);
 for(let i=0;i<11;i++){const g=m.gameBundles[i];assert.equal(g.slug,ids.games[i].slug);
 assert.equal(g.path,'apps/arcade-web/src/games/'+g.slug);
 assert.deepEqual(g.dependsOn,['arcade-core']);assert.equal(g.independentlyBundled,true);assert.equal(g.implemented,false);}
 assert.equal(platform.games.length,11);
 assert.deepEqual(m.gameBundles.map(x=>x.slug),platform.games.map(x=>x.slug));
 const deps=['420-gaming-sdk','phaser','react','typescript'];
 assert.deepEqual(m.externalDependencies.map(x=>x.name),deps);
 assert.equal(m.externalDependencies[0].path,'packages/420-gaming-sdk');assert.equal(m.externalDependencies[0].optional,true);
 assert.equal(m.externalDependencies[1].optional,true);
 for(let i=1;i<4;i++)assert.equal(m.externalDependencies[i].installation,'NOT_PINNED_NOT_INSTALLED');
 for(const k of ['guestCoreRequiresWallet','allowCrossGameProtectedSaveWrite','allowClientSigningKeyCustody','allowClientVerifiedScoreAuthority','allowDirectGameToRegistryWrite','allowPrivateContentOnChain'])assert.equal(m.boundaries[k],false);
 for(const k of ['serverAuthorityOnlyThroughExistingGamingProtocol','scopedSdkOnly','assetRightsApprovalBeforePublish','lazyFaultIsolatedBundles'])assert.equal(m.boundaries[k],true);
 const required={identity:'IMMUTABLE_V1_GAME_ID',manifest:'semver',api:'semver',ruleset:'exact-semver',content:'exact-semver',saveSchema:'positive-integer-migrations',assets:'content-hash-and-approval',compatibility:'explicit-replay-and-save-migration',breaking:'major-bump-and-explicit-migration',patch:'no-change-to-published-rules-semantics',lockfile:'required-before-runtime-install',packageChanges:'scoped-tests-and-migration-review'};
 assert.deepEqual(m.versions,required);
 assert.deepEqual(m.release,{registeredGames:0,liveAuthority:false,platformCertified:false,gameBundlesImplemented:0});
 return true;
}
validate(policy);
const bad=fn=>{const m=structuredClone(policy);fn(m);assert.throws(()=>validate(m));};
[
 m=>m.packages.pop(),m=>m.packages[1].id='arcade-core2',m=>m.packages[0].path='../escape',
 m=>m.packages[0].dependencies.push('arcade-testing'),m=>m.packages[1].dependencies=['arcade-web'],
 m=>m.packages[2].dependencies=['arcade-saves'],m=>m.gameBundles.pop(),m=>m.gameBundles.reverse(),
 m=>m.gameBundles[0].path='../evil',m=>m.gameBundles[0].independentlyBundled=false,
 m=>m.gameBundles[0].dependsOn=['arcade-score'],m=>m.gameBundles[1].slug=m.gameBundles[0].slug,
 m=>m.boundaries.allowClientSigningKeyCustody=true,m=>m.boundaries.allowDirectGameToRegistryWrite=true,
 m=>m.boundaries.allowCrossGameProtectedSaveWrite=true,m=>m.boundaries.guestCoreRequiresWallet=true,
 m=>m.boundaries.scopedSdkOnly=false,m=>m.versions.identity='MUTABLE',
 m=>m.versions.patch='allow-rules-rewrites',m=>m.versions.lockfile='optional',
 m=>m.externalDependencies[1].installation='INSTALLED',m=>m.release.liveAuthority=true,
 m=>m.release.gameBundlesImplemented=11,m=>m.status='PRODUCTION_READY'
].forEach(bad);
assert.ok(read('docs/arcade/ARC-0.2-ARCHITECTURE-DECISIONS.md').includes('packages/arcade-core/'));
assert.ok(read('packages/420-gaming-sdk/src/client.js').includes('createGamingClient420'));
console.log('ARC-0.6 module/dependency/versioning verification and 24 negative fixtures PASS');
