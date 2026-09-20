import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize420Name, validateNamesRecord, confirm420NameRecipient } from '../core/names-send.js';

const HASH = `0x${'a'.repeat(64)}`;
const OWNER = '0x00000000000000000000000000000000000000aa';
const RECIPIENT = '0x00000000000000000000000000000000000000bb';
const record = (changes = {}) => ({ owner: OWNER, resolvedAddress: RECIPIENT, expiresAt: 5000, labelLength: 5, ...changes });

function harness(records, confirmation = true) {
  let calls = 0;
  return {
    name: 'alice.420',
    lookup: async () => ({ labelHash: HASH, record: records[Math.min(calls++, records.length - 1)] }),
    chainTime: async () => 1000,
    confirm: async ({ recipient, name }) => {
      assert.equal(recipient, RECIPIENT);
      assert.equal(name, 'alice.420');
      return confirmation;
    },
  };
}

test('420 Names accept only unambiguous lowercase ASCII labels', () => {
  assert.equal(normalize420Name(' alice.420 '), 'alice.420');
  for (const text of ['Alice.420', 'alice.eth', 'ali ce.420', 'a--.420', '-alice.420', 'alice-.420', 'álîce.420', 'a'.repeat(64) + '.420']) {
    assert.throws(() => normalize420Name(text), /invalid 420 Name/);
  }
});

test('record validation fails closed for expired, missing and malformed names', () => {
  assert.equal(validateNamesRecord(record(), { expectedLabelHash: HASH, nowSeconds: 1000 }).recipient, RECIPIENT);
  assert.throws(() => validateNamesRecord(record({ expiresAt: 1000 }), { expectedLabelHash: HASH, nowSeconds: 1000 }), /expired/);
  assert.throws(() => validateNamesRecord(record({ resolvedAddress: '0x' + '0'.repeat(40) }), { expectedLabelHash: HASH, nowSeconds: 1000 }), /no recipient/);
  assert.throws(() => validateNamesRecord(record(), { expectedLabelHash: HASH }), /chain time unavailable/);
  assert.throws(() => validateNamesRecord(record(), { nowSeconds: 1000 }), /hash not verified/);
  assert.throws(() => validateNamesRecord(record({ labelLength: 64 }), { expectedLabelHash: HASH, nowSeconds: 1000 }), /invalid 420 Name record/);
});

test('confirmed stable forward resolution returns the reviewed recipient', async () => {
  assert.deepEqual(await confirm420NameRecipient(harness([record(), record()])), {
    name: 'alice.420', recipient: RECIPIENT, labelHash: HASH,
  });
});

test('send preparation rejects unconfirmed recipient and changed or expired resolution', async () => {
  await assert.rejects(confirm420NameRecipient(harness([record()], false)), /not confirmed/);
  await assert.rejects(confirm420NameRecipient(harness([record(), record({ resolvedAddress: OWNER })])), /changed during confirmation/);
  await assert.rejects(confirm420NameRecipient(harness([record(), record({ owner: RECIPIENT })])), /changed during confirmation/);
  await assert.rejects(confirm420NameRecipient(harness([record(), record({ expiresAt: 1000 })])), /expired/);
  await assert.rejects(confirm420NameRecipient(harness([record({ labelLength: 4 })])), /label length mismatch/);
  await assert.rejects(confirm420NameRecipient({ name: 'alice.420' }), /canonical 420 Names resolution/);
});
