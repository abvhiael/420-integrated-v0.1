// HC-NEXT-7.4 — one-way, migrator-only additive schema installation.
// Never migrate from an HTTP request or from the normal runtime role.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync(new URL('../migrations/011_highcountry_cup_achievements.up.sql',import.meta.url),'utf8');
export const cupMigrationDigest420=createHash('sha256').update(sql).digest('hex');
export async function migrateCupAchievements420(pool){
 if(typeof pool?.connect!=='function')throw Error('cup-migration-config-invalid');
 const c=await pool.connect();let opened=false;
 try{
  await c.query('BEGIN');opened=true;
  const check=await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS ok");
  if(check.rows[0]?.ok!==true)throw Error('cup-migration-role-denied');
  await c.query('SET LOCAL ROLE gaming_datastore_migrator');
  await c.query('SELECT pg_advisory_xact_lock(420, 704)');
  const exists=(await c.query("SELECT to_regclass('highcountry_cup.migration_history') AS present")).rows[0]?.present;
  if(exists){
   const records=(await c.query('SELECT version,digest FROM highcountry_cup.migration_history')).rows;
   if(records.length!==1||records[0].version!==1||records[0].digest!==cupMigrationDigest420)
    throw Error('cup-migration-drift');
   await c.query('COMMIT');opened=false;
   return {changed:false,digest:cupMigrationDigest420};
  }
  const partial=(await c.query("SELECT to_regclass('highcountry_cup.achievements') AS present")).rows[0]?.present;
  if(partial)throw Error('cup-migration-untracked-schema');
  await c.query(sql);
  await c.query('CREATE TABLE highcountry_cup.migration_history(version integer PRIMARY KEY,digest text NOT NULL)');
  await c.query('INSERT INTO highcountry_cup.migration_history(version,digest) VALUES(1,$1)',[cupMigrationDigest420]);
  await c.query('COMMIT');opened=false;
  return {changed:true,digest:cupMigrationDigest420};
 }catch(e){if(opened)try{await c.query('ROLLBACK');}catch{}throw e;}
 finally{c.release();}
}
