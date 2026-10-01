import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import {
  descriptorsFromStakeRelease420,
  type RetainedAbiArtifact420,
  type StakeReleaseDescriptor420,
} from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';
import { indexerEventEnvelope420 } from '../src/event-stream.js';
import { IndexerEventCanonicality420 } from '../src/event-canonicality.js';

const manifest = JSON.parse(readFileSync('descriptors/stake420-v3.json','utf8')) as StakeReleaseDescriptor420;
const validatorArtifact = JSON.parse(readFileSync('../contracts/artifacts/ValidatorRegistry.abi.json','utf8')) as RetainedAbiArtifact420;
const rewardArtifact = JSON.parse(readFileSync('../contracts/artifacts/RewardController.abi.json','utf8')) as RetainedAbiArtifact420;
const artifacts = new Map<string, RetainedAbiArtifact420>([
  ['ValidatorRegistry', validatorArtifact],
  ['RewardController', rewardArtifact],
]);
const word = (tail: string): Hex => ('0x' + tail.padStart(64,'0')) as Hex;
const addressWord = (address: string): Hex => ('0x' + address.slice(2).padStart(64,'0')) as Hex;
const joinData = (...values: Hex[]): Hex => ('0x' + values.map((v) => v.slice(2)).join('')) as Hex;

function descriptor(signature: string) {
  const found = descriptorsFromStakeRelease420(manifest, artifacts).find((d) => d.signature === signature);
  assert.ok(found, 'missing descriptor ' + signature);
  return found;
}

function log(signature: string, address: Hex, block: bigint, topics: Hex[], data: Hex): IndexerLog {
  const d = descriptor(signature);
  return {
    address,
    blockHash: word(block.toString(16)),
    blockNumber: block,
    transactionHash: word((block + 1000n).toString(16)),
    transactionIndex: 0,
    logIndex: 0,
    topics: [d.topic0, ...topics],
    data
  };
}

test('pinned 420Stake descriptor is exact and retains canonical lifecycle/reward event set', () => {
  const descriptors = descriptorsFromStakeRelease420(manifest, artifacts);
  assert.equal(descriptors.length, 13);
  assert.deepEqual(descriptors.map((d) => d.signature).sort(), [...manifest.requiredEvents].sort());
  for (const d of descriptors) {
    if (d.signature === 'RewardApplied(uint64,address,uint256,uint256,uint256,uint256)') {
      assert.equal(d.contractAddress, '0x0000000000000000000000000000000000000420');
    } else {
      assert.equal(d.contractAddress, '0x0000000000000000000000000000000000000423');
    }
  }
});

test('canonical Stake descriptors decode validator lifecycle, slashing and rewards', () => {
  const registry = new ProtocolDecoderRegistry420(descriptorsFromStakeRelease420(manifest, artifacts));
  const validatorId = word('aa');
  const owner = '0x1111111111111111111111111111111111111111';
  const withdrawal = '0x2222222222222222222222222222222222222222';
  const proposer = '0x3333333333333333333333333333333333333333';

  const registered = registry.decode(log(
    'ValidatorRegistered(bytes32,address,address,uint256,uint256)',
    '0x0000000000000000000000000000000000000423',
    10n,
    [validatorId,addressWord(owner),addressWord(withdrawal)],
    joinData(word('5208'),word('4200'))
  ))!;
  assert.equal(registered.fields.validatorId, validatorId);
  assert.equal(registered.fields.owner, owner);
  assert.equal(registered.fields.withdrawal, withdrawal);

  const active = registry.decode(log(
    'ConsensusStateApplied(bytes32,uint8,uint8,uint64,uint64,uint64,uint64)',
    '0x0000000000000000000000000000000000000423',
    11n,
    [validatorId],
    joinData(word('3'),word('4'),word('64'),word('1'),word('4'),word('0'))
  ))!;
  assert.equal(active.fields.previousStatus, 3n);
  assert.equal(active.fields.newStatus, 4n);

  const slash = registry.decode(log(
    'SlashApplied(bytes32,uint8,uint8,uint256,uint256,bytes32,uint8)',
    '0x0000000000000000000000000000000000000423',
    12n,
    [validatorId],
    joinData(word('2'),word('1'),word('a'),word('b'),word('55'),word('6'))
  ))!;
  assert.equal(slash.fields.resultingStatus, 6n);

  const reward = registry.decode(log(
    'RewardApplied(uint64,address,uint256,uint256,uint256,uint256)',
    '0x0000000000000000000000000000000000000420',
    13n,
    [word('d'),addressWord(proposer)],
    joinData(word('64'),word('c8'),word('12c'),word('190'))
  ))!;
  assert.equal(reward.fields.blockNumber, 13n);
  assert.equal(reward.fields.proposer, proposer);

  const snapshots = reduceProtocolLifecycle420([slash, active, registered]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].objectKey, 'validatorId:' + validatorId);
  assert.equal(snapshots[0].state, 'FAILED');
  assert.equal(snapshots[0].eventName, 'SlashApplied');
});

