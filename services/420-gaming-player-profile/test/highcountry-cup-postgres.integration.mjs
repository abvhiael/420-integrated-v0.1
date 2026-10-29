import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {bootstrapDatastoreRoles} from '../src/schema-migrations.js';
import {migrateCupAchievements420} from '../src/highcountry-cup-migrations.js';
import {createPostgresCupAchievements420} from '../src/highcountry-cup-achievements.js';
const url=process.env.HIGHCOUNTRY_CUP_POSTGRES_TEST_URL;
if(!url||new URL(url).pathname!=='/hc_cup_ci')throw Error('isolated-cup-postgres-required');
const hex=(c,n)=>'0x'+c.repeat(n);
const cupId=hex('1',64),game=hex('2',64),second=hex('3',64);
test('real PostgreSQL SERIALIZABLE Cup snapshots, idempotency, isolation, revocation and restricted runtime role',async()=>{
 const root=new Pool({connectionString:url});let runtime;
 try{
  await bootstrapDatastoreRoles(root);
  assert.equal((await migrateCupAchievements420(root)).changed,true);
  assert.equal((await migrateCupAchievements420(root)).changed,false);
  await root.query("CREATE ROLE hc_cup_ci_runtime LOGIN PASSWORD 'test-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
  await root.query('GRANT gaming_datastore_runtime TO hc_cup_ci_runtime');
  const runtimeUrl=new URL(url);runtimeUrl.username='hc_cup_ci_runtime';runtimeUrl.password='test-only';
  runtime=new Pool({connectionString:runtimeUrl.toString()});
  await assert.rejects(runtime.query('DROP SCHEMA highcountry_cup CASCADE'));
  await assert.rejects(runtime.query('UPDATE highcountry_cup.history SET prestige=false'));
  let canonical={cupId,chainId:420,cupAddress:hex('a',40),
   blockHash:hex('b',64),champion:hex('c',40),resultCommitment:hex('d',64),
   scope:hex('e',64),achievement:{kind:'prestige'}};
  const projection={standings:async()=>canonical};
  const store=createPostgresCupAchievements420({pool:runtime,gameId:game,projection});
  await Promise.all([store.synchronize({cupId}),store.synchronize({cupId})]);
  assert.equal((await store.current({cupId})).current,true);
  assert.equal(Number((await runtime.query('SELECT count(*) AS count FROM highcountry_cup.achievements')).rows[0].count),1);
  assert.equal(Number((await runtime.query('SELECT count(*) AS count FROM highcountry_cup.history')).rows[0].count),1);
  canonical={...canonical,blockHash:hex('f',64),achievement:null};
  assert.equal((await store.current({cupId})).current,false);
  await store.synchronize({cupId});
  assert.equal((await store.current({cupId})).current,true);
  assert.equal(Number((await runtime.query('SELECT count(*) AS count FROM highcountry_cup.history')).rows[0].count),2);
  const another=createPostgresCupAchievements420({pool:runtime,gameId:second,projection});
  assert.equal((await another.current({cupId})).recorded,false);
 }finally{
  if(runtime)await runtime.end();
  await root.query('DROP SCHEMA IF EXISTS highcountry_cup CASCADE').catch(()=>{});
  await root.query('DROP ROLE IF EXISTS hc_cup_ci_runtime').catch(()=>{});
  await root.end();
 }
});
