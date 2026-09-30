import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNames420Error,
  createNames420ManagementClient,
  randomNames420Salt,
} from '../core/names-management.js';
import { hash420Label } from '../core/names-client.js';
import { keccak256Hex } from '../core/keccak.js';

const CONTRACT = '0x0000000000000000000000000000000000000435';
const ALICE = '0x00000000000000000000000000000000000000aa';
const BOB = '0x00000000000000000000000000000000000000bb';
const TX = `0x${'12'.repeat(32)}`;
const COMMITMENT = `0x${'42'.repeat(32)}`;
const SALT = `0x${'99'.repeat(32)}`;
const ZERO32 = `0x${'0'.repeat(64)}`;
const word = (value) => BigInt(value).toString(16).padStart(64, '0');
const addressWord = (value) => value.slice(2).padStart(64, '0');
const id = (signature) => keccak256Hex(new TextEncoder().encode(signature)).slice(0, 10);
const identity = `0x${word(32)}${word(8)}${'4e616d6573343230'.padEnd(64, '0')}`;
const record = ({ owner = ALICE, pendingOwner = '0x0000000000000000000000000000000000000000', resolvedAddress = ALICE, expiresAt = 9999999n, labelLength = 5 } = {}) =>
  `0x${addressWord(owner)}${addressWord(pendingOwner)}${addressWord(resolvedAddress)}${word(0)}${word(0)}${word(expiresAt)}${word(labelLength)}`;

function setup(overrides = {}) {
  let chain = overrides.chain || '0x420';
  let accounts = overrides.accounts || [ALICE];
  let timestamp = overrides.timestamp ?? 1000n;
  let committedAt = overrides.committedAt ?? 0n;
  let currentRecord = overrides.record || record();
  let available = overrides.available ?? true;
  let receipt = overrides.receipt || { status: '0x1', transactionHash: TX };
  let simulateError = overrides.simulateError || null;
  const calls = [];
  const sent = [];

  const provider = { async request(method, params = []) {
    calls.push({ method, params });
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_accounts') return accounts;
    if (method === 'eth_getCode') return '0x60006000';
    if (method === 'eth_getBlockByNumber') return { timestamp: `0x${timestamp.toString(16)}` };
    if (method === 'eth_estimateGas') return '0x5208';
    if (method === 'eth_getTransactionReceipt') return receipt;
    if (method === 'eth_sendTransaction') {
      const tx = params[0];
      sent.push(tx);
      if (tx.data.startsWith(id('commit(bytes32)'))) committedAt = timestamp;
      return TX;
    }
    if (method === 'eth_call') {
      const data = params[0].data;
      if (simulateError && [
        id('commit(bytes32)'), id('register(bytes32,uint8,address,uint64,bytes32)'),
        id('renew(bytes32,uint64)'), id('setResolution(bytes32,address,bytes32,bytes32)'),
        id('setReverseName(bytes32)'), id('transferName(bytes32,address)'), id('acceptName(bytes32)'),
      ].some((selector) => data.startsWith(selector))) throw new Error(simulateError);
      if (data.startsWith(id('protocolVersion()'))) return `0x${word(3)}`;
      if (data.startsWith(id('systemName()'))) return identity;
      if (data.startsWith(id('MIN_COMMITMENT_AGE()'))) return `0x${word(60)}`;
      if (data.startsWith(id('MAX_COMMITMENT_AGE()'))) return `0x${word(86400)}`;
      if (data.startsWith(id('MIN_REGISTRATION_PERIOD()'))) return `0x${word(2592000)}`;
      if (data.startsWith(id('MAX_REGISTRATION_PERIOD()'))) return `0x${word(31536000)}`;
      if (data.startsWith(id('makeCommitment(bytes32,uint8,address,uint64,bytes32,address)'))) return COMMITMENT;
      if (data.startsWith(id('commitments(bytes32)'))) return `0x${word(committedAt)}`;
      if (data.startsWith(id('isAvailable(bytes32)'))) return `0x${word(available ? 1 : 0)}`;
      if (data.startsWith(id('resolve(bytes32)'))) return currentRecord;
      return '0x';
    }
    throw new Error(`unexpected RPC method ${method}`);
  } };

  return {
    provider,
    calls,
    sent,
    client: createNames420ManagementClient({ provider, namesAddress: CONTRACT, chainId: '0x420', account: ALICE }),
    setTime(value) { timestamp = BigInt(value); },
    setAccounts(value) { accounts = value; },
    setChain(value) { chain = value; },
    setAvailable(value) { available = value; },
    setRecord(value) { currentRecord = value; },
    setReceipt(value) { receipt = value; },
  };
}

test('commit workflow validates canonical label, duration, availability and broadcasts only after simulation', async () => {
  const rpc = setup();
  const prepared = await rpc.client.makeCommitment({ name: 'alice.420', durationSeconds: 2592000, salt: SALT });
  assert.equal(prepared.labelHash, hash420Label('alice.420'));
  assert.equal(prepared.commitment, COMMITMENT);
  assert.equal(prepared.labelLength, 5);
  assert.equal(prepared.owner, ALICE);

  const submitted = await rpc.client.sendCommit({ name: 'alice.420', durationSeconds: 2592000, salt: SALT });
  assert.equal(submitted.stage, 'commit-submitted');
  assert.equal(submitted.txHash, TX);
  assert.equal(rpc.sent.length, 1);
  assert.ok(rpc.calls.some(({ method }) => method === 'eth_estimateGas'));
  assert.ok(rpc.sent[0].data.startsWith(id('commit(bytes32)')));

  const confirmed = await rpc.client.confirm(TX, { attempts: 1 });
  assert.equal(confirmed.receipt.status, '0x1');
});

