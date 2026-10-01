import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import {
  descriptorsFromNames420Release420,
  names420DescriptorDigest420,
  NAMES420_ADDRESS_420,
  type Names420ReleaseDescriptor420
} from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420, type DecodedProtocolEvent420 } from '../src/protocol-decoder.js';
import { reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';
import { indexerEventEnvelope420 } from '../src/event-stream.js';
import { IndexerEventCanonicality420 } from '../src/event-canonicality.js';
import type { ProtocolEventDto420, JsonValue420 } from '../src/public-dto.js';

const manifest = JSON.parse(readFileSync('descriptors/names420-v3.json','utf8')) as Names420ReleaseDescriptor420;
const word = (tail: string): Hex => ('0x' + tail.padStart(64,'0')) as Hex;
const addressWord = (address: string): Hex => ('0x' + address.slice(2).padStart(64,'0')) as Hex;
const joinData = (...values: Hex[]): Hex => ('0x' + values.map((v) => v.slice(2)).join('')) as Hex;

function event(name: string) {
  const found = manifest.events.find((e) => e.name === name);
  assert.ok(found, 'missing event ' + name);
  return found;
}

function log(name: string, block: bigint, topics: Hex[], data: Hex): IndexerLog {
  return {
    address: NAMES420_ADDRESS_420,
    blockHash: word(block.toString(16)),
    blockNumber: block,
    transactionHash: word((block + 1000n).toString(16)),
    transactionIndex: 0,
    logIndex: 0,
    topics: [event(name).topic0, ...topics],
    data
  };
}

function jsonFields(fields: DecodedProtocolEvent420['fields']): { [key: string]: JsonValue420 } {
  const out: { [key: string]: JsonValue420 } = {};
  for (const [key,value] of Object.entries(fields)) out[key] = typeof value === 'bigint' ? value.toString() : value;
  return out;
}

function dto(decoded: DecodedProtocolEvent420): ProtocolEventDto420 {
  const objectKey = typeof decoded.fields.labelHash === 'string'
    ? 'labelHash:' + decoded.fields.labelHash.toLowerCase()
    : null;
  return {
    chainId: '420',
    blockNumber: decoded.blockNumber.toString(),
    blockHash: decoded.blockHash,
    transactionHash: decoded.transactionHash,
    transactionIndex: decoded.transactionIndex,
    logIndex: decoded.logIndex,
    contractAddress: decoded.contractAddress,
    protocol: decoded.protocol,
    eventName: decoded.eventName,
    objectKey,
    lifecycleState: null,
    fields: jsonFields(decoded.fields)
  };
}

test('pinned Names420 descriptor is exact, reproducible and artifact-bound', () => {
  assert.equal(names420DescriptorDigest420(manifest), manifest.descriptorSha256);
  const descriptors = descriptorsFromNames420Release420(manifest);
  assert.equal(descriptors.length, 7);
  assert.deepEqual(descriptors.map((d) => d.signature).sort(), [
    'CommitmentMade(bytes32,address,uint64)',
    'NameRegistered(bytes32,address,uint64,uint8)',
    'NameRenewed(bytes32,address,uint64)',
    'NameTransferStarted(bytes32,address,address)',
    'NameTransferred(bytes32,address,address)',
    'ResolutionUpdated(bytes32,address,bytes32,bytes32)',
    'ReverseNameSet(address,bytes32)'
  ].sort());
  for (const descriptor of descriptors) assert.equal(descriptor.contractAddress, NAMES420_ADDRESS_420);
});

test('canonical Names420 descriptors decode registration, resolution, renewal and transfer lifecycle', () => {
  const registry = new ProtocolDecoderRegistry420(descriptorsFromNames420Release420(manifest));
  const label = word('aa');
  const owner = '0x1111111111111111111111111111111111111111';
  const resolved = '0x2222222222222222222222222222222222222222';
  const next = '0x3333333333333333333333333333333333333333';
  const profile = word('44');
  const service = word('55');

  const registered = registry.decode(log('NameRegistered', 10n, [label,addressWord(owner)], joinData(word('64'),word('07'))))!;
  const resolution = registry.decode(log('ResolutionUpdated', 11n, [label,addressWord(resolved),profile], service))!;
  const renewed = registry.decode(log('NameRenewed', 12n, [label,addressWord(owner)], word('c8')))!;
  const transferred = registry.decode(log('NameTransferred', 13n, [label,addressWord(owner),addressWord(next)], '0x'))!;

  assert.equal(registered.fields.owner, owner);
  assert.equal(registered.fields.expiresAt, 100n);
  assert.equal(resolution.fields.resolvedAddress, resolved);
  assert.equal(resolution.fields.profileId, profile);
  assert.equal(resolution.fields.serviceId, service);
  assert.equal(renewed.fields.expiresAt, 200n);
  assert.equal(transferred.fields.newOwner, next);

  const snapshots = reduceProtocolLifecycle420([transferred,resolution,registered,renewed]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].objectKey, 'labelHash:' + label);
  assert.equal(snapshots[0].state, 'ACTIVE');
  assert.equal(snapshots[0].eventName, 'NameTransferred');
  assert.equal(snapshots[0].fields.newOwner, next);
});

