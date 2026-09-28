import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import {
  descriptorsFromProtocolRegistryRelease420,
  PROTOCOL_REGISTRY_ADDRESS_420,
  PROTOCOL_REGISTRY_DESCRIPTOR_SHA256_420,
  protocolRegistryDescriptorDigest420,
  type ProtocolRegistryReleaseDescriptor420
} from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';

const manifest = JSON.parse(readFileSync('descriptors/protocol-registry-v4.json','utf8')) as ProtocolRegistryReleaseDescriptor420;
const word = (tail: string): Hex => ('0x' + tail.padStart(64,'0')) as Hex;
const addressWord = (address: string): Hex => ('0x' + address.slice(2).padStart(64,'0')) as Hex;

test('pinned ProtocolRegistry descriptor is reproducible and hash-bound', () => {
  assert.equal(protocolRegistryDescriptorDigest420(manifest), PROTOCOL_REGISTRY_DESCRIPTOR_SHA256_420);
  const descriptors = descriptorsFromProtocolRegistryRelease420(manifest);
  assert.equal(descriptors.length, 3);
  assert.deepEqual(descriptors.map((d) => d.eventName).sort(), [
    'ServiceDeprecated','ServiceRegistrationProfilePublished','ServiceVersionPublished'
  ]);
  for (const descriptor of descriptors) assert.equal(descriptor.contractAddress, PROTOCOL_REGISTRY_ADDRESS_420);
});

test('known ServiceVersionPublished vector decodes with canonical descriptor and address', () => {
  const descriptors = descriptorsFromProtocolRegistryRelease420(manifest);
  const registry = new ProtocolDecoderRegistry420(descriptors);
  const event = manifest.events.find((e) => e.name === 'ServiceVersionPublished')!;
  const implementation='0x1234567890abcdef1234567890abcdef12345678';
  const log: IndexerLog = {
    address: PROTOCOL_REGISTRY_ADDRESS_420,
    blockHash: word('42'), blockNumber: 42n, transactionHash: word('99'), transactionIndex: 0, logIndex: 1,
    topics: [event.topic0, word('11'), word('02'), addressWord(implementation)],
    data: ('0x' + word('22').slice(2) + word('33').slice(2) + word('01').slice(2)) as Hex
  };
  const decoded=registry.decode(log)!;
  assert.equal(decoded.eventName,'ServiceVersionPublished');
  assert.equal(decoded.fields.version,2n);
  assert.equal(decoded.fields.implementation,implementation);
  assert.equal(decoded.fields.active,true);
});

test('known registration profile vector decodes deterministically', () => {
  const descriptors = descriptorsFromProtocolRegistryRelease420(manifest);
  const registry = new ProtocolDecoderRegistry420(descriptors);
  const event = manifest.events.find((e) => e.name === 'ServiceRegistrationProfilePublished')!;
  const log: IndexerLog = {
    address: PROTOCOL_REGISTRY_ADDRESS_420,
    blockHash: word('43'), blockNumber: 43n, transactionHash: word('98'), transactionIndex: 0, logIndex: 2,
    topics: [event.topic0, word('11'), word('02')],
    data: ('0x' + word('04').slice(2) + word('44').slice(2) + word('55').slice(2) + word('66').slice(2)) as Hex
  };
  const decoded=registry.decode(log)!;
  assert.equal(decoded.fields.componentType,4n);
  assert.equal(decoded.fields.manifestHash,word('44'));
  assert.equal(decoded.fields.interfaceHash,word('66'));
});

test('descriptor hash drift and identity drift fail closed', () => {
  const hashDrift=structuredClone(manifest);
  hashDrift.events[0].inputs[0].name='service';
  assert.throws(() => descriptorsFromProtocolRegistryRelease420(hashDrift), /hash drift/);

  const addressDrift=structuredClone(manifest);
  addressDrift.canonicalAddress='0x0000000000000000000000000000000000000435';
  assert.throws(() => descriptorsFromProtocolRegistryRelease420(addressDrift), /address mismatch/);
});

test('matching topic from the wrong contract address is rejected', () => {
  const registry=new ProtocolDecoderRegistry420(descriptorsFromProtocolRegistryRelease420(manifest));
  const event=manifest.events.find((e) => e.name === 'ServiceDeprecated')!;
  const log: IndexerLog = {
    address:'0x0000000000000000000000000000000000000435', blockHash:word('50'), blockNumber:50n,
    transactionHash:word('51'), transactionIndex:0, logIndex:0,
    topics:[event.topic0,word('11'),word('01')], data:'0x'
  };
  assert.throws(() => registry.decode(log), /contract mismatch/);
});
