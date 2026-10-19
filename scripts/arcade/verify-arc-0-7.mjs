import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url));
const j=p=>JSON.parse(read(p).toString('utf8'));
const f=j('config/arcade-0-7-scope-freeze.json');
const ids=j('config/arcade-game-identities.json'), platform=j('config/arcade-platform-requirements.json'), arch=j('config/arcade-module-architecture.json');
const frozen=['config/arcade-game-identities.json','config/arcade-platform-requirements.json','config/arcade-module-architecture.json','docs/arcade/ARC-0.2-ARCHITECTURE-DECISIONS.md','packages/420-gaming-sdk/src/client.js'];
const expectedReq=["canonical-roster-and-exclusions","identity-namespace-and-nonregistration","platform-desktop-mobile-accessibility-offline","module-graph-and-release-versioning","independent-game-bundles-and-guest-core","score-replay-and-unverified-results","privacy-assets-and-rights","optional-gaming-sdk-authority","per-step-level1-exact-sha","milestone-level2-only-when-required","phase-level3-once-at-final-arcade-closeout","live-testnet-acceptance-separately-gated"];
const expectedGameReq=["responsive-desktop-mobile","keyboard-touch-and-pause","wcag-2.2-aa-target","guest-offline-after-assets-installed","versioned-saves-with-isolation","content-integrity-and-rights","adversarial-negative-tests","wallet-free-core"];
const expectedOwners=["ARC_STEP_SCOPED","ARC_INTEGRATION_APP","SOLIDITY","GENESIS_ADDRESS_AUTHORITY","INTEGRATED","DOCS"];
function checks(m,blobs=m.sourceBlobs){
assert.equal(m.schemaVersion,'1.0.0');assert.equal(m.step,'ARC-0.7');assert.equal(m.application,'420Arcade');
assert.equal(m.status,'DEFINITION_FREEZE_ONLY');assert.equal(m.authority,'LOCAL_REQUIREMENTS_NOT_RELEASE');
assert.deepEqual(Object.keys(blobs).sort(),[...frozen].sort());
for(const p of frozen){const bytes=read(p);const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');assert.match(blobs[p],/^[0-9a-f]{40}$/);assert.equal(blobs[p],sha,'freeze digest mismatch: '+p);}
assert.deepEqual(m.scope.genesisGames,ids.games.map(g=>g.slug));assert.equal(m.scope.genesisGames.length,11);
assert.deepEqual(m.scope.excluded,['bud-match','weedle','420-trivia']);
assert.equal(m.scope.runtimeBuildsCompleted,0);assert.equal(m.scope.networkRegistrations,0);assert.equal(m.scope.applicationGamesApproved,11);
assert.equal(m.scope.addingGamesRequires,'EXPLICIT_SCOPE_APPROVAL_AND_NEW_FREEZE');
assert.deepEqual(m.acceptance.requirements,expectedReq);assert.deepEqual(m.acceptance.allGamesMustMeet,expectedGameReq);
for(const k of ['noClientVerifiedClaims','noEconomicsWithoutExternalApproval','noFakeBrowserCompatibilityProof','phaseNotComplete'])assert.equal(m.acceptance[k],true);
assert.equal(platform.games.length,11);assert.deepEqual(platform.games.map(g=>g.slug),m.scope.genesisGames);
assert.equal(arch.gameBundles.length,11);assert.deepEqual(arch.gameBundles.map(g=>g.slug),m.scope.genesisGames);
assert.equal(m.qualification.ordinary,'LEVEL1_EXACT_IMPLEMENTATION_SHA');
assert.equal(m.qualification.integration,'LEVEL2_APP_ONLY_WHEN_REQUIRED');
assert.equal(m.qualification.phaseCloseout,'LEVEL3_ONCE_AFTER_FREEZE_AND_RECONCILIATION');
assert.deepEqual(m.qualification.owners,expectedOwners);
assert.equal(m.qualification.preservePriorEvidence,true);assert.equal(m.qualification.globalSuitesAtOrdinarySteps,false);
assert.equal(m.qualification.latestQualifiedStep,'ARC-0.6');
assert.deepEqual(m.qualification.previousStages,[...Array(6)].map((_,i)=>({step:'ARC-0.'+(i+1),status:'QUALIFIED_PREVIOUSLY',requalify:false})));
assert.equal(m.dependencies.moduleContract,'config/arcade-module-architecture.json');
assert.equal(m.dependencies.platformContract,'config/arcade-platform-requirements.json');
assert.equal(m.dependencies.identities,'config/arcade-game-identities.json');
assert.equal(m.dependencies.madBudArt,'INDEPENDENT_LICENSE_AND_APPROVED_EXPORT_REQUIRED');
assert.equal(m.dependencies.runtimeDependencies,'PIN_AND_LOCK_BEFORE_INSTALL');
assert.equal(m.dependencies.sdk,'EXISTING_SCOPED_GAMING_SDK_ONLY');
assert.equal(m.dependencies.canonicalRegistration,'TESTNET_NOT_COMPLETED');
assert.equal(m.dependencies.scoringServer,'REQUIRES_TRUSTED_VERIFIER');
assert.equal(m.dependencies.productionApproval,'NOT_GRANTED');
assert.equal(m.testnet.status,'PENDING_EXTERNAL_PROOF');
assert.deepEqual(m.testnet.requirements,['selected-chain-gameregistry-registrations','operator-capability-grants','finality-and-rpc-fault-evidence','GP-17.9-live-onboarding','independent-security-risk-and-release-approval']);
return true;
}
checks(f);
const clone=()=>structuredClone(f);
let negative=0;
for(const change of [
 m=>m.scope.genesisGames.pop(),m=>m.scope.genesisGames.reverse(),m=>m.scope.genesisGames[0]=m.scope.genesisGames[1],
 m=>m.scope.excluded.pop(),m=>m.scope.runtimeBuildsCompleted=11,m=>m.scope.networkRegistrations=11,
 m=>m.scope.addingGamesRequires='ANYONE_CAN_ADD',
 m=>m.acceptance.requirements.pop(),m=>m.acceptance.allGamesMustMeet.pop(),
 m=>m.acceptance.noClientVerifiedClaims=false,m=>m.acceptance.noEconomicsWithoutExternalApproval=false,
 m=>m.acceptance.noFakeBrowserCompatibilityProof=false,m=>m.acceptance.phaseNotComplete=false,
 m=>m.qualification.ordinary='SKIP',m=>m.qualification.integration='GLOBAL_LEVEL3',
 m=>m.qualification.phaseCloseout='LEVEL3_EACH_STEP',m=>m.qualification.globalSuitesAtOrdinarySteps=true,
 m=>m.qualification.previousStages[0].requalify=true,m=>m.qualification.owners.pop(),
 m=>m.dependencies.sdk='NEW_PARALLEL_REGISTRY',m=>m.dependencies.canonicalRegistration='ACTIVE',
 m=>m.dependencies.productionApproval='APPROVED',m=>m.testnet.status='PASSED',
 m=>m.sourceBlobs[frozen[0]]='0'.repeat(40),m=>delete m.sourceBlobs[frozen[1]]
]){const bad=clone();change(bad);assert.throws(()=>checks(bad));negative++;}
console.log('ARC-0.7 freeze source hashes, game scope, acceptance, qualification and '+negative+' adversarial cases PASS');
