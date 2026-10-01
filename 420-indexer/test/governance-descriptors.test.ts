import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex } from '../src/chain-source.js';
import type { Artifact420 } from '../src/abi-manifest.js';
import {
  GOVERNANCE_CIVIC_CONTRACTS_420,
  bindGovernanceCivicDescriptors420,
  governanceCivicDescriptorsFromArtifacts420,
  type GovernanceCivicArtifactManifest420,
  type GovernanceCivicContract420
} from '../src/governance-descriptors.js';

const manifest = JSON.parse(
  readFileSync(new URL('../descriptors/governance-civic-v1.json', import.meta.url), 'utf8')
) as GovernanceCivicArtifactManifest420;

function artifactsFromManifest420(): ReadonlyMap<string, Artifact420> {
  return new Map(manifest.contracts.map((contract) => [
    contract.contractName,
    {
      contractName: contract.contractName,
      abi: contract.events.map((event) => ({
        type: 'event' as const,
        name: event.name,
        anonymous: false,
        inputs: event.inputs.map((input) => ({ ...input }))
      }))
    }
  ]));
}

test('builds canonical address-unbound Governance descriptors from exact artifact event shapes', () => {
  const descriptors = governanceCivicDescriptorsFromArtifacts420(manifest, artifactsFromManifest420());
  assert.equal(descriptors.length, 12);
  assert.deepEqual(
    [...new Set(descriptors.map((descriptor) => descriptor.contractName))].sort(),
    [...GOVERNANCE_CIVIC_CONTRACTS_420].sort()
  );
  assert.equal(descriptors.every((descriptor) => descriptor.protocol === '420Governance'), true);
  assert.equal(descriptors.some((descriptor) => descriptor.eventName === 'CivicProposalRegistered'), true);
  assert.equal(descriptors.some((descriptor) => descriptor.eventName === 'CivicProposalStateChanged'), true);
  assert.equal(descriptors.every((descriptor) => !('contractAddress' in descriptor)), true);
});

test('artifact descriptor generation fails closed on ABI/indexing drift', () => {
  const artifacts = new Map(artifactsFromManifest420());
  const original = artifacts.get('CivicVoting420')!;
  const mutated: Artifact420 = {
    ...original,
    abi: original.abi.map((item) => {
      if ((item as { name?: string }).name !== 'CivicVoteCast') return item;
      const event = item as { type: 'event'; name: string; anonymous?: boolean; inputs: Array<{ name: string; type: string; indexed?: boolean }> };
      return { ...event, inputs: event.inputs.map((input, index) => index === 0 ? { ...input, indexed: false } : input) };
    })
  };
  artifacts.set('CivicVoting420', mutated);
  assert.throws(
    () => governanceCivicDescriptorsFromArtifacts420(manifest, artifacts),
    /artifact input drift/
  );
});

test('deployment binding requires valid addresses and does not manufacture them in the artifact descriptor', () => {
  const descriptors = governanceCivicDescriptorsFromArtifacts420(manifest, artifactsFromManifest420());
  const addresses = Object.fromEntries(
    GOVERNANCE_CIVIC_CONTRACTS_420.map((name, index) => [
      name,
      `0x${(index + 1).toString(16).padStart(40, '0')}` as Hex
    ])
  ) as Record<GovernanceCivicContract420, Hex>;
  const bound = bindGovernanceCivicDescriptors420(descriptors, addresses);
  assert.equal(bound.length, descriptors.length);
  assert.equal(bound.every((descriptor) => /^0x[0-9a-f]{40}$/.test(descriptor.contractAddress)), true);

  const invalid = { ...addresses, CivicGovernor420: '0x1234' as Hex };
  assert.throws(() => bindGovernanceCivicDescriptors420(descriptors, invalid), /deployment address invalid/);
});
