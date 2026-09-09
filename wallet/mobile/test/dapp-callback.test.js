import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileDappCallback420, parseMobileDappCallback420 } from '../core/dapp-callback.js';

test('builds and parses a successful HTTPS dApp callback', () => {
  const url = buildMobileDappCallback420({
    callbackUrl: 'https://example.com/callback',
    origin: 'https://example.com',
    requestId: 'req-1',
    result: ['0x1111111111111111111111111111111111111111'],
  });
  const parsed = parseMobileDappCallback420(url, { origin: 'https://example.com', requestId: 'req-1' });
  assert.deepEqual(parsed.result, ['0x1111111111111111111111111111111111111111']);
});

test('builds and parses an error callback', () => {
  const url = buildMobileDappCallback420({
    callbackUrl: 'https://example.com/callback',
    origin: 'https://example.com',
    requestId: 'req-2',
    error: { code: 4001, message: 'User rejected the request' },
  });
  const parsed = parseMobileDappCallback420(url, { origin: 'https://example.com', requestId: 'req-2' });
  assert.equal(parsed.error.code, 4001);
});

test('rejects insecure callback URLs and mismatched request ids', () => {
  assert.throws(() => buildMobileDappCallback420({ callbackUrl: 'http://example.com/cb', origin: 'https://example.com', requestId: 'req-1', result: true }), /must use https/);
  const url = buildMobileDappCallback420({ callbackUrl: 'https://example.com/cb', origin: 'https://example.com', requestId: 'req-1', result: true });
  assert.throws(() => parseMobileDappCallback420(url, { requestId: 'req-2' }), /request id mismatch/);
});
