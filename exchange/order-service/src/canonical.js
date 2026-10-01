import {
  canonicalLimitOrder as canonicalOrder,
  canonicalLimitOrderDomain as canonicalDomain,
  hashLimitOrder as hashOrder,
  limitOrderDigest as orderDigest,
  limitOrderDomainSeparator as domainSeparator,
} from '../../web/core/limit-order-identity.js';

export {canonicalOrder,canonicalDomain,hashOrder,orderDigest,domainSeparator};

export function validatePublicationEnvelope({schema,domain,order,signature,marketId,chainId,nowSeconds}={}){
  if(schema!=='420-exchange-order-publication-v1')throw new Error('unsupported publication schema');
  const d=canonicalDomain(domain),o=canonicalOrder(order);
  if(typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature))throw new Error('invalid order signature');
  if(marketId!==undefined&&String(marketId).toLowerCase()!==o.marketId)throw new Error('market mismatch');
  let expected;try{expected=BigInt(chainId);}catch{throw new Error('invalid service chain');}
  if(BigInt(d.chainId)!==expected)throw new Error('chain mismatch');
  if(!Number.isSafeInteger(nowSeconds)||BigInt(o.expiry)<=BigInt(nowSeconds))throw new Error('order expired');
  return Object.freeze({domain:d,order:o,signature:signature.toLowerCase(),orderHash:hashOrder(o),digest:orderDigest({domain:d,order:o})});
}
