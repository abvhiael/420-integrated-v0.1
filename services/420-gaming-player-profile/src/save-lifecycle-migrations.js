import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync(new URL('../migrations/004_save_lifecycle.up.sql',import.meta.url),'utf8');
export const saveLifecycleDigest=createHash('sha256').update(sql).digest('hex');
export async function migrateSaveLifecycle(pool) {
 if(typeof pool?.connect!=='function')throw Error('save-schema-configuration');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0]?.allowed)
   throw Error('save-migration-denied');
  await c.query('SET LOCAL ROLE gaming_datastore_migrator');
  await c.query('SELECT pg_advisory_xact_lock(420,505)');
  const exists=(await c.query("SELECT to_regclass('gaming_datastore.save_lifecycle_schema') AS present")).rows[0].present;
  if(!exists){
   const a=(await c.query('SELECT version FROM gaming_datastore.schema_migrations')).rows;
   const d=(await c.query('SELECT version FROM gaming_datastore.migration_application_schema')).rows;
   if(a.length!==1||a[0].version!==1||d.length!==1||d[0].version!==3)throw Error('save-migration-baseline');
   await c.query(sql);
   await c.query('INSERT INTO gaming_datastore.save_lifecycle_schema(version,digest) VALUES(5,$1)',[saveLifecycleDigest]);
  }else{
   const rows=(await c.query('SELECT version,digest FROM gaming_datastore.save_lifecycle_schema')).rows;
   if(rows.length!==1||rows[0].version!==5||rows[0].digest!==saveLifecycleDigest)
    throw Error('save-schema-drift');
  }
  await c.query('COMMIT');
  return {changed:!exists,version:5,digest:saveLifecycleDigest};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
