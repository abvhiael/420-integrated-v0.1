import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTestnetQualificationConfig420 } from '../src/testnet-qualification.js';

const base = {
  IDX420_CHAIN_ID: '420420',
  IDX420_RPC_URL: 'https://rpc.testnet.420.example/',
  IDX420_EXPECTED_GENESIS_HASH: `0x${'ab'.repeat(32)}`,
  IDX420_FINALITY_MODE: 'confirmations',
  IDX420_CONFIRMATIONS: '12',
  IDX420_SUSTAINED_BLOCKS: '420',
  IDX420_MAX_REORG_DEPTH: '64',
  IDX420_RESTART_REPLAY_BLOCKS: '16',
};

test('parses an explicit testnet qualification environment', () => {
  assert.deepEqual(parseTestnetQualificationConfig420(base), {
    chainId: '420420',
    rpcUrl: 'https://rpc.testnet.420.example/',
    expectedGenesisHash: `0x${'ab'.repeat(32)}`,
    finalityMode: 'confirmations',
    confirmations: 12,
    sustainedBlocks: 420,
    maxReorgDepth: 64,
    restartReplayBlocks: 16,
  });
});

test('fails closed when chain identity is missing or malformed', () => {
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_CHAIN_ID: undefined }), /missing required/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_CHAIN_ID: '0x420' }), /positive base-10 integer/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_EXPECTED_GENESIS_HASH: '0x1234' }), /32-byte/);
});

test('rejects unsafe RPC URL forms and embedded credentials', () => {
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_RPC_URL: 'ws://localhost:8545' }), /http or https/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_RPC_URL: 'https://user:pass@example.test' }), /must not embed credentials/);
});

test('enforces finality-specific confirmation settings', () => {
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_CONFIRMATIONS: undefined }), /IDX420_CONFIRMATIONS/);
  assert.throws(() => parseTestnetQualificationConfig420({ ...base, IDX420_FINALITY_MODE: 'head' }), /only valid/);

  const head = parseTestnetQualificationConfig420({
    ...base,
    IDX420_FINALITY_MODE: 'head',
    IDX420_CONFIRMATIONS: undefined,
  });
  assert.equal(head.confirmations, null);
});

test('requires bounded replay to remain inside the reorg qualification window', () => {
  assert.throws(
    () => parseTestnetQualificationConfig420({ ...base, IDX420_MAX_REORG_DEPTH: '8', IDX420_RESTART_REPLAY_BLOCKS: '9' }),
    /must not exceed/,
  );
});