test('Names420 fork replacement retracts orphan state and recovers on canonical replacement', () => {
  const registry = new ProtocolDecoderRegistry420(descriptorsFromNames420Release420(manifest));
  const label = word('aa');
  const oldOwner = '0x1111111111111111111111111111111111111111';
  const newOwner = '0x9999999999999999999999999999999999999999';

  const oldDecoded = registry.decode(log('NameRegistered', 20n, [label,addressWord(oldOwner)], joinData(word('64'),word('07'))))!;
  const replacementLog = log('NameRegistered', 20n, [label,addressWord(newOwner)], joinData(word('64'),word('07')));
  replacementLog.blockHash = word('beef');
  replacementLog.transactionHash = word('cafe');
  const replacementDecoded = registry.decode(replacementLog)!;

  const oldEnvelope = indexerEventEnvelope420(dto(oldDecoded));
  const replacementEnvelope = indexerEventEnvelope420(dto(replacementDecoded));
  const canonicality = new IndexerEventCanonicality420();
  canonicality.observe(oldEnvelope);
  canonicality.retract(oldEnvelope.id, 'Names420 block removed by reorg');
  canonicality.observe(replacementEnvelope);
  canonicality.finalize(replacementEnvelope.id);

  assert.equal(canonicality.records.get(oldEnvelope.id)?.state, 'retracted');
  assert.equal(canonicality.records.get(replacementEnvelope.id)?.state, 'finalized');
  const recovered = reduceProtocolLifecycle420([replacementDecoded]);
  assert.equal(recovered[0].fields.owner, newOwner);
});

test('descriptor/address/artifact drift fails closed', () => {
  const addressDrift = structuredClone(manifest);
  addressDrift.canonicalAddress = '0x0000000000000000000000000000000000000445';
  assert.throws(() => descriptorsFromNames420Release420(addressDrift), /address mismatch/);

  const artifactDrift = structuredClone(manifest);
  artifactDrift.artifact.runtimeCodeHash = word('01');
  assert.throws(() => descriptorsFromNames420Release420(artifactDrift), /artifact drift/);

  const eventDrift = structuredClone(manifest);
  eventDrift.events[0].inputs[0].name = 'changed';
  assert.throws(() => descriptorsFromNames420Release420(eventDrift), /hash drift/);
});

test('matching Names420 topic from the wrong contract address is rejected', () => {
  const registry = new ProtocolDecoderRegistry420(descriptorsFromNames420Release420(manifest));
  const label = word('aa');
  const owner = '0x1111111111111111111111111111111111111111';
  const wrong = log('NameRegistered', 30n, [label,addressWord(owner)], joinData(word('64'),word('07')));
  wrong.address = '0x0000000000000000000000000000000000000445';
  assert.throws(() => registry.decode(wrong), /contract mismatch/);
});
