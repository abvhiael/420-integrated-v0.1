import {fail} from './errors.js';

export class RouteSource {
  async quoteExactInput(_request,_context){fail('ROUTE_SOURCE_UNAVAILABLE','route source unavailable',{status:503,retryable:true});}
}
export class ChainStateAdapter {
  async snapshot(_request){fail('CHAIN_SOURCE_UNAVAILABLE','chain state source unavailable',{status:503,retryable:true});}
}
export function createStaticRouteSource({routes=[]}={}){
  const byPair=new Map(routes.map(route=>[(route.tokenIn+'|'+route.tokenOut).toLowerCase(),structuredClone(route)]));
  return new class extends RouteSource {
    async quoteExactInput(request){
      const route=byPair.get((request.tokenIn+'|'+request.tokenOut).toLowerCase());
      if(!route)fail('UNSUPPORTED_ROUTE','no configured route for requested pair',{status:422});
      return structuredClone(route);
    }
  };
}
export function createStaticChainAdapter({assets=[],feeBps=0,deployment,chainId=null,observedAt=null}={}){
  const byAddress=new Map(assets.map(asset=>[asset.address.toLowerCase(),structuredClone(asset)]));
  return new class extends ChainStateAdapter {
    async snapshot(request){
      const input=byAddress.get(request.tokenIn),output=byAddress.get(request.tokenOut);
      if(!input||!output)fail('INVALID_TOKEN_METADATA','token metadata unavailable',{status:422});
      return {assets:{input:structuredClone(input),output:structuredClone(output)},feeBps,deployment:structuredClone(deployment),chainId,observedAt};
    }
  };
}
