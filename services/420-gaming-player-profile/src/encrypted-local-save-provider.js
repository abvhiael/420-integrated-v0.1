// R05.5 encrypted local save provider. Never persists raw payloads or signing credentials.
// Production cloud adapters must implement the same immutable put/get/copy/delete interface.
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,open,rename,readFile,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const digest=x=>'0x'+createHash('sha256').update(x).digest('hex');
const valid=x=>typeof x==='string'&&/^obj_[a-f0-9-]{36}$/.test(x);
const integrity=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x);
const MAGIC=Buffer.from('G420SAVE1');
const MAX=67108864;
export class EncryptedLocalSaveProvider420 {
 #root;#key;#id;
 constructor({directory,encryptionKey,providerId='highcountry-local'}={}){
  if(typeof directory!=='string'||!directory.startsWith('/')||
   !(encryptionKey instanceof Uint8Array)||encryptionKey.length!==32||
   !/^[A-Za-z0-9:_-]{1,128}$/.test(providerId))fail('save-provider-config-invalid');
  this.#root=resolve(directory);this.#key=Buffer.from(encryptionKey);this.#id=providerId;
 }
 async #path(objectRef){
  if(!valid(objectRef))fail('save-provider-object-invalid');
  return join(this.#root,objectRef);
 }
 async put({bytes,integrity:expected}){
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||bytes.byteLength>MAX||
   !integrity(expected)||digest(bytes)!==expected)fail('save-provider-integrity-invalid');
  await mkdir(this.#root,{recursive:true,mode:0o700});
  const id='obj_'+randomUUID(),iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',this.#key,iv);
  cipher.setAAD(Buffer.from(this.#id+':'+id));
  const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
  const contents=Buffer.concat([MAGIC,iv,cipher.getAuthTag(),ciphertext]);
  const path=await this.#path(id),tmp=join(this.#root,'.tmp_'+randomUUID());
  let fh;
  try{
   fh=await open(tmp,'wx',0o600);
   await fh.writeFile(contents);await fh.sync();await fh.close();fh=null;
   await rename(tmp,path);
   const dir=await open(this.#root,'r');try{await dir.sync();}finally{await dir.close();}
  }catch(e){
   if(fh)try{await fh.close();}catch{}
   try{await unlink(tmp);}catch{}
   throw e;
  }
  return Object.freeze({providerId:this.#id,objectRef:id,integrity:expected});
 }
 async get({providerId,objectRef}){
  if(providerId!==this.#id)fail('save-provider-scope-denied');
  const bytes=await readFile(await this.#path(objectRef));
  if(bytes.length<MAGIC.length+28||!bytes.subarray(0,MAGIC.length).equals(MAGIC)||
   bytes.length>MAX+MAGIC.length+28)fail('save-provider-invalid-format');
  try{
   const offset=MAGIC.length,iv=bytes.subarray(offset,offset+12),tag=bytes.subarray(offset+12,offset+28);
   const decipher=createDecipheriv('aes-256-gcm',this.#key,iv);
   decipher.setAAD(Buffer.from(this.#id+':'+objectRef));
   decipher.setAuthTag(tag);
   return Uint8Array.from(Buffer.concat([decipher.update(bytes.subarray(offset+28)),decipher.final()]));
  }catch{fail('save-provider-decryption-failed');}
 }
 async copy({providerId,objectRef,integrity:expected}){
  if(!integrity(expected))fail('save-provider-integrity-invalid');
  const bytes=await this.get({providerId,objectRef});
  if(digest(bytes)!==expected)fail('save-provider-integrity-invalid');
  return this.put({bytes,integrity:expected});
 }
 async delete({providerId,objectRef}){
  if(providerId!==this.#id)fail('save-provider-scope-denied');
  try{await unlink(await this.#path(objectRef));}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }
}
