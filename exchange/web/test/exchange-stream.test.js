import test from 'node:test';
import assert from 'node:assert/strict';
import { createStreamAdapter, decodeStreamPayload, encodeResumeCursor } from '../core/exchange-stream.js';

test('resume cursor is deterministic', () => {
  assert.equal(encodeResumeCursor(0),'');
  assert.equal(encodeResumeCursor(42),'42');
});

test('websocket and SSE decode identical stream state', () => {
  const payload=JSON.stringify({sequence:1,kind:'HEARTBEAT',canonicalHead:2,emittedAt:10});
  assert.deepEqual(decodeStreamPayload(payload), decodeStreamPayload(JSON.parse(payload)));
});

test('SSE and websocket adapters preserve the same resume cursor', () => {
  const urls=[];
  const sse=createStreamAdapter({
    transport:'sse',
    onEvent:()=>{},
    eventSourceFactory:(url)=>{urls.push(url);return {close(){}};},
  });
  const ws=createStreamAdapter({
    transport:'websocket',
    onEvent:()=>{},
    webSocketFactory:(url)=>{urls.push(url);return {close(){}};},
  });
  sse.connect('https://stream.example.test/events','7');
  ws.connect('wss://stream.example.test/events','7');
  assert.equal(new URL(urls[0]).searchParams.get('cursor'),'7');
  assert.equal(new URL(urls[1]).searchParams.get('cursor'),'7');
});
