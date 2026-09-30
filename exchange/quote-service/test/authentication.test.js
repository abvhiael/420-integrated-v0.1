import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicKey,sign as nodeSign} from 'node:crypto';
import {authenticateExecutableSwapQuote,validateExecutableSwapQuote} from '../../web/core/executable-quote-intake.js';
import {createQuoteReplayGuard,normalizeTrustedQuotePolicy,verifyQuoteAuthentication} from '../../web/core/quote-authentication.js';
import {testOnlyPrivateKeyFromSeed} from '../src/auth.js';
import {engineForAuth,request,runtimeForAuth,vector} from '../../web/test/authenticated-quote-fixture.js';
import {TEST_PUBLIC_RAW_HEX,TEST_SEED,testPolicy,testPublicKey,testSigner,TEST_KEY_VERSION,TEST_PRODUCER_ID} from './test-auth.js';

const endpoint='https://api.example.invalid/executable-swap-quote';
const hexFromB64url=value=>Buffer.from(value,'base64url').toString('hex');

test('PRE-05 RFC 8032 Ed25519 deterministic vector matches the standard seed/public/signature',()=>{
 const privateKey=testOnlyPrivateKeyFromSeed(TEST_SEED);
 const publicJwk=createPublicKey(privateKey).export({format:'jwk'});
 assert.equal(Buffer.from(publicJwk.x,'base64url').toString('hex'),TEST_PUBLIC_RAW_HEX);
 assert.equal(hexFromB64url(testPublicKey()),TEST_PUBLIC_RAW_HEX);
 const signature=nodeSign(null,Buffer.alloc(0),privateKey).toString('hex');
 assert.equal(signature,'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b');
});

test('PRE-05 same quote inputs and key produce deterministic authenticated envelope',async()=>{
 const engine=engineForAuth(),a=await engine(request),b=await engine(request);
 assert.deepEqual(a,b);
 assert.equal(a.authentication.algorithm,'Ed25519');
 assert.equal(a.authentication.producerId,TEST_PRODUCER_ID);
 assert.equal(a.authentication.keyVersion,TEST_KEY_VERSION);
 assert.match(a.authentication.payloadHash,/^0x[0-9a-f]{64}$/);
 assert.match(a.authentication.signature,/^[A-Za-z0-9_-]+$/);
 assert.match(a.transactionFingerprint,/^0x[0-9a-f]{64}$/);
 assert.match(a.replayDomain,/^0x[0-9a-f]{64}$/);
});

test('PRE-05 browser independently verifies origin, exact intent and transaction fingerprint',async()=>{
 const response=await engineForAuth()(request),runtime=runtimeForAuth();
 const candidate=validateExecutableSwapQuote({runtime,request,response,nowSeconds:1000});
 assert.equal(candidate.prepared.context.trustLevel,'REVIEW_CANDIDATE');
 const evidence=await verifyQuoteAuthentication({runtime,quote:response,prepared:candidate.prepared,nowSeconds:1000,endpointUrl:endpoint});
 assert.equal(evidence.verified,true);
 assert.equal(evidence.quoteId,response.quoteId);
 assert.equal(evidence.transactionFingerprint,response.transactionFingerprint);
 const trusted=await authenticateExecutableSwapQuote({runtime,request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()});
 assert.equal(trusted.status,'TRUSTED_EXECUTION_QUOTE');
 assert.equal(trusted.prepared.context.trustLevel,'AUTHENTICATED_EXECUTION');
 assert.equal(trusted.prepared.context.authentication,trusted.authentication);
});

