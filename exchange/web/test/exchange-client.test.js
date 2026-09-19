import test from 'node:test';
import assert from 'node:assert/strict';
import { ExchangeApiError, ExchangeClient, validateHistoryPage, validateSnapshot, validateStreamEvent } from '../core/exchange-client.js';

function response(body, { ok = true, status = 200, major = '13', minor = '6' } = {}) {
  return {
    ok,
    status,
    headers: { get: (key) => key === 'x-420-api-major' ? major : key === 'x-420-api-minor' ? minor : null },
    async json() { return body; },
  };
}

test('snapshot preserves canonical subject and snapshot IDs', async () => {
  const snapshot = { marketSubjectId:'market-1', snapshotId:'snap-1', canonicalHead:100, canonicality:'canonical' };
  const client = new ExchangeClient({ baseUrl:'https://api.example.test', fetchImpl: async () => response({ snapshot }) });
  assert.deepEqual(await client.snapshot('market-1'), snapshot);
});

test('future API minor fails closed', async () => {
  const client = new ExchangeClient({ baseUrl:'https://api.example.test', fetchImpl: async () => response({}, { minor:'7' }) });
  await assert.rejects(() => client.snapshot('market-1'), (error) => error instanceof ExchangeApiError && error.code === 'UNSUPPORTED_VERSION');
});

test('history page is bounded to V13.4 maximum', () => {
  const records = Array.from({length:101}, (_,i) => ({recordId:`r${i}`,subjectId:'s',active:true}));
  assert.throws(() => validateHistoryPage({ records, nextCursor:'' }), /exceeds V13.4 bound/);
});

test('replacement event requires distinct old and new record IDs', () => {
  assert.throws(() => validateStreamEvent({sequence:1,kind:'REPLACEMENT',canonicalHead:1,affectedRecordId:'a',replacementRecordId:'a'}));
});

test('snapshot without canonical identity fails closed', () => {
  assert.throws(() => validateSnapshot({ snapshotId:'x', canonicalHead:1, canonicality:'canonical' }));
});
