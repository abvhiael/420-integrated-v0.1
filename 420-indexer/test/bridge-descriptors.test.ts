import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Hex, IndexerLog } from '../src/chain-source.js';
import {
  BRIDGE_CONTRACTS_420,
  bindBridgeDescriptors420,
  bridgeDescriptorsFromManifest420,
  type BridgeArtifactManifest420,
  type BridgeContract420
} from '../src/bridge-descriptors.js';
import { ProtocolDecoderRegistry420 } from '../src/protocol-decoder.js';
import { reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';

const manifest = JSON.parse(
  readFileSync(new URL('../../descriptors/bridge420-v1.json', import.meta.url), 'utf8')
) as BridgeArtifactManifest420;

const word = (value: bigint | number | string): Hex => {
  if (typeof value === 'string' && value.startsWith('0x')) return ('0x' + value.slice(2).padStart(64,'0')) as Hex;
  return ('0x' + BigInt(value).toString(16).padStart(64,'0')) as Hex;
};
const address = (n: number): Hex => ('0x' + n.toString(16).padStart(40,'0')) as Hex;
const addresses = Object.fromEntries(BRIDGE_CONTRACTS_420.map((name,index)=>[name,address(index+1)])) as Record<BridgeContract420,Hex>;

function log(address_: Hex, topic0: Hex, topics: Hex[], dataWords: Hex[], logIndex=0): IndexerLog {
  return {
    address: address_,
    blockHash: word(100),
    blockNumber: 10n,
    transactionHash: word(200 + logIndex),
    transactionIndex: 0,
    logIndex,
    topics: [topic0,...topics],
    data: ('0x'+dataWords.map((item)=>item.slice(2)).join('')) as Hex
  };
}

test('Bridge manifest covers all canonical contracts and 27 current events', () => {
  const descriptors = bridgeDescriptorsFromManifest420(manifest);
  assert.equal(descriptors.length, 27);
  assert.deepEqual([...new Set(descriptors.map((d)=>d.contractName))].sort(), [...BRIDGE_CONTRACTS_420].sort());
  assert.equal(descriptors.every((d)=>d.protocol === '420Bridge' && !('contractAddress' in d)), true);
  for (const required of ['TransferCreated','TransferStatus','TransferTransition','InboundAccepted','OutboundTransferRegistered','ReconciliationHealth']) {
    assert.equal(descriptors.some((d)=>d.eventName===required), true, 'missing '+required);
  }
});

test('Bridge deployment binding requires exact nonzero addresses', () => {
  const descriptors = bridgeDescriptorsFromManifest420(manifest);
  const bound = bindBridgeDescriptors420(descriptors, addresses);
  assert.equal(bound.length, 27);
  assert.equal(bound.every((d)=>/^0x[0-9a-f]{40}$/.test(d.contractAddress)), true);
  assert.throws(
    ()=>bindBridgeDescriptors420(descriptors,{...addresses,GatewayRouter420:'0x0000000000000000000000000000000000000000' as Hex}),
    /deployment address invalid/
  );
});

test('decoder supports identical Bridge event signatures on distinct bound contracts without cross-address confusion', () => {
  const bound = bindBridgeDescriptors420(bridgeDescriptorsFromManifest420(manifest), addresses);
  const registry = new ProtocolDecoderRegistry420(bound);
  const risk = bound.find((d)=>d.contractAddress===addresses.BridgeRiskManager && d.eventName==='RouterSet')!;
  const transfer = bound.find((d)=>d.contractAddress===addresses.BridgeTransferRegistry && d.eventName==='RouterSet')!;
  assert.equal(risk.topic0, transfer.topic0);
  const routerWord=word(address(99));
  const riskDecoded=registry.decode(log(addresses.BridgeRiskManager,risk.topic0,[routerWord],[word(1)]));
  const transferDecoded=registry.decode(log(addresses.BridgeTransferRegistry,transfer.topic0,[routerWord],[word(0)],1));
  assert.equal(riskDecoded?.contractAddress,addresses.BridgeRiskManager);
  assert.equal(riskDecoded?.fields.trusted,true);
  assert.equal(transferDecoded?.contractAddress,addresses.BridgeTransferRegistry);
  assert.equal(transferDecoded?.fields.trusted,false);
  assert.throws(
    () => registry.decode(log(address(250),risk.topic0,[routerWord],[word(1)],2)),
    /protocol descriptor contract mismatch/
  );
});

test('canonical Bridge transfer events reconstruct exact lifecycle and preserve terminal completion', () => {
  const bound = bindBridgeDescriptors420(bridgeDescriptorsFromManifest420(manifest), addresses);
  const registry = new ProtocolDecoderRegistry420(bound);
  const created = bound.find((d)=>d.contractName==='BridgeTransferRegistry'&&d.eventName==='TransferCreated')!;
  const transition = bound.find((d)=>d.contractName==='BridgeTransferRegistry'&&d.eventName==='TransferTransition')!;
  const transferId=word(0x420);
  const routeId=word(0x421);
  const assetId=word(0x422);
  const actor=word(address(77));
  const events=[
    registry.decode(log(addresses.BridgeTransferRegistry,created.topic0,[transferId,routeId,assetId],[word(100)],0))!,
    registry.decode(log(addresses.BridgeTransferRegistry,transition.topic0,[transferId,word(1),word(2)],[word(1),actor],1))!,
    registry.decode(log(addresses.BridgeTransferRegistry,transition.topic0,[transferId,word(2),word(3)],[word(2),actor],2))!,
    registry.decode(log(addresses.BridgeTransferRegistry,transition.topic0,[transferId,word(3),word(4)],[word(3),actor],3))!,
    registry.decode(log(addresses.BridgeTransferRegistry,transition.topic0,[transferId,word(4),word(5)],[word(4),actor],4))!,
    registry.decode(log(addresses.BridgeTransferRegistry,transition.topic0,[transferId,word(5),word(6)],[word(5),actor],5))!,
    registry.decode(log(addresses.BridgeTransferRegistry,transition.topic0,[transferId,word(6),word(7)],[word(6),actor],6))!,
    registry.decode(log(addresses.BridgeTransferRegistry,transition.topic0,[transferId,word(7),word(11)],[word(7),actor],7))!
  ];
  const [snapshot]=reduceProtocolLifecycle420(events);
  assert.equal(snapshot.objectKey,'transferId:'+transferId);
  assert.equal(snapshot.state,'COMPLETED');
  assert.equal(snapshot.terminal,true);
  assert.equal(snapshot.blockNumber,10n);
  assert.equal(snapshot.logIndex,6);
});

test('obsolete synthetic Bridge lifecycle names do not manufacture state', () => {
  const synthetic = {
    protocol:'420Bridge',eventName:'TransferFinalized',contractAddress:address(1),
    blockNumber:1n,blockHash:word(1),transactionHash:word(2),transactionIndex:0,logIndex:0,
    fields:{transferId:word(3)}
  };
  assert.deepEqual(reduceProtocolLifecycle420([synthetic]),[]);
});
