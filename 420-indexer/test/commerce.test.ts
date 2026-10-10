import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { GENESIS_PROTOCOL_BY_CONTRACT_420, descriptorsFromArtifact420 } from '../src/abi-manifest.js';
import { ProtocolDecoderRegistry420, type DecodedProtocolEvent420 } from '../src/protocol-decoder.js';
import { protocolObjectKey420, reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';
import type { Hex } from '../src/chain-source.js';
const listingId=('0x'+'1'.repeat(64)) as Hex,orderId=('0x'+'2'.repeat(64)) as Hex;
const address=('0x'+'3'.repeat(40)) as Hex,hash=('0x'+'4'.repeat(64)) as Hex;
const event=(name:string,fields:DecodedProtocolEvent420['fields'],logIndex=0):DecodedProtocolEvent420=>({protocol:'420Market',eventName:name,contractAddress:address,blockHash:hash,blockNumber:1n,transactionHash:hash,transactionIndex:0,logIndex,fields});
test('Market keys bind order before listing or payment; no secondary identity collision',()=>{
  assert.equal(protocolObjectKey420(event('OrderCreated',{orderId,listingId,paymentId:hash})),'orderId:'+orderId);
  assert.equal(protocolObjectKey420(event('ListingPublished',{listingId,sellerProfileId:hash})),'listingId:'+listingId);
});
test('Market frozen lifecycle and partial Pay refund separation; sorted replay converges',()=>{
  const events=[event('OrderCreated',{orderId,listingId},0),event('PaymentRecorded',{orderId,paymentRef:hash},1),event('FulfillmentRecorded',{orderId},2),event('OrderCompleted',{orderId},3),event('RefundRecorded',{orderId},4)];
  const result=reduceProtocolLifecycle420([...events].reverse());assert.equal(result[0]?.state,'COMPLETED');assert.equal(result[0]?.terminal,true);
  const paid=reduceProtocolLifecycle420([events[0]!,events[1]!,{...event('PaymentSet',{paymentId:hash,status:7n},2),protocol:'420Pay'}]);assert.equal(paid.find(x=>x.protocol==='420Market')?.state,'PAID');
});
test('cancelled listing can revise/reopen; terminal order cannot reopen',()=>{
  assert.equal(reduceProtocolLifecycle420([event('ListingPublished',{listingId},0),event('ListingCancelled',{listingId},1),event('ListingPublished',{listingId},2)])[0]?.state,'ACTIVE');
  assert.equal(reduceProtocolLifecycle420([event('OrderCreated',{orderId},0),event('OrderCancelled',{orderId},1),event('PaymentRecorded',{orderId},2)])[0]?.state,'CANCELLED');
});
test('actual ABI-generated order descriptor decodes provenance and rejects wrong emitter',()=>{
  const iface=new Interface(['event OrderCreated(bytes32 indexed orderId,bytes32 indexed listingId,uint32 indexed listingRevision,address buyer,address seller,uint256 quantity,address paymentAsset,uint256 totalAmount,bytes32 settlementAdapterId)']);
  const abi=JSON.parse(iface.formatJson());const descriptors=descriptorsFromArtifact420('420Market',{name:'OrderRegistry420',address,artifact:'deployment-resolved'},{contractName:'OrderRegistry420',abi});
  const decoder=new ProtocolDecoderRegistry420(descriptors),encoded=iface.encodeEventLog(iface.getEvent('OrderCreated')!,[orderId,listingId,1,address,address,1,address,100,hash]);
  const log={address,topics:encoded.topics as Hex[],data:encoded.data as Hex,blockNumber:1n,blockHash:hash,transactionHash:hash,transactionIndex:0,logIndex:0};const decoded=decoder.decode(log);assert.equal(decoded?.fields.orderId,orderId);assert.equal(decoded?.fields.totalAmount,100n);assert.throws(()=>decoder.decode({...log,address:('0x'+'5'.repeat(40)) as Hex}),/contract mismatch/);
  assert.equal(GENESIS_PROTOCOL_BY_CONTRACT_420.OrderRegistry420,'420Market');assert.equal(GENESIS_PROTOCOL_BY_CONTRACT_420.InventoryReservation420,'420Market');
});
