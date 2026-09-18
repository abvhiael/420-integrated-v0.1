export const ACTIVITY_KINDS=Object.freeze(['TRADE','FILL','ORDER','CANCELLATION','BRIDGE_DEPOSIT','BRIDGE_WITHDRAWAL','FEE_ROUTING']);

function finite(value,label){
  const n=typeof value==='number'?value:Number(value);
  if(!Number.isFinite(n)) throw new Error(`invalid ${label}`);
  return n;
}
function text(value,label){
  if(typeof value!=='string'||!value) throw new Error(`missing ${label}`);
  return value;
}

export function normalizeBalance(record){
  return {
    assetId:text(record.assetId,'assetId'),
    symbol:text(record.symbol,'symbol'),
    balance:finite(record.balance,'balance'),
    available:finite(record.available??record.balance,'available'),
    locked:finite(record.locked??0,'locked'),
    source:text(record.source,'source'),
    canonical:record.canonical===true,
  };
}

export function normalizeActivity(record){
  const kind=text(record.kind,'kind');
  if(!ACTIVITY_KINDS.includes(kind)) throw new Error('unsupported activity kind');
  const id=text(record.recordId,'recordId');
  const timestamp=finite(record.timestamp,'timestamp');
  return {
    recordId:id,
    kind,
    timestamp,
    subjectId:record.subjectId??null,
    txHash:record.txHash??null,
    amount:record.amount===undefined?null:finite(record.amount,'amount'),
    assetSymbol:record.assetSymbol??null,
    active:record.active!==false,
    replacedBy:record.replacedBy??null,
    feeAmount:record.feeAmount===undefined?null:finite(record.feeAmount,'feeAmount'),
  };
}

export function mergeActivity(records){
  const byId=new Map();
  for(const raw of records){
    const record=normalizeActivity(raw);
    const existing=byId.get(record.recordId);
    if(!existing || record.timestamp>=existing.timestamp) byId.set(record.recordId,record);
  }
  return [...byId.values()].sort((a,b)=>b.timestamp-a.timestamp || a.recordId.localeCompare(b.recordId));
}

export function activityState(record){
  const r=normalizeActivity(record);
  if(!r.active) return 'reorg';
  if(r.replacedBy) return 'replacement';
  return 'canonical';
}

export function explorerHref(baseUrl,txHash){
  if(!baseUrl||!txHash) return null;
  return `${String(baseUrl).replace(/\/$/,'')}/tx/${encodeURIComponent(txHash)}`;
}

export function portfolioSummary(balances){
  const rows=balances.map(normalizeBalance);
  return {
    assetCount:rows.length,
    canonicalAssetCount:rows.filter((r)=>r.canonical).length,
    totalLocked:rows.reduce((sum,r)=>sum+r.locked,0),
  };
}
