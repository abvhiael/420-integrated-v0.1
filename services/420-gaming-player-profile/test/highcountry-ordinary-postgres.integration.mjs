import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {bootstrapDatastoreRoles} from '../src/schema-migrations.js';
import {migrateOrdinaryExhibitions420} from '../src/highcountry-ordinary-migrations.js';
import {createPostgresOrdinaryExhibitionRepository420} from '../src/highcountry-ordinary-postgres.js';
import {createOrdinaryExhibitions420} from '../src/highcountry-ordinary-exhibitions.js';
const url=process.env.HIGHCOUNTRY_EXHIBITIONS_POSTGRES_TEST_URL;
if(!url||!new URL(url).pathname.endsWith('/hc_exhibition_ci'))throw Error('isolated-exhibition-postgres-required');
const game='0x'+'a'.repeat(64),otherGame='0x'+'b'.repeat(64),hash='0x'+'c'.repeat(64);
test('HC-NEXT-7.2 real SERIALIZABLE PostgreSQL registration, unique claims, restart, evidence revocation and game separation',async()=>{
 const root=new Pool({connectionString:url});let runtime;
 try{
  await bootstrapDatastoreRoles(root);
  const first=await migrateOrdinaryExhibitions420(root);
  assert.equal(first.version,1);assert.equal((await migrateOrdinaryExhibitions420(root)).changed,false);
  await root.query("INSERT INTO highcountry_exhibitions.seasons(game_id,season_id,organizer,opens_at,closes_at) VALUES($1,'s','organizer',1100,3000)",[game]);
  await root.query("INSERT INTO highcountry_exhibitions.categories(game_id,category,version,rules_hash,wallet_required) VALUES($1,'flower',1,$2,false)",[game,hash]);
  await root.query("INSERT INTO highcountry_exhibitions.adjudicators(game_id,account_id) VALUES($1,'judge')",[game]);
  // Real runtime role, without DDL or rights to modify seasons/categories.
  await root.query("CREATE ROLE hc_exhibition_ci_runtime LOGIN PASSWORD 'test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
  await root.query('GRANT gaming_datastore_runtime TO hc_exhibition_ci_runtime');
  const runtimeUrl=new URL(url);runtimeUrl.username='hc_exhibition_ci_runtime';runtimeUrl.password='test-only';
  runtime=new Pool({connectionString:runtimeUrl.toString()});
  await assert.rejects(runtime.query("UPDATE highcountry_exhibitions.seasons SET organizer='attacker' WHERE game_id=$1",[game]));
  const repository=createPostgresOrdinaryExhibitionRepository420({pool:runtime,gameId:game});
  let t=1000;
  const proofs=new Map();
  const service=createOrdinaryExhibitions420({repository,clock:()=>t,
   identity:{verify:async token=>({accountId:token,registered:token!=='guest',revoked:false})},
   harvest:{verifyFinalizedFlower:async({accountId,harvestId})=>{
    const p=proofs.get(harvestId);return p?.accountId===accountId?p:null;}}});
  await service.create({token:'organizer',eventId:'e',seasonId:'s',category:'flower',
   version:1,rulesHash:hash,opensAt:1200,closesAt:2000,challengeUntil:2200});
  t=1300;
  await assert.rejects(service.enter({token:'guest',eventId:'e'}),/authentication-denied/);
  await service.enter({token:'alice',eventId:'e'});
  await assert.rejects(service.enter({token:'alice',eventId:'e'}),/duplicate-entry/);
  proofs.set('harvest-a',{accountId:'alice',harvestId:'harvest-a',qualityBps:9200,finalizedAt:1250,provenanceHash:hash});
  await service.submit({token:'alice',eventId:'e',harvestId:'harvest-a'});
  await assert.rejects(service.submit({token:'alice',eventId:'e',harvestId:'harvest-a'}),/submission-denied/);
  assert.equal((await service.status({token:'alice',eventId:'e'})).finalized,false);
  const other=createPostgresOrdinaryExhibitionRepository420({pool:runtime,gameId:otherGame});
  assert.equal(await other.transaction(tx=>tx.event('e'),{isolation:'serializable'}),null);
  // Reorged canonical proof is no longer eligible even though the DB result is immutable.
  proofs.delete('harvest-a');t=2200;
  assert.equal((await service.finalize({eventId:'e'})).winner,null);
  await assert.rejects(service.finalize({eventId:'e'}),/finalization-denied/);
  assert.equal((await service.status({token:'alice',eventId:'e'})).finalized,true);
 }finally{
  if(runtime)await runtime.end();
  await root.query('DROP SCHEMA IF EXISTS highcountry_exhibitions CASCADE').catch(()=>{});
  await root.query('DROP ROLE IF EXISTS hc_exhibition_ci_runtime').catch(()=>{});
  await root.end();
 }
});
