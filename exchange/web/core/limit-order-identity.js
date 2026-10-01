import {addressWord,boolWord,bytes32Word,keccak256,uintWord} from './abi.js';

const ORDER_TYPE='LimitOrder(address maker,address sellToken,address buyToken,uint128 sellAmount,uint128 minBuyAmount,address recipient,bytes32 marketId,uint256 nonce,uint64 expiry,bool allowPartial)';
const DOMAIN_TYPE='EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
export const LIMIT_ORDER_TYPEHASH=keccak256(ORDER_TYPE);
export const LIMIT_ORDER_DOMAIN_TYPEHASH=keccak256(DOMAIN_TYPE);
export const LIMIT_ORDER_NAME_HASH=keccak256('420Exchange Limit Orders');
export const LIMIT_ORDER_VERSION_HASH=keccak256('1');

const addr=v=>typeof v==='string'&&/^0x[0-9a-fA-F]{40}$/.test(v)&&!/^0x0{40}$/i.test(v);
const id=v=>typeof v==='string'&&/^0x[0-9a-fA-F]{64}$/.test(v);
function raw(value,label,bits=256,positive=false){
  if(typeof value!=='string'||!/^(?:0|[1-9][0-9]*)$/.test(value))throw new Error(`invalid ${label}`);
  const n=BigInt(value);uintWord(n,bits);if(positive&&n<=0n)throw new Error(`invalid ${label}`);return n.toString();
}
export function canonicalLimitOrder(order){
  if(!order||typeof order!=='object'||Array.isArray(order))throw new Error('order object required');
  if(!addr(order.maker)||!addr(order.sellToken)||!addr(order.buyToken)||!addr(order.recipient)||!id(order.marketId))throw new Error('invalid order identity');
  if(order.sellToken.toLowerCase()===order.buyToken.toLowerCase())throw new Error('sell and buy token must differ');
  if(order.allowPartial!==true&&order.allowPartial!==false)throw new Error('explicit partial-fill policy required');
  return Object.freeze({
    maker:order.maker.toLowerCase(),sellToken:order.sellToken.toLowerCase(),buyToken:order.buyToken.toLowerCase(),
    sellAmountRaw:raw(order.sellAmountRaw,'sellAmountRaw',128,true),minBuyAmountRaw:raw(order.minBuyAmountRaw,'minBuyAmountRaw',128,true),
    recipient:order.recipient.toLowerCase(),marketId:order.marketId.toLowerCase(),nonce:raw(order.nonce,'nonce'),
    expiry:raw(order.expiry,'expiry',64),allowPartial:order.allowPartial,
  });
}
export function hashLimitOrder(order){
  const o=canonicalLimitOrder(order);
  return keccak256('0x'+[
    LIMIT_ORDER_TYPEHASH.slice(2),addressWord(o.maker),addressWord(o.sellToken),addressWord(o.buyToken),
    uintWord(o.sellAmountRaw,128),uintWord(o.minBuyAmountRaw,128),addressWord(o.recipient),bytes32Word(o.marketId),
    uintWord(o.nonce),uintWord(o.expiry,64),boolWord(o.allowPartial),
  ].join(''));
}
export function canonicalLimitOrderDomain(domain){
  if(!domain||domain.name!=='420Exchange Limit Orders'||domain.version!=='1'||!addr(domain.verifyingContract))throw new Error('invalid EIP-712 domain');
  let chainId;try{chainId=BigInt(domain.chainId);}catch{throw new Error('invalid EIP-712 chainId');}
  if(chainId<=0n)throw new Error('invalid EIP-712 chainId');
  return Object.freeze({name:domain.name,version:domain.version,chainId:'0x'+chainId.toString(16),verifyingContract:domain.verifyingContract.toLowerCase()});
}
export function limitOrderDomainSeparator(domain){
  const d=canonicalLimitOrderDomain(domain);
  return keccak256('0x'+[
    LIMIT_ORDER_DOMAIN_TYPEHASH.slice(2),LIMIT_ORDER_NAME_HASH.slice(2),LIMIT_ORDER_VERSION_HASH.slice(2),uintWord(BigInt(d.chainId)),addressWord(d.verifyingContract),
  ].join(''));
}
export function limitOrderDigest({domain,order}){
  const ds=limitOrderDomainSeparator(domain),oh=hashLimitOrder(order);
  return keccak256('0x1901'+ds.slice(2)+oh.slice(2));
}
