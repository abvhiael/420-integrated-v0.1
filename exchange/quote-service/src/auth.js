import {createHash,sign as nodeSign,createPrivateKey,createPublicKey} from 'node:crypto';
import {canonicalJson} from './canonical.js';
import {fail} from './errors.js';

export const AUTH_SCHEMA='420-exchange-quote-auth-v1';
export const AUTH_ALGORITHM='Ed25519';
export const SIGNED_PAYLOAD_SCHEMA='420-exchange-signed-quote-payload-v1';

const b64u=buffer=>Buffer.from(buffer).toString('base64url');
const fromB64u=value=>Buffer.from(value,'base64url');
const id=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(value);
const keyVersion=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(value);

export function canonicalSignedQuotePayload(quote){
  if(!quote||quote.schema!=='420-exchange-executable-swap-quote-v1')fail('AUTH_INVALID','canonical executable quote required',{status:500});
  const {authentication:_authentication,...unsigned}=quote;
  return Object.freeze({
    schema:SIGNED_PAYLOAD_SCHEMA,
    service:'420/service/exchange-quote/v1',
    quote:unsigned,
  });
}
export function signedPayloadBytes(quote){return Buffer.from(canonicalJson(canonicalSignedQuotePayload(quote)),'utf8');}
export function signedPayloadHash(quote){return '0x'+createHash('sha256').update(signedPayloadBytes(quote)).digest('hex');}
export function publicKeyFingerprint(publicKey){
  const jwk=createPublicKey(publicKey).export({format:'jwk'});
  if(typeof jwk.x!=='string')fail('SIGNER_CONFIG_INVALID','Ed25519 public key bytes unavailable',{status:503});
  return 'sha256:'+createHash('sha256').update(fromB64u(jwk.x)).digest('hex');
}
export function createEd25519Signer({producerId,keyVersion:version,privateKey,revocationEpoch=0}={}){
  if(!id(producerId)||!keyVersion(version)||!Number.isSafeInteger(revocationEpoch)||revocationEpoch<0)fail('SIGNER_CONFIG_INVALID','producer/key version/revocation epoch required',{status:503});
  let key;try{key=createPrivateKey(privateKey);}catch{fail('SIGNER_CONFIG_INVALID','valid Ed25519 private key required',{status:503});}
  if(key.asymmetricKeyType!=='ed25519')fail('SIGNER_CONFIG_INVALID','Ed25519 signing key required',{status:503});
  const publicKey=createPublicKey(key),fingerprint=publicKeyFingerprint(publicKey);
  return Object.freeze({
    producerId,keyVersion:version,algorithm:AUTH_ALGORITHM,publicKeyFingerprint:fingerprint,revocationEpoch,
    signQuote(quote){
      const payloadHash=signedPayloadHash(quote),signature=nodeSign(null,signedPayloadBytes(quote),key);
      return Object.freeze({
        ...quote,
        authentication:Object.freeze({
          schema:AUTH_SCHEMA,algorithm:AUTH_ALGORITHM,producerId,keyVersion:version,
          publicKeyFingerprint:fingerprint,revocationEpoch,payloadHash,signature:b64u(signature),
        }),
      });
    },
  });
}
export function rawPublicKeyBase64Url(publicKey){
  const key=createPublicKey(publicKey);
  if(key.asymmetricKeyType!=='ed25519')fail('SIGNER_CONFIG_INVALID','Ed25519 public key required',{status:503});
  const jwk=key.export({format:'jwk'});
  return jwk.x;
}
export function testOnlyPrivateKeyFromSeed(seedHex){
  if(typeof seedHex!=='string'||!/^[0-9a-f]{64}$/i.test(seedHex))throw Error('32-byte test seed required');
  const der=Buffer.concat([Buffer.from('302e020100300506032b657004220420','hex'),Buffer.from(seedHex,'hex')]);
  return createPrivateKey({key:der,format:'der',type:'pkcs8'});
}
export {fromB64u};
