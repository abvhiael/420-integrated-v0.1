import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export class ReadOnlySwapEntryError extends Error {
  constructor(code,message){super(message);this.name='ReadOnlySwapEntryError';this.code=code;}
}
const fail=(code,message)=>{throw new ReadOnlySwapEntryError(code,message);};
const addr=v=>typeof v==='string'&&/^0x[0-9a-f]{40}$/i.test(v)&&!/^0x0{40}$/i.test(v);
const id32=v=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
const symbol=v=>typeof v==='string'&&/^[A-Za-z0-9._-]{1,16}$/.test(v);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);

export const REVIEW_CATALOGUE_SCHEMA='420-exchange-review-catalogue-v1';

export function parseDisplayUnits(value,decimals){
  if(typeof value!=='string'||!Number.isInteger(decimals)||decimals<0||decimals>36)fail('INVALID_AMOUNT','decimal amount and qualified token decimals required');
  const input=value.trim();
  if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(input))fail('INVALID_AMOUNT','amount must be a plain positive decimal without exponent notation');
  const [whole,fraction='']=input.split('.');
  if(fraction.length>decimals)fail('TOO_MANY_DECIMALS',`amount exceeds token precision of ${decimals} decimals`);
  const raw=(BigInt(whole)*(10n**BigInt(decimals)))+BigInt((fraction+'0'.repeat(decimals)).slice(0,decimals)||'0');
  if(raw<=0n||raw>=(1n<<256n))fail('INVALID_AMOUNT','amount must be positive and fit uint256');
  return raw.toString();
}

export function normalizeReviewCatalogue(runtime){
  const source=runtime?.reviewCatalogue;
  if(!object(source)||source.schema!==REVIEW_CATALOGUE_SCHEMA||source.qualification!=='QUALIFIED_CONFIG'||source.authority!=='METADATA_ONLY'||source.demo!==false||source.fixture!==false){
    fail('CATALOGUE_UNAVAILABLE','qualified configured Exchange review metadata is unavailable');
  }
  let chainId;
  try{chainId=normalizeChainId(runtime?.network?.chainId);}catch{fail('CHAIN_UNCONFIGURED','configured Exchange chain required');}
  if(source.chainId!==undefined&&normalizeChainId(source.chainId)!==chainId)fail('CHAIN_MISMATCH','review catalogue chain differs from runtime');
  if(!Array.isArray(source.assets)||!source.assets.length||!Array.isArray(source.markets)||!source.markets.length)fail('CATALOGUE_EMPTY','qualified asset and market metadata required');
  const maxRouteHops=source.maxRouteHops===undefined?8:source.maxRouteHops;
  if(!Number.isInteger(maxRouteHops)||maxRouteHops<1||maxRouteHops>16)fail('INVALID_ROUTE_LIMIT','review route bound must be between 1 and 16');

  const assets=[],byId=new Map(),addresses=new Set();
  for(const item of source.assets){
    if(!object(item)||!id32(item.assetId)||!addr(item.address)||!symbol(item.symbol)||!Number.isInteger(item.decimals)||item.decimals<0||item.decimals>36||item.verified!==true||item.reviewEligible!==true){
      fail('INVALID_ASSET_METADATA','qualified asset id/address/symbol/decimals required');
    }
    const assetId=item.assetId.toLowerCase(),address=normalizeAccount(item.address);
    if(byId.has(assetId)||addresses.has(address))fail('DUPLICATE_ASSET','asset identifiers and addresses must be unique');
    const normalized=Object.freeze({assetId,address,symbol:item.symbol,decimals:item.decimals,name:typeof item.name==='string'&&item.name.trim()?item.name.trim():item.symbol});
    byId.set(assetId,normalized);addresses.add(address);assets.push(normalized);
  }

  const markets=[],marketIds=new Set(),pairs=new Set();
  for(const item of source.markets){
    if(!object(item)||!id32(item.marketId)||!id32(item.inputAssetId)||!id32(item.outputAssetId)||item.active!==true||item.reviewEligible!==true){
      fail('INVALID_MARKET_METADATA','active review-eligible market metadata required');
    }
    const marketId=item.marketId.toLowerCase(),inputAssetId=item.inputAssetId.toLowerCase(),outputAssetId=item.outputAssetId.toLowerCase();
    const input=byId.get(inputAssetId),output=byId.get(outputAssetId);
    if(!input||!output||inputAssetId===outputAssetId)fail('INVALID_MARKET_METADATA','market assets must reference distinct qualified assets');
    const pair=inputAssetId+'|'+outputAssetId;
    if(marketIds.has(marketId)||pairs.has(pair))fail('DUPLICATE_MARKET','market IDs and directed asset pairs must be unique');
    marketIds.add(marketId);pairs.add(pair);
    markets.push(Object.freeze({marketId,inputAssetId,outputAssetId,input,output,label:typeof item.label==='string'&&item.label.trim()?item.label.trim():`${input.symbol} → ${output.symbol}`}));
  }

  return Object.freeze({schema:REVIEW_CATALOGUE_SCHEMA,chainId,maxRouteHops,assets:Object.freeze(assets),markets:Object.freeze(markets)});
}

export function buildMetadataSwapReviewRequest({runtime,account,marketId,recipient,amountIn,minimumOutput}={}){
  if(!addr(account)||!addr(recipient))fail('INVALID_RECIPIENT','connected account and valid recipient required');
  const catalogue=normalizeReviewCatalogue(runtime);
  const market=catalogue.markets.find(item=>item.marketId===String(marketId??'').toLowerCase());
  if(!market)fail('MARKET_UNAVAILABLE','select a qualified configured market');
  const amountInRaw=parseDisplayUnits(amountIn,market.input.decimals);
  const minimumOutputRaw=parseDisplayUnits(minimumOutput,market.output.decimals);
  return Object.freeze({
    catalogue,
    market,
    request:Object.freeze({
      account:normalizeAccount(account),
      tokenIn:market.input.address,
      tokenOut:market.output.address,
      recipient:normalizeAccount(recipient),
      amountInRaw,
      minimumOutputRaw,
    }),
  });
}

export function assertCandidateMatchesEntry(candidate,entry){
  if(!candidate?.projection||!entry?.market||!entry?.catalogue)fail('REVIEW_UNAVAILABLE','canonical review candidate and selected market required');
  const p=candidate.projection,market=entry.market;
  if(normalizeAccount(p.input?.address??'')!==market.input.address||normalizeAccount(p.output?.address??'')!==market.output.address)fail('ASSET_MISMATCH','quote candidate assets differ from selected metadata');
  if(!Array.isArray(p.hops)||p.hops.length<1||p.hops.length>entry.catalogue.maxRouteHops)fail('ROUTE_TOO_LARGE','quote route exceeds configured review bound');
  return candidate;
}
