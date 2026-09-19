import test from 'node:test';
import assert from 'node:assert/strict';
import { Watchlist, filterMarkets, freshnessState, normalizeMarket, sortMarkets } from '../core/markets.js';

const snapshots=[
  {marketSubjectId:'m1',snapshotId:'s1',marketLabel:'420 / USD',baseSymbol:'420',quoteSymbol:'USD',canonicality:'canonical',lastTradePrice:'4.20',open:'4.00',quoteVolume:'4200',liquidity:'9000',bestBid:'4.19',bestAsk:'4.21',routeHealthy:true,settlementHealthy:true,observedAt:100},
  {marketSubjectId:'m2',snapshotId:'s2',marketLabel:'420 / ETH',baseSymbol:'420',quoteSymbol:'ETH',canonicality:'canonical',lastTradePrice:'0.001',open:'0.0011',quoteVolume:'10',liquidity:'200',bestBid:'0.0009',bestAsk:'0.0011',routeHealthy:false,settlementHealthy:true,observedAt:90},
];

test('market rows derive rolling change only from snapshot values', () => {
  const market=normalizeMarket(snapshots[0]);
  assert.equal(market.lastPrice,4.2);
  assert.ok(Math.abs(market.changePct-5)<1e-9);
});

test('search covers pair symbols and canonical subject ID', () => {
  const markets=snapshots.map(normalizeMarket);
  assert.equal(filterMarkets(markets,'eth').length,1);
  assert.equal(filterMarkets(markets,'m1').length,1);
});

test('sorting handles price and liquidity deterministically', () => {
  const markets=snapshots.map(normalizeMarket);
  assert.equal(sortMarkets(markets,'lastPrice','desc')[0].marketSubjectId,'m1');
  assert.equal(sortMarkets(markets,'liquidity','asc')[0].marketSubjectId,'m2');
});

test('freshness marks records stale after 30 seconds', () => {
  const market=normalizeMarket(snapshots[0]);
  assert.equal(freshnessState(market,130),'canonical');
  assert.equal(freshnessState(market,131),'stale');
});

test('watchlist is local-only and deterministic', () => {
  const memory=new Map();
  const storage={getItem:(k)=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  const watchlist=new Watchlist(storage);
  assert.equal(watchlist.toggle('m2'),true);
  assert.equal(watchlist.toggle('m1'),true);
  assert.deepEqual([...watchlist.values()],['m1','m2']);
  assert.equal(watchlist.toggle('m1'),false);
});
