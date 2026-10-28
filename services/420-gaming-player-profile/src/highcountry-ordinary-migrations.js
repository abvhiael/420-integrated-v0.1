// Additive HC-NEXT-7.2 migration. Never silently alter an existing schema.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const schema=readFileSync(new URL('../migrations/010_highcountry_ordinary_exhibitions.up.sql',import.meta.url),'utf8');
export const ordinaryExhibitionsMigrationDigest420=createHash('sha256').update(schema).digest('hex');
export async function migrateOrdinaryExhibitions420(pool){
 const c=await pool.connect();let opened=false;
 try{
  await c.query('BEGIN');opened=true;
  const allowed=(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS ok")).rows[0]?.ok;
  if(!allowed)throw Error('migration-role-denied');
  await c.query('SET LOCAL ROLE gaming_datastore_migrator');
  await c.query('SELECT pg_advisory_xact_lock(420, 702)');
  const exists=(await c.query("SELECT to_regclass('highcountry_exhibitions.migration_history') AS present")).rows[0]?.present;
  if(exists){
   const history=(await c.query('SELECT version,digest FROM highcountry_exhibitions.migration_history')).rows;
   if(history.length!==1||history[0].version!==1||history[0].digest!==ordinaryExhibitionsMigrationDigest420)
    throw Error('exhibition-schema-drift');
   await c.query('COMMIT');opened=false;
   return {changed:false,version:1,digest:ordinaryExhibitionsMigrationDigest420};
  }
  const partial=(await c.query("SELECT to_regclass('highcountry_exhibitions.seasons') AS present")).rows[0]?.present;
  if(partial)throw Error('exhibition-untracked-schema');
  await c.query(schema);
  await c.query('CREATE TABLE highcountry_exhibitions.migration_history(version integer PRIMARY KEY,digest text NOT NULL)');
  await c.query('INSERT INTO highcountry_exhibitions.migration_history(version,digest) VALUES(1,$1)',
   [ordinaryExhibitionsMigrationDigest420]);
  await c.query('COMMIT');opened=false;
  return {changed:true,version:1,digest:ordinaryExhibitionsMigrationDigest420};
 }catch(e){if(opened)try{await c.query('ROLLBACK');}catch{}throw e;}
 finally{c.release();}
}
