import {createEd25519Signer,rawPublicKeyBase64Url,testOnlyPrivateKeyFromSeed} from '../src/auth.js';

export const TEST_SEED='9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
export const TEST_PUBLIC_RAW_HEX='d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
export const TEST_PRODUCER_ID='exchange-quote-test';
export const TEST_KEY_VERSION='test-v1';
export const TEST_REVOCATION_EPOCH=1;

export function testSigner(){
  return createEd25519Signer({
    producerId:TEST_PRODUCER_ID,keyVersion:TEST_KEY_VERSION,
    privateKey:testOnlyPrivateKeyFromSeed(TEST_SEED),revocationEpoch:TEST_REVOCATION_EPOCH,
  });
}
export function testPublicKey(){
  return rawPublicKeyBase64Url(testOnlyPrivateKeyFromSeed(TEST_SEED));
}
export function testPolicy({vector,revoked=false,keyVersion=TEST_KEY_VERSION,notBefore=900,notAfter=2000,revocationEpoch=TEST_REVOCATION_EPOCH,publicKey=testPublicKey(),producers=null,maxKeyOverlapSeconds=3600}={}){
  return {
    schema:'420-exchange-quote-auth-policy-v1',status:'QUALIFIED_CONFIG',service:'420/service/exchange-quote/v1',
    endpointUrl:'https://api.example.invalid/executable-swap-quote',maxKeyOverlapSeconds,
    deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,router:vector.router,spender:vector.spender},
    producers:producers??[{producerId:TEST_PRODUCER_ID,keyVersion,algorithm:'Ed25519',publicKey,notBefore,notAfter,revocationEpoch,revoked}],
  };
}
