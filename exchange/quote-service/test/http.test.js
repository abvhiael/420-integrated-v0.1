import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';
import {createQuoteHttpServer} from '../src/http.js';
import {createQuoteEngine} from '../src/quote-engine.js';
import {createStaticChainAdapter,createStaticRouteSource} from '../src/adapters.js';
import {createFixedWindowRateLimiter} from '../src/rate-limit.js';
import {createRedactedLogger} from '../src/redaction.js';
import {testSigner} from './test-auth.js';

const vector=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../fixtures/pre04-vector-v1.json'),'utf8'));
function quoteEngine(){
 return createQuoteEngine({
  chainId:vector.chainId,router:vector.router,spender:vector.spender,deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,clock:()=>1000,
  routeSource:createStaticRouteSource({routes:[vector.route]}),
  chainAdapter:createStaticChainAdapter({assets:vector.assets,feeBps:vector.feeBps,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash},chainId:vector.chainId,observedAt:1000}),
  signer:testSigner(),
 });
}
async function withServer(options,fn){
 const server=createQuoteHttpServer({quoteEngine:quoteEngine(),...options});server.listen(0,'127.0.0.1');await once(server,'listening');
 try{return await fn(`http://127.0.0.1:${server.address().port}`);}finally{server.close();await once(server,'close');}
}
test('PRE-04 HTTP POST serves versioned deterministic quote and stable headers',async()=>{
 await withServer({},async origin=>{
  const res=await fetch(origin+'/executable-swap-quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(vector.request)});
  assert.equal(res.status,200);assert.equal(res.headers.get('x-420-exchange-quote-schema'),'1');assert.equal(res.headers.get('cache-control'),'no-store');
  const body=await res.json();assert.equal(body.quoteId,vector.expected.quoteId);assert.equal(body.schema,'420-exchange-executable-swap-quote-v1');assert.equal(body.authentication.algorithm,'Ed25519');
 });
});
test('PRE-04 HTTP errors are deterministic for method/path/json/body bounds',async()=>{
 await withServer({maxBodyBytes:512},async origin=>{
  let res=await fetch(origin+'/wrong',{method:'POST',body:'{}'});assert.equal(res.status,404);assert.equal((await res.json()).error.code,'NOT_FOUND');
  res=await fetch(origin+'/executable-swap-quote',{method:'GET'});assert.equal(res.status,404);
  res=await fetch(origin+'/executable-swap-quote',{method:'POST',body:'{'});assert.equal(res.status,400);assert.equal((await res.json()).error.code,'MALFORMED_JSON');
  res=await fetch(origin+'/executable-swap-quote',{method:'POST',body:'x'.repeat(600)});assert.equal(res.status,413);assert.equal((await res.json()).error.code,'REQUEST_TOO_LARGE');
 });
});
test('PRE-04 HTTP rate-limit hook fails closed with retryable 429',async()=>{
 let now=1000;const rateLimit=createFixedWindowRateLimiter({maxRequests:1,windowMs:1000,now:()=>now});
 await withServer({rateLimit},async origin=>{
  let res=await fetch(origin+'/executable-swap-quote',{method:'POST',body:JSON.stringify(vector.request)});assert.equal(res.status,200);
  res=await fetch(origin+'/executable-swap-quote',{method:'POST',body:JSON.stringify(vector.request)});assert.equal(res.status,429);
  const error=await res.json();assert.equal(error.error.code,'RATE_LIMITED');assert.equal(error.error.retryable,true);
  now=2001;res=await fetch(origin+'/executable-swap-quote',{method:'POST',body:JSON.stringify(vector.request)});assert.equal(res.status,200);
 });
});
test('PRE-04 logs redact credentials/secrets and response size is bounded',async()=>{
 const logs=[],logger=createRedactedLogger(record=>logs.push(record));
 await withServer({logger,maxResponseBytes:10},async origin=>{
  const res=await fetch(origin+'/executable-swap-quote',{method:'POST',body:JSON.stringify(vector.request)});
  assert.equal(res.status,503);assert.equal((await res.json()).error.code,'RESPONSE_TOO_LARGE');
 });
 logger.warn('security_probe',{authorization:'Bearer secret-token',cookie:'session=secret'});
 const encoded=JSON.stringify(logs);assert.equal(encoded.includes('secret-token'),false);assert.equal(encoded.includes('session=secret'),false);assert.match(encoded,/REDACTED/);
});
