import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p,root),'utf8');
const gameIds = ['ARCADE_KUSH_CRUSH','ARCADE_420_COLOURING_BOOK','ARCADE_420_BUDDY','ARCADE_BONG_BREAKER','ARCADE_BAKED_INVADERS','ARCADE_PUFF_MAN','ARCADE_GRASSHOPPER','ARCADE_ROACH_RUN','ARCADE_HIGH_CLIMB','ARCADE_WHERES_DAVE','ARCADE_MAD_BUD_DELIVERY'];
const names = ['Kush Crush','420Colouring Book','420Buddy','Bong Breaker','Baked Invaders','Puff-Man','Grasshopper','Roach Run','High Climb',"Where's Dave?",'Mad Bud Delivery'];
export function validate(input) {
  assert.equal(input.schemaVersion,'1.0.0');
  assert.equal(input.application,'420Arcade');
  assert.equal(input.authority,'LOCAL_CANDIDATE_ONLY');
  assert.equal(input.registrationStatus,'NOT_REGISTERED');
  assert.equal(input.games?.length,11);
  const ids=new Set(), slugs=new Set();
  for (const [i,g] of input.games.entries()) {
    assert.equal(g.gameId,'420/GAMING/GAME/'+gameIds[i]+'/V1');
    assert.equal(g.displayName,names[i]);
    assert.match(g.slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(g.gameId) && !slugs.has(g.slug),'duplicate game identity/slug');
    ids.add(g.gameId);slugs.add(g.slug);
    assert.match(g.manifestVersion,/^1\.0\.0$/);
    assert.match(g.rulesetVersion,/^1\.0\.0$/);
    assert.match(g.contentVersion,/^1\.0\.0$/);
    assert.equal(g.saveSchemaVersion,1);
    assert.ok(['react-puzzle','react-simulation','canvas','phaser','scene-renderer'].includes(g.runtime));
    assert.equal(g.registration,'UNREGISTERED');
    assert.equal(g.walletRequiredForCore,false);
    assert.equal(g.protocolIntegration,'OPTIONAL');
  }
  assert.equal(new Set(names).size,11);
  return true;
}
const manifest=JSON.parse(read('config/arcade-game-identities.json'));
validate(manifest);
const genesis=JSON.parse(read('config/genesis-applications.json'));
assert.ok(genesis.apps.some(x=>x.name==='420Arcade' && x.contracts_required===false));
assert.ok(genesis.apps.some(x=>x.name==='420 Gaming Protocol'));
const gp=read('developer-hub/src/gaming-onboarding.mjs');
assert.ok(gp.includes('420/GAMING/GAME/'));
const registry=read('contracts/src/gaming/GameRegistry420.sol');
assert.ok(registry.includes('authorization.requireAuthorized(msg.sender, gameId'));
assert.ok(registry.includes('GameAlreadyExists'));
const clone=()=>structuredClone(manifest);
for(const mutate of [
 m=>{m.games.push(structuredClone(m.games[0]))},
 m=>{m.games[1].gameId=m.games[0].gameId},
 m=>{m.games[1].slug=m.games[0].slug},
 m=>{m.games[0].gameId='420/GAMING/GAME/HIGH_COUNTRY/V1'},
 m=>{m.games[0].registration='REGISTERED'},
 m=>{m.games[0].walletRequiredForCore=true},
 m=>{m.games[0].protocolIntegration='REQUIRED'},
 m=>{m.games[0].saveSchemaVersion=0},
 m=>{m.games[0].rulesetVersion=''},
 m=>{m.authority='CANONICAL_REGISTRY'},
 m=>{m.registrationStatus='REGISTERED'},
 m=>{m.games[0].displayName='Renamed'},
 m=>{m.games[0].slug='../escape'}
]){let altered=clone();mutate(altered);assert.throws(()=>validate(altered));}
console.log('ARC-0.4 identity manifest, GP-17 namespace, immutability, separation, negative checks PASS');
