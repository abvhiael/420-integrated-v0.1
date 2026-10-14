import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync(new URL('../migrations/006_abuse_operations.up.sql',import.meta.url),'utf8');
export const r059Digest=createHash('sha256').update(sql).digest('hex');
export async function migrateR059Abuse(pool){
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS ok")).rows[0]?.ok)
   throw Error('r059-migration-role-denied');
  await c.query('SET LOCAL ROLE gaming_datastore_migrator');
  await c.query('SELECT pg_advisory_xact_lock(420,509)');
  const exists=(await c.query("SELECT to_regclass('gaming_datastore.abuse_schema') AS t")).rows[0]?.t;
  if(!exists){
   await c.query(sql);
   await c.query('INSERT INTO gaming_datastore.abuse_schema(version,digest) VALUES(9,$1)',[r059Digest]);
  }else{
   const rows=(await c.query('SELECT version,digest FROM gaming_datastore.abuse_schema')).rows;
   if(rows.length!==1||rows[0].version!==9||rows[0].digest!==r059Digest)throw Error('r059-migration-drift');
  }
  await c.query('COMMIT');
  return {changed:!exists,version:9,digest:r059Digest};
 }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
}
