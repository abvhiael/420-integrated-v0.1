import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
// Run with independently approved migrator-member credentials and a provisioned R05 datastore.
if(!process.env.GAMING_DATASTORE_MIGRATION_URL)throw Error('migration connection required');
const pool=new Pool({connectionString:process.env.GAMING_DATASTORE_MIGRATION_URL});
try{
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const m=(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0];
  if(!m?.allowed)throw Error('routine-migration-role-denied');
  await c.query('SET LOCAL ROLE gaming_datastore_migrator');
  await c.query('SELECT pg_advisory_xact_lock(420,606)');
  const existing=(await c.query("SELECT to_regclass('gaming_datastore.highcountry_r066_routine_operations') AS table_name")).rows[0]?.table_name;
  if(existing)throw Error('routine-migration-already-present; verify exact schema');
  const sql=await readFile(new URL('../migrations/007_highcountry_r066_routine.up.sql',import.meta.url),'utf8');
  await c.query(sql);await c.query('COMMIT');
  console.log('R06.6 routine journal migration applied under restricted migrator role');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){console.error('R06.6 migration not applied:',e.message);process.exitCode=1;}
finally{await pool.end();}