test('reveal enforces minimum and maximum commitment age before wallet submission', async () => {
  const rpc = setup({ committedAt: 1000n, timestamp: 1059n });
  const input = { name: 'alice.420', durationSeconds: 2592000, salt: SALT };
  await assert.rejects(rpc.client.sendRegister(input), /not ready until chain time 1060/);
  assert.equal(rpc.sent.length, 0);

  rpc.setTime(1060n);
  const submitted = await rpc.client.sendRegister(input);
  assert.ok(submitted.transaction.data.startsWith(id('register(bytes32,uint8,address,uint64,bytes32)')));

  const expired = setup({ committedAt: 1000n, timestamp: 87401n });
  await assert.rejects(expired.client.sendRegister(input), /commitment expired/);
  assert.equal(expired.sent.length, 0);
});

test('registration refuses unavailable labels and invalid duration without broadcasting', async () => {
  const unavailable = setup({ available: false });
  await assert.rejects(unavailable.client.sendCommit({ name: 'alice.420', durationSeconds: 2592000, salt: SALT }), /not currently available/);
  assert.equal(unavailable.sent.length, 0);

  const rpc = setup();
  await assert.rejects(rpc.client.makeCommitment({ name: 'Alice.420', durationSeconds: 2592000, salt: SALT }), /invalid 420 Name/);
  await assert.rejects(rpc.client.makeCommitment({ name: 'alice.420', durationSeconds: 1, salt: SALT }), /between/);
  await assert.rejects(rpc.client.makeCommitment({ name: 'alice.420', durationSeconds: 2592000, salt: ZERO32 }), /must not be zero/);
});

test('owner workflows renew, update resolution and nominate transfer only after canonical ownership recheck', async () => {
  const rpc = setup();
  const renew = await rpc.client.sendRenew({ name: 'alice.420', durationSeconds: 2592000 });
  assert.ok(renew.transaction.data.startsWith(id('renew(bytes32,uint64)')));

  const resolution = await rpc.client.sendResolution({
    name: 'alice.420',
    resolvedAddress: BOB,
    profileId: `0x${'11'.repeat(32)}`,
    serviceId: `0x${'22'.repeat(32)}`,
  });
  assert.ok(resolution.transaction.data.startsWith(id('setResolution(bytes32,address,bytes32,bytes32)')));

  const transfer = await rpc.client.sendTransfer({ name: 'alice.420', newOwner: BOB });
  assert.ok(transfer.transaction.data.startsWith(id('transferName(bytes32,address)')));

  rpc.setRecord(record({ owner: BOB }));
  await assert.rejects(rpc.client.sendRenew({ name: 'alice.420', durationSeconds: 2592000 }), /not the current 420 Name owner/);
});

test('reverse and transfer acceptance enforce current chain state', async () => {
  const rpc = setup();
  const reverse = await rpc.client.sendReverse({ name: 'alice.420' });
  assert.ok(reverse.transaction.data.startsWith(id('setReverseName(bytes32)')));

  rpc.setRecord(record({ owner: BOB, pendingOwner: ALICE, resolvedAddress: BOB }));
  const accepted = await rpc.client.sendAccept({ name: 'alice.420' });
  assert.ok(accepted.transaction.data.startsWith(id('acceptName(bytes32)')));

  rpc.setRecord(record({ owner: BOB, pendingOwner: BOB, resolvedAddress: BOB }));
  await assert.rejects(rpc.client.sendAccept({ name: 'alice.420' }), /not the pending/);
  await assert.rejects(rpc.client.sendReverse({ name: 'alice.420' }), /not the current forward-resolution target/);
});

test('network/account changes and simulation failures fail closed before broadcast', async () => {
  const rpc = setup();
  rpc.setChain('0x421');
  await assert.rejects(rpc.client.sendRenew({ name: 'alice.420', durationSeconds: 2592000 }), /chain changed/);
  assert.equal(rpc.sent.length, 0);

  const accountChanged = setup();
  accountChanged.setAccounts([BOB]);
  await assert.rejects(accountChanged.client.verifySession(), /account changed/);

  const reverted = setup({ simulateError: 'execution reverted' });
  await assert.rejects(reverted.client.sendCommit({ name: 'alice.420', durationSeconds: 2592000, salt: SALT }), /simulation reverted/);
  assert.equal(reverted.sent.length, 0);
});

test('confirmation reports reverted or missing receipts as recoverable transaction state', async () => {
  const reverted = setup({ receipt: { status: '0x0' } });
  await assert.rejects(reverted.client.confirm(TX, { attempts: 1 }), /transaction reverted/);

  const pending = setup({ receipt: null });
  await assert.rejects(pending.client.confirm(TX, { attempts: 1, delayMs: 0 }), /not confirmed/);
});

test('error classification and salt generation provide explicit recovery guidance', () => {
  assert.equal(classifyNames420Error({ code: 4001, message: 'User rejected' }).code, 'USER_REJECTED');
  assert.equal(classifyNames420Error(new Error('420 Names chain changed')).code, 'NETWORK_CHANGED');
  assert.equal(classifyNames420Error(new Error('registration commitment expired')).code, 'COMMITMENT_EXPIRED');
  assert.equal(classifyNames420Error(new Error('420 Names simulation reverted: nope')).code, 'SIMULATION_FAILED');

  const salt = randomNames420Salt({ getRandomValues(bytes) { bytes.fill(0xab); return bytes; } });
  assert.equal(salt, `0x${'ab'.repeat(32)}`);
});
