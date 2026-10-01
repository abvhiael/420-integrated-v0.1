#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { id } from 'ethers';

const root = resolve(process.cwd(), '..');
const artifactPath = resolve(root, 'contracts/artifacts/Names420.json');
const statePath = resolve(root, 'contracts/config/predeploy/Names420-predeploy-state.json');
const outPath = resolve(process.cwd(), 'descriptors/names420-v3.json');

const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
const state = JSON.parse(readFileSync(statePath, 'utf8'));

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function fail(message) { throw new Error(message); }

if (artifact.contractName !== 'Names420') fail('artifact contractName drift');
if (artifact.canonicalAddress !== '0x0000000000000000000000000000000000000435') fail('artifact canonical address drift');
if (artifact.sourceBlobSha1 !== '4cb9b06b4a3febb3bf024c087f3ade1eebdcf31d') fail('artifact source blob drift');
if (artifact.artifactPayloadSha256 !== 'c40970d3a04503309f9467eaca00c915f5ce3dd1e993c2df3318aa6cd149ab2c') fail('artifact payload drift');
if (state.runtimeCodeHash !== '0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7') fail('runtime hash drift');
if (state.address !== artifact.canonicalAddress) fail('artifact/state address mismatch');

const events = artifact.abi
  .filter((entry) => entry.type === 'event')
  .map((entry) => {
    const signature = entry.name + '(' + entry.inputs.map((i) => i.type).join(',') + ')';
    return {
      type: 'event',
      name: entry.name,
      anonymous: Boolean(entry.anonymous),
      signature,
      topic0: id(signature).toLowerCase(),
      inputs: entry.inputs.map((i) => ({ name: i.name, type: i.type, indexed: Boolean(i.indexed) }))
    };
  })
  .sort((a,b) => a.signature.localeCompare(b.signature));

if (events.length !== 7) fail('Names420 event count drift: expected 7, got ' + events.length);

const required = [
  'CommitmentMade(bytes32,address,uint64)',
  'NameRegistered(bytes32,address,uint64,uint8)',
  'NameRenewed(bytes32,address,uint64)',
  'NameTransferStarted(bytes32,address,address)',
  'NameTransferred(bytes32,address,address)',
  'ResolutionUpdated(bytes32,address,bytes32,bytes32)',
  'ReverseNameSet(address,bytes32)'
].sort();
const actual = events.map((e) => e.signature).sort();
if (JSON.stringify(actual) !== JSON.stringify(required)) fail('Names420 event set drift');

const descriptor = {
  schema: '420-names-release-descriptor-v1',
  descriptorVersion: 1,
  contractName: 'Names420',
  protocol: '420Names',
  protocolVersion: 3,
  canonicalAddress: artifact.canonicalAddress,
  source: {
    path: artifact.source,
    gitBlobSha: artifact.sourceBlobSha1
  },
  artifact: {
    path: 'contracts/artifacts/Names420.json',
    payloadSha256: artifact.artifactPayloadSha256,
    runtimeCodeHash: state.runtimeCodeHash
  },
  events,
  authority: 'repository_descriptor_only_not_live_names_authority'
};
const payload = {
  canonicalAddress: descriptor.canonicalAddress,
  contractName: descriptor.contractName,
  protocol: descriptor.protocol,
  protocolVersion: descriptor.protocolVersion,
  source: descriptor.source,
  artifact: descriptor.artifact,
  events: descriptor.events
};
descriptor.descriptorSha256 = createHash('sha256').update(canonical(payload)).digest('hex');

const text = JSON.stringify(descriptor, null, 2) + '\n';
if (process.argv.includes('--write')) writeFileSync(outPath, text);
if (process.argv.includes('--check')) {
  const committed = readFileSync(outPath, 'utf8');
  if (committed !== text) fail('committed Names420 descriptor is missing or stale');
}
if (process.argv.includes('--print')) {
  console.log('===BEGIN_NAMES420_DESCRIPTOR===');
  process.stdout.write(text);
  console.log('===END_NAMES420_DESCRIPTOR===');
}
console.log('NAMES_AUDIT_7_DESCRIPTOR=PASS');
console.log('descriptorSha256=' + descriptor.descriptorSha256);
console.log('eventCount=' + events.length);