test('Stake event canonicality retracts orphan lifecycle/reward observations on reorg', () => {
  const registry = new ProtocolDecoderRegistry420(descriptorsFromStakeRelease420(manifest, artifacts));
  const validatorId = word('aa');
  const owner = '0x1111111111111111111111111111111111111111';
  const withdrawal = '0x2222222222222222222222222222222222222222';
  const decoded = registry.decode(log(
    'ValidatorRegistered(bytes32,address,address,uint256,uint256)',
    '0x0000000000000000000000000000000000000423',
    20n,
    [validatorId,addressWord(owner),addressWord(withdrawal)],
    joinData(word('5208'),word('4200'))
  ))!;
  const envelope = indexerEventEnvelope420({
    chainId:'420', blockNumber:'20', blockHash:decoded.blockHash,
    transactionHash:decoded.transactionHash, transactionIndex:0, logIndex:0,
    contractAddress:decoded.contractAddress, protocol:'420Stake',
    eventName:decoded.eventName, objectKey:'validatorId:'+validatorId,
    lifecycleState:'PENDING', fields:{ validatorId, owner, withdrawal, ownedBond:'21000', protocolCredit:'21000' }
  });
  const canonicality = new IndexerEventCanonicality420();
  canonicality.observe(envelope);
  canonicality.retract(envelope.id, 'Stake block removed by reorg');
  assert.equal(canonicality.records.get(envelope.id)?.state, 'retracted');
});

test('Stake descriptor and retained artifact provenance drift fails closed', () => {
  const missing = structuredClone(manifest);
  missing.requiredEvents.pop();
  assert.throws(() => descriptorsFromStakeRelease420(missing, artifacts), /unexpected or duplicate event|event set mismatch/);

  const addressDrift = structuredClone(manifest);
  addressDrift.contracts[0].canonicalAddress = '0x0000000000000000000000000000000000000999';
  assert.throws(() => descriptorsFromStakeRelease420(addressDrift, artifacts), /provenance mismatch/);

  const artifactDrift = structuredClone(validatorArtifact);
  artifactDrift.source.gitBlobSha = '0'.repeat(40);
  const bad = new Map(artifacts);
  bad.set('ValidatorRegistry', artifactDrift);
  assert.throws(() => descriptorsFromStakeRelease420(manifest, bad), /retained ABI artifact provenance mismatch/);
});

test('matching canonical Stake topic from the wrong contract is rejected', () => {
  const registry = new ProtocolDecoderRegistry420(descriptorsFromStakeRelease420(manifest, artifacts));
  const validatorId = word('aa');
  const owner = '0x1111111111111111111111111111111111111111';
  const withdrawal = '0x2222222222222222222222222222222222222222';
  const wrong = log(
    'ValidatorRegistered(bytes32,address,address,uint256,uint256)',
    '0x0000000000000000000000000000000000000423',
    30n,[validatorId,addressWord(owner),addressWord(withdrawal)],joinData(word('1'),word('1'))
  );
  wrong.address = '0x0000000000000000000000000000000000000999';
  assert.throws(() => registry.decode(wrong), /contract mismatch/);
});
