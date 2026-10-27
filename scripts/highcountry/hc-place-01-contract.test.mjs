import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const contract=read('docs/highcountry/HC-PLACE-01-ARCHITECTURE-BASELINE.md');
test('placement contract explicitly separates sprites, 64px tile and occupied geometry',()=>{
 assert.match(contract,/64px tile/);assert.match(contract,/Sprite dimensions.*MUST NOT determine physical occupancy/);
 assert.match(contract,/maskVersion/);assert.match(contract,/renderAnchor/);
});
test('wall and tabletop surfaces do not claim floor occupancy',()=>{
 for(const x of ['wall_slot','tabletop_slot','shelf_slot']) assert.ok(contract.includes(x));
 assert.match(contract,/zero standalone floor footprint/);
});
test('server mutation admission requires authentication revisions idempotency and atomic state',()=>{
 for(const phrase of ['authenticated registered principal','idempotency key','scene revision','instance revisions','commit or roll back together','must remain disabled','no authority'])assert.ok(contract.toLowerCase().includes(phrase.toLowerCase()),phrase);
});
test('source economy store uses SERIALIZABLE transaction and row locking',()=>{
 const source=read('services/highcountry-economy/src/postgres-store.js');
 assert.match(source,/BEGIN ISOLATION LEVEL SERIALIZABLE/);
 assert.match(source,/FOR UPDATE/);
 assert.match(source,/ROLLBACK/);
});
test('marketplace authenticated transport does not constitute a world placement service',()=>{
 const source=read('apps/highcountry-web/src/marketplace.js');
 assert.match(source,/authorization:'Bearer '/);
 assert.match(source,/server-derived/);
 assert.match(contract,/no established durable world placement route/);
});
test('existing fail-closed physical survey admission retained, without promoting synthetic titles',()=>{
 const source=read('scripts/highcountry/hc-world-02-parcel-access.mjs');
 const doc=read('docs/highcountry/HC-WORLD-02-PARCEL-TERRAIN-ACCESS-VALIDATION.md');
 assert.match(source,/HC-WORLD-02 parcel-level access/);
 assert.match(doc,/31,260 blocked/);
 assert.match(contract,/must not promote synthetic cadastral layouts/);
});
test('contract preserves existing canonical ownership, art and market boundaries',()=>{
 for(const value of ['No marketplace ID','64px tile','ownership','geometry','HC-PLACE-12']) assert.ok(contract.toLowerCase().includes(value.toLowerCase()),value);
});
