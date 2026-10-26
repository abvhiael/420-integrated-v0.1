import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
const URL=process.env.HC_SOC5B_TEST_DATABASE_URL;
if(!URL)throw Error('HC_SOC5B_TEST_DATABASE_URL required for actual Postgres integration');
const pool=new pg.Pool({connectionString:URL,max:3});
const role='hc_social_test_runtime',a='hc5b-test',b='other-game',tx='0x'+'a'.repeat(64);
test('SOC-5B real Postgres 16: RLS tenant isolation, restrictions, journal uniqueness and reconnect',async()=>{
 const admin=await pool.connect();
 try{
  await admin.query('BEGIN');
  for(const scope of [a,b])await admin.query("INSERT INTO highcountry_social_operations(scope,operation_id,principal,wallet,action,tx_hash,state) VALUES ($1,$2,'p','w','organization.join',$3,'submitted') ON CONFLICT DO NOTHING",[scope,'0x'+'b'.repeat(64),tx]);
  await admin.query("INSERT INTO highcountry_social_intents(scope,tx_hash,principal,wallet,action,raw_transaction,state) VALUES ($1,$2,'p','w','organization.join','0x1234','prepared') ON CONFLICT DO NOTHING",[a,tx]);
  await admin.query('COMMIT');
  const scoped=await pool.connect();
  try{
   await scoped.query('BEGIN');
   await scoped.query('SET LOCAL ROLE '+role);
   await scoped.query("SET LOCAL highcountry.social_namespace = 'other-game'");
   const r=await scoped.query('SELECT scope FROM highcountry_social_operations');
   assert.deepEqual(r.rows.map(x=>x.scope),[a]);
   assert.equal((await scoped.query('SELECT count(*)::integer AS n FROM highcountry_social_intents')).rows[0].n,1);
   await assert.rejects(scoped.query('DELETE FROM highcountry_social_operations'),/permission denied/);
   await scoped.query('ROLLBACK');
   await scoped.query('BEGIN');await scoped.query('SET LOCAL ROLE '+role);
   await assert.rejects(scoped.query("INSERT INTO highcountry_social_intents(scope,tx_hash,principal,wallet,action,raw_transaction) VALUES ('other-game',$1,'p','w','organization.join','0x1234')",[tx]),/row-level security|violates/);
   await scoped.query('ROLLBACK');
  }finally{scoped.release();}
  const reopened=await pool.connect();
  try{
   await reopened.query('BEGIN');await reopened.query('SET LOCAL ROLE '+role);
   const r=await reopened.query('SELECT state,raw_transaction FROM highcountry_social_intents WHERE tx_hash=$1',[tx]);
   assert.equal(r.rows.length,1);assert.equal(r.rows[0].state,'prepared');assert.equal(r.rows[0].raw_transaction,'0x1234');
   const transition=await reopened.query("UPDATE highcountry_social_intents SET state='broadcast' WHERE scope=$1 AND tx_hash=$2 RETURNING state",[a,tx]);
   assert.equal(transition.rowCount,1);assert.equal(transition.rows[0].state,'broadcast');
   await reopened.query('COMMIT');
  }finally{reopened.release();}
  const afterRestart=await pool.connect();
  try{
   await afterRestart.query('BEGIN');await afterRestart.query('SET LOCAL ROLE '+role);
   assert.equal((await afterRestart.query('SELECT state FROM highcountry_social_intents WHERE tx_hash=$1',[tx])).rows[0].state,'broadcast');
   const duplicate=await afterRestart.query("INSERT INTO highcountry_social_intents(scope,tx_hash,principal,wallet,action,raw_transaction) VALUES ($1,$2,'p','w','organization.join','0x1234') ON CONFLICT DO NOTHING",[a,tx]);
   assert.equal(duplicate.rowCount,0,'replay must not create a second journal entry');
   await afterRestart.query('ROLLBACK');
  }finally{afterRestart.release();}
 }finally{admin.release();await pool.end();}
});
