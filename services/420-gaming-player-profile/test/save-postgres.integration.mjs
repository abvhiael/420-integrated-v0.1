import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {CloudSaveLifecycle420} from '../src/cloud-save-lifecycle.js';
import {EncryptedLocalSaveProvider420} from '../src/encrypted-local-save-provider.js';
import {bootstrapDatastoreRoles,migrateDatastore} from '../src/schema-migrations.js';
import {migrateWalletLinks} from '../src/wallet-link-migrations.js';
import {migrateMigrationRuntime} from '../src/migration-runtime-migrations.js';
import {migrateSaveLifecycle,saveLifecycleDigest} from '../src/save-lifecycle-migrations.js';
import {GamingDatastoreProvisioner420} from '../src/datastore-provisioning.js';
import {PostgresGamingRepository420,saveScopeDigest} from '../src/postgres-repository.js';
import {SaveRetentionWorker420} from '../src/save-retention-worker.js';
const uri=process.env.GAMING_SAVE_TEST_URL;
if(!uri||!new URL(uri).pathname.endsWith('/r055_ci'))throw Error('isolated PostgreSQL r055_ci required, never skip');
const root=new Pool({connectionString:uri}),pools=[root];
const h=x=>'0x'+x.repeat(64),G=h('a'),R=h('b'),P=h('c');
const objects=new Map();
let serial=0;
const storage={
 copy:async({providerId,objectRef,integrity})=>{
  assert.equal(providerId,'source');assert.equal(objectRef,'original');
  const name='copy'+(++serial);objects.set(name,{integrity});
  return {providerId:'copy-provider',objectRef:name,integrity};
 },
 delete:async({providerId,objectRef})=>{
  assert.ok(providerId==='copy-provider'||providerId==='source');objects.delete(objectRef);
 }
};
test('R05.5 actual PostgreSQL schema, scoped backup and deletion lifecycle',async t=>{
 let actor;
 try{
  await bootstrapDatastoreRoles(root);
  await migrateDatastore(root);await migrateWalletLinks(root);await migrateMigrationRuntime(root);
  assert.equal((await migrateSaveLifecycle(root)).changed,true);
  assert.equal((await migrateSaveLifecycle(root)).changed,false);
  const prov=new GamingDatastoreProvisioner420(root);
  await prov.provisionAccount({accountId:'saver',issuerRef:'issuer',credentialCommitment:h('d')});
  await root.query("CREATE ROLE r055_saver LOGIN PASSWORD 'r055_ci_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS");
  await root.query('GRANT gaming_datastore_runtime TO r055_saver');
  await prov.bindRuntimeScope({roleName:'r055_saver',accountId:'saver',gameId:G});
  await prov.registerSaveSchema({gameId:G,schemaLabel:'hc-schema-7',schemaNumber:'7'});
  const u=new URL(uri);u.username='r055_saver';u.password='r055_ci_only';
  actor=new Pool({connectionString:u.toString()});pools.push(actor);
  const repo=new PostgresGamingRepository420({pool:actor,accountId:'saver',gameId:G,
   expectedEpoch:'0',expectedIssuerRef:'issuer'});
  await repo.transaction(t=>t.createProfile({profileId:'p',rulesetId:R}));
  await repo.transaction(t=>t.recordConsent({consentId:'save-consent',purpose:'CLOUD_SAVE',policyHash:P,
   contextHash:saveScopeDigest('saver',G,R),nonceCommitment:h('e'),expiresAt:'18446744073709551615'}));
  await repo.transaction(t=>t.publishSaveReference({expectedRevision:'0',schemaLabel:'hc-schema-7',
   rulesetId:R,stateHash:h('f'),providerId:'source',objectRef:'original',byteLength:'10',consentId:'save-consent'}));
  const scope={accountId:'saver',gameId:G};
  const auth=async ({accountId,gameId,authority,purpose})=>
   accountId==='saver'&&gameId===G&&authority==='signed-session'&&
   ['SAVE_BACKUP','SAVE_DELETE'].includes(purpose);
  const worker=new SaveRetentionWorker420({operatorPool:root,authorize:auth,storage});
  await t.test('RLS excludes unscoped profiles and denies runtime backup mutation',async()=>{
   assert.equal((await actor.query('SELECT * FROM gaming_datastore.save_backups')).rowCount,0);
   await assert.rejects(()=>actor.query(`INSERT INTO gaming_datastore.save_backups
    (account_id,game_id,backup_id,source_revision,provider_id,object_ref,state_hash,byte_length,schema_label,expires_at)
    VALUES($1,$2,'forged',1,'a','b',$3,1,'x',18446744073709551615)`,['saver',G,h('f')]),
    e=>e.code==='42501');
   await assert.rejects(()=>worker.backup({...scope,revision:'1',backupId:'unauth',
    expiresAt:'18446744073709551615',authority:'forged'}),/save-authority-denied/);
  });
  await t.test('independent provider copy, exact backup metadata and replay denial',async()=>{
   const first=await worker.backup({...scope,revision:'1',backupId:'backup-1',
    expiresAt:'18446744073709551615',authority:'signed-session'});
   assert.equal(first.sourceRevision,'1');
   assert.equal(objects.size,1);
   const rows=(await actor.query('SELECT backup_id,source_revision,provider_id,object_ref FROM gaming_datastore.save_backups')).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].provider_id,'copy-provider');
   await assert.rejects(()=>worker.backup({...scope,revision:'1',backupId:'backup-1',
    expiresAt:'18446744073709551615',authority:'signed-session'}),/save-backup-replayed/);
   assert.equal(objects.size,1,'replayed backup must not orphan a second provider copy');
  });
  await t.test('delete tombstones and physically removes only unshared backup copy',async()=>{
   const d=await worker.requestDelete({...scope,backupId:'backup-1',authority:'signed-session'});
   assert.equal(d.physicalDelete,true);
   const repeat=await worker.requestDelete({...scope,backupId:'backup-1',authority:'signed-session'});
   assert.equal(repeat.duplicate,true);
   const results=await worker.drain();
   assert.equal(results.length,1);assert.equal(results[0].status,'DONE');
   assert.equal(objects.has('copy1'),false);
   assert.equal((await actor.query('SELECT backup_id FROM gaming_datastore.save_backups')).rowCount,0);
   await assert.rejects(()=>actor.query('SELECT * FROM gaming_datastore.save_deletion_jobs'),e=>e.code==='42501');
   assert.equal((await root.query("SELECT status FROM gaming_datastore.save_deletion_jobs")).rows[0].status,'DONE');
  });
  await t.test('expired independent backup creates durable deletion work and worker completes',async()=>{
   await worker.backup({...scope,revision:'1',backupId:'backup-expired',
    expiresAt:'18446744073709551615',authority:'signed-session'});
   await root.query(`UPDATE gaming_datastore.save_backups SET
      created_at=gaming_datastore.now_seconds()-600,expires_at=gaming_datastore.now_seconds()-1
      WHERE backup_id='backup-expired'`);
   assert.equal(await worker.expire(),1);
   assert.equal((await repo.transaction(t=>t.saveReference('1'))).revision,'1');
   const finished=await worker.drain();
   assert.equal(finished.length,1);assert.equal(finished[0].status,'DONE');
   assert.equal(objects.has('copy2'),false);
  });
  await t.test('primary save deletion revokes provider locator and physically expires its unshared blob',async()=>{
   await assert.rejects(()=>worker.requestSaveDelete({...scope,revision:'1',authority:'forged'}),/save-authority-denied/);
   const before=await repo.transaction(tx=>tx.saveReference('1'));assert.equal(before.provider_id,'source');
   const deletion=await worker.requestSaveDelete({...scope,revision:'1',authority:'signed-session'});
   assert.equal(deletion.physicalDelete,true);
   assert.equal(await repo.transaction(tx=>tx.saveReference('1')),null);
   assert.equal((await actor.query('SELECT object_ref FROM gaming_datastore.save_references')).rowCount,0);
   assert.equal(await repo.transaction(tx=>tx.saveReference()),null);
   const twice=await worker.requestSaveDelete({...scope,revision:'1',authority:'signed-session'});
   assert.equal(twice.duplicate,true);
   const complete=await worker.drain();assert.equal(complete.length,1);
   assert.equal(complete[0].status,'DONE');
   assert.equal((await actor.query('SELECT revision FROM gaming_datastore.save_redactions')).rows.length,1);
  });
  await t.test('real encrypted provider + PostgreSQL survives source delete and independent backup restore',async()=>{
   const directory=await mkdtemp(join(tmpdir(),'r055-pg-provider-'));
   try{
    const provider=new EncryptedLocalSaveProvider420({directory,encryptionKey:randomBytes(32)});
    const cloud=new CloudSaveLifecycle420({repository:repo,provider,schemaVersion:7});
    const local=new SaveRetentionWorker420({operatorPool:root,authorize:auth,storage:provider});
    const bytes=new TextEncoder().encode(JSON.stringify({schemaVersion:7,rulesetId:R,state:{harvests:12}}));
    const published=await cloud.publish({expectedRevision:'1',schemaLabel:'hc-schema-7',consentId:'save-consent',bytes});
    assert.equal(published.revision,'2');
    assert.equal((await cloud.read()).local.state.harvests,12);
    await local.backup({...scope,revision:'2',backupId:'bk-independent',
     expiresAt:'18446744073709551615',authority:'signed-session'});
    const deletion=await local.requestSaveDelete({...scope,revision:'2',authority:'signed-session'});
    assert.equal(deletion.physicalDelete,true);
    assert.equal((await local.drain())[0].status,'DONE');
    assert.equal(await repo.transaction(tx=>tx.saveReference('2')),null);
    const restored=await cloud.restoreBackup({backupId:'bk-independent',expectedHead:'2',
     schemaLabel:'hc-schema-7',consentId:'save-consent'});
    assert.equal(restored.revision,'3');
    assert.equal(restored.sourceRevision,'2');
    assert.equal((await cloud.read()).local.state.harvests,12);
    assert.equal(await repo.transaction(tx=>tx.saveReference('2')),null,'redacted source cannot reappear');
   }finally{await rm(directory,{recursive:true,force:true});}
  });
  await t.test('digest drift aborts changes before mutable updates',async()=>{
   await root.query("UPDATE gaming_datastore.save_lifecycle_schema SET digest=repeat('0',64)");
   await assert.rejects(()=>worker.backup({...scope,revision:'1',backupId:'bad',
    expiresAt:'18446744073709551615',authority:'signed-session'}),/save-schema-drift/);
   await root.query('UPDATE gaming_datastore.save_lifecycle_schema SET digest=$1',[saveLifecycleDigest]);
  });
 } finally {
  for(const pool of pools.reverse()){try{await pool.end();}catch{}}
 }
});
