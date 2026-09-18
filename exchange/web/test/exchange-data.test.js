import test from 'node:test';
import assert from 'node:assert/strict';
import { ExchangeDataLayer } from '../core/exchange-data.js';

function response(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: (key) => key === 'x-420-api-major' ? '13' : key === 'x-420-api-minor' ? '6' : null },
    async json() { return body; },
  };
}

test('data layer caches snapshot by canonical subject', async () => {
  let calls=0;
  const layer=new ExchangeDataLayer({
    baseUrl:'https://api.example.test',
    fetchImpl:async()=>{calls++;return response({snapshot:{marketSubjectId:'m1',snapshotId:'s1',canonicalHead:5,canonicality:'canonical'}});},
  });
  await layer.loadSnapshot('m1');
  await layer.loadSnapshot('m1');
  assert.equal(calls,1);
  assert.equal(layer.store.snapshots.get('m1').snapshotId,'s1');
});

test('data layer caches history by full cursor/filter identity', async () => {
  let calls=0;
  const layer=new ExchangeDataLayer({
    baseUrl:'https://api.example.test',
    fetchImpl:async()=>{calls++;return response({records:[],nextCursor:'',hasMore:false});},
  });
  await layer.loadHistory({kind:'TRADE',subjectId:'m1',cursor:'',limit:50});
  await layer.loadHistory({kind:'TRADE',subjectId:'m1',cursor:'',limit:50});
  await layer.loadHistory({kind:'TRADE',subjectId:'m1',cursor:'next',limit:50});
  assert.equal(calls,2);
});

test('stream reconnect resumes from last delivered sequence', () => {
  const urls=[];
  const layer=new ExchangeDataLayer({
    baseUrl:'https://api.example.test',
    streamUrl:'wss://stream.example.test/events',
    transport:'websocket',
    fetchImpl:async()=>response({}),
    webSocketFactory:(url)=>{urls.push(url);return {close(){}};},
  });
  layer.store.lastSequence=9;
  const disconnect=layer.connectStream();
  assert.equal(new URL(urls[0]).searchParams.get('cursor'),'9');
  disconnect();
});

test('stream error degrades freshness explicitly', () => {
  let socket;
  const layer=new ExchangeDataLayer({
    baseUrl:'https://api.example.test',
    streamUrl:'wss://stream.example.test/events',
    transport:'websocket',
    fetchImpl:async()=>response({}),
    webSocketFactory:()=>{socket={close(){}};return socket;},
  });
  layer.connectStream();
  socket.onerror();
  assert.equal(layer.store.freshness,'degraded');
});
