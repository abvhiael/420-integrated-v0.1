import crypto from 'node:crypto';

export const HISTORY_KINDS=Object.freeze(['TRADE','FILL','ORDER','CANCELLATION','LIQUIDITY','BRIDGE_DEPOSIT','BRIDGE_WITHDRAWAL','ROUTE_STATE','FEE_ROUTING']);
const EVENT_KIND=Object.freeze({
  AtomicPathExecuted:'TRADE',NativePathExecuted:'TRADE',LimitOrderFilled:'FILL',
  LimitOrderCancelled:'CANCELLATION',LimitOrderNonceCancelled:'CANCELLATION',LimitOrderNonceFloorSet:'CANCELLATION',
  OutboundInitiated:'BRIDGE_WITHDRAWAL',InboundAccepted:'BRIDGE_DEPOSIT',
  ExchangeFeeSettled:'FEE_ROUTING',ExchangeFeeRouted:'FEE_ROUTING',
  RouteSet:'ROUTE_STATE',DirectionSet:'ROUTE_STATE',
});
const req=(v,label)=>{if(typeof v!=='string'||!v)throw new Error('invalid '+label);return v;};
const str=v=>typeof v==='bigint'?v.toString():String(v);
function field(e,...names){for(const n of names)if(e.fields?.[n]!==undefined&&e.fields?.[n]!==null)return str(e.fields[n]);return null;}
function recordId(e){return crypto.createHash('sha256').update([str(e.chainId),e.blockHash,e.transactionHash,str(e.logIndex)].join('|')).digest('hex');}
function subject(e,kind){
  if(kind==='TRADE')return field(e,'marketId','pathHash','tradeRef')??e.objectKey??e.transactionHash;
  if(kind==='FILL'||kind==='CANCELLATION'||kind==='ORDER')return field(e,'orderHash','tradeRef')??e.objectKey??e.transactionHash;
  if(kind==='BRIDGE_WITHDRAWAL')return field(e,'routeId','sourceMessageId')??e.objectKey??e.transactionHash;
  if(kind==='BRIDGE_DEPOSIT')return field(e,'transferId','routeId')??e.objectKey??e.transactionHash;
  if(kind==='FEE_ROUTING')return field(e,'tradeRef','pathHash')??e.objectKey??e.transactionHash;
  return field(e,'routeId','marketId')??e.objectKey??e.transactionHash;
}
function semantic(e,kind,subjectId){return [kind,subjectId,e.eventName,field(e,'nonce','sourceMessageId','transferId','tradeRef')??''].join('|');}
export function mapIndexerEventToHistory(e,{observedAt=0,finality='indexed',freshness='canonical'}={}){
  if(!e||e.protocol!=='420Exchange'&&e.protocol!=='420Bridge')return null;
  const kind=EVENT_KIND[e.eventName];if(!kind)return null;
  const subjectId=req(subject(e,kind),'history subject');
  const rid='idx:'+recordId(e);
  const amountRaw=field(e,'amount','amountIn','amountOut','sellAmountFilled','grossRevenue','grossAmountOut');
  const beneficiary=field(e,'recipient','beneficiary');
  const feeAmountRaw=field(e,'grossRevenue','developerPayment');
  return Object.freeze({
    recordId:rid,semanticKey:semantic(e,kind,subjectId),kind,subjectId,active:true,replacedBy:null,
    chainId:str(e.chainId),blockNumber:str(e.blockNumber),blockHash:req(e.blockHash,'blockHash'),txHash:req(e.transactionHash,'transactionHash'),
    logIndex:Number(e.logIndex),canonicality:'canonical',finality,freshness,observedAt:Number(observedAt)||0,
    eventName:e.eventName,contractAddress:req(e.contractAddress,'contractAddress'),amountRaw,beneficiary,feeAmountRaw,
    destinationAssetId:field(e,'destinationAssetId','assetId'),routeId:field(e,'routeId'),sourceMessageId:field(e,'sourceMessageId'),
    provenance:Object.freeze({source:'420Indexer/v1',protocol:e.protocol,authoritative:false}),
  });
}
export function dedupeAndValidate(records){
  const byId=new Map();
  for(const r of records){
    const existing=byId.get(r.recordId);
    if(existing&&JSON.stringify(existing)!==JSON.stringify(r))throw new Error('duplicate recordId conflict');
    byId.set(r.recordId,r);
  }
  const semantic=new Map();
  for(const r of byId.values()){
    const key=r.semanticKey,prev=semantic.get(key);
    if(prev&&prev.active!==false&&r.active!==false){
      if(prev.beneficiary&&r.beneficiary&&prev.beneficiary.toLowerCase()!==r.beneficiary.toLowerCase())throw new Error('beneficiary conflict');
      if(prev.feeAmountRaw&&r.feeAmountRaw&&prev.feeAmountRaw!==r.feeAmountRaw)throw new Error('fee conflict');
    } else semantic.set(key,r);
  }
  return [...byId.values()];
}
function qhash(query){return crypto.createHash('sha256').update(JSON.stringify(query)).digest('hex').slice(0,24);}
export function encodeCursor(query,offset){return Buffer.from(JSON.stringify({v:1,q:qhash(query),o:offset})).toString('base64url');}
export function decodeCursor(cursor,query){if(!cursor)return 0;let p;try{p=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));}catch{throw new Error('invalid cursor');}if(p?.v!==1||p.q!==qhash(query)||!Number.isSafeInteger(p.o)||p.o<0)throw new Error('cursor/query mismatch');return p.o;}
export function historyPage(records,{kind,subjectId=null,activeOnly=true,cursor='',limit=50}={}){
  if(!HISTORY_KINDS.includes(kind))throw new Error('unsupported history kind');if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error('invalid history limit');
  const query={kind,subjectId,activeOnly};const offset=decodeCursor(cursor,query);
  const filtered=records.filter(r=>r.kind===kind&&(!subjectId||r.subjectId===subjectId)&&(!activeOnly||r.active!==false))
    .sort((a,b)=>BigInt(b.blockNumber)>BigInt(a.blockNumber)?1:BigInt(b.blockNumber)<BigInt(a.blockNumber)?-1:b.logIndex-a.logIndex||a.recordId.localeCompare(b.recordId));
  const page=filtered.slice(offset,offset+limit),next=offset+page.length<filtered.length?encodeCursor(query,offset+page.length):'';
  return Object.freeze({records:Object.freeze(page),nextCursor:next});
}
export function marketSnapshot({catalogueEntry,status,events,nowSeconds=Math.floor(Date.now()/1000)}){
  const head=Number(status?.indexedHead);if(!Number.isSafeInteger(head)||head<=0)throw new Error('qualified indexed head required');
  const matching=events.filter(e=>e.eventName==='SnapshotApplied'&&String(e.fields?.marketSubjectId??e.objectKey??'')===catalogueEntry.marketSubjectId);
  const latest=matching.sort((a,b)=>BigInt(b.blockNumber)-BigInt(a.blockNumber)||Number(b.logIndex)-Number(a.logIndex))[0]??null;
  const observedAt=Number(status?.indexedHeadTimestamp??nowSeconds);
  const stale=Boolean(status?.runtime?.stale);
  return Object.freeze({
    marketSubjectId:catalogueEntry.marketSubjectId,
    snapshotId:latest?String(latest.fields?.snapshotId??('indexer:'+recordId(latest))):`catalogue:v${catalogueEntry.catalogueVersion}:${catalogueEntry.marketSubjectId}:${head}`,
    canonicalHead:head,canonicality:stale?'stale':'canonical',
    marketLabel:catalogueEntry.marketLabel,baseSymbol:catalogueEntry.baseSymbol,quoteSymbol:catalogueEntry.quoteSymbol,
    lastTradePrice:null,open:null,baseVolume:null,quoteVolume:null,liquidity:null,bestBid:null,bestAsk:null,
    routeHealthy:catalogueEntry.qualification==='DISPLAY_ONLY_QUALIFIED_METADATA'&&catalogueEntry.routeHealthy,
    settlementHealthy:catalogueEntry.qualification==='DISPLAY_ONLY_QUALIFIED_METADATA'&&catalogueEntry.settlementHealthy,
    observedAt,qualification:catalogueEntry.qualification,
    provenance:Object.freeze({source:'420Indexer/v1+repository-catalogue',authoritative:false,indexedHead:String(status.indexedHead),finality:status.finality??null}),
  });
}
