// R05.5 operator-only backup/retention worker. Requires independently scoped account authority.
// PostgreSQL is the immutable source of jobs; object storage owns raw bytes.
import {randomUUID} from 'node:crypto';
import {saveLifecycleDigest} from './save-lifecycle-migrations.js';
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&!/^0x0+$/.test(x);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<2n**64n;
export class SaveRetentionWorker420 {
 #pool;#auth;#storage;
 constructor({operatorPool,authorize,storage}={}){
  if(typeof operatorPool?.connect!=='function'||typeof authorize!=='function'||
   typeof storage?.delete!=='function'||typeof storage?.copy!=='function')fail('save-worker-invalid-configuration');
  this.#pool=operatorPool;this.#auth=authorize;this.#storage=storage;
 }
 async #tx(fn){
  const c=await this.#pool.connect();
  try{
   await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
   await c.query("SET LOCAL statement_timeout='10s'");
   if(!(await c.query("SELECT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') AS allowed")).rows[0]?.allowed)
    fail('save-operator-denied');
   await c.query('SET LOCAL ROLE gaming_datastore_migrator');
   const rows=(await c.query('SELECT version,digest FROM gaming_datastore.save_lifecycle_schema')).rows;
   if(rows.length!==1||rows[0].version!==5||rows[0].digest!==saveLifecycleDigest)fail('save-schema-drift');
   const result=await fn(c);await c.query('COMMIT');return result;
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
 }
 async backup({accountId,gameId,revision,backupId,expiresAt,authority}){
  if(!opaque(accountId)||!hash(gameId)||!uint(revision)||revision==='0'||
   !opaque(backupId)||!uint(expiresAt))fail('save-invalid-backup');
  if(await this.#auth({authority,accountId,gameId,purpose:'SAVE_BACKUP'})!==true)
   fail('save-authority-denied');
  return this.#tx(async c=>{
   const src=(await c.query(`SELECT * FROM gaming_datastore.save_references
    WHERE account_id=$1 AND game_id=$2 AND revision=$3 FOR SHARE`,[accountId,gameId,revision])).rows[0];
   if(!src)fail('save-source-missing');
   const active=(await c.query(`SELECT count(*)::integer AS n FROM gaming_datastore.save_backups
    WHERE account_id=$1 AND game_id=$2 AND deleted_at IS NULL AND expires_at>gaming_datastore.now_seconds()`,
    [accountId,gameId])).rows[0];
   if(active.n>=16)fail('save-backup-limit');
   const copied=await this.#storage.copy({providerId:src.provider_id,objectRef:src.object_ref,integrity:src.state_hash});
   if(!copied||!opaque(copied.providerId)||!opaque(copied.objectRef)||
    copied.integrity!==src.state_hash||
    (copied.providerId===src.provider_id&&copied.objectRef===src.object_ref))fail('save-backup-copy-invalid');
   const row=(await c.query(`INSERT INTO gaming_datastore.save_backups
    (account_id,game_id,backup_id,source_revision,provider_id,object_ref,
     state_hash,byte_length,schema_label,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT(account_id,game_id,backup_id) DO NOTHING RETURNING *`,
    [accountId,gameId,backupId,revision,copied.providerId,copied.objectRef,src.state_hash,
     src.byte_length,src.schema_label,expiresAt])).rows[0];
   if(!row)fail('save-backup-replayed');
   return {backupId,sourceRevision:revision,expiresAt};
  });
 }
 async requestDelete({accountId,gameId,backupId,authority,reason='USER_DELETE'}){
  if(!opaque(accountId)||!hash(gameId)||!opaque(backupId)||
   !['USER_DELETE','CONSENT_REVOKED'].includes(reason))fail('save-invalid-deletion');
  if(await this.#auth({authority,accountId,gameId,purpose:'SAVE_DELETE'})!==true)
   fail('save-authority-denied');
  return this.#tx(async c=>{
   const ref=(await c.query(`SELECT * FROM gaming_datastore.save_backups
    WHERE account_id=$1 AND game_id=$2 AND backup_id=$3 FOR UPDATE`,
    [accountId,gameId,backupId])).rows[0];
   if(!ref)fail('save-backup-missing');
   if(ref.deleted_at!==null)return {backupId,duplicate:true};
   // Do not delete a shared underlying blob referenced by any live save/backup.
   // Tombstone backup metadata now; physical deletion only if no other live references exist.
   await c.query(`UPDATE gaming_datastore.save_backups
     SET deleted_at=gaming_datastore.now_seconds()
     WHERE account_id=$1 AND game_id=$2 AND backup_id=$3`,[accountId,gameId,backupId]);
   const still=(await c.query(`SELECT 1 FROM gaming_datastore.save_references
    WHERE provider_id=$1 AND object_ref=$2 LIMIT 1`,[ref.provider_id,ref.object_ref])).rows;
   if(still.length)return {backupId,duplicate:false,physicalDelete:false};
   const pending=(await c.query(`SELECT 1 FROM gaming_datastore.save_backups
    WHERE provider_id=$1 AND object_ref=$2 AND deleted_at IS NULL LIMIT 1`,
    [ref.provider_id,ref.object_ref])).rows;
   if(pending.length)return {backupId,duplicate:false,physicalDelete:false};
   await c.query(`INSERT INTO gaming_datastore.save_deletion_jobs
    (account_id,game_id,job_id,provider_id,object_ref,reason)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [accountId,gameId,randomUUID(),ref.provider_id,ref.object_ref,reason]);
   return {backupId,duplicate:false,physicalDelete:true};
  });
 }
 async expire({limit=10}={}){
  if(!Number.isInteger(limit)||limit<1||limit>100)fail('save-invalid-limit');
  return this.#tx(async c=>{
   const due=(await c.query(`SELECT account_id,game_id,backup_id FROM gaming_datastore.save_backups
    WHERE expires_at<=gaming_datastore.now_seconds() AND deleted_at IS NULL
    ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT $1`,[limit])).rows;
   // Retention tombstones are durable and safe even when the provider is down.
   for(const a of due){
    await c.query(`UPDATE gaming_datastore.save_backups SET deleted_at=gaming_datastore.now_seconds()
      WHERE account_id=$1 AND game_id=$2 AND backup_id=$3`,[a.account_id,a.game_id,a.backup_id]);
   }
   return due.length;
  });
 }
 async drain({max=5}={}){
  if(!Number.isInteger(max)||max<1||max>20)fail('save-invalid-limit');
  const leased=await this.#tx(async c=>{
   const rows=(await c.query(`SELECT * FROM gaming_datastore.save_deletion_jobs
    WHERE status IN ('PENDING','RETRY') OR (status='LEASED' AND lease_until<=gaming_datastore.now_seconds())
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1`,[max])).rows;
   const selected=[];
   for(const row of rows){
    const token=randomUUID();
    await c.query(`UPDATE gaming_datastore.save_deletion_jobs
     SET status='LEASED',lease_token=$4,lease_until=gaming_datastore.now_seconds()+120,
      attempts=attempts+1 WHERE account_id=$1 AND game_id=$2 AND job_id=$3`,
     [row.account_id,row.game_id,row.job_id,token]);
    selected.push({...row,token});
   }
   return selected;
  });
  const results=[];
  for(const job of leased){
   let deleted=false;
   try{await this.#storage.delete({providerId:job.provider_id,objectRef:job.object_ref});deleted=true;}catch{}
   const outcome=await this.#tx(async c=>{
    const row=(await c.query(`UPDATE gaming_datastore.save_deletion_jobs
     SET status=$5,lease_token=NULL,lease_until=NULL,
      completed_at=CASE WHEN $5='DONE' THEN gaming_datastore.now_seconds() ELSE NULL END
     WHERE account_id=$1 AND game_id=$2 AND job_id=$3 AND lease_token=$4
     AND status='LEASED' RETURNING status`,
     [job.account_id,job.game_id,job.job_id,job.token,
      deleted?'DONE':job.attempts>=29?'RETRY':'RETRY'])).rows[0];
    if(!row)fail('save-lease-lost');
    return row.status;
   });
   results.push({jobId:job.job_id,status:outcome});
  }
  return results;
 }

}
