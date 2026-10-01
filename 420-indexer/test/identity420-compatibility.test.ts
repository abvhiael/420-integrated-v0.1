import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { id } from 'ethers';
import type { Hex } from '../src/chain-source.js';
import { descriptorsFromArtifact420 } from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420, type DecodedProtocolEvent420 } from '../src/protocol-decoder.js';
import { protocolObjectKey420 } from '../src/lifecycle-reducer.js';
import { IndexerEventCanonicality420 } from '../src/event-canonicality.js';
import { indexerEventEnvelope420 } from '../src/event-stream.js';
import type { ProtocolEventDto420 } from '../src/public-dto.js';

const ADDRESS = '0x0000000000000000000000000000000000000436' as Hex;
const artifact = JSON.parse(
  readFileSync(new URL('../../../contracts/artifacts/Identity420.json', import.meta.url), 'utf8')
);
const descriptors = descriptorsFromArtifact420(
  '420Identity',
  { name: 'Identity420', address: ADDRESS, artifact: 'contracts/artifacts/Identity420.json' },
  artifact
);
const byName = new Map(descriptors.map((d) => [d.eventName, d]));

function word(value: string): string {
  return value.replace(/^0x/, '').padStart(64, '0');
}
function bytes32(ch: string): Hex { return ('0x' + ch.repeat(64)) as Hex; }
function address(ch: string): Hex { return ('0x' + ch.repeat(40)) as Hex; }

function encodedLog(
  eventName: string,
  values: Record<string,string|bigint|boolean>,
  blockNumber = 1n,
  logIndex = 0
) {
  const descriptor = byName.get(eventName);
  assert.ok(descriptor, 'missing descriptor ' + eventName);
  const topics: Hex[] = [descriptor.topic0];
  const data: string[] = [];
  for (const field of descriptor.fields) {
    const value = values[field.name];
    let encoded: string;
    if (field.kind === 'address') encoded = word(String(value));
    else if (field.kind === 'bool') encoded = word(value ? '1' : '0');
    else if (field.kind.startsWith('uint')) encoded = word(BigInt(value as bigint).toString(16));
    else encoded = word(String(value));
    if (field.indexed) topics.push(('0x' + encoded) as Hex);
    else data.push(encoded);
  }
  return {
    address: ADDRESS,
    topics,
    data: ('0x' + data.join('')) as Hex,
    blockNumber,
    blockHash: bytes32('a'),
    transactionHash: bytes32('b'),
    transactionIndex: 0,
    logIndex
  };
}

function decode(eventName: string, values: Record<string,string|bigint|boolean>, block = 1n, log = 0): DecodedProtocolEvent420 {
  const registry = new ProtocolDecoderRegistry420(descriptors);
  const decoded = registry.decode(encodedLog(eventName, values, block, log));
  assert.ok(decoded);
  return decoded;
}

test('final Identity artifact exposes exact nine-event derived-service surface', () => {
  assert.deepEqual(
    [...byName.keys()].sort(),
    [
      'CredentialIssued','CredentialRejected','CredentialRevoked','IssuerSet',
      'PrimaryNameSet','ProfileControllerTransferStarted','ProfileControllerTransferred',
      'ProfileCreated','ProfileUpdated'
    ].sort()
  );
  for (const descriptor of descriptors) {
    assert.equal(descriptor.protocol, '420Identity');
    assert.equal(descriptor.contractAddress, ADDRESS);
    assert.equal(descriptor.topic0, id(descriptor.signature));
  }
});

