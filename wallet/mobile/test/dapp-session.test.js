import test from 'node:test';
import assert from 'node:assert/strict';
import {
  persistMobileDappSession420,
  readMobileDappSession420,
  touchMobileDappSession420,
  disconnectMobileDappSession420,
  assertMobileDappSessionAccount420,
} from '../core/dapp-session.js';

function runtime() {
  const store = new Map();
  return {
    secureStorage: {
      get: async (key) => store.get(key) ?? null,
      set: async (key, value) => { store.set(key, value); },
      delete: async (key) => { store.delete(key); },
    },
  };
}

const ACCOUNT = '0x1111111111111111111111111111111111111111';

test('persists canonical per-origin approval session metadata', async () => {
  const rt = runtime();
  const saved = await persistMobileDappSession420(rt, 'https://example.com/path', [ACCOUNT], 1000, {
    chainId: '0x420', sessionScopes: ['swap:execute'], expiresAt: 5000,
  });
  assert.equal(saved.origin, 'https://example.com');
  assert.deepEqual(saved.accounts, [ACCOUNT]);
  assert.equal(saved.grantedAt, 1000);
  assert.equal(saved.chainId, '0x420');
  assert.deepEqual(saved.sessionScopes, ['swap:execute']);
  const loaded = await readMobileDappSession420(rt, 'https://example.com', { chainId: '0x420', nowMs: 1500 });
  assert.equal(loaded.grantedAt, 1000);
  assert.equal(await assertMobileDappSessionAccount420(rt, 'https://example.com', ACCOUNT, { chainId: '0x420', nowMs: 1500 }), ACCOUNT);
});

test('network drift and expiry fail closed', async () => {
  const rt = runtime();
  await persistMobileDappSession420(rt, 'https://example.com', [ACCOUNT], 1000, { chainId: '0x420', expiresAt: 2000 });
  await assert.rejects(() => readMobileDappSession420(rt, 'https://example.com', { chainId: '0x421', nowMs: 1500 }), /network mismatch/);
  await assert.rejects(() => readMobileDappSession420(rt, 'https://example.com', { chainId: '0x420', nowMs: 2000 }), /expired/);
});

test('touch updates last-used metadata without changing grant time', async () => {
  const rt = runtime();
  await persistMobileDappSession420(rt, 'https://example.com', [ACCOUNT], 1000);
  const touched = await touchMobileDappSession420(rt, 'https://example.com', 1500);
  assert.equal(touched.grantedAt, 1000);
  assert.equal(touched.lastUsedAt, 1500);
});

test('disconnect removes authorization and fails closed', async () => {
  const rt = runtime();
  await persistMobileDappSession420(rt, 'https://example.com', [ACCOUNT], 1000);
  const disconnected = await disconnectMobileDappSession420(rt, 'https://example.com');
  assert.equal(disconnected.disconnected, true);
  assert.equal(await readMobileDappSession420(rt, 'https://example.com'), null);
  await assert.rejects(() => assertMobileDappSessionAccount420(rt, 'https://example.com', ACCOUNT), /not connected/);
});
