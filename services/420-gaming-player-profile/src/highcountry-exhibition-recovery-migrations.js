import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const schema=readFileSync(new URL('../migrations/012_highcountry_exhibition_recovery.up.sql',import.meta.url),'utf8');
export const exhibitionRecoveryDigest420=createHash('sha256').update(schema).digest('hex');
export async function migrateExhibitionRecovery420(pool){
 const c=await pool.connect();let opened=false;
 try{
  await c.query('BEGIN');opened=true;
  if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS ok")).rows[0]?.ok)
   throw Error('migration-role-denied');
  await c.query('SET LOCAL ROLE gaming_datastore_migrator');
  await c.query('SELECT pg_advisory_xact_lock(420, 705)');
  const existing=(await c.query("SELECT to_regclass('highcountry_exhibitions.adjudication_history') AS present")).rows[0]?.present;
  const tracking=(await c.query("SELECT to_regclass('highcountry_exhibitions.recovery_migration_history') AS present")).rows[0]?.present;
  if(tracking){
   const rows=(await c.query('SELECT version,digest FROM highcountry_exhibitions.recovery_migration_history')).rows;
   if(rows.length!==1||rows[0].version!==1||rows[0].digest!==exhibitionRecoveryDigest420||!existing)
    throw Error('exhibition-recovery-schema-drift');
   await c.query('COMMIT');opened=false;return {changed:false,digest:exhibitionRecoveryDigest420};
  }
  if(existing)throw Error('exhibition-recovery-untracked-schema');
  if(!(await c.query("SELECT to_regclass('highcountry_exhibitions.results') AS present")).rows[0]?.present)
   throw Error('exhibition-base-migration-required');
  await c.query(schema);
  await c.query('CREATE TABLE highcountry_exhibitions.recovery_migration_history(version integer PRIMARY KEY,digest text NOT NULL)');
  await c.query('INSERT INTO highcountry_exhibitions.recovery_migration_history VALUES(1,$1)',[exhibitionRecoveryDigest420]);
  await c.query('COMMIT');opened=false;return {changed:true,digest:exhibitionRecoveryDigest420};
 }catch(e){if(opened)await c.query('ROLLBACK').catch(()=>{});throw e;}
 finally{c.release();}
}
