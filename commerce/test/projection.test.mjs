import test from 'node:test';
import assert from 'node:assert/strict';
import { Projection } from '../src/projection.mjs';
import { Database } from '../src/database.mjs';
import { indexerEventEnvelope420 } from '../../420-indexer/dist/src/event-stream.js';
import { setup,listingEvent,batch,header,b32 } from './fixtures.mjs';
test('actual shared Indexer envelope ingests atomically and duplicate replay cannot multiply inbox/outbox',async t=>{
  const f=setup();t.after(()=>f.close());const event=listingEvent(f);
  const upstream=indexerEventEnvelope420({...event.provenance,protocol:event.protocol,eventName:event.eventName,objectKey:event.objectKey,lifecycleState:null,fields:event.fields});assert.deepEqual(upstream,event);
  await f.projection.ingest(batch([upstream]),[header()]);await f.projection.ingest(batch([upstream]),[header()]);
  for(const table of ['catalogue_projection','event_inbox','projection_outbox'])assert.equal(f.db.get(`SELECT COUNT(*) AS n FROM ${table}`).n,1);
  assert.equal(f.projection.health().state,'ready');assert.equal(f.db.get('SELECT cursor FROM projection_checkpoints').cursor,'opaque-cursor');
});
test('inbox/projection/checkpoint/outbox rollback together on conflicting payload or incomplete order history',async t=>{
  const f=setup();t.after(()=>f.close());const event=listingEvent(f);await f.projection.ingest(batch([event]),[header()]);
  const changed=structuredClone(event);changed.fields.unitPrice='101';await assert.rejects(()=>f.projection.ingest({...batch([changed]),nextCursor:'changed'},[header()]),e=>e.code==='event_payload_conflict');assert.equal(f.db.get('SELECT cursor FROM projection_checkpoints').cursor,'opaque-cursor');
  const orphan=structuredClone(event);orphan.eventName='PaymentRecorded';orphan.topic='420Market.PaymentRecorded';orphan.provenance.logIndex=1;orphan.id=orphan.id.slice(0,-1)+'1';orphan.provenance.contractAddress=f.contracts.OrderRegistry420.address;orphan.objectKey='orderId:'+b32(6);orphan.fields={orderId:b32(6),paymentRef:b32(7)};
  await assert.rejects(()=>f.projection.ingest(batch([orphan]),[header()]),e=>e.code==='order_history_incomplete');assert.equal(f.db.get('SELECT COUNT(*) AS n FROM event_inbox').n,1);
});
test('nonfinal reorg replaces derived rows and invalidates orphan notifications while retaining audit provenance',async t=>{
  const f=setup();t.after(()=>f.close());await f.projection.ingest(batch([listingEvent(f)]),[header()]);
  const replacement=listingEvent(f,{blockHash:b32(101),revision:'2'});await f.projection.ingest(batch([replacement]),[header(1,b32(101))]);
  assert.equal(JSON.parse(f.db.get('SELECT payload FROM catalogue_projection').payload).revision,'2');assert.equal(f.db.get('SELECT COUNT(*) AS n FROM event_inbox WHERE canonical=0').n,1);assert.equal(f.db.get('SELECT COUNT(*) AS n FROM projection_outbox WHERE invalidated=1').n,1);
  const delivered=[];await f.projection.deliverOutbox(async value=>delivered.push(value));assert.equal(delivered.length,1);assert.equal(delivered[0].eventId,replacement.id);
});
test('finality promotes identical envelopes; finalized replacement and unknown ancestry persist a halt',async t=>{
  const f=setup();t.after(()=>f.close());const event=listingEvent(f);await f.projection.ingest(batch([event]),[header()]);await f.projection.ingest(batch([event]),[header(1,b32(100),b32(99),true)]);
  assert.equal(f.db.get('SELECT finalized FROM catalogue_projection').finalized,1);
  await assert.rejects(()=>f.projection.ingest(batch([listingEvent(f,{blockHash:b32(101)})]),[header(1,b32(101))]),e=>e.code==='finalized_mismatch');assert.equal(f.projection.health().state,'halted');
  await assert.rejects(()=>f.projection.ingest(batch([]),[header()]),e=>e.code==='projection_halted');
  const other=setup();t.after(()=>other.close());await assert.rejects(()=>other.projection.ingest(batch([]),[header(1,b32(100),b32(98))]),e=>e.code==='unknown_ancestry');assert.equal(other.projection.health().state,'halted');
});
test('canonical block verification mismatch persists a halt and emits an operational audit',async t=>{
  const f=setup();t.after(()=>f.close());f.authority.verifyBlocks=async()=>false;await assert.rejects(()=>f.projection.ingest(batch([]),[header()]),e=>e.code==='unverified_blocks');assert.equal(f.projection.health().state,'halted');assert.equal(f.db.get('SELECT operation FROM audit_log').operation,'unverified_blocks');
});
for(const [name,mutate] of Object.entries({wrongChain:e=>e.provenance.chainId='421',wrongEmitter:e=>e.provenance.contractAddress='0x'+'f'.repeat(40),wrongHash:e=>e.provenance.blockHash=b32(123),wrongID:e=>e.id='spoof',wrongKey:e=>e.objectKey='orderId:'+b32(2),badSchema:e=>e.streamVersion='v2',authority:e=>e.authoritative=true,badTopic:e=>e.topic='spoof.ListingPublished',negativeLog:e=>e.provenance.logIndex=-1,hugePayload:e=>e.fields.description='x'.repeat(17000)}))test(`projection rejects ${name} without any partial persistence`,async t=>{
  const f=setup();t.after(()=>f.close());const e=listingEvent(f);mutate(e);await assert.rejects(()=>f.projection.ingest(batch([e]),[header()]));assert.equal(f.db.get('SELECT COUNT(*) AS n FROM event_inbox').n,0);assert.equal(f.db.get('SELECT height FROM projection_checkpoints').height,0);
});
test('restart/rebuild from durable inbox restores identical public state; failed authority cannot clear halt',async t=>{
  const f=setup();t.after(()=>f.close());await f.projection.ingest(batch([listingEvent(f)]),[header()]);const expected=f.db.all('SELECT * FROM catalogue_projection');
  const reopened=new Database(f.file);const p=new Projection(reopened,f.authority,{chainId:'420',contracts:f.contracts,startHeight:1,startParentHash:b32(99),now:f.now});reopened.run('DELETE FROM catalogue_projection');await p.rebuild();assert.deepEqual(reopened.all('SELECT * FROM catalogue_projection'),expected);
  reopened.run('UPDATE projection_checkpoints SET halted=1');f.authority.verifyBlocks=async()=>false;await assert.rejects(()=>p.rebuild());assert.equal(p.health().state,'halted');reopened.close();f.advance(120001);assert.equal(f.projection.health().state,'halted');
});
test('outbox crash retries same stable idempotency key; does not claim exactly-once external delivery',async t=>{
  const f=setup();t.after(()=>f.close());await f.projection.ingest(batch([listingEvent(f)]),[header()]);const keys=[];
  await assert.rejects(()=>f.projection.deliverOutbox(async value=>{keys.push(value.idempotencyKey);throw new Error('timeout after send');}));
  await f.projection.deliverOutbox(async value=>keys.push(value.idempotencyKey));assert.equal(keys[0],keys[1]);assert.equal(f.db.get('SELECT attempts FROM projection_outbox').attempts,2);
});
test('delivered nonfinal events are retracted and a returning fork receives a new delivery generation',async t=>{
  const f=setup();t.after(()=>f.close());const first=listingEvent(f),replacement=listingEvent(f,{blockHash:b32(101),revision:'2'}),messages=[];
  await f.projection.ingest(batch([first]),[header()]);await f.projection.deliverOutbox(async value=>messages.push(value));
  await f.projection.ingest(batch([replacement]),[header(1,b32(101))]);await f.projection.deliverOutbox(async value=>messages.push(value));
  assert.deepEqual(messages.map(x=>x.operation),['projection_changed','projection_retracted','projection_changed']);
  await f.projection.ingest(batch([first]),[header()]);await f.projection.deliverOutbox(async value=>messages.push(value));assert.equal(messages.length,5);assert.equal(messages[4].operation,'projection_changed');assert.notEqual(messages[0].idempotencyKey,messages[4].idempotencyKey);
});
test('bounded randomized duplicate replay/reorg sequence converges to the canonical branch',async t=>{
  const f=setup();t.after(()=>f.close());let value=17;
  for(let n=0;n<100;n++){value=(value*48271)%2147483647;const hash=b32(1000+n),e=listingEvent(f,{blockHash:hash,revision:String(n+1)});await f.projection.ingest(batch([e]),[header(1,hash)]);for(let k=0;k<value%3;k++)await f.projection.ingest(batch([e]),[header(1,hash)]);assert.equal(f.db.get('SELECT COUNT(*) AS n FROM event_inbox WHERE canonical=1').n,1);assert.equal(JSON.parse(f.db.get('SELECT payload FROM catalogue_projection').payload).revision,String(n+1));}
});
