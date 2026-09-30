import {keccak256} from './abi.js';
import {transactionFingerprint} from './preflight.js';

export class QuoteAuthenticationError extends Error {
  constructor(code,message){super(message);this.name='QuoteAuthenticationError';this.code=code;}
}
const fail=(code,message)=>{throw new QuoteAuthenticationError(code,message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(value);
const bytes32=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value);
const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value);
const b64url=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();

function canonicalJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
}
function signedPayload(quote){
  const {authentication:_authentication,...unsigned}=quote;
  return {schema:'420-exchange-signed-quote-payload-v1',service:'420/service/exchange-quote/v1',quote:unsigned};
}
const utf8=value=>new TextEncoder().encode(value);
const hex=bytes=>'0x'+[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
const decodeB64url=value=>{
  const base=value.replace(/-/g,'+').replace(/_/g,'/');const padded=base+'='.repeat((4-base.length%4)%4);
  const binary=globalThis.atob?globalThis.atob(padded):Buffer.from(padded,'base64').toString('binary');
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
async function sha256(bytes){
  if(!globalThis.crypto?.subtle)fail('CRYPTO_UNAVAILABLE','WebCrypto verification unavailable');
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));
}
async function importEd25519(raw){
  if(!globalThis.crypto?.subtle)fail('CRYPTO_UNAVAILABLE','WebCrypto verification unavailable');
  try{return await globalThis.crypto.subtle.importKey('raw',decodeB64url(raw),{name:'Ed25519'},false,['verify']);}
  catch{fail('KEY_INVALID','trusted producer public key is invalid');}
}
export function normalizeTrustedQuotePolicy(runtime){
  const policy=runtime?.quoteAuthentication;
  if(!object(policy)||policy.schema!=='420-exchange-quote-auth-policy-v1'||policy.status!=='QUALIFIED_CONFIG'||!Array.isArray(policy.producers)||!policy.producers.length)fail('AUTH_POLICY_UNAVAILABLE','qualified quote producer policy required');
  const producers=new Map();
  for(const producer of policy.producers){
    if(!object(producer)||!id(producer.producerId)||!id(producer.keyVersion)||producer.algorithm!=='Ed25519'||!b64url(producer.publicKey)||!Number.isSafeInteger(producer.notBefore)||!Number.isSafeInteger(producer.notAfter)||producer.notAfter<=producer.notBefore||!Number.isSafeInteger(producer.revocationEpoch)||producer.revocationEpoch<0||producer.revoked===true)fail('AUTH_POLICY_INVALID','valid active quote producer key required');
    const key=producer.producerId+'|'+producer.keyVersion;
    if(producers.has(key))fail('AUTH_POLICY_INVALID','duplicate producer key policy');
    producers.set(key,Object.freeze({...producer}));
  }
  return Object.freeze({schema:policy.schema,service:policy.service,producers});
}
export async function verifyQuoteAuthentication({runtime,quote,prepared,nowSeconds,endpointUrl}={}){
  if(!object(quote)||!object(quote.authentication))fail('UNSIGNED_QUOTE','authenticated quote envelope required');
  const auth=quote.authentication;
  if(auth.schema!=='420-exchange-quote-auth-v1'||auth.algorithm!=='Ed25519'||!id(auth.producerId)||!id(auth.keyVersion)||!b64url(auth.signature)||!/^sha256:[0-9a-f]{64}$/i.test(auth.publicKeyFingerprint)||!bytes32(auth.payloadHash)||!Number.isSafeInteger(auth.revocationEpoch)||auth.revocationEpoch<0)fail('AUTH_ENVELOPE_INVALID','quote authentication envelope is malformed');
  const policy=normalizeTrustedQuotePolicy(runtime),trusted=policy.producers.get(auth.producerId+'|'+auth.keyVersion);
  if(!trusted)fail('UNTRUSTED_PRODUCER','quote producer/key version is not trusted');
  if(policy.service!=='420/service/exchange-quote/v1')fail('DOMAIN_MISMATCH','trusted producer policy service domain mismatch');
  if(!Number.isSafeInteger(nowSeconds)||nowSeconds<trusted.notBefore||nowSeconds>=trusted.notAfter)fail('KEY_NOT_ACTIVE','quote producer key is outside its validity window');
  if(auth.revocationEpoch!==trusted.revocationEpoch)fail('KEY_REVOKED','quote key revocation epoch mismatch');
  const rawKey=decodeB64url(trusted.publicKey),fingerprint='sha256:'+hex(await sha256(rawKey)).slice(2);
  if(!same(fingerprint,auth.publicKeyFingerprint))fail('KEY_FINGERPRINT_MISMATCH','quote key fingerprint differs from trusted policy');
  const payloadBytes=utf8(canonicalJson(signedPayload(quote))),payloadHash=hex(await sha256(payloadBytes));
  if(!same(payloadHash,auth.payloadHash))fail('PAYLOAD_HASH_MISMATCH','authenticated payload hash mismatch');
  const key=await importEd25519(trusted.publicKey);
  const verified=await globalThis.crypto.subtle.verify({name:'Ed25519'},key,decodeB64url(auth.signature),payloadBytes);
  if(!verified)fail('SIGNATURE_INVALID','quote signature verification failed');

  const deployment=quote.deployment;
  if(!object(deployment)||!bytes32(deployment.deploymentId)||!bytes32(deployment.manifestHash)||!address(deployment.router)||!address(deployment.spender))fail('DOMAIN_MISMATCH','quote deployment domain is incomplete');
  const expectedDeployment=runtime?.quoteAuthentication?.deployment;
  if(!object(expectedDeployment)||!same(expectedDeployment.deploymentId,deployment.deploymentId)||!same(expectedDeployment.manifestHash,deployment.manifestHash)||!same(expectedDeployment.router,deployment.router)||!same(expectedDeployment.spender,deployment.spender))fail('DOMAIN_MISMATCH','quote deployment/router domain mismatch');
  if(endpointUrl){
    const expectedOrigin=runtime?.quoteAuthentication?.endpointOrigin;
    let origin;try{origin=new URL(endpointUrl).origin;}catch{fail('ENDPOINT_MISMATCH','invalid quote endpoint domain');}
    if(typeof expectedOrigin!=='string'||origin!==expectedOrigin)fail('ENDPOINT_MISMATCH','quote endpoint origin differs from authenticated policy');
  }
  if(!bytes32(quote.replayDomain)||!bytes32(quote.quoteId)||!address(quote.account)||!Number.isSafeInteger(quote.expiresAt))fail('DOMAIN_MISMATCH','quote replay domain fields missing');
  const expectedReplay=keccak256([
    '420/service/exchange-quote/v1',quote.chainId.toLowerCase(),deployment.deploymentId.toLowerCase(),deployment.manifestHash.toLowerCase(),
    deployment.router.toLowerCase(),quote.account.toLowerCase(),quote.quoteId.toLowerCase(),String(quote.expiresAt),
  ].join('|'));
  if(!same(expectedReplay,quote.replayDomain))fail('REPLAY_DOMAIN_MISMATCH','quote replay domain is invalid');
  const fingerprint=transactionFingerprint(prepared?.transaction);
  if(!bytes32(quote.transactionFingerprint)||!same(quote.transactionFingerprint,fingerprint))fail('FINGERPRINT_MISMATCH','authenticated quote does not bind the reviewed transaction');
  return Object.freeze({verified:true,producerId:auth.producerId,keyVersion:auth.keyVersion,algorithm:auth.algorithm,payloadHash:auth.payloadHash,transactionFingerprint:fingerprint,replayDomain:quote.replayDomain});
}

export function createQuoteReplayGuard({maxEntries=2048}={}){
  const seen=new Map();
  return Object.freeze({
    assertFresh({quoteId,replayDomain,expiresAt,nowSeconds}={}){
      if(!bytes32(quoteId)||!bytes32(replayDomain)||!Number.isSafeInteger(expiresAt)||!Number.isSafeInteger(nowSeconds))fail('REPLAY_INVALID','complete replay identity required');
      for(const [key,expiry] of seen)if(expiry<=nowSeconds)seen.delete(key);
      const key=quoteId.toLowerCase()+'|'+replayDomain.toLowerCase();
      if(seen.has(key))fail('QUOTE_REPLAYED','quote has already been accepted in this replay guard');
      if(seen.size>=maxEntries)fail('REPLAY_CAPACITY','replay guard capacity exhausted');
      seen.set(key,expiresAt);return true;
    },
    size(){return seen.size;},
  });
}
