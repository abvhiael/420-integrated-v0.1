export const DETAIL_WINDOWS = Object.freeze(['1h','4h','1d','7d']);

function num(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCandle(record) {
  if (!record?.recordId || !record?.subjectId) throw new Error('candle identity required');
  const open=num(record.open), high=num(record.high), low=num(record.low), close=num(record.close), volume=num(record.volume);
  if ([open,high,low,close].some((v)=>v===null)) throw new Error('candle OHLC required');
  if (high < Math.max(open, close) || low > Math.min(open, close) || low > high) throw new Error('invalid OHLC bounds');
  return {
    recordId: record.recordId,
    subjectId: record.subjectId,
    active: record.active === true,
    replacedBy: record.replacedBy ?? null,
    timestamp: num(record.timestamp),
    open, high, low, close, volume: volume ?? 0,
  };
}

export function normalizeTrade(record) {
  if (!record?.recordId || !record?.subjectId) throw new Error('trade identity required');
  return {
    recordId: record.recordId,
    subjectId: record.subjectId,
    active: record.active === true,
    replacedBy: record.replacedBy ?? null,
    timestamp: num(record.timestamp),
    price: num(record.price),
    amount: num(record.amount),
    side: record.side === 'sell' ? 'sell' : 'buy',
  };
}

export function chartDomain(candles) {
  const active=candles.filter((c)=>c.active);
  if (!active.length) return null;
  const low=Math.min(...active.map((c)=>c.low));
  const high=Math.max(...active.map((c)=>c.high));
  return { low, high, span: high-low || 1 };
}

export function candleGeometry(candles, width=720, height=280, padding=24) {
  const active=candles.filter((c)=>c.active);
  const domain=chartDomain(active);
  if (!domain) return [];
  const innerW=Math.max(1,width-padding*2);
  const innerH=Math.max(1,height-padding*2);
  const step=innerW/Math.max(active.length,1);
  const y=(value)=>padding + ((domain.high-value)/domain.span)*innerH;
  return active.map((candle,index)=>({
    recordId:candle.recordId,
    x:padding+step*index+step/2,
    bodyWidth:Math.max(2,step*.5),
    openY:y(candle.open),
    closeY:y(candle.close),
    highY:y(candle.high),
    lowY:y(candle.low),
    direction:candle.close>=candle.open?'up':'down',
  }));
}

export function reconcileHistory(records) {
  const byId=new Map(records.map((record)=>[record.recordId, record]));
  return records.map((record)=>({
    ...record,
    state: record.active ? (record.replacedBy ? 'replacement' : 'canonical') : 'reorg',
    replacement: record.replacedBy ? byId.get(record.replacedBy) ?? null : null,
  }));
}

export function aggregateTradesToCandles(trades, bucketSeconds) {
  if (!Number.isInteger(bucketSeconds) || bucketSeconds <= 0) throw new Error('invalid candle bucket');
  const active=trades.filter((trade)=>trade.active && trade.timestamp !== null && trade.price !== null);
  const buckets=new Map();
  for (const trade of active) {
    const start=Math.floor(trade.timestamp/bucketSeconds)*bucketSeconds;
    const bucket=buckets.get(start) ?? [];
    bucket.push(trade);
    buckets.set(start,bucket);
  }
  return [...buckets.entries()].sort((a,b)=>a[0]-b[0]).map(([start,bucket])=>{
    const prices=bucket.map((trade)=>trade.price);
    return normalizeCandle({
      recordId:`derived:${bucketSeconds}:${start}:${bucket.map((trade)=>trade.recordId).join(',')}`,
      subjectId:bucket[0].subjectId,
      active:true,
      timestamp:start,
      open:bucket[0].price,
      high:Math.max(...prices),
      low:Math.min(...prices),
      close:bucket[bucket.length-1].price,
      volume:bucket.reduce((sum,trade)=>sum+(trade.amount ?? 0),0),
    });
  });
}

export function bucketSecondsForWindow(windowName) {
  const mapping={ '1h':300, '4h':900, '1d':3600, '7d':21600 };
  if (!(windowName in mapping)) throw new Error('unsupported detail window');
  return mapping[windowName];
}
