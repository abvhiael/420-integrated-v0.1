import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sql=readFileSync(new URL('../migrations/003_migration_runtime.up.sql',import.meta.url),'utf8');
export const migrationRuntimeDigest=createHash('sha256').update(sql).digest('hex');
export async function migrateMigrationRuntime(pool) {
  if(typeof pool?.connect!=='function')throw Error('migration-runtime-configuration');
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0].allowed)
      throw Error('migration-runtime-denied');
    await c.query('SET LOCAL ROLE gaming_datastore_migrator');
    await c.query('SELECT pg_advisory_xact_lock(420,503)');
    const registered=(await c.query("SELECT to_regclass('gaming_datastore.migration_application_schema') AS present")).rows[0].present;
    if(!registered){
      const base=(await c.query('SELECT version FROM gaming_datastore.schema_migrations')).rows;
      const wallet=(await c.query('SELECT version FROM gaming_datastore.wallet_link_schema')).rows;
      if(base.length!==1||base[0].version!==1||wallet.length!==1||wallet[0].version!==2)
        throw Error('migration-runtime-baseline');
      await c.query(sql);
      await c.query('INSERT INTO gaming_datastore.migration_application_schema(version,digest) VALUES(3,$1)',[migrationRuntimeDigest]);
    } else {
      const current=(await c.query('SELECT version,digest FROM gaming_datastore.migration_application_schema')).rows;
      if(current.length!==1||current[0].version!==3||current[0].digest!==migrationRuntimeDigest)
        throw Error('migration-runtime-drift');
    }
    await c.query('COMMIT');
    return {changed:!registered,version:3,digest:migrationRuntimeDigest};
  } catch(e){
    try{await c.query('ROLLBACK');}catch{}
    if(['migration-runtime-denied','migration-runtime-baseline','migration-runtime-drift'].includes(e.message))throw e;
    throw Error('migration-runtime-migration-failed');
  } finally{c.release();}
}
