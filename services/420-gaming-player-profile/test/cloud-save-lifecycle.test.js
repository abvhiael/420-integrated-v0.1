import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudSaveLifecycle420,parseLocalSave420} from '../src/cloud-save-lifecycle.js';
const R='0x'+'a'.repeat(64);
const bytes=(state,version=7)=>new TextEncoder().encode(JSON.stringify({schemaVersion:version,rulesetId:R,state}));
function fixture(){
 const objects=new Map(),revisions=new Map(),head={revision:'0'},calls=[];
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
  saveReference:async revision=>revisions.get(revision??head.revision)??null
 })};
 return {save:new CloudSaveLifecycle420({repository:repo,provider,schemaVersion:7}),objects,revisions,head,calls};
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
 await assert.rejects(()=>f.save.publish({expectedRevision:'0',consentId:'c1',schemaLabel:'hc-v7',bytes}),/revision-conflict/);
 assert.equal(f.head.revision,'1');
 f.objects.set(row.objectRef,bytes({home:99}));
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