test('Identity profile, issuer and credential events use canonical object keys', () => {
  const profile = bytes32('1');
  const issuer = bytes32('2');
  const credential = bytes32('3');
  const controller = address('4');

  const events = [
    decode('ProfileCreated', { profileId: profile, controller, metadataHash: bytes32('5') }),
    decode('ProfileUpdated', { profileId: profile, metadataHash: bytes32('6'), active: false }),
    decode('PrimaryNameSet', { profileId: profile, labelHash: bytes32('7') }),
    decode('ProfileControllerTransferStarted', { profileId: profile, currentController: controller, pendingController: address('8') }),
    decode('ProfileControllerTransferred', { profileId: profile, previousController: controller, newController: address('8') }),
    decode('IssuerSet', { issuerId: issuer, controller, metadataHash: bytes32('9'), trustClass: 2n, active: true }),
    decode('CredentialIssued', { credentialId: credential, issuerId: issuer, subjectProfileId: profile, credentialType: bytes32('a'), claimHash: bytes32('b'), expiresAt: 100n }),
    decode('CredentialRevoked', { credentialId: credential, issuerId: issuer }),
    decode('CredentialRejected', { credentialId: credential, subjectProfileId: profile })
  ];
  assert.deepEqual(events.slice(0,5).map(protocolObjectKey420), Array(5).fill('profileId:' + profile));
  assert.equal(protocolObjectKey420(events[5]!), 'issuerId:' + issuer);
  assert.deepEqual(events.slice(6).map(protocolObjectKey420), Array(3).fill('credentialId:' + credential));
});

test('Identity decoded fields preserve commitment hashes without dereference or reinterpretation', () => {
  const profile = bytes32('1');
  const metadataHash = bytes32('d');
  const claimHash = bytes32('e');
  const created = decode('ProfileCreated', { profileId: profile, controller: address('4'), metadataHash });
  assert.equal(created.fields.metadataHash, metadataHash);
  const issued = decode('CredentialIssued', {
    credentialId: bytes32('3'), issuerId: bytes32('2'), subjectProfileId: profile,
    credentialType: bytes32('a'), claimHash, expiresAt: 100n
  });
  assert.equal(issued.fields.claimHash, claimHash);
  assert.equal(Object.hasOwn(issued.fields, 'metadataPayload'), false);
  assert.equal(Object.hasOwn(issued.fields, 'claimPayload'), false);
});

test('Identity event canonicality is replay-idempotent and reorg-sensitive', () => {
  const event: ProtocolEventDto420 = {
    chainId: '420', blockNumber: '10', blockHash: bytes32('a'), transactionHash: bytes32('b'),
    transactionIndex: 0, logIndex: 1, contractAddress: ADDRESS, protocol: '420Identity',
    eventName: 'CredentialIssued', objectKey: 'credentialId:' + bytes32('3'), lifecycleState: 'ACTIVE',
    fields: { credentialId: bytes32('3'), issuerId: bytes32('2'), subjectProfileId: bytes32('1') }
  };
  const tracker = new IndexerEventCanonicality420();
  const envelope = indexerEventEnvelope420(event);
  const first = tracker.observe(envelope);
  assert.strictEqual(tracker.observe(envelope), first);

  const replacement = indexerEventEnvelope420({
    ...event, blockHash: bytes32('c'), transactionHash: bytes32('d')
  });
  const signal = tracker.supersede(envelope.id, replacement, 'canonical fork replacement');
  assert.equal(signal.kind, 'superseded');
  assert.equal(tracker.records.get(envelope.id)?.state, 'superseded');
  assert.equal(tracker.records.get(replacement.id)?.state, 'observed');
});

test('Identity SQL projection declares credential/issuer keys and explicit lifecycle events', () => {
  const sql = readFileSync(new URL('../sql/005-genesis-state-views.sql', import.meta.url), 'utf8');
  assert.match(sql, /fields->>'credentialId'/);
  assert.match(sql, /fields->>'issuerId'/);
  assert.ok(sql.indexOf("fields->>'credentialId'") < sql.indexOf("fields->>'issuerId'"));
  for (const token of [
    "when 'ProfileCreated' then 'ACTIVE'",
    "when 'ProfileControllerTransferStarted' then 'PENDING_CONTROLLER_TRANSFER'",
    "when 'ProfileControllerTransferred' then 'CONTROLLER_TRANSFERRED'",
    "when 'CredentialIssued' then 'ACTIVE'",
    "when 'CredentialRevoked' then 'REVOKED'",
    "when 'CredentialRejected' then 'REJECTED'"
  ]) assert.ok(sql.includes(token), 'missing SQL lifecycle mapping ' + token);
});
