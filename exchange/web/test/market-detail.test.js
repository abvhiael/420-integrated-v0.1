import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateTradesToCandles, bucketSecondsForWindow, candleGeometry, chartDomain, normalizeCandle, normalizeTrade, reconcileHistory } from '../core/market-detail.js';

test('OHLC candles enforce qualified bounds', () => {
  assert.throws(()=>normalizeCandle({recordId:'c1',subjectId:'m1',active:true,open:4,high:3,low:2,close:4,volume:1}));
  const c=normalizeCandle({recordId:'c1',subjectId:'m1',active:true,open:4,high:5,low:3,close:4.5,volume:10});
  assert.equal(c.close,4.5);
});

test('chart domain excludes orphaned candles', () => {
  const candles=[
    normalizeCandle({recordId:'c1',subjectId:'m1',active:true,open:4,high:5,low:3,close:4.5}),
    normalizeCandle({recordId:'c2',subjectId:'m1',active:false,open:100,high:110,low:90,close:105}),
  ];
  assert.deepEqual(chartDomain(candles),{low:3,high:5,span:2});
});

test('geometry is deterministic for identical canonical inputs', () => {
  const candles=[normalizeCandle({recordId:'c1',subjectId:'m1',active:true,open:4,high:5,low:3,close:4.5})];
  assert.deepEqual(candleGeometry(candles,100,100,10), candleGeometry(candles,100,100,10));
});

test('trade normalization preserves record identity', () => {
  const trade=normalizeTrade({recordId:'t1',subjectId:'m1',active:true,timestamp:1,price:'4.2',amount:'10',side:'sell'});
  assert.equal(trade.recordId,'t1');
  assert.equal(trade.side,'sell');
});

test('reorg and replacement remain inspectable', () => {
  const records=[
    {recordId:'old',active:false,replacedBy:'new'},
    {recordId:'new',active:true},
  ];
  const out=reconcileHistory(records);
  assert.equal(out[0].state,'reorg');
  assert.equal(out[0].replacement.recordId,'new');
});

test('trade aggregation deterministically derives OHLCV without inventing source prices', () => {
  const trades=[
    normalizeTrade({recordId:'t1',subjectId:'m1',active:true,timestamp:10,price:4,amount:2,side:'buy'}),
    normalizeTrade({recordId:'t2',subjectId:'m1',active:true,timestamp:20,price:5,amount:3,side:'buy'}),
    normalizeTrade({recordId:'t3',subjectId:'m1',active:true,timestamp:30,price:3,amount:4,side:'sell'}),
  ];
  const candles=aggregateTradesToCandles(trades,60);
  assert.equal(candles.length,1);
  assert.deepEqual({open:candles[0].open,high:candles[0].high,low:candles[0].low,close:candles[0].close,volume:candles[0].volume},
    {open:4,high:5,low:3,close:3,volume:9});
});

test('qualified detail windows map to deterministic bucket widths', () => {
  assert.equal(bucketSecondsForWindow('1h'),300);
  assert.equal(bucketSecondsForWindow('7d'),21600);
  assert.throws(()=>bucketSecondsForWindow('30d'));
});
