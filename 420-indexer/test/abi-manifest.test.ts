import test from 'node:test';
import assert from 'node:assert/strict';
import { id } from 'ethers';
import type { Hex } from '../src/chain-source.js';
import { buildGenesisDescriptorManifest420, descriptorsFromArtifact420 } from '../src/abi-manifest.js';

const predeploy = { name: 'Names420', address: '0x0000000000000000000000000000000000000435' as Hex, artifact: 'contracts/artifacts/Names420.json' };

const artifact = {
  contractName: 'Names420',
  abi: [
    { type: 'event' as const, name: 'NameRegistered', inputs: [
      { name: 'labelHash', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'expiresAt', type: 'uint64', indexed: false },
      { name: 'labelLength', type: 'uint8', indexed: false }
    ] }
  ]
};

test('builds deterministic descriptors from genesis ABI events', () => {
  const [descriptor] = descriptorsFromArtifact420('420Names', predeploy, artifact);
  assert.equal(descriptor.signature, 'NameRegistered(bytes32,address,uint64,uint8)');
  assert.equal(descriptor.topic0, id(descriptor.signature));
  assert.equal(descriptor.contractAddress, predeploy.address);
  assert.deepEqual(descriptor.fields.map((f) => [f.name, f.kind, f.indexed]), [
    ['labelHash','bytes32',true], ['owner','address',true], ['expiresAt','uint64',false], ['labelLength','uint8',false]
  ]);
});

test('fails closed when a required genesis artifact is missing', () => {
  assert.throws(
    () => buildGenesisDescriptorManifest420({ predeploys: [predeploy] }, new Map()),
    /required genesis artifact missing: Names420/
  );
});

test('fails closed on ABI event types outside the frozen decoder surface', () => {
  const unsupported = {
    contractName: 'Names420',
    abi: [{ type: 'event' as const, name: 'Complex', inputs: [{ name: 'value', type: 'string', indexed: false }] }]
  };
  assert.throws(() => descriptorsFromArtifact420('420Names', predeploy, unsupported), /unsupported event field string/);
});
