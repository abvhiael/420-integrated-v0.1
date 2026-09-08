import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileHandoffReplayGuard420, parseMobileDappHandoff420 } from '../core/dapp-handoff.js';

const now = 1_800_000_000_000;
const callback = encodeURIComponent('https://dapp.example/wallet/callback');
const origin = encodeURIComponent('https://dapp.example');

function prod(overrides = '') {
  return `https://wallet.example/connect?origin=${origin}&requestId=request-1234&expiresAt=${now + 60_000}&callback=${callback}${overrides}`;
}

test('verified production handoff binds wallet host, dApp origin, request id, expiry and callback', () => {
  const handoff = parseMobileDappHandoff420(prod(), { productionHost: 'wallet.example', nowMs: now });
  assert.equal(handoff.origin, 'https://dapp.example');
  assert.equal(handoff.requestId, 'request-1234');
  assert.equal(handoff.transport, 'verified-link');
  assert.equal(handoff.callbackUrl, 'https://dapp.example/wallet/callback');
  assert.throws(() => parseMobileDappHandoff420(prod().replace('wallet.example', 'evil.example'), { productionHost: 'wallet.example', nowMs: now }), /host or path mismatch/);
  assert.throws(() => parseMobileDappHandoff420(prod().replace('/connect?', '/other?'), { productionHost: 'wallet.example', nowMs: now }), /host or path mismatch/);
});

test('development scheme is explicit and disabled by default', () => {
  const url = `420wallet://connect?origin=${origin}&requestId=request-1234&expiresAt=${now + 60_000}&callback=${callback}`;
  assert.throws(() => parseMobileDappHandoff420(url, { productionHost: 'wallet.example', nowMs: now }), /development wallet scheme is disabled/);
  assert.equal(parseMobileDappHandoff420(url, { productionHost: 'wallet.example', nowMs: now, allowDevelopmentScheme: true }).transport, 'development-scheme');
});

test('handoff rejects expired, overlong, cross-origin callback and fragment payloads', () => {
  assert.throws(() => parseMobileDappHandoff420(prod().replace(String(now + 60_000), String(now - 1)), { productionHost: 'wallet.example', nowMs: now }), /expired/);
  assert.throws(() => parseMobileDappHandoff420(prod().replace(String(now + 60_000), String(now + 11 * 60_000)), { productionHost: 'wallet.example', nowMs: now }), /maximum window/);
  assert.throws(() => parseMobileDappHandoff420(prod().replace(callback, encodeURIComponent('https://evil.example/cb')), { productionHost: 'wallet.example', nowMs: now }), /callback origin mismatch/);
  assert.throws(() => parseMobileDappHandoff420(`${prod()}#secret`, { productionHost: 'wallet.example', nowMs: now }), /forbidden components/);
});

test('handoff replay guard rejects the same origin/request pair until expiry', () => {
  const handoff = parseMobileDappHandoff420(prod(), { productionHost: 'wallet.example', nowMs: now });
  let clock = now;
  const guard = createMobileHandoffReplayGuard420({ nowMs: () => clock });
  assert.equal(guard.consume(handoff), handoff);
  assert.throws(() => guard.consume(handoff), /replay rejected/);
  clock = handoff.expiresAt + 1;
  assert.throws(() => guard.consume(handoff), /expired/);
});
