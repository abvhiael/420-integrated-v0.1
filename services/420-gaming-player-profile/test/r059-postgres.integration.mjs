import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {randomBytes} from 'node:crypto';
import {bootstrapDatastoreRoles,migrateDatastore} from '../src/schema-migrations.js';
import {migrateR059Abuse,r059Digest} from '../src/r059-schema-migrations.js';
import {createGamingAbuseGuard420} from '../src/r059-security-operations.js';
const uri=process.env.GAMING_R059_TEST_URL;
if(!uri||!new URL(uri).pathname.endsWith('/r059_ci'))throw Error('isolated r059_ci required');
const pool=new Pool({connectionString:uri,max:12}),gameId='0x'+'a'.repeat(64);
test('R05.9 real PostgreSQL atomic quota, tenant isolation, RLS and digest',async()=>{
 try{
  await bootstrapDatastoreRoles(pool);await migrateDatastore(pool);
  assert.equal((await migrateR059Abuse(pool)).changed,true);
  assert.equal((await migrateR059Abuse(pool)).changed,false);
  const key=randomBytes(32),config={pool,key,maxRequests:5,windowSeconds:60};
  const a=createGamingAbuseGuard420(config),b=createGamingAbuseGuard420(config);
  const results=await Promise.allSettled(Array.from({length:12},(_,i)=>
   (i%2===0?a:b).consume({accountId:'alice',gameId,action:'events'})));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,5);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason?.code==='abuse-rate-limited').length,7);
  const bob=await b.consume({accountId:'bob',gameId,action:'events'});
  assert.equal(bob.remaining,4);
  const rows=(await pool.query('SELECT scope_digest,count FROM gaming_datastore.abuse_buckets')).rows;
  assert.equal(rows.length,2);
  assert.ok(rows.every(x=>/^[a-f0-9]{64}$/.test(x.scope_digest)));
  assert.ok(rows.every(x=>!JSON.stringify(x).includes('alice')&&!JSON.stringify(x).includes('bob')));
  const user='r059_unprivileged';
  await pool.query(`CREATE ROLE "${user}" LOGIN PASSWORD 'local_ci_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
  const u=new URL(uri);u.username=user;u.password='local_ci_only';
  const runtime=new Pool({connectionString:u.toString()});
  try{
   await assert.rejects(()=>runtime.query('SELECT * FROM gaming_datastore.abuse_buckets'),e=>e.code==='42501');
   await assert.rejects(()=>runtime.query('UPDATE gaming_datastore.abuse_buckets SET count=1'),e=>e.code==='42501');
  }finally{await runtime.end();}
  await pool.query("UPDATE gaming_datastore.abuse_schema SET digest=repeat('f',64)");
  await assert.rejects(()=>migrateR059Abuse(pool),/r059-migration-drift/);
  await pool.query('UPDATE gaming_datastore.abuse_schema SET digest=$1',[r059Digest]);
 }finally{await pool.end();}
});
