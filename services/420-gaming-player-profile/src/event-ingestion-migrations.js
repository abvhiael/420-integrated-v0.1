import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ddl=readFileSync(new URL('../migrations/005_event_ingestion.up.sql',import.meta.url),'utf8');
export const eventIngestionDigest=createHash('sha256').update(ddl).digest('hex');
export async function migrateEventIngestion(pool){
 if(typeof pool?.connect!=='function')throw Error('events-pool-required');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0]?.allowed)
   throw Error('events-migrator-denied');
  await c.query('SET LOCAL ROLE gaming_datastore_migrator');
  await c.query('SELECT pg_advisory_xact_lock(420,506)');
  const exists=(await c.query("SELECT to_regclass('gaming_datastore.event_ingestion_schema') AS t")).rows[0]?.t;
  if(!exists){
   const base=(await c.query('SELECT version,digest FROM gaming_datastore.schema_migrations')).rows;
   if(base.length!==1||base[0].version!==1)throw Error('events-base-missing');
   await c.query(ddl);
   await c.query('INSERT INTO gaming_datastore.event_ingestion_schema(version,digest) VALUES(6,$1)',[eventIngestionDigest]);
  }else{
   const rows=(await c.query('SELECT version,digest FROM gaming_datastore.event_ingestion_schema')).rows;
   if(rows.length!==1||rows[0].version!==6||rows[0].digest!==eventIngestionDigest)
    throw Error('events-schema-drift');
  }
  await c.query('COMMIT');
  return {changed:!exists,version:6,digest:eventIngestionDigest};
 }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
}
