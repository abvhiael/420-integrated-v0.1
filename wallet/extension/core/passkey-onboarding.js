import {base64urlEncode} from './passkeys.js';
import {extractP256PublicKeyFromSpki} from './passkey-p256-browser.js';

function failUnless(ok,message){if(!ok)throw new Error(message);}
function secureRandom(bytes){failUnless(globalThis.crypto?.getRandomValues,'Secure randomness unavailable');return globalThis.crypto.getRandomValues(new Uint8Array(bytes));}
export function validatePendingPasskey420(value){
  failUnless(value&&value.status==='pending-onchain-enrollment','Passkey is not in pending enrollment state');
  failUnless(typeof value.credentialId==='string'&&/^[A-Za-z0-9_-]{8,1400}$/.test(value.credentialId),'Invalid passkey credential identifier');
  for(const key of ['publicKeyX','publicKeyY']){
    failUnless(typeof value[key]==='string'&&/^0x[0-9a-f]{64}$/i.test(value[key])&&!/^0x0{64}$/i.test(value[key]),'Invalid P-256 coordinate');
  }
  failUnless(typeof value.origin==='string'&&/^chrome-extension:\/\/[a-p]{32}$/.test(value.origin),'Unsupported extension passkey origin');
  failUnless(value.rpId===value.origin.slice('chrome-extension://'.length),'Passkey RP ID must be its own extension');
  failUnless(typeof value.createdAt==='number'&&Number.isFinite(value.createdAt),'Passkey creation date required');
  return true;
}
/** Prepares a WebAuthn ES256 device credential. This never enrolls it into SmartAccount420. */
export async function registerPendingExtensionPasskey420(navigatorLike,{origin=globalThis.location?.origin,rpName='420 Wallet'}={}){
  failUnless(navigatorLike?.credentials?.create,'Browser WebAuthn credential creation unavailable');
  failUnless(typeof origin==='string'&&/^chrome-extension:\/\/[a-p]{32}$/.test(origin),'Only the trusted Chromium extension origin may create a device passkey');
  failUnless(globalThis.location?.origin===origin,'WebAuthn caller origin mismatch');
  const challenge=secureRandom(32),userId=secureRandom(32);
  const result=await navigatorLike.credentials.create({publicKey:{
    challenge,rp:{name:rpName},user:{id:userId,name:'420Wallet pending SmartAccount',displayName:'420Wallet Smart Account'},
    pubKeyCredParams:[{type:'public-key',alg:-7}],
    authenticatorSelection:{residentKey:'required',requireResidentKey:true,userVerification:'required'},
    attestation:'none',timeout:120000,
  }});
  failUnless(result?.type==='public-key'&&typeof result.id==='string'&&result.rawId,'Invalid WebAuthn response');
  failUnless(result.id===base64urlEncode(new Uint8Array(result.rawId)),'WebAuthn credential ID mismatch');
  const data=JSON.parse(new TextDecoder().decode(result.response?.clientDataJSON));
  failUnless(data.type==='webauthn.create'&&data.origin===origin&&data.challenge===base64urlEncode(challenge)&&data.crossOrigin!==true,'WebAuthn creation origin/challenge mismatch');
  failUnless(result.response?.getPublicKeyAlgorithm?.()===-7,'Passkey must be ES256/P-256');
  const {publicKeyX,publicKeyY}=extractP256PublicKeyFromSpki(result.response.getPublicKey());
  const pending={status:'pending-onchain-enrollment',credentialId:result.id,publicKeyX,publicKeyY,rpId:origin.split('://')[1],origin,createdAt:Date.now()};
  validatePendingPasskey420(pending);
  return pending;
}
