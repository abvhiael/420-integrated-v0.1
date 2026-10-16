import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {bootstrapDatastoreRoles,migrateDatastore} from '../src/schema-migrations.js';
import {createHighCountryRoutineJournal420} from '../src/highcountry-r066-routine-journal.js';
test('R06.6 real PostgreSQL 16: restricted role, durable replay uniqueness across sessions',async()=>{
 const url=process.env.HIGHCOUNTRY_R066_PG_URL;
 if(!url||!/\/r066_ci(?:\?|$)/.test(url))throw Error('isolated R06.6 PostgreSQL required');
 const pool=new pg.Pool({connectionString:url});
 try{
  await bootstrapDatastoreRoles(pool);
  await migrateDatastore(pool);
  const sql=await readFile(new URL('../migrations/007_highcountry_r066_routine.up.sql',import.meta.url),'utf8');
  const c=await pool.connect();
  try{
   await c.query('BEGIN');await c.query('SET LOCAL ROLE gaming_datastore_migrator');
   await c.query(sql);await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  const queryAsRuntime=async(sql,args)=>{
   const client=await pool.connect();
   try{
    await client.query('BEGIN');await client.query('SET LOCAL ROLE gaming_datastore_runtime');
    const response=await client.query(sql,args);await client.query('COMMIT');return response;
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  };
  const first=createHighCountryRoutineJournal420({pool:{query:queryAsRuntime}});
  const request={principal:'p1',sessionId:'s1',operation:'op1',action:'routine'};
  assert.equal(await first.claim(request),true);
  const second=createHighCountryRoutineJournal420({pool:{query:queryAsRuntime}});
  assert.equal(await second.claim(request),false);
  assert.equal(await second.claim({...request,operation:'op2'}),true);
  // Runtime role may append its own journal reservation, but never delete it or modify prior reservations.
  await assert.rejects(queryAsRuntime('DELETE FROM gaming_datastore.highcountry_r066_routine_operations WHERE principal=$1',['p1']));
  await assert.rejects(queryAsRuntime('TRUNCATE gaming_datastore.highcountry_r066_routine_operations'));
 }finally{await pool.end();}
});
