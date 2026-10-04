import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex } from '../src/chain-source.js';
import type { Artifact420, AbiEvent420 } from '../src/abi-manifest.js';
import {
  bindRightsDescriptors420,
  bindRightsDescriptorsWithCodeIdentity420,
  rightsDescriptorsFromArtifacts420,
  type RightsArtifactManifest420
} from '../src/rights-descriptors.js';

const manifest = JSON.parse(
  readFileSync(new URL('../../descriptors/rights420-v1.json', import.meta.url), 'utf8')
) as RightsArtifactManifest420;

function artifactMap(): Map<string, Artifact420> {
  return new Map(manifest.contracts.map((contract) => [
    contract.contractName,
    {
      contractName: contract.contractName,
      abi: contract.events.map((event) => ({
        type: 'event',
        name: event.name,
        anonymous: false,
        inputs: event.inputs.map((input) => ({
          name: input.name,
          type: input.type,
          indexed: input.indexed
        }))
      } satisfies AbiEvent420))
    } satisfies Artifact420
  ]));
}

test('420Rights descriptor manifest reconstructs every canonical emitted event', () => {
  const descriptors = rightsDescriptorsFromArtifacts420(manifest, artifactMap());
  assert.equal(descriptors.length, 9);
  assert.deepEqual(
    new Set(descriptors.map((descriptor) => descriptor.eventName)),
    new Set([
      'RightClassPolicyConfigured',
      'SubjectRegistered',
      'SubjectMetadataUpdated',
      'ClaimDeclared',
      'ClaimSuperseded',
      'RightHolderTransferred',
      'LicenseGranted',
      'LicenseRevoked',
      'LicenseRenounced'
    ])
  );
});

test('420Rights descriptor generation fails closed on ABI indexing drift', () => {
  const artifacts = artifactMap();
  const asset = artifacts.get('RightsAssetRegistry420')!;
  const events = asset.abi.filter((item): item is AbiEvent420 => (item as AbiEvent420).type === 'event');
  events[0]!.inputs[0]!.indexed = false;
  assert.throws(
    () => rightsDescriptorsFromArtifacts420(manifest, artifacts),
    /Rights artifact input drift/
  );
});

test('420Rights descriptor binding accepts exact registry-resolved address set', () => {
  const descriptors = rightsDescriptorsFromArtifacts420(manifest, artifactMap());
  const addresses = {
    RightsPolicyRegistry420: '0x0000000000000000000000000000000000001001',
    RightsAssetRegistry420: '0x0000000000000000000000000000000000001002',
    RightsClaimRegistry420: '0x0000000000000000000000000000000000001003',
    RightsLicenseRegistry420: '0x0000000000000000000000000000000000001004'
  } as const satisfies Record<string, Hex>;
  const bound = bindRightsDescriptors420(descriptors, addresses);
  assert.equal(bound.length, 9);
  assert.ok(bound.every((descriptor) => /^0x[0-9a-f]{40}$/.test(descriptor.contractAddress)));
});

test('420Rights descriptor binding rejects malformed deployment address', () => {
  const descriptors = rightsDescriptorsFromArtifacts420(manifest, artifactMap());
  const addresses = {
    RightsPolicyRegistry420: '0x0000000000000000000000000000000000001001',
    RightsAssetRegistry420: '0x0000000000000000000000000000000000001002',
    RightsClaimRegistry420: '0x0000000000000000000000000000000000001003',
    RightsLicenseRegistry420: '0x1234'
  } as unknown as Record<'RightsPolicyRegistry420'|'RightsAssetRegistry420'|'RightsClaimRegistry420'|'RightsLicenseRegistry420', Hex>;
  assert.throws(() => bindRightsDescriptors420(descriptors, addresses), /Rights deployment address invalid/);
});


test('420Rights code-identity binding accepts exact registry addresses and nonzero runtime hashes', () => {
  const descriptors = rightsDescriptorsFromArtifacts420(manifest, artifactMap());
  const deployments = {
    RightsPolicyRegistry420: {
      address: '0x0000000000000000000000000000000000001001',
      runtimeCodeHash: '0x1111111111111111111111111111111111111111111111111111111111111111'
    },
    RightsAssetRegistry420: {
      address: '0x0000000000000000000000000000000000001002',
      runtimeCodeHash: '0x2222222222222222222222222222222222222222222222222222222222222222'
    },
    RightsClaimRegistry420: {
      address: '0x0000000000000000000000000000000000001003',
      runtimeCodeHash: '0x3333333333333333333333333333333333333333333333333333333333333333'
    },
    RightsLicenseRegistry420: {
      address: '0x0000000000000000000000000000000000001004',
      runtimeCodeHash: '0x4444444444444444444444444444444444444444444444444444444444444444'
    }
  } as const;
  const bound = bindRightsDescriptorsWithCodeIdentity420(descriptors, deployments);
  assert.equal(bound.length, 9);
  assert.ok(bound.every((descriptor) => /^0x[0-9a-f]{64}$/.test(descriptor.runtimeCodeHash)));
});

test('420Rights code-identity binding rejects zero runtime code hash', () => {
  const descriptors = rightsDescriptorsFromArtifacts420(manifest, artifactMap());
  const deployments = {
    RightsPolicyRegistry420: {
      address: '0x0000000000000000000000000000000000001001',
      runtimeCodeHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
    },
    RightsAssetRegistry420: {
      address: '0x0000000000000000000000000000000000001002',
      runtimeCodeHash: '0x2222222222222222222222222222222222222222222222222222222222222222'
    },
    RightsClaimRegistry420: {
      address: '0x0000000000000000000000000000000000001003',
      runtimeCodeHash: '0x3333333333333333333333333333333333333333333333333333333333333333'
    },
    RightsLicenseRegistry420: {
      address: '0x0000000000000000000000000000000000001004',
      runtimeCodeHash: '0x4444444444444444444444444444444444444444444444444444444444444444'
    }
  } as const;
  assert.throws(
    () => bindRightsDescriptorsWithCodeIdentity420(descriptors, deployments),
    /Rights deployment runtime code hash invalid/
  );
});
