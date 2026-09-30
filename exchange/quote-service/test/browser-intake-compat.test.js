import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createQuoteEngine} from '../src/quote-engine.js';
import {createStaticChainAdapter,createStaticRouteSource} from '../src/adapters.js';
import {validateRequest} from '../src/validation.js';
import {authenticateExecutableSwapQuote,validateExecutableSwapQuote} from '../../web/core/executable-quote-intake.js';
import {createQuoteReplayGuard} from '../../web/core/quote-authentication.js';
import {testPolicy,testSigner} from './test-auth.js';

const vector=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../fixtures/pre04-vector-v1.json'),'utf8'));

test('PRE-04 backend response is consumable by the existing browser quote intake without trust elevation',async()=>{
 const request=validateRequest(vector.request);
 const engine=createQuoteEngine({
  chainId:vector.chainId,router:vector.router,spender:vector.spender,deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,clock:()=>1000,
  routeSource:createStaticRouteSource({routes:[vector.route]}),
  chainAdapter:createStaticChainAdapter({assets:vector.assets,feeBps:vector.feeBps,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash},chainId:vector.chainId,observedAt:1000}),
  signer:testSigner(),
 });
 const response=await engine(request);
 const runtime={
  deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:vector.chainId},contracts:{ExchangeAtomicRouter420:vector.router},
  quoteAuthentication:testPolicy({vector}),
 };
 const candidate=validateExecutableSwapQuote({runtime,request,response,nowSeconds:1000});
 assert.equal(candidate.status,'REVIEW_CANDIDATE_ONLY');
 assert.equal(candidate.prepared.context.trustLevel,'REVIEW_CANDIDATE');
 const trusted=await authenticateExecutableSwapQuote({
  runtime,request,response,nowSeconds:1000,endpointUrl:'https://api.example.invalid/executable-swap-quote',
  replayGuard:createQuoteReplayGuard(),
 });
 assert.equal(trusted.status,'TRUSTED_EXECUTION_QUOTE');
 assert.equal(trusted.prepared.context.trustLevel,'AUTHENTICATED_EXECUTION');
 assert.equal(trusted.authentication.verified,true);
 assert.equal(trusted.projection.amountIn,'1');
 assert.equal(trusted.projection.minimumOutput,'4.1');
 assert.equal(trusted.projection.fees.totalFee,'0.0125');
 assert.equal(trusted.prepared.transaction.request.to,vector.router);
 assert.equal(Object.hasOwn(trusted,'sourceAuthenticated'),false);
 assert.equal(response.producer.authentication,'ED25519_PRE05');
});
