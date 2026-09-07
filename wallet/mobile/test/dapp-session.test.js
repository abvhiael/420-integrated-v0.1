import test from 'node:test';
import assert from 'node:assert/strict';
import {
  persistMobileDappSession420,
  readMobileDappSession420,
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

test('persists and reads per-origin approval session', async () => {
  const rt = runtime();
  const saved = await persistMobileDappSession420(rt, 'https://example.com/path', [ACCOUNT], 1000);
  assert.equal(saved.origin, 'https://example.com');
  assert.deepEqual(saved.accounts, [ACCOUNT]);
  const loaded = await readMobileDappSession420(rt, 'https://example.com');
  assert.equal(loaded.createdAt, 1000);
  assert.equal(await assertMobileDappSessionAccount420(rt, 'https://example.com', ACCOUNT), ACCOUNT);
});

test('disconnect removes authorization and fails closed', async () => {
  const rt = runtime();
  await persistMobileDappSession420(rt, 'https://example.com', [ACCOUNT], 1000);
  const disconnected = await disconnectMobileDappSession420(rt, 'https://example.com');
  assert.equal(disconnected.disconnected, true);
  assert.equal(await readMobileDappSession420(rt, 'https://example.com'), null);
  await assert.rejects(() => assertMobileDappSessionAccount420(rt, 'https://example.com', ACCOUNT), /not connected/);
});
