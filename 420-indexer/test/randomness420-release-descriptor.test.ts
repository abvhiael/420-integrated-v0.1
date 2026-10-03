import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import {
  bindRandomnessDescriptors420,
  randomnessDescriptors420,
  RANDOMNESS_REGISTRY_ADDRESS_420,
  type RandomnessReleaseDescriptor420
} from '../src/randomness-descriptors.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';

const manifest = JSON.parse(
  readFileSync('descriptors/randomness-v1.json','utf8')
) as RandomnessReleaseDescriptor420;

const ROUTER = '0x1111111111111111111111111111111111111111' as Hex;
const word = (tail: string): Hex => ('0x' + tail.padStart(64,'0')) as Hex;
const addressWord = (address: string): Hex => ('0x' + address.slice(2).padStart(64,'0')) as Hex;
const joinData = (...values: Hex[]): Hex => ('0x' + values.map((v) => v.slice(2)).join('')) as Hex;

function descriptors() {
  return bindRandomnessDescriptors420(randomnessDescriptors420(manifest), ROUTER);
}

function event(name: string) {
  const found = descriptors().find((descriptor) => descriptor.eventName === name);
  assert.ok(found, 'missing event ' + name);
  return found;
}

function log(address: Hex, name: string, block: bigint, topics: Hex[], data: Hex): IndexerLog {
  return {
    address,
    blockHash: word(block.toString(16)),
    blockNumber: block,
    transactionHash: word((block + 1000n).toString(16)),
    transactionIndex: 0,
    logIndex: 0,
    topics: [event(name).topic0, ...topics],
    data
  };
}

test('pinned generalized Randomness descriptor binds fixed registry and Registry-resolved router', () => {
  const bound = descriptors();
  assert.equal(bound.length, 7);
  const registry = bound.filter((descriptor) => descriptor.contractAddress === RANDOMNESS_REGISTRY_ADDRESS_420);
  const router = bound.filter((descriptor) => descriptor.contractAddress === ROUTER);
  assert.equal(registry.length, 3);
  assert.equal(router.length, 4);
  assert.deepEqual(bound.map((descriptor) => descriptor.eventName).sort(), [
    'RandomnessFallbackActivated',
    'RandomnessFulfilled',
    'RandomnessRequestCreated',
    'RandomnessRequestVoided',
    'RandomnessRequested',
    'RandomnessResolved',
    'RandomnessRouterBound'
  ].sort());
});

test('generalized router request and resolve events reduce to pending then completed', () => {
  const registry = new ProtocolDecoderRegistry420(descriptors());
  const requestId = word('aa');
  const requester = '0x2222222222222222222222222222222222222222';
  const profile = word('bb');
  const route = word('cc');

  const created = registry.decode(log(
    ROUTER,
    'RandomnessRequestCreated',
    10n,
    [requestId,addressWord(requester),profile],
    joinData(
      word('01'), word('01'), word('02'), route, word('00'),
      word('64'), word('c8'), word('01'), word('00')
    )
  ))!;
  const resolved = registry.decode(log(
    ROUTER,
    'RandomnessResolved',
    11n,
    [requestId,route],
    joinData(word('dd'),word('ee'))
  ))!;

  assert.equal(created.fields.requestId, requestId);
  assert.equal(created.fields.requester, requester);
  assert.equal(resolved.fields.routeId, route);

  const pending = reduceProtocolLifecycle420([created]);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].objectKey, 'requestId:' + requestId);
  assert.equal(pending[0].state, 'PENDING');
  assert.equal(pending[0].terminal, false);

  const completed = reduceProtocolLifecycle420([created,resolved]);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].state, 'COMPLETED');
  assert.equal(completed[0].terminal, true);
  assert.equal(completed[0].eventName, 'RandomnessResolved');
});

test('voided generalized request becomes terminal expired', () => {
  const registry = new ProtocolDecoderRegistry420(descriptors());
  const requestId = word('ab');
  const voided = registry.decode(log(ROUTER,'RandomnessRequestVoided',20n,[requestId],'0x'))!;
  const snapshot = reduceProtocolLifecycle420([voided]);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].state, 'EXPIRED');
  assert.equal(snapshot[0].terminal, true);
});

test('registry request and fulfillment events retain the same request object identity', () => {
  const registry = new ProtocolDecoderRegistry420(descriptors());
  const requestId = word('ac');
  const route = word('ad');
  const requested = registry.decode(log(
    RANDOMNESS_REGISTRY_ADDRESS_420,
    'RandomnessRequested',
    30n,
    [requestId,word('be')],
    word('1e')
  ))!;
  const fulfilled = registry.decode(log(
    RANDOMNESS_REGISTRY_ADDRESS_420,
    'RandomnessFulfilled',
    31n,
    [requestId,route],
    joinData(word('01'),word('02'),word('1f'))
  ))!;
  const snapshot = reduceProtocolLifecycle420([requested,fulfilled]);
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].objectKey, 'requestId:' + requestId);
  assert.equal(snapshot[0].state, 'COMPLETED');
  assert.equal(snapshot[0].terminal, true);
});

test('wrong router address and registry/router address collision fail closed', () => {
  assert.throws(
    () => bindRandomnessDescriptors420(randomnessDescriptors420(manifest), RANDOMNESS_REGISTRY_ADDRESS_420),
    /cannot equal/
  );
  assert.throws(
    () => bindRandomnessDescriptors420(randomnessDescriptors420(manifest), '0x0000000000000000000000000000000000000000'),
    /invalid/
  );

  const registry = new ProtocolDecoderRegistry420(descriptors());
  const wrong = log(
    '0x3333333333333333333333333333333333333333',
    'RandomnessRequestVoided',
    40n,
    [word('aa')],
    '0x'
  );
  assert.throws(() => registry.decode(wrong), /contract mismatch/);
});
