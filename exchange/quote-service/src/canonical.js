import {createHash} from 'node:crypto';
import {fail} from './errors.js';
import {address,id32,normalizeAddress,raw} from './validation.js';

export function canonicalJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
}
export const hash32=value=>'0x'+createHash('sha256').update(canonicalJson(value)).digest('hex');

export function validateAsset(asset,expectedAddress){
  if(!asset||!id32(asset.assetId)||!address(asset.address)||normalizeAddress(asset.address)!==normalizeAddress(expectedAddress)||
     typeof asset.symbol!=='string'||!/^[A-Za-z0-9._-]{1,16}$/.test(asset.symbol)||
     !Number.isInteger(asset.decimals)||asset.decimals<0||asset.decimals>36||asset.verified!==true||asset.tradeEligible!==true){
    fail('INVALID_TOKEN_METADATA','qualified trade-eligible token metadata required',{status:422});
  }
  return Object.freeze({assetId:asset.assetId.toLowerCase(),address:normalizeAddress(asset.address),symbol:asset.symbol,decimals:asset.decimals,verified:true});
}
export function validateRoutePlan(plan,{tokenIn,tokenOut,maxHops=8}={}){
  if(!plan||plan.source!=='route-adapter'||!Array.isArray(plan.hops)||plan.hops.length<1||plan.hops.length>maxHops||
     !raw(plan.grossAmountOutRaw))fail('UNSUPPORTED_ROUTE','qualified route plan required',{status:422});
  let current=normalizeAddress(tokenIn);
  const hops=plan.hops.map((hop,index)=>{
    if(!id32(hop.marketId)||!id32(hop.routeId)||!address(hop.tokenIn)||!address(hop.tokenOut)||normalizeAddress(hop.tokenIn)!==current||
       !raw(hop.amountOutRaw)||!raw(hop.minAmountOutRaw)||BigInt(hop.minAmountOutRaw)>BigInt(hop.amountOutRaw)||
       typeof hop.routeData!=='string'||!/^0x(?:[0-9a-f]{2})*$/i.test(hop.routeData)){
      fail('UNSUPPORTED_ROUTE',`invalid route hop ${index}`,{status:422});
    }
    current=normalizeAddress(hop.tokenOut);
    return Object.freeze({marketId:hop.marketId.toLowerCase(),routeId:hop.routeId.toLowerCase(),tokenIn:normalizeAddress(hop.tokenIn),tokenOut:current,amountOutRaw:hop.amountOutRaw,minAmountOutRaw:hop.minAmountOutRaw,routeData:hop.routeData.toLowerCase()});
  });
  if(current!==normalizeAddress(tokenOut)||BigInt(plan.grossAmountOutRaw)!==BigInt(hops.at(-1).amountOutRaw))fail('UNSUPPORTED_ROUTE','route output does not match requested asset',{status:422});
  return Object.freeze({source:'route-adapter',grossAmountOutRaw:plan.grossAmountOutRaw,hops:Object.freeze(hops)});
}
