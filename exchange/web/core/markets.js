export const MARKET_SORTS = Object.freeze(['symbol','lastPrice','change','volume','liquidity']);

function number(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeMarket(snapshot) {
  if (!snapshot?.marketSubjectId || !snapshot?.snapshotId) throw new Error('market snapshot identity required');
  const label = snapshot.marketLabel ?? snapshot.symbol ?? snapshot.marketSubjectId;
  const lastPrice = number(snapshot.lastTradePrice ?? snapshot.lastPrice);
  const open = number(snapshot.open);
  const changePct = lastPrice !== null && open !== null && open !== 0
    ? ((lastPrice - open) / open) * 100
    : null;

  return {
    marketSubjectId: snapshot.marketSubjectId,
    snapshotId: snapshot.snapshotId,
    label,
    baseSymbol: snapshot.baseSymbol ?? '',
    quoteSymbol: snapshot.quoteSymbol ?? '',
    canonicality: snapshot.canonicality ?? 'degraded',
    lastPrice,
    changePct,
    baseVolume: number(snapshot.baseVolume),
    quoteVolume: number(snapshot.quoteVolume),
    liquidity: number(snapshot.liquidity),
    bestBid: number(snapshot.bestBid),
    bestAsk: number(snapshot.bestAsk),
    routeHealthy: snapshot.routeHealthy === true,
    settlementHealthy: snapshot.settlementHealthy === true,
    observedAt: number(snapshot.observedAt),
  };
}

export function filterMarkets(markets, query) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return [...markets];
  return markets.filter((market) => [
    market.label,
    market.baseSymbol,
    market.quoteSymbol,
    market.marketSubjectId,
  ].some((value) => String(value ?? '').toLowerCase().includes(needle)));
}

export function sortMarkets(markets, field = 'symbol', direction = 'asc') {
  if (!MARKET_SORTS.includes(field)) throw new Error('unsupported market sort');
  const sign = direction === 'desc' ? -1 : 1;
  return [...markets].sort((a,b) => {
    if (field === 'symbol') return sign * a.label.localeCompare(b.label);
    const fieldMap = {
      lastPrice: 'lastPrice',
      change: 'changePct',
      volume: 'quoteVolume',
      liquidity: 'liquidity',
    };
    const key = fieldMap[field];
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return a.label.localeCompare(b.label);
    if (av === null) return 1;
    if (bv === null) return -1;
    return av === bv ? a.label.localeCompare(b.label) : sign * (av - bv);
  });
}

export function freshnessState(market, nowSeconds) {
  if (!market.observedAt || nowSeconds < market.observedAt) return 'degraded';
  return nowSeconds - market.observedAt > 30 ? 'stale' : market.canonicality;
}

export class Watchlist {
  constructor(storage, key = '420exchange.watchlist.v14') {
    this.storage = storage;
    this.key = key;
  }
  values() {
    try {
      const raw = this.storage?.getItem?.(this.key);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed.filter((v)=>typeof v === 'string') : []);
    } catch {
      return new Set();
    }
  }
  toggle(subjectId) {
    const set = this.values();
    if (set.has(subjectId)) set.delete(subjectId); else set.add(subjectId);
    this.storage?.setItem?.(this.key, JSON.stringify([...set].sort()));
    return set.has(subjectId);
  }
}
