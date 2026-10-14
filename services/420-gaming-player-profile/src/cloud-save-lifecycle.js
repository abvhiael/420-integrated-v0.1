// R05.5 account-scoped save lifecycle. Provider owns bytes; database stores only metadata.
import {createHash,randomUUID} from 'node:crypto';
import {saveScopeDigest} from './postgres-repository.js';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash=x=>typeof x==='string'&&/^0x[0-9a-f]{64}$/.test(x)&&!/^0x0+$/.test(x);
const uint=x=>typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<(1n<<64n);
const maxBytes=67108864;
export const parseLocalSave420=({bytes,schemaVersion,maxAllowedBytes=maxBytes}={})=>{
 if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>maxAllowedBytes||
  !Number.isInteger(schemaVersion)||schemaVersion<1||schemaVersion>4294967295)
  fail('save-invalid-bytes');
 let save;
 try{save=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('save-invalid-json');}
 if(!save||Array.isArray(save)||typeof save!=='object'||Object.keys(save).length!==3||
  !Object.hasOwn(save,'schemaVersion')||!Object.hasOwn(save,'rulesetId')||
  !Object.hasOwn(save,'state')||save.schemaVersion!==schemaVersion||
  !hash(save.rulesetId)||!save.state||Array.isArray(save.state)||typeof save.state!=='object')
  fail('save-invalid-schema');
 return Object.freeze({schemaVersion,rulesetId:save.rulesetId,
  digest:'0x'+createHash('sha256').update(bytes).digest('hex'),
  byteLength:String(bytes.length),state:Object.freeze(save.state)});
};
export class CloudSaveLifecycle420 {
 #repo;#provider;#schema;
 constructor({repository,provider,schemaVersion}={}){
  if(typeof repository?.transaction!=='function'||
   typeof provider?.put!=='function'||typeof provider?.get!=='function'||
   typeof provider?.delete!=='function'||!Number.isInteger(schemaVersion)||schemaVersion<1)
   fail('save-invalid-configuration');
  this.#repo=repository;this.#provider=provider;this.#schema=schemaVersion;
 }
 async publish({expectedRevision,consentId,schemaLabel,bytes}){
  if(!uint(expectedRevision)||!opaque(consentId)||!opaque(schemaLabel))fail('save-invalid-input');
  const local=parseLocalSave420({bytes,schemaVersion:this.#schema});
  // The provider must produce a durable immutable object before reference publication.
  const stored=await this.#provider.put({bytes,integrity:local.digest});
  if(!stored||!opaque(stored.providerId)||!opaque(stored.objectRef))fail('save-provider-invalid');
  try{
   const row=await this.#repo.transaction(async tx=>{
    const profile=await tx.profile();
    if(!profile||profile.ruleset_id!==local.rulesetId)fail('save-ruleset-conflict');
    return tx.publishSaveReference({expectedRevision,schemaLabel,rulesetId:local.rulesetId,
     stateHash:local.digest,providerId:stored.providerId,objectRef:stored.objectRef,
     byteLength:local.byteLength,consentId});
   });
   return Object.freeze({revision:String(row.revision),digest:local.digest,providerId:stored.providerId,objectRef:stored.objectRef});
  }catch(e){
   // Best-effort orphan cleanup; operators must separately sweep provider orphans.
   try{await this.#provider.delete(stored);}catch{}
   throw e;
  }
 }
 async read(revision=null){
  const ref=await this.#repo.transaction(tx=>tx.saveReference(revision));
  if(!ref)return null;
  const bytes=await this.#provider.get({providerId:ref.provider_id,objectRef:ref.object_ref});
  if(!(bytes instanceof Uint8Array)||bytes.length!==Number(ref.byte_length))
   fail('save-provider-corruption');
  const digest='0x'+createHash('sha256').update(bytes).digest('hex');
  if(digest!==ref.state_hash)fail('save-integrity-mismatch');
  const local=parseLocalSave420({bytes,schemaVersion:this.#schema});
  if(local.rulesetId!==ref.ruleset_id)fail('save-ruleset-conflict');
  return Object.freeze({revision:String(ref.revision),local});
 }
 async restore({backupRevision,expectedHead,consentId,schemaLabel}){
  if(!uint(backupRevision)||backupRevision==='0'||!uint(expectedHead)||
   !opaque(consentId)||!opaque(schemaLabel))fail('save-invalid-restore');
  // Never overwrite history; restoration creates a new monotonically increasing revision.
  const snapshot=await this.read(backupRevision);
  if(!snapshot)fail('save-backup-not-found');
  const ref=await this.#repo.transaction(tx=>tx.saveReference(backupRevision));
  const bytes=await this.#provider.get({providerId:ref.provider_id,objectRef:ref.object_ref});
  const published=await this.publish({expectedRevision:expectedHead,consentId,schemaLabel,bytes});
  return Object.freeze({...published,restoredFrom:backupRevision});
 }
}
