import {addressWord,bytes32Word,decodeBool,decodeUint256,dynamicBytes,encodeHopArray,encodeLimitOrderTuple,functionSelector,uintWord} from './abi.js';
import {normalizeAccount,normalizeChainId} from './wallet-session.js';

const HASH=/^0x[0-9a-fA-F]{64}$/;
function positive(value,label,bits=256){
  if(typeof value!=='string'||!/^[0-9]+$/.test(value)) throw new Error(`invalid ${label}: raw integer string required`);
  const n=BigInt(value); if(n<=0n) throw new Error(`invalid ${label}`); uintWord(n,bits); return n;
}
function orderFields(order){
  if(!order||typeof order!=='object') throw new Error('signed order required');
  encodeLimitOrderTuple(order);
  if(positive(String(order.sellAmountRaw),'sell amount',128)===0n) throw new Error('invalid sell amount');
  positive(String(order.minBuyAmountRaw),'minimum buy amount',128);
  if(order.allowPartial!==true&&order.allowPartial!==false) throw new Error('explicit partial-fill policy required');
  return order;
}
export function encodeFillOrder({order,fillSellAmountRaw,signature,expectedPathHash,hops}){
  orderFields(order);
  const fill=positive(fillSellAmountRaw,'fill amount',128);
  if(fill>BigInt(order.sellAmountRaw)) throw new Error('fill exceeds signed sell amount');
  if(!order.allowPartial&&fill!==BigInt(order.sellAmountRaw)) throw new Error('partial fill not permitted');
  const signatureEncoded=dynamicBytes(signature);
  if(signatureEncoded.length<=64) throw new Error('signature required');
  bytes32Word(expectedPathHash);
  if(!Array.isArray(hops)||hops.length<1||hops.length>4) throw new Error('1..4 hops required');
  if(hops[0].marketId.toLowerCase()!==order.marketId.toLowerCase()) throw new Error('first hop market differs from signed order');
  if(hops.at(-1).tokenOut.toLowerCase()!==order.buyToken.toLowerCase()) throw new Error('last hop output differs from signed order');
  const headBytes=14*32; // 10 static tuple words, fill, signature offset, path hash, hops offset
  const hopData=encodeHopArray(hops);
  const head=[encodeLimitOrderTuple(order),uintWord(fill),uintWord(headBytes),bytes32Word(expectedPathHash),uintWord(headBytes+signatureEncoded.length/2)].join('');
  return functionSelector('fillOrder((address,address,address,uint128,uint128,address,bytes32,uint256,uint64,bool),uint128,bytes,bytes32,(bytes32,bytes32,address,uint256,bytes)[])')+head+signatureEncoded+hopData;
}
export function buildLimitOrderFillTransaction({runtime,filler,order,fillSellAmountRaw,signature,expectedPathHash,hops}){
  if(runtime?.deployment?.status!=='RESOLVED'||runtime.deployment.environment!=='testnet') throw new Error('resolved Exchange testnet runtime required');
  const to=runtime.contracts?.ExchangeLimitOrderSettlement420;
  addressWord(to);
  const from=normalizeAccount(filler);
  const data=encodeFillOrder({order,fillSellAmountRaw,signature,expectedPathHash,hops});
  return Object.freeze({kind:'ORDER_FILL',chainId:normalizeChainId(runtime.network.chainId),request:Object.freeze({from,to,data,value:'0x0'})});
}
async function read(provider,to,data){return provider.request({method:'eth_call',params:[{to,data},'latest']});}
export async function readLimitOrderState({provider,runtime,order}){
  orderFields(order);
  if(runtime?.deployment?.status!=='RESOLVED') throw new Error('resolved deployment required');
  const to=runtime.contracts?.ExchangeLimitOrderSettlement420;addressWord(to);
  const encoded=encodeLimitOrderTuple(order);
  const orderHash=await read(provider,to,functionSelector('hashOrder((address,address,address,uint128,uint128,address,bytes32,uint256,uint64,bool))')+encoded);
  if(!HASH.test(orderHash)) throw new Error('invalid on-chain order hash');
  const [filled,cancelled,nonceCancelled,nonceFloor,boundHash]=await Promise.all([
    read(provider,to,functionSelector('filledSellAmount(bytes32)')+bytes32Word(orderHash)),
    read(provider,to,functionSelector('cancelledOrder(bytes32)')+bytes32Word(orderHash)),
    read(provider,to,functionSelector('cancelledNonce(address,uint256)')+addressWord(order.maker)+uintWord(order.nonce)),
    read(provider,to,functionSelector('minValidNonce(address)')+addressWord(order.maker)),
    read(provider,to,functionSelector('nonceOrderHash(address,uint256)')+addressWord(order.maker)+uintWord(order.nonce)),
  ]);
  return Object.freeze({orderHash:orderHash.toLowerCase(),filledSellAmountRaw:decodeUint256(filled).toString(),cancelled:decodeBool(cancelled),nonceCancelled:decodeBool(nonceCancelled),nonceFloor:decodeUint256(nonceFloor).toString(),boundHash:HASH.test(boundHash)?boundHash.toLowerCase():null});
}
