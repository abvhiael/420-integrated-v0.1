import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {PostgresBudsStore} from '../src/postgres-store.js';
import {SeedCollection} from '../src/seed-catalogue.js';
import {fixture} from './seed-catalogue.fixture.mjs';
const url=process.env.HC_TEST_POSTGRES_URL;if(!url)throw Error('dedicated HC_TEST_POSTGRES_URL required');
const admin=new pg.Pool({connectionString:url,max:4});const role='hc_seed05_'+process.pid;let pool;
const empty={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],assets:[],assetSources:[],listings:[],transferIntents:[],importedAssets:[],issued:0,burned:0};
try{
 await admin.query(await readFile(new URL('../migrations/001_buds_state.sql',import.meta.url),'utf8'));
 await admin.query(await readFile(new URL('../migrations/002_runtime_namespace_rls.sql',import.meta.url),'utf8'));
 await admin.query('CREATE ROLE '+role+" LOGIN PASSWORD 'seed05_disposable_only'");
 await admin.query('GRANT USAGE ON SCHEMA public TO '+role);await admin.query('GRANT SELECT, UPDATE ON highcountry_buds_state TO '+role);
 await admin.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[role,JSON.stringify(empty)]);
 const runtimeUrl=new URL(url);runtimeUrl.username=role;runtimeUrl.password='seed05_disposable_only';pool=new pg.Pool({connectionString:runtimeUrl.toString(),max:6});
 const store=new PostgresBudsStore(pool,role),f=await fixture({store});
 await f.service.snapshot(f.alice);await f.service.claimHarvest(f.alice,'7');
 const restartStore=new PostgresBudsStore(pool,role),identity=Object.create(Object.getPrototypeOf(f.identity));Object.assign(identity,f.identity,{store:restartStore});
 const restarted=new SeedCollection({store:restartStore,identity,catalogue:f.catalogue,reader:f.chain.reader});
 assert.equal((await restarted.snapshot(f.alice)).cards.length,1);assert.equal((await restarted.snapshot(f.bob)).cards.length,0);
 await restarted.claimHarvest(f.alice,'7');
 // Both racing instances see the same durable source key; a serialization loser may retry.
 const results=await Promise.allSettled([f.service.claimHarvest(f.alice,'7'),restarted.claimHarvest(f.alice,'7')]);assert.ok(results.some(r=>r.status==='fulfilled'));
 const persisted=await restartStore.transact(s=>({cards:s.seedHarvestCards.size,claims:s.seedHarvestClaims.size,issued:s.issued,burned:s.burned,assets:s.assets.size,discovered:s.seedDiscoveries.get('alice')}));
 assert.deepEqual(persisted,{cards:1,claims:1,issued:0,burned:0,assets:0,discovered:['HC-C-blue-dream']});
 assert.equal((await pool.query('SELECT * FROM highcountry_buds_state WHERE namespace=$1',['other_namespace'])).rows.length,0);
 await assert.rejects(pool.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',['forbidden',JSON.stringify(empty)]));
 await assert.rejects(pool.query('ALTER TABLE highcountry_buds_state ADD COLUMN forbidden text'));
 console.log('Seed collection PostgreSQL: signed accounts, durable discoveries/cards, independent instance restart, atomic replay, zero asset/currency issuance and restricted-role/RLS PASS');
}finally{
 if(pool)await pool.end();
 await admin.query('DELETE FROM highcountry_buds_state WHERE namespace=$1',[role]).catch(()=>{});
 await admin.query('DROP OWNED BY '+role).catch(()=>{});await admin.query('DROP ROLE '+role).catch(()=>{});await admin.end();
}
