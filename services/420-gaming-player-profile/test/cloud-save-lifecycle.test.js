import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudSaveLifecycle420,parseLocalSave420} from '../src/cloud-save-lifecycle.js';
const R='0x'+'a'.repeat(64);
const bytes=(state,version=7)=>new TextEncoder().encode(JSON.stringify({schemaVersion:version,rulesetId:R,state}));
function fixture(){
 const objects=new Map(),revisions=new Map(),backups=new Map(),head={revision:'0'},calls=[];
 const provider={
  put:async({bytes,integrity})=>{const ref='o'+(objects.size+1);objects.set(ref,Uint8Array.from(bytes));return {providerId:'localfixture',objectRef:ref};},
  get:async({objectRef})=>objects.get(objectRef),
  delete:async({objectRef})=>objects.delete(objectRef)
 };
 const repo={transaction:async cb=>cb({
  profile:async()=>({ruleset_id:R}),
  publishSaveReference:async x=>{
   calls.push(x);
   if(x.expectedRevision!==head.revision)throw Error('revision-conflict');
   head.revision=String(BigInt(head.revision)+1n);
   const row={revision:head.revision,provider_id:x.providerId,object_ref:x.objectRef,
    state_hash:x.stateHash,byte_length:x.byteLength,ruleset_id:x.rulesetId};
   revisions.set(row.revision,row);return row;
  },
  saveReference:async revision=>revisions.get(revision??head.revision)??null,
  backupReference:async id=>backups.get(id)??null
 })};
 return {save:new CloudSaveLifecycle420({repository:repo,provider,schemaVersion:7}),provider,objects,revisions,backups,head,calls};
}
test('R05.5 explicit version, bounded size and local schema reject malformed saves',()=>{
 assert.equal(parseLocalSave420({bytes:bytes({room:1}),schemaVersion:7}).schemaVersion,7);
 assert.throws(()=>parseLocalSave420({bytes:bytes({room:1},6),schemaVersion:7}),/save-invalid-schema/);
 assert.throws(()=>parseLocalSave420({bytes:bytes({room:1}),schemaVersion:7,maxAllowedBytes:4}),/save-invalid-bytes/);
 assert.throws(()=>parseLocalSave420({bytes:new TextEncoder().encode('{bad'),schemaVersion:7}),/save-invalid-json/);
 assert.throws(()=>parseLocalSave420({bytes:new Uint8Array(0),schemaVersion:7}),/save-invalid-bytes/);
});
test('R05.5 immutable revisions, integrity verified read and conflict rejects without stale writes',async()=>{
 const f=fixture(),content=bytes({home:1});
 const row=await f.save.publish({expectedRevision:'0',consentId:'c1',schemaLabel:'hc-v7',bytes:content});
 assert.equal(row.revision,'1');
 assert.equal((await f.save.read()).revision,'1');
 await assert.rejects(()=>f.save.publish({expectedRevision:'0',consentId:'c1',schemaLabel:'hc-v7',bytes:content}),/revision-conflict/);
 assert.equal(f.head.revision,'1');
 f.objects.set(row.objectRef,bytes({home:9}));
 await assert.rejects(()=>f.save.read(),/save-integrity-mismatch/);
});
test('R05.5 restore creates new head and leaves historical backup immutable',async()=>{
 const f=fixture();await f.save.publish({expectedRevision:'0',consentId:'c1',schemaLabel:'hc-v7',bytes:bytes({home:1})});
 await f.save.publish({expectedRevision:'1',consentId:'c1',schemaLabel:'hc-v7',bytes:bytes({home:2})});
 const restored=await f.save.restore({backupRevision:'1',expectedHead:'2',consentId:'c1',schemaLabel:'hc-v7'});
 assert.equal(restored.revision,'3');assert.equal(restored.restoredFrom,'1');
 assert.equal((await f.save.read()).local.state.home,1);
 assert.equal((await f.save.read('2')).local.state.home,2);
 await assert.rejects(()=>f.save.restore({backupRevision:'1',expectedHead:'2',consentId:'c1',schemaLabel:'hc-v7'}),/revision-conflict/);
});

test('R05.5 independent backup can restore after source object is lost or redacted',async()=>{
 const f=fixture();
 const initial=await f.save.publish({expectedRevision:'0',consentId:'c1',schemaLabel:'hc-v7',bytes:bytes({saved:1})});
 const snapshot=f.objects.get(initial.objectRef);
 f.objects.set('independent-backup',Uint8Array.from(snapshot));
 f.backups.set('backup-safe',{backup_id:'backup-safe',source_revision:'1',
  provider_id:'localfixture',object_ref:'independent-backup',
  state_hash:initial.digest,byte_length:String(snapshot.length),schema_label:'hc-v7'});
 f.objects.delete(initial.objectRef);
 const restored=await f.save.restoreBackup({backupId:'backup-safe',expectedHead:'1',
  consentId:'c1',schemaLabel:'hc-v7'});
 assert.equal(restored.revision,'2');assert.equal(restored.sourceRevision,'1');
 assert.equal((await f.save.read()).local.state.saved,1);
 await assert.rejects(()=>f.save.restoreBackup({backupId:'unknown',expectedHead:'2',
  consentId:'c1',schemaLabel:'hc-v7'}),/save-backup-unavailable/);
});

test('R05.5 backup revoked between provider read and save commit cannot resurrect',async()=>{
 const f=fixture();
 const original=await f.save.publish({expectedRevision:'0',consentId:'c1',schemaLabel:'hc-v7',bytes:bytes({saved:1})});
 const copy=Uint8Array.from(f.objects.get(original.objectRef));
 f.objects.set('copy-safe',copy);
 f.backups.set('bk',{backup_id:'bk',source_revision:'1',provider_id:'localfixture',
  object_ref:'copy-safe',state_hash:original.digest,byte_length:String(copy.length),schema_label:'hc-v7'});
 const read=f.provider.get;
 f.provider.get=async ref=>{
  const blob=await read(ref);
  if(ref.objectRef==='copy-safe')f.backups.delete('bk'); // concurrent user deletion
  return blob;
 };
 await assert.rejects(()=>f.save.restoreBackup({backupId:'bk',expectedHead:'1',
  consentId:'c1',schemaLabel:'hc-v7'}),/save-backup-revoked/);
 assert.equal(f.head.revision,'1');
});
