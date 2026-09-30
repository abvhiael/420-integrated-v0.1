import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createQuoteEngine} from '../src/quote-engine.js';
import {createStaticChainAdapter,createStaticRouteSource} from '../src/adapters.js';
import {validateRequest} from '../src/validation.js';
import {validateExecutableSwapQuote} from '../../web/core/executable-quote-intake.js';

const vector=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../fixtures/pre04-vector-v1.json'),'utf8'));

test('PRE-04 backend response is consumable by the existing browser quote intake without trust elevation',async()=>{
 const request=validateRequest(vector.request);
 const engine=createQuoteEngine({
  chainId:vector.chainId,router:vector.router,spender:vector.spender,deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,clock:()=>1000,
  routeSource:createStaticRouteSource({routes:[vector.route]}),
  chainAdapter:createStaticChainAdapter({assets:vector.assets,feeBps:vector.feeBps,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash},chainId:vector.chainId,observedAt:1000}),
 });
 const response=await engine(request);
 const runtime={deployment:{status:'RESOLVED',environment:'testnet'},network:{chainId:vector.chainId},contracts:{ExchangeAtomicRouter420:vector.router}};
 const candidate=validateExecutableSwapQuote({runtime,request,response,nowSeconds:1000});
 assert.equal(candidate.status,'REVIEW_CANDIDATE_ONLY');
 assert.equal(candidate.projection.amountIn,'1');
 assert.equal(candidate.projection.minimumOutput,'4.1');
 assert.equal(candidate.projection.fees.totalFee,'0.0125');
 assert.equal(candidate.prepared.transaction.request.to,vector.router);
 assert.equal(Object.hasOwn(candidate,'sourceAuthenticated'),false);
 assert.equal(response.producer.authentication,'DEFERRED_TO_PRE05');
});
