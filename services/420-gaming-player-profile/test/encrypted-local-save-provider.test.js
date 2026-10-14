import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {EncryptedLocalSaveProvider420} from '../src/encrypted-local-save-provider.js';
const digest=x=>'0x'+createHash('sha256').update(x).digest('hex');
test('R05.5 actual encrypted local saves survive restart, copied backup independent and deletion',async()=>{
 const root=await mkdtemp(join(tmpdir(),'r055-save-')),key=randomBytes(32);
 try{
  const p=new EncryptedLocalSaveProvider420({directory:root,encryptionKey:key});
  const plain=new TextEncoder().encode('{"state":"confidential game save","progress":123}');
  const src=await p.put({bytes:plain,integrity:digest(plain)});
  const raw=await readFile(join(root,src.objectRef));
  assert.equal(raw.includes(Buffer.from('confidential game save')),false);
  const restart=new EncryptedLocalSaveProvider420({directory:root,encryptionKey:key});
  assert.deepEqual(await restart.get(src),plain);
  const backup=await restart.copy({...src,integrity:digest(plain)});
  assert.notEqual(backup.objectRef,src.objectRef);
  await restart.delete(src);
  assert.deepEqual(await restart.get(backup),plain);
  await assert.rejects(()=>restart.get(src),e=>e.code==='ENOENT');
  await restart.delete(src);
  const wrong=new EncryptedLocalSaveProvider420({directory:root,encryptionKey:randomBytes(32)});
  await assert.rejects(()=>wrong.get(backup),/save-provider-decryption-failed/);
  const contents=await readFile(join(root,backup.objectRef));
  contents[contents.length-1]^=1;
  await writeFile(join(root,backup.objectRef),contents);
  await assert.rejects(()=>restart.get(backup),/save-provider-decryption-failed/);
  await assert.rejects(()=>restart.copy({...backup,integrity:digest(plain)}),/save-provider-decryption-failed/);
  await assert.rejects(()=>restart.get({providerId:'unknown',objectRef:backup.objectRef}),/save-provider-scope-denied/);
  await assert.rejects(()=>restart.get({providerId:backup.providerId,objectRef:'../../private'}),/save-provider-object-invalid/);
 }finally{await rm(root,{recursive:true,force:true});}
});