test('PRE-05 every signed execution-critical field rejects post-signature tampering',async()=>{
 const original=await engineForAuth()(request),runtime=runtimeForAuth();
 const mutations=[
  q=>{q.account='0x'+'09'.repeat(20);},
  q=>{q.chainId='0x421';},
  q=>{q.deployment.router='0x'+'09'.repeat(20);q.builder.router=q.deployment.router;},
  q=>{q.deployment.manifestHash='0x'+'09'.repeat(32);},
  q=>{q.reviewedIntent.recipient='0x'+'09'.repeat(20);q.execution.recipient=q.reviewedIntent.recipient;},
  q=>{q.execution.amountInRaw='2';q.builder.execution.amountInRaw='2';},
  q=>{q.execution.hops[0].routeId='0x'+'09'.repeat(32);q.builder.execution.hops[0].routeId=q.execution.hops[0].routeId;},
  q=>{q.fees.totalFeeRaw='1';q.fees.components[0].amountRaw='1';q.quoteEconomics.feeAmountRaw='1';},
  q=>{q.quoteEconomics.netAmountOutRaw='4987499';},
  q=>{q.transactionFingerprint='0x'+'09'.repeat(32);},
  q=>{q.quoteId='0x'+'09'.repeat(32);},
  q=>{q.expiresAt=1029;},
  q=>{q.replayDomain='0x'+'09'.repeat(32);},
 ];
 for(const mutate of mutations){
  const changed=structuredClone(original);mutate(changed);
  await assert.rejects(
   authenticateExecutableSwapQuote({runtime,request,response:changed,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),
   error=>['SIGNATURE_INVALID','PAYLOAD_HASH_MISMATCH','ACCOUNT_MISMATCH','CHAIN_MISMATCH','QUOTE_REQUEST_MISMATCH','UNQUALIFIED_RESPONSE','FINGERPRINT_MISMATCH','REPLAY_DOMAIN_MISMATCH','DOMAIN_MISMATCH','INVALID_QUOTE'].includes(error.code),
  );
 }
});

test('PRE-05 unsigned, extra-field and omitted-field envelopes fail closed before trust promotion',async()=>{
 const response=await engineForAuth()(request),runtime=runtimeForAuth();
 for(const changed of [
  (()=>{const q=structuredClone(response);delete q.authentication;return q;})(),
  {...structuredClone(response),sourceAuthenticated:true},
  (()=>{const q=structuredClone(response);delete q.fees;return q;})(),
  (()=>{const q=structuredClone(response);q.execution={...q.execution,approvalTarget:vector.spender};q.builder.execution=q.execution;return q;})(),
 ]){
  await assert.rejects(
   Promise.resolve().then(()=>authenticateExecutableSwapQuote({runtime,request,response:changed,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()})),
   error=>error.name==='QuoteIntakeError',
  );
 }
});

test('PRE-05 replay guard rejects a second admission of the same signed quote',async()=>{
 const response=await engineForAuth()(request),runtime=runtimeForAuth(),guard=createQuoteReplayGuard();
 await authenticateExecutableSwapQuote({runtime,request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:guard});
 await assert.rejects(
  authenticateExecutableSwapQuote({runtime,request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:guard}),
  error=>error.code==='QUOTE_REPLAYED',
 );
});

test('PRE-05 domain substitution fails across account, chain, router and endpoint',async()=>{
 const response=await engineForAuth()(request);
 await assert.rejects(authenticateExecutableSwapQuote({runtime:runtimeForAuth(),request:{...request,account:'0x'+'09'.repeat(20)},response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>e.code==='ACCOUNT_MISMATCH');
 await assert.rejects(authenticateExecutableSwapQuote({runtime:{...runtimeForAuth(),network:{chainId:'0x421'}},request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>e.code==='CHAIN_MISMATCH');
 const wrongRouter='0x'+'09'.repeat(20),policy=testPolicy({vector});
 policy.deployment={...policy.deployment,router:wrongRouter};
 await assert.rejects(authenticateExecutableSwapQuote({runtime:{...runtimeForAuth(),quoteAuthentication:policy},request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>['DOMAIN_MISMATCH','FINGERPRINT_MISMATCH'].includes(e.code));
 await assert.rejects(authenticateExecutableSwapQuote({runtime:runtimeForAuth(),request,response,nowSeconds:1000,endpointUrl:'https://evil.example.invalid/executable-swap-quote',replayGuard:createQuoteReplayGuard()}),e=>e.code==='ENDPOINT_MISMATCH');
});

test('PRE-05 key revocation, validity windows, unknown versions and excessive rollover overlap fail closed',async()=>{
 const response=await engineForAuth()(request);
 await assert.rejects(authenticateExecutableSwapQuote({runtime:runtimeForAuth({policy:testPolicy({vector,revoked:true})}),request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>e.code==='KEY_REVOKED');
 await assert.rejects(authenticateExecutableSwapQuote({runtime:runtimeForAuth({policy:testPolicy({vector,notBefore:1001})}),request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>e.code==='KEY_NOT_ACTIVE');
 await assert.rejects(authenticateExecutableSwapQuote({runtime:runtimeForAuth({policy:testPolicy({vector,keyVersion:'other-v2'})}),request,response,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>e.code==='UNTRUSTED_PRODUCER');
 const base=testPolicy({vector}).producers[0];
 const excessive=testPolicy({vector,maxKeyOverlapSeconds:10,producers:[
  base,{...base,keyVersion:'test-v2',notBefore:950,notAfter:1100},
 ]});
 assert.throws(()=>normalizeTrustedQuotePolicy({quoteAuthentication:excessive}),e=>e.code==='AUTH_POLICY_INVALID');
 const bounded=testPolicy({vector,maxKeyOverlapSeconds:60,producers:[
  {...base,notAfter:1010},{...base,keyVersion:'test-v2',notBefore:950,notAfter:1100},
 ]});
 assert.doesNotThrow(()=>normalizeTrustedQuotePolicy({quoteAuthentication:bounded}));
});

test('PRE-05 forged signature and key fingerprint fail independently',async()=>{
 const response=await engineForAuth()(request),runtime=runtimeForAuth();
 const forged=structuredClone(response);forged.authentication.signature=(forged.authentication.signature[0]==='A'?'B':'A')+forged.authentication.signature.slice(1);
 await assert.rejects(authenticateExecutableSwapQuote({runtime,request,response:forged,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>['SIGNATURE_INVALID','PAYLOAD_HASH_MISMATCH'].includes(e.code));
 const fingerprint=structuredClone(response);fingerprint.authentication.publicKeyFingerprint='sha256:'+'00'.repeat(32);
 await assert.rejects(authenticateExecutableSwapQuote({runtime,request,response:fingerprint,nowSeconds:1000,endpointUrl:endpoint,replayGuard:createQuoteReplayGuard()}),e=>e.code==='KEY_FINGERPRINT_MISMATCH');
});
