import fs from 'node:fs';
import path from 'node:path';
import {createQuoteEngine} from '../../quote-service/src/quote-engine.js';
import {createStaticChainAdapter,createStaticRouteSource} from '../../quote-service/src/adapters.js';
import {validateRequest} from '../../quote-service/src/validation.js';
import {testPolicy,testSigner} from '../../quote-service/test/test-auth.js';
import {authenticateExecutableSwapQuote} from '../core/executable-quote-intake.js';
import {createQuoteReplayGuard} from '../core/quote-authentication.js';

export const vector=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../../quote-service/fixtures/pre04-vector-v1.json'),'utf8'));
export const request=validateRequest(vector.request);
export function runtimeForAuth({policy=testPolicy({vector})}={}){
  return {
    deployment:{status:'RESOLVED',environment:'testnet'},
    network:{chainId:vector.chainId},
    api:{baseUrl:'https://api.example.invalid',executableQuoteUrl:'https://api.example.invalid/executable-swap-quote'},
    contracts:{ExchangeAtomicRouter420:vector.router},
    quoteAuthentication:policy,
  };
}
export function engineForAuth({signer=testSigner(),clock=()=>1000,route=vector.route,assets=vector.assets,feeBps=vector.feeBps}={}){
  return createQuoteEngine({
    chainId:vector.chainId,router:vector.router,spender:vector.spender,deploymentId:vector.deploymentId,manifestHash:vector.manifestHash,
    clock,routeSource:createStaticRouteSource({routes:[route]}),
    chainAdapter:createStaticChainAdapter({assets,feeBps,deployment:{deploymentId:vector.deploymentId,manifestHash:vector.manifestHash},chainId:vector.chainId,observedAt:1000}),
    signer,
  });
}
export async function authenticatedFixture({runtime=runtimeForAuth(),response=null,nowSeconds=1000,replayGuard=createQuoteReplayGuard(),endpointUrl='https://api.example.invalid/executable-swap-quote'}={}){
  const quote=response??await engineForAuth() (request);
  return authenticateExecutableSwapQuote({runtime,request,response:quote,nowSeconds,replayGuard,endpointUrl});
}
