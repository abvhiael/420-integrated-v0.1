// 420Arbitration private evidence: locally generated, context-bound commitments.
// This module never uploads plaintext, stores a decryption key, signs transactions,
// or treats private storage receipts as canonical case/evidence state.
import {tokenHashText420,tokenHashHex420,tokenWord420,tokenAddressWord420} from './token-sdk.js';

export const ARBITRATION_EVIDENCE_DOMAIN_420 = tokenHashText420('420/arbitration/evidence/private-envelope/v1');
export const ARBITRATION_EVIDENCE_MAX_BYTES_420 = 8*1024*1024;
export const ARBITRATION_EVIDENCE_MAX_RETENTION_MS_420 = 90*24*60*60*1000;
const HEX32=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const check=(ok,message)=>{if(!ok)throw new EvidencePrivacyError420(message);};
const hex=bytes=>'0x'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const bytes32=(value,label)=>{
  check(typeof value==='string'&&HEX32.test(value)&&BigInt(value)!==0n,'invalid '+label);
  return value.toLowerCase();
};
const addr=(value)=>{
  check(typeof value==='string'&&ADDRESS.test(value)&&BigInt(value)!==0n,'invalid evidence participant');
  return value.toLowerCase();
};
const bytes=(value,label='evidence')=>{
  check(value instanceof Uint8Array||value instanceof ArrayBuffer,'invalid '+label+' bytes');
  const copy=value instanceof Uint8Array?new Uint8Array(value):new Uint8Array(value.slice(0));
  check(copy.length>0&&copy.length<=ARBITRATION_EVIDENCE_MAX_BYTES_420,'invalid evidence size');
  return copy;
};
const isBytes=(x,length)=>x instanceof Uint8Array&&x.length===length;
const now=()=>Date.now();
const ensureCrypto=(cryptoImpl)=>{
  check(cryptoImpl&&typeof cryptoImpl.getRandomValues==='function'&&cryptoImpl.subtle,
    'secure evidence cryptography unavailable');
  return cryptoImpl;
};
const commitmentInput=(ctx,digest,nonce)=>{
  const components=[
    ARBITRATION_EVIDENCE_DOMAIN_420.slice(2),
    tokenWord420(ctx.chainId),
    tokenAddressWord420(ctx.caseRegistry),
    ctx.caseId.slice(2),
    tokenWord420(ctx.round),
    tokenAddressWord420(ctx.submitter),
    digest.slice(2),nonce.slice(2)
  ];
  return '0x'+components.join('');
};
const associatedData=ctx=>new TextEncoder().encode(JSON.stringify([
  '420/arbitration/evidence/aes-gcm/v1',ctx.chainId,ctx.caseRegistry,ctx.caseId,ctx.round,ctx.submitter
]));
const safeError='Private evidence unavailable, inaccessible or failed integrity verification';
export class EvidencePrivacyError420 extends Error {
  constructor(message){super(message);this.name='EvidencePrivacyError420';}
}
export function normalizeEvidenceContext420(context) {
  check(context&&typeof context==='object','evidence context missing');
  check(Number.isSafeInteger(context.chainId)&&context.chainId>0,'invalid evidence chain');
  check(Number.isInteger(context.round)&&context.round>=0&&context.round<=3,'invalid evidence round');
  return Object.freeze({chainId:context.chainId,caseRegistry:addr(context.caseRegistry),
    caseId:bytes32(context.caseId,'case ID'),round:context.round,submitter:addr(context.submitter)});
}
export function evidenceCommitment420(context,digest,nonce) {
  const c=normalizeEvidenceContext420(context);
  return tokenHashHex420(commitmentInput(c,bytes32(digest,'evidence digest'),
    bytes32(nonce,'evidence nonce')));
}
export async function hashPrivateEvidence420(data,{cryptoImpl=globalThis.crypto}={}) {
  const crypto=ensureCrypto(cryptoImpl);
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(data))));
}
// Salt prevents offline confirmation of a guessed plaintext from an on-chain digest.
// Nonce is part of private recipient-held access metadata, never published with the commitment.
export async function preparePrivateEvidence420({data,context,cryptoImpl=globalThis.crypto,nonce=null}){
  const crypto=ensureCrypto(cryptoImpl),ctx=normalizeEvidenceContext420(context);
  const plaintext=bytes(data),digest=await hashPrivateEvidence420(plaintext,{cryptoImpl:crypto});
  const randomNonce=nonce===null?crypto.getRandomValues(new Uint8Array(32)):new Uint8Array(nonce);
  check(isBytes(randomNonce,32)&&randomNonce.some(x=>x!==0),'invalid evidence nonce');
  const salt=hex(randomNonce);
  const commitment=evidenceCommitment420(ctx,digest,salt);
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,
    additionalData:associatedData(ctx),tagLength:128},key,plaintext));
  plaintext.fill(0);
  const rawKey=new Uint8Array(await crypto.subtle.exportKey('raw',key));
  const encrypted=Object.freeze({
    schema:'420-arbitration-private-evidence-v1',context:ctx,commitment,
    digest,nonce:salt,iv:hex(iv),ciphertext:hex(ciphertext),sizeBytes:data.byteLength,
    access:'private',contentType:'application/octet-stream'
  });
  const recoveryKey=hex(rawKey);rawKey.fill(0);
  return Object.freeze({commitment,encrypted,recoveryKey});
}
const decodeHex=(value,label,max)=>{
  check(typeof value==='string'&&/^0x(?:[0-9a-fA-F]{2})*$/.test(value)&&
    (value.length-2)/2<=max,'invalid '+label);
  return new Uint8Array((value.slice(2).match(/../g)||[]).map(pair=>Number.parseInt(pair,16)));
};
const contextsEqual=(a,b)=>Object.keys(a).every(k=>a[k]===b[k]);
export async function verifyPrivateEvidence420({
  encrypted,recoveryKey,context,expectedCommitment,cryptoImpl=globalThis.crypto
}) {
  const crypto=ensureCrypto(cryptoImpl),ctx=normalizeEvidenceContext420(context);
  // Uniform failure message for inaccessible, tampered or wrong-case evidence.
  try {
    check(encrypted?.schema==='420-arbitration-private-evidence-v1'&&encrypted.access==='private',
      safeError);
    const c=normalizeEvidenceContext420(encrypted.context);
    check(contextsEqual(c,ctx),safeError);
    const committed=bytes32(expectedCommitment,'expected commitment');
    check(bytes32(encrypted.commitment,'stored commitment')===committed,safeError);
    check(evidenceCommitment420(ctx,encrypted.digest,encrypted.nonce)===committed,safeError);
    const rawKey=decodeHex(recoveryKey,'recovery key',32);
    check(isBytes(rawKey,32),'invalid recovery key');
    const iv=decodeHex(encrypted.iv,'IV',12);
    check(isBytes(iv,12),'invalid IV');
    const ciphertext=decodeHex(encrypted.ciphertext,'ciphertext',ARBITRATION_EVIDENCE_MAX_BYTES_420+16);
    check(ciphertext.length>=17,'invalid ciphertext');
    check(Number.isSafeInteger(encrypted.sizeBytes)&&encrypted.sizeBytes>0&&
      encrypted.sizeBytes<=ARBITRATION_EVIDENCE_MAX_BYTES_420,'invalid original size');
    const key=await crypto.subtle.importKey('raw',rawKey,'AES-GCM',false,['decrypt']);
    rawKey.fill(0);
    const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,
      additionalData:associatedData(ctx),tagLength:128},key,ciphertext));
    check(plain.length===encrypted.sizeBytes,safeError);
    const digest=await hashPrivateEvidence420(plain,{cryptoImpl:crypto});
    check(digest===encrypted.digest,safeError);
    return plain; // Caller must discard explicitly and never insert bytes into innerHTML.
  } catch {
    throw new EvidencePrivacyError420(safeError);
  }
}
export function authorizeEvidenceViewer420({context,record,viewer,nowMs=now(),grant=null}){
  const ctx=normalizeEvidenceContext420(context),v=addr(viewer);
  check(record?.id===ctx.caseId&&Number(record.round)>=ctx.round &&
    record.claimant&&record.respondent,'evidence case or round mismatch');
  const currentResolver=ctx.round===0?record.resolver:record.appealResolver;
  const known=[addr(record.claimant),addr(record.respondent),addr(currentResolver)];
  // Do not treat a locally asserted role, grant, or session as authorization.
  check(known.includes(v)&&grant&&grant.account?.toLowerCase()===v&&
    grant.caseId?.toLowerCase()===ctx.caseId&&grant.round===ctx.round &&
    grant.chainId===ctx.chainId&&grant.caseRegistry?.toLowerCase()===ctx.caseRegistry &&
    grant.expiresAt>nowMs&&typeof grant.authorization==='string'&&grant.authorization.length>20,
    'private evidence authorization required');
  return true;
}
export function normalizePrivateEvidenceReceipt420(receipt,expected){
  // Canonical 420Storage v1 requires the full object identity. Storage receipts
  // are operational, not on-chain evidence or permission grants.
  const ref=receipt?.object;
  check(ref&&expected&&typeof ref==='object','private storage object reference missing');
  for(const field of ['object_id','manifest_id','shard_index','shard_root','size_bytes','commitment_id'])
    check(Object.hasOwn(ref,field)&&String(ref[field])===String(expected[field]),
      'private storage object identity mismatch');
  check(receipt.visibility==='private','private storage visibility required');
  return Object.freeze({object:Object.freeze({...ref}),visibility:'private'});
}
// Explicit adapter seam for the qualified 420Storage v1 prepare/ingest/retrieve
// service. A caller must supply an already-authorized transport/session; an
// unconfigured backend never falls back to public URLs or a local mock.
export function createPrivateEvidenceStore420({storage=null,authenticate,clock=now}={}) {
  check(typeof authenticate==='function','trusted private evidence session verifier required');
  const authenticated=async(context,viewer,record)=>{
    let grant;
    try{grant=await authenticate({context,viewer,record});}
    catch{throw new EvidencePrivacyError420('private evidence authorization required');}
    authorizeEvidenceViewer420({context,viewer,record,grant,nowMs:clock()});
    return grant;
  };
  async function upload({encrypted,context,record,viewer,object,retentionMs,
    signal,authorizationRequired=true}){
    check(storage&&typeof storage.prepare==='function'&&typeof storage.ingest==='function',
      'approved private evidence storage unavailable');
    check(authorizationRequired===true,'private evidence access restrictions required');
    check(Number.isSafeInteger(retentionMs)&&retentionMs>0&&
      retentionMs<=ARBITRATION_EVIDENCE_MAX_RETENTION_MS_420,'invalid evidence retention');
    const ctx=normalizeEvidenceContext420(context),grant=await authenticated(ctx,viewer,record);
    check(!signal?.aborted,'private evidence operation interrupted');
    check(encrypted?.schema==='420-arbitration-private-evidence-v1'&&
      contextsEqual(normalizeEvidenceContext420(encrypted.context),ctx),'evidence context mismatch');
    check(evidenceCommitment420(ctx,encrypted.digest,encrypted.nonce)===encrypted.commitment,
      'evidence commitment mismatch');
    const metadata=Object.freeze({context:ctx,commitment:encrypted.commitment,
      visibility:'private',expiresAt:clock()+retentionMs});
    // Client-side contract: provider must enforce authorization/expiration,
    // encrypt-at-rest of operational records, private no-store retrieval,
    // and never publish the submitted ciphertext through public delivery routes.
    let prepared;
    try {
      prepared=await storage.prepare({object,metadata,grant,signal});
      check(!signal?.aborted&&prepared,'private evidence upload interrupted');
      const payload=new TextEncoder().encode(JSON.stringify(encrypted));
      const receipt=await storage.ingest({prepared,object,bytes:payload,metadata,grant,signal});
      check(!signal?.aborted,'private evidence upload interrupted');
      return normalizePrivateEvidenceReceipt420(receipt,object);
    }catch{
      throw new EvidencePrivacyError420('private evidence upload unavailable or interrupted');
    }
  }
  async function retrieve({context,record,viewer,object,expectedCommitment,recoveryKey,signal}){
    check(storage&&typeof storage.retrieve==='function',
      'approved private evidence storage unavailable');
    const ctx=normalizeEvidenceContext420(context),grant=await authenticated(ctx,viewer,record);
    check(!signal?.aborted,'private evidence operation interrupted');
    try {
      const result=await storage.retrieve({object,grant,signal,mode:'private'});
      check(!signal?.aborted&&result?.visibility==='private','private evidence retrieval unavailable');
      normalizePrivateEvidenceReceipt420(result,object);
      const data=bytes(result.bytes,'private encrypted payload');
      const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
      return await verifyPrivateEvidence420({encrypted:envelope,recoveryKey,context:ctx,
        expectedCommitment});
    }catch{
      throw new EvidencePrivacyError420(safeError);
    }
  }
  return Object.freeze({upload,retrieve});
}
