import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMobileDappQr420 } from '../core/dapp-qr.js';
import { createMobileDappCompletion420, rehydrateMobileDappRequest420 } from '../core/dapp-handoff-runtime.js';

const now = 1_800_000_000_000;
const origin = 'https://dapp.example';
const callback = 'https://dapp.example/wallet/callback';
const requestId = 'request-5678';
const qr = `https://wallet.example/connect?origin=${encodeURIComponent(origin)}&requestId=${requestId}&expiresAt=${now + 60_000}&callback=${encodeURIComponent(callback)}`;

test('QR ingestion reuses strict verified-link handoff parsing', () => {
  const handoff = parseMobileDappQr420(`  ${qr}  `, { productionHost: 'wallet.example', nowMs: now });
  assert.equal(handoff.transport, 'verified-link');
  assert.equal(handoff.origin, origin);
  assert.equal(handoff.requestId, requestId);
  assert.throws(() => parseMobileDappQr420('x'.repeat(4097), { productionHost: 'wallet.example', nowMs: now }), /payload length/);
});

test('canonical request rehydration binds origin and request id', async () => {
  const handoff = parseMobileDappQr420(qr, { productionHost: 'wallet.example', nowMs: now });
  const resolved = await rehydrateMobileDappRequest420(handoff, {
    nowMs: now,
    fetchRequest: async ({ origin: requestedOrigin, requestId: requestedId }) => {
      assert.equal(requestedOrigin, origin);
      assert.equal(requestedId, requestId);
      return { id: requestId, origin, method: 'eth_chainId', params: [] };
    },
  });
  assert.equal(resolved.request.id, requestId);
  assert.equal(resolved.request.origin, origin);
  assert.equal(resolved.request.authorityClass, 'read-only');
});

test('rehydration rejects substituted origin, request id and expired handoff', async () => {
  const handoff = parseMobileDappQr420(qr, { productionHost: 'wallet.example', nowMs: now });
  await assert.rejects(() => rehydrateMobileDappRequest420(handoff, {
    nowMs: now,
    fetchRequest: async () => ({ id: requestId, origin: 'https://evil.example', method: 'eth_chainId', params: [] }),
  }), /origin mismatch/);
  await assert.rejects(() => rehydrateMobileDappRequest420(handoff, {
    nowMs: now,
    fetchRequest: async () => ({ id: 'request-9999', origin, method: 'eth_chainId', params: [] }),
  }), /request id mismatch/);
  await assert.rejects(() => rehydrateMobileDappRequest420(handoff, {
    nowMs: handoff.expiresAt,
    fetchRequest: async () => ({ id: requestId, origin, method: 'eth_chainId', params: [] }),
  }), /expired/);
});

test('callback completion is single-shot and expiry-bound', () => {
  const handoff = parseMobileDappQr420(qr, { productionHost: 'wallet.example', nowMs: now });
  let clock = now;
  const completion = createMobileDappCompletion420({ nowMs: () => clock });
  const callbackUrl = completion.complete(handoff, { result: '0x420' });
  const parsed = new URL(callbackUrl);
  assert.equal(parsed.origin, origin);
  assert.equal(parsed.searchParams.get('requestId'), requestId);
  assert.throws(() => completion.complete(handoff, { result: '0x420' }), /already completed/);

  const second = parseMobileDappQr420(qr.replace(requestId, 'request-6789'), { productionHost: 'wallet.example', nowMs: now });
  clock = second.expiresAt;
  assert.throws(() => completion.complete(second, { result: '0x420' }), /expired/);
});
