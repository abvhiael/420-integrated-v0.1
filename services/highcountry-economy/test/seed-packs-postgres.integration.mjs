import assert from 'node:assert/strict';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {PostgresBudsStore} from '../src/postgres-store.js';
import {SeedPacks} from '../src/seed-packs.js';
import {SeedCollection} from '../src/seed-catalogue.js';
import {fixture} from './seed-catalogue.fixture.mjs';
const url=process.env.HC_TEST_POSTGRES_URL;if(!url)throw Error('dedicated HC_TEST_POSTGRES_URL required');
const admin=new pg.Pool({connectionString:url,max:4});const role='hc_seed07_'+process.pid,foreign=role+'_other';let pool;
const empty={schema:1,balances:[],operations:[],claims:[],sourceIssued:[],assets:[],assetSources:[],listings:[],transferIntents:[],importedAssets:[],issued:0,burned:0};
try{
 await admin.query(await readFile(new URL('../migrations/001_buds_state.sql',import.meta.url),'utf8'));
 await admin.query(await readFile(new URL('../migrations/002_runtime_namespace_rls.sql',import.meta.url),'utf8'));
 await admin.query('CREATE ROLE '+role+" LOGIN PASSWORD 'seed05_disposable_only'");
 await admin.query('GRANT USAGE ON SCHEMA public TO '+role);await admin.query('GRANT SELECT, UPDATE ON highcountry_buds_state TO '+role);
 await admin.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[role,JSON.stringify(empty)]);
 await admin.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',[foreign,JSON.stringify(empty)]);
 const runtimeUrl=new URL(url);runtimeUrl.username=role;runtimeUrl.password='seed05_disposable_only';pool=new pg.Pool({connectionString:runtimeUrl.toString(),max:6});
 const store=new PostgresBudsStore(pool,role),f=await fixture({store});
 const packs=new SeedPacks({...f,reader:f.chain.reader});
 const attempts=await Promise.allSettled(Array.from({length:12},()=>packs.starter(f.alice,'Red Mesa')));
 assert.ok(attempts.some(r=>r.status==='fulfilled'));
 // SERIALIZABLE conflicts may retry the same request, never a new source/pack identity.
 const grant=await packs.starter(f.alice,'Red Mesa');assert.equal(grant.length,2);
 const intent=await packs.prepare(f.alice,grant[0].id);
 const restartStore=new PostgresBudsStore(pool,role),identity=Object.create(Object.getPrototypeOf(f.identity));Object.assign(identity,f.identity,{store:restartStore});
 const restarted=new SeedPacks({store:restartStore,identity,catalogue:f.catalogue,reader:f.chain.reader});
 assert.deepEqual(await restarted.starter(f.alice,'Red Mesa'),(await packs.inventory(f.alice)).packs);
 assert.deepEqual(await restarted.prepare(f.alice,grant[0].id),intent);
 await identity.unlink(f.alice);assert.equal((await restarted.starter(f.alice,'Red Mesa')).length,2);
 await assert.rejects(restarted.starter(f.alice,'Emerald Coast'),/already issued/);
 const persisted=await restartStore.transact(s=>({packs:s.seedPacks.size,grants:s.seedStarterGrants.size,lots:s.seedLotIntents.size,lotIds:s.seedLotIds.size,walletClaims:s.seedStarterWalletClaims.size,issued:s.issued,burned:s.burned,assets:s.assets.size,units:[...s.seedSupply.entries()].filter(([k])=>k.startsWith('seeds:')).reduce((n,[,v])=>n+v,0)}));
 assert.deepEqual(persisted,{packs:2,grants:1,lots:1,lotIds:1,walletClaims:1,issued:0,burned:0,assets:0,units:6});
 assert.equal((await restarted.inventory(f.bob)).packs.length,0);
 assert.equal((await admin.query('SELECT * FROM highcountry_buds_state WHERE namespace=$1',[foreign])).rows.length,1);
 assert.equal((await pool.query('SELECT * FROM highcountry_buds_state WHERE namespace=$1',[foreign])).rows.length,0);
 assert.equal((await pool.query('UPDATE highcountry_buds_state SET state=state WHERE namespace=$1',[foreign])).rowCount,0);
 await assert.rejects(new PostgresBudsStore(pool,foreign).transact(()=>null),/unprovisioned/);
 await assert.rejects(pool.query('INSERT INTO highcountry_buds_state(namespace,state) VALUES($1,$2::jsonb)',['forbidden',JSON.stringify(empty)]));
 await assert.rejects(pool.query('ALTER TABLE highcountry_buds_state ADD COLUMN forbidden text'));
 console.log('Seed pack PostgreSQL: signed accounts, 12 racing starter claims, independent instance restart, durable lot IDs/supply/wallet claims, atomic replay, zero asset/currency issuance and restricted-role/RLS PASS');
}finally{
 if(pool)await pool.end();
 await admin.query('DELETE FROM highcountry_buds_state WHERE namespace IN ($1,$2)',[role,foreign]).catch(()=>{});
 await admin.query('DROP OWNED BY '+role).catch(()=>{});await admin.query('DROP ROLE '+role).catch(()=>{});await admin.end();
}
