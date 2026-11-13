// W15.6-M4: read-only portfolio classification. Never authorize transfers or synthesize prices.
import {decodeString,decodeUint,normalizeAddress,encodeBalanceOf,encodeDecimals,encodeSymbol} from './abi.js';
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const WORD=/^0x[0-9a-fA-F]{64}$/;
const ZERO='0x'+'0'.repeat(40);
export const PORTFOLIO_SETTINGS_KEY_420='420-wallet-portfolio-settings-v1';
export const PORTFOLIO_CACHE_KEY_420='420-wallet-portfolio-cache-v1';
export const PRICE_CACHE_KEY_420='420-wallet-portfolio-price-cache-v1';
export const TRANSFER_TOPIC_420='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const require420=(ok,message)=>{if(!ok)throw new Error(message);};
const decimal=(value,max=36)=>Number.isInteger(value)&&value>=0&&value<=max;
const wordAddress=a=>'0x'+a.slice(2).toLowerCase().padStart(64,'0');
const hexBlock=n=>'0x'+n.toString(16);
export function portfolioScope420(chainId,account){
  require420(typeof chainId==='string'&&/^0x[0-9a-fA-F]+$/.test(chainId),'Invalid portfolio chain');
  return '0x'+BigInt(chainId).toString(16)+':'+normalizeAddress(account);
}
export function checkedToken420(token){
  require420(token&&ADDRESS.test(token.address)&&token.address.toLowerCase()!==ZERO,'Invalid token address');
  const address=normalizeAddress(token.address);
  const symbol=String(token.symbol||'');
  require420(/^[a-zA-Z0-9]{1,12}$/.test(symbol),'Invalid token symbol');
  require420(decimal(token.decimals),'Invalid token decimals');
  return {address,symbol,decimals:token.decimals,hidden:token.hidden===true,
    spam:token.spam===true,source:token.source==='discovered'?'discovered':'imported',
    verified:token.verified===true};
}
export function spamSignals420(token){
  const symbol=String(token.symbol||'');
  const suspicious=/https?:|www\.|\.com|\.xyz|airdrop|claim|reward|bonus|visit|voucher|free\$/i.test(symbol);
  return {suspected:suspicious||token.spam===true,reasons:[
    ...(suspicious?['Promotional or URL-like token symbol']:[]),
    ...(token.spam===true?['User marked as spam']:[])
  ]};
}
export function classifyBalance420({raw=null,status='unavailable',pendingRaw='0',blockNumber=null,checkedAt=null}={}){
  if(status!=='verified'||typeof raw!=='string'||!/^\d+$/.test(raw))
    return {status:'unavailable',spendable:null,pending:null,blockNumber:null,checkedAt};
  require420(typeof pendingRaw==='string'&&/^\d+$/.test(pendingRaw),'Invalid pending amount');
  const available=BigInt(raw),pending=BigInt(pendingRaw);
  return {status:pending>0n?'pending':'spendable',spendable:available.toString(),
    pending:pending.toString(),blockNumber,checkedAt};
}
export async function verifiedTokenMetadata420(provider,address){
  const to=normalizeAddress(address);
  require420(to!==ZERO,'Invalid token address');
  const code=await provider.request('eth_getCode',[to,'latest']);
  require420(typeof code==='string'&&/^0x(?:[0-9a-fA-F]{2})+$/.test(code)&&!/^0x0+$/i.test(code),'Token contract code missing');
  const [decRaw,symbolRaw]=await Promise.all([
    provider.request('eth_call',[{to,data:encodeDecimals()},'latest']),
    provider.request('eth_call',[{to,data:encodeSymbol()},'latest'])
  ]);
  const decimals=Number(decodeUint(decRaw));
  require420(decimal(decimals),'Invalid on-chain token decimals');
  const symbol=decodeString(symbolRaw).trim();
  require420(/^[a-zA-Z0-9]{1,12}$/.test(symbol),'Unsafe or malformed on-chain token symbol');
  return {address:to,symbol,decimals,verified:true};
}
export async function checkedTokenBalance420(provider,token,account){
  const t=checkedToken420(token),owner=normalizeAddress(account);
  const raw=decodeUint(await provider.request('eth_call',[{to:t.address,data:encodeBalanceOf(owner)},'latest']));
  return raw.toString();
}
export async function discoverTokens420(provider,account,{fromBlock=0n,toBlock=null,maxLogs=250,maxSpan=2048n}={}){
  const owner=normalizeAddress(account),block=toBlock==null?BigInt(await provider.request('eth_blockNumber')):BigInt(toBlock);
  const from=BigInt(fromBlock);
  require420(from>=0n&&block>=from&&block-from<=maxSpan,'Discovery requires bounded confirmed block range');
  const topic=wordAddress(owner);
  const getLogs=async topics=>provider.request('eth_getLogs',[{fromBlock:hexBlock(from),toBlock:hexBlock(block),topics}]);
  const [incoming,outgoing]=await Promise.all([getLogs([TRANSFER_TOPIC_420,null,topic]),getLogs([TRANSFER_TOPIC_420,topic])]);
  require420(Array.isArray(incoming)&&Array.isArray(outgoing)&&incoming.length+outgoing.length<=maxLogs,'Discovery exceeds bounded log limit');
  const addresses=new Set();
  const nftCandidates=new Map();
  for(const log of [...incoming,...outgoing]){
    if(!ADDRESS.test(log?.address)||!Array.isArray(log.topics)||log.topics[0]?.toLowerCase()!==TRANSFER_TOPIC_420)continue;
    const address=normalizeAddress(log.address);
    if(log.topics.length===3)addresses.add(address);
    if(log.topics.length===4&&WORD.test(log.topics[3])){
      const ids=nftCandidates.get(address)||new Set();
      ids.add(BigInt(log.topics[3]).toString());nftCandidates.set(address,ids);
    }
  }
  const tokens=[],nfts=[],unverified=[];
  for(const address of [...addresses].slice(0,50)){
    try{
      const metadata=await verifiedTokenMetadata420(provider,address);
      const raw=await checkedTokenBalance420(provider,metadata,owner);
      tokens.push({...metadata,raw,source:'discovered',spam:spamSignals420(metadata).suspected});
    }catch(e){unverified.push({address,reason:'Contract metadata or balance could not be verified'});}
  }
  for(const [address,ids] of [...nftCandidates].slice(0,30)){
    for(const tokenId of [...ids].slice(0,30)){
      try{
        const data='0x6352211e'+BigInt(tokenId).toString(16).padStart(64,'0'); // ERC721 ownerOf(uint256)
        const result=await provider.request('eth_call',[{to:address,data},'latest']);
        require420(WORD.test(result),'Invalid ownerOf response');
        if('0x'+result.slice(-40).toLowerCase()===owner)nfts.push({standard:'ERC721',address,tokenId,owner,verified:true});
      }catch{} // Candidate is not certified as owned without ownerOf.
    }
  }
  return {chainBlock:block.toString(),fromBlock:from.toString(),toBlock:block.toString(),
    tokens,nfts,unverified,limited:true};
}
export function validatePrice420(quote,{chainId,address,now=Date.now(),maxAgeMs=300000}={}){
  require420(quote&&quote.chainId===chainId&&quote.address===address,'Price asset/chain mismatch');
  require420(typeof quote.currency==='string'&&/^[A-Z]{3}$/.test(quote.currency),'Price currency invalid');
  require420(typeof quote.price==='string'&&/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(quote.price),'Price is not an exact positive decimal');
  require420(Number(quote.price)>0&&Number.isFinite(Number(quote.price)),'Invalid price');
  require420(Number.isSafeInteger(quote.timestamp)&&quote.timestamp<=now+30000&&quote.timestamp>0,'Price timestamp invalid');
  const stale=now-quote.timestamp>maxAgeMs;
  return {...quote,stale,verified:true};
}
export function fiatValue420(raw,decimals,quote){
  if(!quote||quote.verified!==true||quote.stale||!decimal(decimals)||!/^\d+$/.test(String(raw)))return null;
  const [whole,fraction='']=quote.price.split('.');
  const scaled=BigInt(whole+fraction.padEnd(18,'0'));
  const cents=(BigInt(raw)*scaled*100n)/(10n**BigInt(decimals)*10n**18n);
  return (cents/100n).toString()+'.'+(cents%100n).toString().padStart(2,'0');
}
export function normalizedPortfolioSettings420(record={}){
  const hidden=Array.isArray(record.hidden)?record.hidden.filter(x=>typeof x==='string'&&ADDRESS.test(x)).map(x=>x.toLowerCase()).slice(0,150):[];
  const spam=Array.isArray(record.spam)?record.spam.filter(x=>typeof x==='string'&&ADDRESS.test(x)).map(x=>x.toLowerCase()).slice(0,150):[];
  const tokens=Array.isArray(record.tokens)?record.tokens.slice(0,60).map(x=>{try{return checkedToken420(x);}catch{return null;}}).filter(Boolean):[];
  const priceEndpoint=typeof record.priceEndpoint==='string'&&/^https:\/\//.test(record.priceEndpoint)?record.priceEndpoint:null;
  const nftKeys=value=>Array.isArray(value)?[...new Set(value.filter(x=>
    typeof x==='string'&&/^(ERC721|ERC1155):0x[0-9a-fA-F]{40}:\d{1,78}$/.test(x)
  ).map(x=>x.slice(0,x.indexOf(':'))+x.slice(x.indexOf(':')).toLowerCase()))].slice(0,200):[];
  const nftIndexFrom=typeof record.nftIndexFrom==='string'&&/^\d+$/.test(record.nftIndexFrom)?
    record.nftIndexFrom:null;
  const nftIndexBefore=typeof record.nftIndexBefore==='string'&&/^\d+$/.test(record.nftIndexBefore)?
    record.nftIndexBefore:null;
  return {tokens,hidden:[...new Set(hidden)],spam:[...new Set(spam)],
    nftHidden:nftKeys(record.nftHidden),nftSpam:nftKeys(record.nftSpam),
    nftTrusted:nftKeys(record.nftTrusted),nftIndexFrom,nftIndexBefore,
    priceEndpoint,
    fiatCurrency:/^(CAD|USD|EUR|GBP)$/.test(record.fiatCurrency)?record.fiatCurrency:'CAD',
    discoveryFrom:typeof record.discoveryFrom==='string'&&/^\d+$/.test(record.discoveryFrom)?record.discoveryFrom:'0'};
}
